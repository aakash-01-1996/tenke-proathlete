"""
Tests for /community endpoints.
- GET /community/
- POST /community/
- DELETE /community/{id}
- POST /community/{id}/comments
- DELETE /community/{id}/comments/{comment_id}
"""

from tests.conftest import auth_patch, make_coach_token, make_member_token

COACH_EMAIL = "coach@test.com"
COACH_TOKEN, COACH_DECODED = make_coach_token(COACH_EMAIL)
MEMBER_EMAIL = "member@test.com"
MEMBER_TOKEN, MEMBER_DECODED = make_member_token(MEMBER_EMAIL)

POST_PAYLOAD = {
    "content": "Great session today!",
    "image_url": None,
}


# ── GET /community/ ───────────────────────────────────────────────────────────

def test_list_posts_requires_auth(client):
    response = client.get("/community/")
    assert response.status_code in (401, 403)


def test_list_posts_empty(client, coach_user):
    with auth_patch(COACH_DECODED):
        response = client.get("/community/", headers={"Authorization": COACH_TOKEN})
    assert response.status_code == 200
    assert response.json() == []


# ── POST /community/ ──────────────────────────────────────────────────────────

def test_create_post_coach(client, coach_user):
    with auth_patch(COACH_DECODED):
        response = client.post(
            "/community/",
            json=POST_PAYLOAD,
            headers={"Authorization": COACH_TOKEN},
        )
    assert response.status_code == 201
    data = response.json()
    assert data["content"] == "Great session today!"
    assert data["author_email"] == COACH_EMAIL
    assert data["comments"] == []


def test_create_post_member(client, member_user):
    with auth_patch(MEMBER_DECODED):
        response = client.post(
            "/community/",
            json=POST_PAYLOAD,
            headers={"Authorization": MEMBER_TOKEN},
        )
    assert response.status_code == 201


def test_create_post_no_auth(client):
    response = client.post("/community/", json=POST_PAYLOAD)
    assert response.status_code in (401, 403)


def test_post_appears_in_list(client, coach_user):
    with auth_patch(COACH_DECODED):
        client.post("/community/", json=POST_PAYLOAD, headers={"Authorization": COACH_TOKEN})
        list_resp = client.get("/community/", headers={"Authorization": COACH_TOKEN})
    assert len(list_resp.json()) == 1


# ── DELETE /community/{id} ────────────────────────────────────────────────────

def test_delete_own_post(client, coach_user):
    with auth_patch(COACH_DECODED):
        create = client.post("/community/", json=POST_PAYLOAD, headers={"Authorization": COACH_TOKEN})
        post_id = create.json()["id"]
        del_resp = client.delete(f"/community/{post_id}", headers={"Authorization": COACH_TOKEN})
    assert del_resp.status_code == 204


def test_delete_post_not_found(client, coach_user):
    with auth_patch(COACH_DECODED):
        response = client.delete(
            "/community/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": COACH_TOKEN},
        )
    assert response.status_code == 404


def test_member_cannot_delete_others_post(client, coach_user, member_user):
    # Coach creates post
    with auth_patch(COACH_DECODED):
        create = client.post("/community/", json=POST_PAYLOAD, headers={"Authorization": COACH_TOKEN})
    post_id = create.json()["id"]

    # Member tries to delete it
    with auth_patch(MEMBER_DECODED):
        response = client.delete(f"/community/{post_id}", headers={"Authorization": MEMBER_TOKEN})
    assert response.status_code in (401, 403)


# ── POST /community/{id}/comments ─────────────────────────────────────────────

def test_add_comment(client, coach_user, member_user):
    with auth_patch(COACH_DECODED):
        post = client.post("/community/", json=POST_PAYLOAD, headers={"Authorization": COACH_TOKEN})
    post_id = post.json()["id"]

    with auth_patch(MEMBER_DECODED):
        comment = client.post(
            f"/community/{post_id}/comments",
            json={"content": "Great post!"},
            headers={"Authorization": MEMBER_TOKEN},
        )
    assert comment.status_code == 201
    assert comment.json()["content"] == "Great post!"


def test_comment_appears_in_post_list(client, coach_user, member_user):
    with auth_patch(COACH_DECODED):
        post = client.post("/community/", json=POST_PAYLOAD, headers={"Authorization": COACH_TOKEN})
    post_id = post.json()["id"]

    with auth_patch(MEMBER_DECODED):
        client.post(f"/community/{post_id}/comments", json={"content": "Nice!"}, headers={"Authorization": MEMBER_TOKEN})

    with auth_patch(COACH_DECODED):
        posts = client.get("/community/", headers={"Authorization": COACH_TOKEN})

    post_data = next(p for p in posts.json() if p["id"] == post_id)
    assert len(post_data["comments"]) == 1
    assert post_data["comments"][0]["content"] == "Nice!"


def test_add_comment_to_nonexistent_post(client, coach_user):
    with auth_patch(COACH_DECODED):
        response = client.post(
            "/community/00000000-0000-0000-0000-000000000000/comments",
            json={"content": "Hi"},
            headers={"Authorization": COACH_TOKEN},
        )
    assert response.status_code == 404


# ── DELETE /community/{id}/comments/{comment_id} ─────────────────────────────

def test_delete_own_comment(client, coach_user, member_user):
    with auth_patch(COACH_DECODED):
        post = client.post("/community/", json=POST_PAYLOAD, headers={"Authorization": COACH_TOKEN})
    post_id = post.json()["id"]

    with auth_patch(MEMBER_DECODED):
        comment = client.post(f"/community/{post_id}/comments", json={"content": "Hi"}, headers={"Authorization": MEMBER_TOKEN})
    comment_id = comment.json()["id"]

    with auth_patch(MEMBER_DECODED):
        del_resp = client.delete(f"/community/{post_id}/comments/{comment_id}", headers={"Authorization": MEMBER_TOKEN})
    assert del_resp.status_code == 204


def test_coach_can_delete_any_comment(client, coach_user, member_user):
    with auth_patch(COACH_DECODED):
        post = client.post("/community/", json=POST_PAYLOAD, headers={"Authorization": COACH_TOKEN})
    post_id = post.json()["id"]

    with auth_patch(MEMBER_DECODED):
        comment = client.post(f"/community/{post_id}/comments", json={"content": "Hi"}, headers={"Authorization": MEMBER_TOKEN})
    comment_id = comment.json()["id"]

    with auth_patch(COACH_DECODED):
        del_resp = client.delete(f"/community/{post_id}/comments/{comment_id}", headers={"Authorization": COACH_TOKEN})
    assert del_resp.status_code == 204
