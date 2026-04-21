"""
Tests for /day-change-requests endpoints.
- POST /day-change-requests         — member only
- GET /day-change-requests          — coach or trainer
- POST /day-change-requests/{id}/approve — coach only
- POST /day-change-requests/{id}/deny   — coach only
"""

import uuid
from db.models import Member, User, UserRole
from tests.conftest import auth_patch, make_coach_token, make_member_token, make_trainer_token

COACH_TOKEN, COACH_DECODED = make_coach_token("coach@test.com")
MEMBER_TOKEN, MEMBER_DECODED = make_member_token("member@test.com")
TRAINER_TOKEN, TRAINER_DECODED = make_trainer_token("trainer@test.com")

REQUEST_PAYLOAD = {
    "requested_days": ["T", "Th", "Sa"],
    "note": "My schedule changed",
}


def _create_member_with_user(db) -> tuple:
    member_id = uuid.uuid4()
    member = Member(id=member_id, display_id=99, first_name="Test", last_name="Member", email="member@test.com")
    user = User(email="member@test.com", role=UserRole.member, ref_id=member_id)
    db.add(member)
    db.add(user)
    db.commit()
    return member, user


# ── POST /day-change-requests ─────────────────────────────────────────────────

def test_member_can_submit_request(client, db):
    _create_member_with_user(db)
    with auth_patch(MEMBER_DECODED):
        response = client.post(
            "/day-change-requests",
            json=REQUEST_PAYLOAD,
            headers={"Authorization": MEMBER_TOKEN},
        )
    assert response.status_code == 201
    data = response.json()
    assert data["requested_days"] == ["T", "Th", "Sa"]
    assert data["status"] == "pending"


def test_coach_cannot_submit_request(client, coach_user):
    with auth_patch(COACH_DECODED):
        response = client.post(
            "/day-change-requests",
            json=REQUEST_PAYLOAD,
            headers={"Authorization": COACH_TOKEN},
        )
    assert response.status_code == 403


# ── GET /day-change-requests ──────────────────────────────────────────────────

def test_coach_can_list_requests(client, coach_user):
    with auth_patch(COACH_DECODED):
        response = client.get("/day-change-requests", headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 200


def test_trainer_can_list_requests(client, trainer_user):
    with auth_patch(TRAINER_DECODED):
        response = client.get("/day-change-requests", headers={"Authorization": TRAINER_TOKEN})
    assert response.status_code == 200


def test_member_cannot_list_requests(client, db):
    _create_member_with_user(db)
    with auth_patch(MEMBER_DECODED):
        response = client.get("/day-change-requests", headers={"Authorization": MEMBER_TOKEN})
    assert response.status_code == 403


# ── Approve / Deny ────────────────────────────────────────────────────────────

def test_coach_approves_request(client, db, coach_user):
    _create_member_with_user(db)
    with auth_patch(MEMBER_DECODED):
        create = client.post("/day-change-requests", json=REQUEST_PAYLOAD, headers={"Authorization": MEMBER_TOKEN})
    req_id = create.json()["id"]

    with auth_patch(COACH_DECODED):
        approve = client.post(
            f"/day-change-requests/{req_id}/approve",
            headers={"Authorization": COACH_TOKEN},
        )
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"


def test_coach_denies_request(client, db, coach_user):
    _create_member_with_user(db)
    with auth_patch(MEMBER_DECODED):
        create = client.post("/day-change-requests", json=REQUEST_PAYLOAD, headers={"Authorization": MEMBER_TOKEN})
    req_id = create.json()["id"]

    with auth_patch(COACH_DECODED):
        deny = client.post(
            f"/day-change-requests/{req_id}/deny",
            headers={"Authorization": COACH_TOKEN},
        )
    assert deny.status_code == 200
    assert deny.json()["status"] == "denied"


def test_approve_nonexistent_request(client, coach_user):
    with auth_patch(COACH_DECODED):
        response = client.post(
            "/day-change-requests/00000000-0000-0000-0000-000000000000/approve",
            headers={"Authorization": COACH_TOKEN},
        )
    assert response.status_code == 404


def test_trainer_can_approve(client, db, trainer_user):
    """Trainers are allowed to approve day-change requests (require_coach_or_trainer)."""
    _create_member_with_user(db)
    with auth_patch(MEMBER_DECODED):
        create = client.post("/day-change-requests", json=REQUEST_PAYLOAD, headers={"Authorization": MEMBER_TOKEN})
    req_id = create.json()["id"]

    with auth_patch(TRAINER_DECODED):
        response = client.post(
            f"/day-change-requests/{req_id}/approve",
            headers={"Authorization": TRAINER_TOKEN},
        )
    assert response.status_code == 200
    assert response.json()["status"] == "approved"
