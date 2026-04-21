"""
Tests for /inquiries endpoints.
- POST /inquiries/       — public, no auth
- GET /inquiries/        — coach only
- PATCH /inquiries/{id}/read — coach only
- DELETE /inquiries/{id} — coach only
- DELETE /inquiries/     — coach only (bulk)
"""

from tests.conftest import auth_patch, make_coach_token, make_member_token

COACH_EMAIL = "coach@test.com"
COACH_TOKEN, COACH_DECODED = make_coach_token(COACH_EMAIL)

VALID_INQUIRY = {
    "first_name": "Jane",
    "last_name": "Smith",
    "child_name": "Tommy",
    "age": 10,
    "email": "jane@example.com",
    "phone": "555-1234",
    "hear_about_us": "instagram",
}


# ── POST /inquiries/ ──────────────────────────────────────────────────────────

def test_create_inquiry_success(client):
    response = client.post("/inquiries/", json=VALID_INQUIRY)
    assert response.status_code == 201
    data = response.json()
    assert data["first_name"] == "Jane"
    assert data["child_name"] == "Tommy"
    assert data["read"] is False


def test_create_inquiry_invalid_email(client):
    payload = {**VALID_INQUIRY, "email": "not-an-email"}
    response = client.post("/inquiries/", json=payload)
    assert response.status_code == 422


def test_create_inquiry_missing_required_field(client):
    payload = {k: v for k, v in VALID_INQUIRY.items() if k != "first_name"}
    response = client.post("/inquiries/", json=payload)
    assert response.status_code == 422


def test_create_inquiry_strips_whitespace(client):
    payload = {**VALID_INQUIRY, "first_name": "  Alice  ", "last_name": "  Brown  "}
    response = client.post("/inquiries/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["first_name"] == "Alice"
    assert data["last_name"] == "Brown"


def test_create_inquiry_optional_hear_about_us(client):
    payload = {k: v for k, v in VALID_INQUIRY.items() if k != "hear_about_us"}
    response = client.post("/inquiries/", json=payload)
    assert response.status_code == 201
    assert response.json()["hear_about_us"] is None


# ── GET /inquiries/ ───────────────────────────────────────────────────────────

def test_list_inquiries_requires_auth(client):
    response = client.get("/inquiries/")
    assert response.status_code in (401, 403)


def test_list_inquiries_coach_can_access(client, coach_user):
    client.post("/inquiries/", json=VALID_INQUIRY)
    with auth_patch(COACH_DECODED):
        response = client.get("/inquiries/", headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_list_inquiries_returns_two_records(client, coach_user):
    client.post("/inquiries/", json={**VALID_INQUIRY, "email": "a@a.com"})
    client.post("/inquiries/", json={**VALID_INQUIRY, "email": "b@b.com"})
    with auth_patch(COACH_DECODED):
        response = client.get("/inquiries/", headers={"Authorization": COACH_TOKEN})
    data = response.json()
    assert len(data) == 2
    emails = {d["email"] for d in data}
    assert emails == {"a@a.com", "b@b.com"}


def test_list_inquiries_member_forbidden(client, member_user):
    _, MEMBER_DECODED = make_member_token()
    with auth_patch(MEMBER_DECODED):
        response = client.get("/inquiries/", headers={"Authorization": "Bearer member-tok"})
    assert response.status_code in (401, 403)


# ── PATCH /inquiries/{id}/read ────────────────────────────────────────────────

def test_mark_read(client, coach_user):
    create_resp = client.post("/inquiries/", json=VALID_INQUIRY)
    inquiry_id = create_resp.json()["id"]
    assert create_resp.json()["read"] is False

    with auth_patch(COACH_DECODED):
        response = client.patch(
            f"/inquiries/{inquiry_id}/read",
            headers={"Authorization": COACH_TOKEN},
        )
    assert response.status_code == 200
    assert response.json()["read"] is True


def test_mark_read_not_found(client, coach_user):
    fake_id = "00000000-0000-0000-0000-000000000000"
    with auth_patch(COACH_DECODED):
        response = client.patch(
            f"/inquiries/{fake_id}/read",
            headers={"Authorization": COACH_TOKEN},
        )
    assert response.status_code == 404


# ── DELETE /inquiries/{id} ────────────────────────────────────────────────────

def test_delete_single_inquiry(client, coach_user):
    create_resp = client.post("/inquiries/", json=VALID_INQUIRY)
    inquiry_id = create_resp.json()["id"]

    with auth_patch(COACH_DECODED):
        del_resp = client.delete(
            f"/inquiries/{inquiry_id}",
            headers={"Authorization": COACH_TOKEN},
        )
    assert del_resp.status_code == 204

    with auth_patch(COACH_DECODED):
        list_resp = client.get("/inquiries/", headers={"Authorization": COACH_TOKEN})
    assert list_resp.json() == []


def test_delete_single_inquiry_not_found(client, coach_user):
    fake_id = "00000000-0000-0000-0000-000000000000"
    with auth_patch(COACH_DECODED):
        response = client.delete(
            f"/inquiries/{fake_id}",
            headers={"Authorization": COACH_TOKEN},
        )
    assert response.status_code == 404


# ── DELETE /inquiries/ (bulk) ─────────────────────────────────────────────────

def test_clear_all_inquiries(client, coach_user):
    client.post("/inquiries/", json={**VALID_INQUIRY, "email": "a@a.com"})
    client.post("/inquiries/", json={**VALID_INQUIRY, "email": "b@b.com"})

    with auth_patch(COACH_DECODED):
        del_resp = client.delete("/inquiries/", headers={"Authorization": COACH_TOKEN})
    assert del_resp.status_code == 204

    with auth_patch(COACH_DECODED):
        list_resp = client.get("/inquiries/", headers={"Authorization": COACH_TOKEN})
    assert list_resp.json() == []


def test_clear_all_empty_is_no_op(client, coach_user):
    with auth_patch(COACH_DECODED):
        response = client.delete("/inquiries/", headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 204
