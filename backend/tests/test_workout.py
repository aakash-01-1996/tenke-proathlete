"""
Tests for workout endpoints (day-based structure):
  PATCH  /members/{id}/goal
  GET    /workout/{member_id}/days
  POST   /workout/{member_id}/days
  PATCH  /workout/{member_id}/days/{day_id}
  DELETE /workout/{member_id}/days/{day_id}
  POST   /workout/{member_id}/days/{day_id}/exercises
  PUT    /workout/{member_id}/days/{day_id}/exercises/{exercise_id}
  DELETE /workout/{member_id}/days/{day_id}/exercises/{exercise_id}
  GET    /workout/{member_id}/{exercise_id}/logs
  POST   /workout/{member_id}/{exercise_id}/logs
  DELETE /workout/{member_id}/{exercise_id}/logs/{log_id}
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


def create_day(client, member_id, label="Upper Body"):
    with auth_patch(COACH_DECODED):
        res = client.post(
            f"/workout/{member_id}/days",
            json={"label": label},
            headers={"Authorization": COACH_TOKEN},
        )
    assert res.status_code == 201
    return res.json()


def create_exercise(client, member_id, day_id, name="Bench Press"):
    with auth_patch(COACH_DECODED):
        res = client.post(
            f"/workout/{member_id}/days/{day_id}/exercises",
            json={"name": name, "sets": 3, "reps": 10},
            headers={"Authorization": COACH_TOKEN},
        )
    assert res.status_code == 201
    return res.json()


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
            json={"training_goal": "Train hard"},
            headers={"Authorization": MEMBER_TOKEN},
        )
    assert res.status_code == 200
    assert res.json()["training_goal"] == "Train hard"


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


# ── GET /workout/{member_id}/days ─────────────────────────────────────────────

def test_list_days_empty(client, db, coach_user):
    m = create_member(db)
    with auth_patch(COACH_DECODED):
        res = client.get(f"/workout/{m.id}/days", headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 200
    assert res.json() == []


def test_list_days_returns_ordered(client, db, coach_user):
    m = create_member(db)
    create_day(client, m.id, "Upper Body")
    create_day(client, m.id, "Lower Body")
    with auth_patch(COACH_DECODED):
        res = client.get(f"/workout/{m.id}/days", headers={"Authorization": COACH_TOKEN})
    data = res.json()
    assert len(data) == 2
    assert data[0]["day_number"] == 1
    assert data[1]["day_number"] == 2


def test_list_days_member_not_found(client, db, coach_user):
    fake_id = "00000000-0000-0000-0000-000000000000"
    with auth_patch(COACH_DECODED):
        res = client.get(f"/workout/{fake_id}/days", headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 404


# ── POST /workout/{member_id}/days ────────────────────────────────────────────

def test_add_day(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id, "Upper Body")
    assert day["label"] == "Upper Body"
    assert day["day_number"] == 1
    assert day["exercises"] == []


def test_add_day_auto_increments(client, db, coach_user):
    m = create_member(db)
    d1 = create_day(client, m.id, "Upper Body")
    d2 = create_day(client, m.id, "Lower Body")
    assert d1["day_number"] == 1
    assert d2["day_number"] == 2


def test_add_day_member_forbidden(client, db, member_user):
    m = create_member(db)
    with auth_patch(MEMBER_DECODED):
        res = client.post(f"/workout/{m.id}/days", json={"label": "Day"}, headers={"Authorization": MEMBER_TOKEN})
    assert res.status_code == 403


def test_add_day_member_not_found(client, db, coach_user):
    fake_id = "00000000-0000-0000-0000-000000000000"
    with auth_patch(COACH_DECODED):
        res = client.post(f"/workout/{fake_id}/days", json={"label": "Day"}, headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 404


# ── PATCH /workout/{member_id}/days/{day_id} ─────────────────────────────────

def test_rename_day(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id, "Upper Body")
    with auth_patch(COACH_DECODED):
        res = client.patch(
            f"/workout/{m.id}/days/{day['id']}",
            json={"label": "Push Day"},
            headers={"Authorization": COACH_TOKEN},
        )
    assert res.status_code == 200
    assert res.json()["label"] == "Push Day"


def test_rename_day_empty_label(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    with auth_patch(COACH_DECODED):
        res = client.patch(
            f"/workout/{m.id}/days/{day['id']}",
            json={"label": "   "},
            headers={"Authorization": COACH_TOKEN},
        )
    assert res.status_code == 422


def test_rename_day_member_forbidden(client, db, coach_user, member_user):
    m = create_member(db)
    day = create_day(client, m.id)
    with auth_patch(MEMBER_DECODED):
        res = client.patch(
            f"/workout/{m.id}/days/{day['id']}",
            json={"label": "Push"},
            headers={"Authorization": MEMBER_TOKEN},
        )
    assert res.status_code == 403


# ── DELETE /workout/{member_id}/days/{day_id} ────────────────────────────────

def test_delete_day(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    with auth_patch(COACH_DECODED):
        del_res = client.delete(f"/workout/{m.id}/days/{day['id']}", headers={"Authorization": COACH_TOKEN})
        list_res = client.get(f"/workout/{m.id}/days", headers={"Authorization": COACH_TOKEN})
    assert del_res.status_code == 204
    assert list_res.json() == []


def test_delete_day_cascades_exercises(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    ex = create_exercise(client, m.id, day["id"])
    with auth_patch(COACH_DECODED):
        client.delete(f"/workout/{m.id}/days/{day['id']}", headers={"Authorization": COACH_TOKEN})
        # Exercise should be gone
        logs_res = client.get(f"/workout/{m.id}/{ex['id']}/logs", headers={"Authorization": COACH_TOKEN})
    assert logs_res.status_code == 404


def test_delete_day_not_found(client, db, coach_user):
    m = create_member(db)
    fake_id = "00000000-0000-0000-0000-000000000000"
    with auth_patch(COACH_DECODED):
        res = client.delete(f"/workout/{m.id}/days/{fake_id}", headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 404


# ── POST /workout/{member_id}/days/{day_id}/exercises ────────────────────────

def test_add_exercise_reps(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    ex = create_exercise(client, m.id, day["id"])
    assert ex["name"] == "Bench Press"
    assert ex["sets"] == 3
    assert ex["reps"] == 10
    assert ex["duration"] is None


def test_add_exercise_duration(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    with auth_patch(COACH_DECODED):
        res = client.post(
            f"/workout/{m.id}/days/{day['id']}/exercises",
            json={"name": "Plank", "sets": 3, "duration": "30 sec"},
            headers={"Authorization": COACH_TOKEN},
        )
    assert res.status_code == 201
    assert res.json()["duration"] == "30 sec"
    assert res.json()["reps"] is None


def test_add_exercise_both_reps_and_duration(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    with auth_patch(COACH_DECODED):
        res = client.post(
            f"/workout/{m.id}/days/{day['id']}/exercises",
            json={"name": "Squat", "sets": 3, "reps": 10, "duration": "30 sec"},
            headers={"Authorization": COACH_TOKEN},
        )
    assert res.status_code == 422


def test_add_exercise_member_forbidden(client, db, coach_user, member_user):
    m = create_member(db)
    day = create_day(client, m.id)
    with auth_patch(MEMBER_DECODED):
        res = client.post(
            f"/workout/{m.id}/days/{day['id']}/exercises",
            json={"name": "Squat", "sets": 3, "reps": 10},
            headers={"Authorization": MEMBER_TOKEN},
        )
    assert res.status_code == 403


def test_add_exercise_day_not_found(client, db, coach_user):
    m = create_member(db)
    fake_id = "00000000-0000-0000-0000-000000000000"
    with auth_patch(COACH_DECODED):
        res = client.post(
            f"/workout/{m.id}/days/{fake_id}/exercises",
            json={"name": "Squat", "sets": 3, "reps": 10},
            headers={"Authorization": COACH_TOKEN},
        )
    assert res.status_code == 404


def test_exercises_appear_in_day_list(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    create_exercise(client, m.id, day["id"], "Bench Press")
    create_exercise(client, m.id, day["id"], "Incline Press")
    with auth_patch(COACH_DECODED):
        res = client.get(f"/workout/{m.id}/days", headers={"Authorization": COACH_TOKEN})
    assert len(res.json()[0]["exercises"]) == 2


# ── PUT /workout/{member_id}/days/{day_id}/exercises/{exercise_id} ────────────

def test_update_exercise(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    ex = create_exercise(client, m.id, day["id"])
    with auth_patch(COACH_DECODED):
        res = client.put(
            f"/workout/{m.id}/days/{day['id']}/exercises/{ex['id']}",
            json={"name": "Incline Press", "sets": 4, "reps": 8},
            headers={"Authorization": COACH_TOKEN},
        )
    assert res.status_code == 200
    assert res.json()["name"] == "Incline Press"
    assert res.json()["sets"] == 4


def test_update_exercise_not_found(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    fake_id = "00000000-0000-0000-0000-000000000000"
    with auth_patch(COACH_DECODED):
        res = client.put(
            f"/workout/{m.id}/days/{day['id']}/exercises/{fake_id}",
            json={"name": "Squat", "sets": 3, "reps": 10},
            headers={"Authorization": COACH_TOKEN},
        )
    assert res.status_code == 404


# ── DELETE /workout/{member_id}/days/{day_id}/exercises/{exercise_id} ─────────

def test_delete_exercise(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    ex = create_exercise(client, m.id, day["id"])
    with auth_patch(COACH_DECODED):
        del_res = client.delete(f"/workout/{m.id}/days/{day['id']}/exercises/{ex['id']}", headers={"Authorization": COACH_TOKEN})
        list_res = client.get(f"/workout/{m.id}/days", headers={"Authorization": COACH_TOKEN})
    assert del_res.status_code == 204
    assert list_res.json()[0]["exercises"] == []


def test_delete_exercise_member_forbidden(client, db, coach_user, member_user):
    m = create_member(db)
    day = create_day(client, m.id)
    ex = create_exercise(client, m.id, day["id"])
    with auth_patch(MEMBER_DECODED):
        res = client.delete(f"/workout/{m.id}/days/{day['id']}/exercises/{ex['id']}", headers={"Authorization": MEMBER_TOKEN})
    assert res.status_code == 403


# ── Weight Logs ───────────────────────────────────────────────────────────────

def test_list_weight_logs_empty(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    ex = create_exercise(client, m.id, day["id"])
    with auth_patch(COACH_DECODED):
        res = client.get(f"/workout/{m.id}/{ex['id']}/logs", headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 200
    assert res.json() == []


def test_log_weight(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    ex = create_exercise(client, m.id, day["id"])
    with auth_patch(COACH_DECODED):
        res = client.post(f"/workout/{m.id}/{ex['id']}/logs", json={"weight": "45 lbs"}, headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 201
    assert res.json()["weight"] == "45 lbs"


def test_log_weight_member_can_log(client, db, coach_user, member_user):
    m = create_member(db)
    day = create_day(client, m.id)
    ex = create_exercise(client, m.id, day["id"])
    with auth_patch(MEMBER_DECODED):
        res = client.post(f"/workout/{m.id}/{ex['id']}/logs", json={"weight": "45 lbs"}, headers={"Authorization": MEMBER_TOKEN})
    assert res.status_code == 201


def test_log_weight_empty_string(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    ex = create_exercise(client, m.id, day["id"])
    with auth_patch(COACH_DECODED):
        res = client.post(f"/workout/{m.id}/{ex['id']}/logs", json={"weight": "  "}, headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 422


def test_log_weight_with_date(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    ex = create_exercise(client, m.id, day["id"])
    with auth_patch(COACH_DECODED):
        res = client.post(f"/workout/{m.id}/{ex['id']}/logs", json={"weight": "50 lbs", "logged_at": "2026-03-15"}, headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 201
    assert res.json()["logged_at"] == "2026-03-15"


def test_delete_weight_log(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    ex = create_exercise(client, m.id, day["id"])
    with auth_patch(COACH_DECODED):
        log = client.post(f"/workout/{m.id}/{ex['id']}/logs", json={"weight": "45 lbs"}, headers={"Authorization": COACH_TOKEN}).json()
        del_res = client.delete(f"/workout/{m.id}/{ex['id']}/logs/{log['id']}", headers={"Authorization": COACH_TOKEN})
        list_res = client.get(f"/workout/{m.id}/{ex['id']}/logs", headers={"Authorization": COACH_TOKEN})
    assert del_res.status_code == 204
    assert list_res.json() == []


def test_delete_weight_log_not_found(client, db, coach_user):
    m = create_member(db)
    day = create_day(client, m.id)
    ex = create_exercise(client, m.id, day["id"])
    fake_id = "00000000-0000-0000-0000-000000000000"
    with auth_patch(COACH_DECODED):
        res = client.delete(f"/workout/{m.id}/{ex['id']}/logs/{fake_id}", headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 404


def test_delete_day_cascades_exercises_and_logs(client, db, coach_user):
    """Deleting a day cascades to exercises and their weight logs."""
    m = create_member(db)
    day = create_day(client, m.id)
    ex = create_exercise(client, m.id, day["id"])
    with auth_patch(COACH_DECODED):
        client.post(f"/workout/{m.id}/{ex['id']}/logs", json={"weight": "45 lbs"}, headers={"Authorization": COACH_TOKEN})
        client.delete(f"/workout/{m.id}/days/{day['id']}", headers={"Authorization": COACH_TOKEN})
        # Exercise now 404
        res = client.get(f"/workout/{m.id}/{ex['id']}/logs", headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 404
