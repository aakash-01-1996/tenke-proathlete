"""
Tests for /gameplan endpoints.
- GET /gameplan/       — any authenticated user
- POST /gameplan/      — coach only
- DELETE /gameplan/{id} — coach only
"""

from unittest.mock import patch, MagicMock
from tests.conftest import auth_patch, make_coach_token, make_member_token, make_trainer_token

COACH_TOKEN, COACH_DECODED = make_coach_token("coach@test.com")
MEMBER_TOKEN, MEMBER_DECODED = make_member_token("member@test.com")
TRAINER_TOKEN, TRAINER_DECODED = make_trainer_token("trainer@test.com")

PDF_PAYLOAD = {
    "title": "Sprint Drills Guide",
    "category": "Training",
    "description": "Weekly sprint protocol",
    "file_url": "https://res.cloudinary.com/demo/raw/upload/sprint.pdf",
    "cloudinary_public_id": "sprint",
}


def _mock_cloudinary():
    mock_uploader = MagicMock()
    mock_uploader.destroy.return_value = {"result": "ok"}
    return patch("cloudinary.uploader.destroy", mock_uploader.destroy)


# ── GET /gameplan/ ────────────────────────────────────────────────────────────

def test_list_pdfs_empty(client, coach_user):
    with auth_patch(COACH_DECODED):
        response = client.get("/gameplan/", headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 200
    assert response.json() == []


def test_list_pdfs_requires_auth(client):
    response = client.get("/gameplan/")
    assert response.status_code in (401, 403)


def test_list_pdfs_member_can_access(client, member_user):
    with auth_patch(MEMBER_DECODED):
        response = client.get("/gameplan/", headers={"Authorization": MEMBER_TOKEN})
    assert response.status_code == 200


# ── POST /gameplan/ ───────────────────────────────────────────────────────────

def test_create_pdf_coach(client, coach_user):
    with auth_patch(COACH_DECODED):
        response = client.post("/gameplan/", json=PDF_PAYLOAD, headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Sprint Drills Guide"
    assert data["category"] == "Training"


def test_create_pdf_member_forbidden(client, member_user):
    with auth_patch(MEMBER_DECODED):
        response = client.post("/gameplan/", json=PDF_PAYLOAD, headers={"Authorization": MEMBER_TOKEN})
    assert response.status_code in (401, 403)


def test_create_pdf_appears_in_list(client, coach_user):
    with auth_patch(COACH_DECODED):
        client.post("/gameplan/", json=PDF_PAYLOAD, headers={"Authorization": COACH_TOKEN})
        list_resp = client.get("/gameplan/", headers={"Authorization": COACH_TOKEN})
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["title"] == "Sprint Drills Guide"


def test_create_pdf_missing_title(client, coach_user):
    payload = {k: v for k, v in PDF_PAYLOAD.items() if k != "title"}
    with auth_patch(COACH_DECODED):
        response = client.post("/gameplan/", json=payload, headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 422


# ── DELETE /gameplan/{id} ─────────────────────────────────────────────────────

def test_delete_pdf_coach(client, coach_user):
    with auth_patch(COACH_DECODED), _mock_cloudinary():
        create = client.post("/gameplan/", json=PDF_PAYLOAD, headers={"Authorization": COACH_TOKEN})
        pdf_id = create.json()["id"]
        del_resp = client.delete(f"/gameplan/{pdf_id}", headers={"Authorization": COACH_TOKEN})
    assert del_resp.status_code == 204


def test_delete_pdf_not_found(client, coach_user):
    with auth_patch(COACH_DECODED), _mock_cloudinary():
        response = client.delete(
            "/gameplan/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": COACH_TOKEN},
        )
    assert response.status_code == 404


def test_delete_pdf_member_forbidden(client, member_user):
    with auth_patch(MEMBER_DECODED):
        response = client.delete(
            "/gameplan/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": MEMBER_TOKEN},
        )
    assert response.status_code in (401, 403)
