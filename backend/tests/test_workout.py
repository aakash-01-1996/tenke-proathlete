"""
Tests for workout endpoints:
  PATCH /members/{id}/goal
  GET   /workout/{member_id}
  POST  /workout/{member_id}
  PUT   /workout/{member_id}/{exercise_id}
  DELETE /workout/{member_id}/{exercise_id}
"""

from tests.conftest import auth_patch, make_coach_token, make_member_token
from db.models import Member

COACH_TOKEN, COACH_DECODED = make_coach_token()
MEMBER_TOKEN, MEMBER_DECODED = make_member_token()


# ── Helpers ───────────────────────────────────────────────────────────────────

def create_member(db) -> Member:
    m = Member(
        display_id=1,
        first_name="Test",
        last_name="Athlete",
        email="athlete@test.com",
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


VALID_EXERCISE = {
    "category": "upper",
    "name": "Bench Press",
    "sets": 3,
    "reps": 10,
}


# ── PATCH /members/{id}/goal ──────────────────────────────────────────────────

def test_update_goal_coach(client, db, coach_user):
    m = create_member(db)
    with auth_patch(COACH_DECODED):
        res = client.patch(
            f"/members/{m.id}/goal",
            json={"training_goal": "<b>Go pro</b>"},
            headers={"Authorization": COACH_TOKEN},
        )
    assert res.status_code == 200
    assert res.json()["training_goal"] == "<b>Go pro</b>"


def test_update_goal_member(client, db, member_user):
    m = create_member(db)
    with auth_patch(MEMBER_DECODED):
        res = client.patch(
            f"/members/{m.id}/goal",
            json={"training_goal": "Train hard 💪"},
            headers={"Authorization": MEMBER_TOKEN},
        )
    assert res.status_code == 200
    assert res.json()["training_goal"] == "Train hard 💪"


def test_clear_goal(client, db, coach_user):
    m = create_member(db)
    with auth_patch(COACH_DECODED):
        client.patch(f"/members/{m.id}/goal", json={"training_goal": "Some goal"}, headers={"Authorization": COACH_TOKEN})
        res = client.patch(f"/members/{m.id}/goal", json={"training_goal": None}, headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 200
    assert res.json()["training_goal"] is None


def test_update_goal_member_not_found(client, db, coach_user):
    fake_id = "00000000-0000-0000-0000-000000000000"
    with auth_patch(COACH_DECODED):
        res = client.patch(f"/members/{fake_id}/goal", json={"training_goal": "x"}, headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 404


# ── GET /workout/{member_id} ──────────────────────────────────────────────────

def test_list_exercises_empty(client, db, coach_user):
    m = create_member(db)
    with auth_patch(COACH_DECODED):
        res = client.get(f"/workout/{m.id}", headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 200
    assert res.json() == []


def test_list_exercises_returns_all(client, db, coach_user):
    m = create_member(db)
    with auth_patch(COACH_DECODED):
        client.post(f"/workout/{m.id}", json=VALID_EXERCISE, headers={"Authorization": COACH_TOKEN})
        client.post(f"/workout/{m.id}", json={**VALID_EXERCISE, "category": "lower", "name": "Squats"}, headers={"Authorization": COACH_TOKEN})
        res = client.get(f"/workout/{m.id}", headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 200
    assert len(res.json()) == 2


# ── POST /workout/{member_id} ─────────────────────────────────────────────────

def test_add_exercise_reps(client, db, coach_user):
    m = create_member(db)
    with auth_patch(COACH_DECODED):
        res = client.post(f"/workout/{m.id}", json=VALID_EXERCISE, headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Bench Press"
    assert data["sets"] == 3
    assert data["reps"] == 10
    assert data["duration"] is None
    assert data["category"] == "upper"


def test_add_exercise_duration(client, db, coach_user):
    m = create_member(db)
    payload = {"category": "core", "name": "Plank", "sets": 3, "duration": "30 sec"}
    with auth_patch(COACH_DECODED):
        res = client.post(f"/workout/{m.id}", json=payload, headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 201
    assert res.json()["duration"] == "30 sec"
    assert res.json()["reps"] is None


def test_add_exercise_invalid_category(client, db, coach_user):
    m = create_member(db)
    with auth_patch(COACH_DECODED):
        res = client.post(f"/workout/{m.id}", json={**VALID_EXERCISE, "category": "legs"}, headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 422


def test_add_exercise_both_reps_and_duration(client, db, coach_user):
    m = create_member(db)
    payload = {**VALID_EXERCISE, "duration": "30 sec"}
    with auth_patch(COACH_DECODED):
        res = client.post(f"/workout/{m.id}", json=payload, headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 422


def test_add_exercise_member_not_found(client, db, coach_user):
    fake_id = "00000000-0000-0000-0000-000000000000"
    with auth_patch(COACH_DECODED):
        res = client.post(f"/workout/{fake_id}", json=VALID_EXERCISE, headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 404


def test_add_exercise_member_can_add(client, db, member_user):
    m = create_member(db)
    with auth_patch(MEMBER_DECODED):
        res = client.post(f"/workout/{m.id}", json=VALID_EXERCISE, headers={"Authorization": MEMBER_TOKEN})
    assert res.status_code == 201


# ── PUT /workout/{member_id}/{exercise_id} ────────────────────────────────────

def test_update_exercise(client, db, coach_user):
    m = create_member(db)
    with auth_patch(COACH_DECODED):
        ex = client.post(f"/workout/{m.id}", json=VALID_EXERCISE, headers={"Authorization": COACH_TOKEN}).json()
        res = client.put(
            f"/workout/{m.id}/{ex['id']}",
            json={**VALID_EXERCISE, "name": "Incline Press", "sets": 4, "reps": 8},
            headers={"Authorization": COACH_TOKEN},
        )
    assert res.status_code == 200
    assert res.json()["name"] == "Incline Press"
    assert res.json()["sets"] == 4


def test_update_exercise_not_found(client, db, coach_user):
    m = create_member(db)
    fake_id = "00000000-0000-0000-0000-000000000000"
    with auth_patch(COACH_DECODED):
        res = client.put(f"/workout/{m.id}/{fake_id}", json=VALID_EXERCISE, headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 404


# ── DELETE /workout/{member_id}/{exercise_id} ─────────────────────────────────

def test_delete_exercise(client, db, coach_user):
    m = create_member(db)
    with auth_patch(COACH_DECODED):
        ex = client.post(f"/workout/{m.id}", json=VALID_EXERCISE, headers={"Authorization": COACH_TOKEN}).json()
        del_res = client.delete(f"/workout/{m.id}/{ex['id']}", headers={"Authorization": COACH_TOKEN})
        list_res = client.get(f"/workout/{m.id}", headers={"Authorization": COACH_TOKEN})
    assert del_res.status_code == 204
    assert list_res.json() == []


def test_delete_exercise_not_found(client, db, coach_user):
    m = create_member(db)
    fake_id = "00000000-0000-0000-0000-000000000000"
    with auth_patch(COACH_DECODED):
        res = client.delete(f"/workout/{m.id}/{fake_id}", headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 404


def test_delete_exercise_member_can_delete(client, db, coach_user, member_user):
    m = create_member(db)
    with auth_patch(COACH_DECODED):
        ex = client.post(f"/workout/{m.id}", json=VALID_EXERCISE, headers={"Authorization": COACH_TOKEN}).json()
    with auth_patch(MEMBER_DECODED):
        res = client.delete(f"/workout/{m.id}/{ex['id']}", headers={"Authorization": MEMBER_TOKEN})
    assert res.status_code == 204
