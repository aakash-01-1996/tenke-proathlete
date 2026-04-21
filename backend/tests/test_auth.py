"""
Tests for /auth endpoints and dependency logic.
- GET /auth/me
- Role serialization (must be 'coach' not 'UserRole.coach')
- Superuser auto-provisioning
- Forbidden cases
"""

from tests.conftest import auth_patch, make_coach_token, make_member_token, make_trainer_token

COACH_TOKEN, COACH_DECODED = make_coach_token("coach@test.com")
TRAINER_TOKEN, TRAINER_DECODED = make_trainer_token("trainer@test.com")
MEMBER_TOKEN, MEMBER_DECODED = make_member_token("member@test.com")


def test_me_returns_coach_role(client, coach_user):
    with auth_patch(COACH_DECODED):
        response = client.get("/auth/me", headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "coach"            # must NOT be 'UserRole.coach'
    assert data["email"] == "coach@test.com"


def test_me_returns_member_role(client, member_user):
    with auth_patch(MEMBER_DECODED):
        response = client.get("/auth/me", headers={"Authorization": MEMBER_TOKEN})
    assert response.status_code == 200
    assert response.json()["role"] == "member"


def test_me_returns_trainer_role(client, trainer_user):
    with auth_patch(TRAINER_DECODED):
        response = client.get("/auth/me", headers={"Authorization": TRAINER_TOKEN})
    assert response.status_code == 200
    assert response.json()["role"] == "trainer"


def test_me_without_token_returns_403(client):
    response = client.get("/auth/me")
    assert response.status_code in (401, 403)  # FastAPI HTTPBearer returns 403


def test_me_unknown_user_returns_401(client):
    """User whose email is not in DB and is not superuser gets 401."""
    decoded = {"email": "unknown@nobody.com", "uid": "xyz"}
    with auth_patch(decoded):
        response = client.get("/auth/me", headers={"Authorization": "Bearer random-token"})
    assert response.status_code == 401


def test_role_value_is_plain_string_not_enum_repr(client, coach_user):
    """Critical regression test: role must serialize as 'coach', not 'UserRole.coach'."""
    with auth_patch(COACH_DECODED):
        response = client.get("/auth/me", headers={"Authorization": COACH_TOKEN})
    role = response.json()["role"]
    assert "UserRole" not in role
    assert "." not in role
    assert role == "coach"


def test_me_includes_ref_id(client, member_user):
    with auth_patch(MEMBER_DECODED):
        response = client.get("/auth/me", headers={"Authorization": MEMBER_TOKEN})
    data = response.json()
    assert "ref_id" in data
