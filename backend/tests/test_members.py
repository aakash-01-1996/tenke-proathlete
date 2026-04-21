"""
Tests for /members endpoints.
Firebase calls are mocked. DB uses SQLite via ORM.
"""

import uuid
from unittest.mock import patch, MagicMock
from tests.conftest import auth_patch, make_coach_token, make_trainer_token, make_member_token
from db.models import Member, User, UserRole

COACH_TOKEN, COACH_DECODED = make_coach_token("coach@test.com")
TRAINER_TOKEN, TRAINER_DECODED = make_trainer_token("trainer@test.com")
MEMBER_TOKEN, MEMBER_DECODED = make_member_token("member@test.com")

NEW_MEMBER = {
    "first_name": "Alex",
    "last_name": "Turner",
    "email": "alex@test.com",
    "phone": "555-1111",
    "age": 20,
    "weight": "180",
    "height": "6'0\"",
    "trainer_id": None,
    "package": "Basic",
    "sessions_total": 10,
    "sessions_left": 10,
    "training_days": ["M", "W", "F"],
}


def _firebase_create_ok():
    """Patch firebase member creation to succeed silently."""
    mock_fb = MagicMock()
    mock_fb.uid = "firebase-uid-123"
    return patch("firebase_admin.auth.create_user", return_value=mock_fb)


def _firebase_create_exists():
    """Patch firebase to raise EmailAlreadyExistsError."""
    import firebase_admin.auth as fa
    return patch("firebase_admin.auth.create_user", side_effect=fa.EmailAlreadyExistsError("", "", None))


def _firebase_get_delete():
    """Patch get_user_by_email + delete_user for cleanup."""
    mock_user = MagicMock()
    mock_user.uid = "uid-123"
    return (
        patch("firebase_admin.auth.get_user_by_email", return_value=mock_user),
        patch("firebase_admin.auth.delete_user", return_value=None),
    )


# ── POST /members ─────────────────────────────────────────────────────────────

def test_create_member_coach(client, coach_user):
    with auth_patch(COACH_DECODED), _firebase_create_ok():
        response = client.post("/members", json=NEW_MEMBER, headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 201
    data = response.json()
    assert data["first_name"] == "Alex"
    assert data["email"] == "alex@test.com"
    assert "temp_password" in data


def test_create_member_trainer_allowed(client, trainer_user):
    """Trainers can create members (require_coach_or_trainer)."""
    with auth_patch(TRAINER_DECODED), _firebase_create_ok():
        response = client.post("/members", json=NEW_MEMBER, headers={"Authorization": TRAINER_TOKEN})
    assert response.status_code == 201


def test_create_member_missing_required_fields(client, coach_user):
    with auth_patch(COACH_DECODED):
        response = client.post("/members", json={"first_name": "Alex"}, headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 422


def test_create_member_duplicate_email(client, coach_user):
    with auth_patch(COACH_DECODED), _firebase_create_ok():
        r1 = client.post("/members", json=NEW_MEMBER, headers={"Authorization": COACH_TOKEN})
    assert r1.status_code == 201
    # Second attempt: DB already has the email → 409 before Firebase call
    with auth_patch(COACH_DECODED), _firebase_create_ok():
        response = client.post("/members", json=NEW_MEMBER, headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 409


# ── GET /members ──────────────────────────────────────────────────────────────

def test_list_members_coach(client, coach_user, db):
    # Add member directly via ORM — no Firebase call needed for GET
    member = Member(
        display_id=1, first_name="Alex", last_name="Turner",
        email="alex@test.com",
    )
    db.add(member)
    db.commit()
    with auth_patch(COACH_DECODED):
        response = client.get("/members", headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["first_name"] == "Alex"


def test_list_members_trainer(client, trainer_user):
    with auth_patch(TRAINER_DECODED):
        response = client.get("/members", headers={"Authorization": TRAINER_TOKEN})
    assert response.status_code == 200


def test_list_members_member_forbidden(client, member_user):
    with auth_patch(MEMBER_DECODED):
        response = client.get("/members", headers={"Authorization": MEMBER_TOKEN})
    assert response.status_code == 403


# ── GET /members/me ───────────────────────────────────────────────────────────

def test_get_me_member(client, db):
    member_id = uuid.uuid4()
    member = Member(
        id=member_id, display_id=1,
        first_name="John", last_name="Doe", email="member@test.com",
    )
    user = User(email="member@test.com", role=UserRole.member, ref_id=member_id)
    db.add(member)
    db.add(user)
    db.commit()
    with auth_patch(MEMBER_DECODED):
        response = client.get("/members/me", headers={"Authorization": MEMBER_TOKEN})
    assert response.status_code == 200
    assert response.json()["email"] == "member@test.com"


def test_get_me_coach_forbidden(client, coach_user):
    with auth_patch(COACH_DECODED):
        response = client.get("/members/me", headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 403


# ── DELETE /members/{id} ─────────────────────────────────────────────────────

def test_delete_member_coach(client, coach_user, db):
    member_id = uuid.uuid4()
    member = Member(id=member_id, display_id=1, first_name="To", last_name="Delete", email="del@test.com")
    db.add(member)
    db.commit()
    get_p, del_p = _firebase_get_delete()
    with auth_patch(COACH_DECODED), get_p, del_p:
        response = client.delete(f"/members/{member_id}", headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 204


def test_delete_member_not_found(client, coach_user):
    get_p, del_p = _firebase_get_delete()
    with auth_patch(COACH_DECODED), get_p, del_p:
        response = client.delete(
            "/members/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": COACH_TOKEN},
        )
    assert response.status_code == 404


def test_delete_member_trainer_returns_404_for_missing(client, trainer_user):
    """Trainers can delete members; 404 when member doesn't exist."""
    get_p, del_p = _firebase_get_delete()
    with auth_patch(TRAINER_DECODED), get_p, del_p:
        response = client.delete(
            "/members/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": TRAINER_TOKEN},
        )
    assert response.status_code == 404
