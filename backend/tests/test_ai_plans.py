"""
Smoke tests for the AI plan generation + approval pipeline.
Mocks services.ai_plan_generator so no real Claude API call is made.
"""

import uuid
from unittest.mock import patch
from db.models import Member, User, UserRole, WorkoutDay, NutritionPlan
from services.ai_plan_generator import WorkoutPlanOut, WorkoutDayOut, WorkoutExerciseOut, NutritionPlanOut, NutritionMealOut, AIGenerationError
from tests.conftest import auth_patch, make_coach_token, make_member_token

COACH_TOKEN, COACH_DECODED = make_coach_token("coach@test.com")
MEMBER_TOKEN, MEMBER_DECODED = make_member_token("member@test.com")


def _create_member_with_user(db):
    member_id = uuid.uuid4()
    member = Member(id=member_id, display_id=99, first_name="Test", last_name="Member", email="member@test.com")
    user = User(email="member@test.com", role=UserRole.member, ref_id=member_id)
    db.add(member)
    db.add(user)
    db.commit()
    return member, user


FAKE_WORKOUT_PLAN = WorkoutPlanOut(days=[
    WorkoutDayOut(day_number=1, label="Upper Body", exercises=[
        WorkoutExerciseOut(name="Bench Press", sets=3, reps=10),
    ])
])

FAKE_NUTRITION_PLAN = NutritionPlanOut(
    daily_calories=2500, daily_protein_g=150, daily_carbs_g=250, daily_fat_g=80,
    summary_notes="Balanced plan",
    meals=[NutritionMealOut(meal_order=1, label="Breakfast", food_items="Oats, eggs")],
)


def test_member_can_generate_workout_plan_and_coach_approves(client, db, coach_user):
    member, _ = _create_member_with_user(db)

    with patch("api.routes.ai_plans.generate_workout_plan", return_value=(FAKE_WORKOUT_PLAN, "claude-sonnet-5", "{}")):
        with auth_patch(MEMBER_DECODED):
            res = client.post(f"/ai-plans/{member.id}/generate-workout", headers={"Authorization": MEMBER_TOKEN})
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "pending"
    assert data["days"][0]["label"] == "Upper Body"
    request_id = data["id"]

    with auth_patch(COACH_DECODED):
        res = client.post(f"/ai-plans/workout-requests/{request_id}/approve", headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 200
    assert res.json()["status"] == "approved"

    days = db.query(WorkoutDay).filter(WorkoutDay.member_id == member.id).all()
    assert len(days) == 1
    assert days[0].label == "Upper Body"


def test_generation_failure_is_recorded_as_failed(client, db):
    member, _ = _create_member_with_user(db)

    with patch("api.routes.ai_plans.generate_workout_plan", side_effect=AIGenerationError("boom")):
        with auth_patch(MEMBER_DECODED):
            res = client.post(f"/ai-plans/{member.id}/generate-workout", headers={"Authorization": MEMBER_TOKEN})
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "failed"
    assert data["error_message"] == "boom"


def test_coach_can_generate_and_approve_nutrition_plan(client, db, coach_user):
    member, _ = _create_member_with_user(db)

    with patch("api.routes.ai_plans.generate_nutrition_plan", return_value=(FAKE_NUTRITION_PLAN, "claude-sonnet-5", "{}")):
        with auth_patch(COACH_DECODED):
            res = client.post(f"/ai-plans/{member.id}/generate-nutrition", headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 201
    request_id = res.json()["id"]

    with auth_patch(COACH_DECODED):
        res = client.post(f"/ai-plans/nutrition-requests/{request_id}/approve", headers={"Authorization": COACH_TOKEN})
    assert res.status_code == 200

    plans = db.query(NutritionPlan).filter(NutritionPlan.member_id == member.id, NutritionPlan.is_active == True).all()  # noqa: E712
    assert len(plans) == 1
    assert plans[0].daily_calories == 2500


def test_deny_leaves_no_side_effects(client, db, coach_user):
    member, _ = _create_member_with_user(db)

    with patch("api.routes.ai_plans.generate_workout_plan", return_value=(FAKE_WORKOUT_PLAN, "claude-sonnet-5", "{}")):
        with auth_patch(MEMBER_DECODED):
            res = client.post(f"/ai-plans/{member.id}/generate-workout", headers={"Authorization": MEMBER_TOKEN})
    request_id = res.json()["id"]

    with auth_patch(COACH_DECODED):
        res = client.post(
            f"/ai-plans/workout-requests/{request_id}/deny",
            json={"coach_notes": "not a good fit"},
            headers={"Authorization": COACH_TOKEN},
        )
    assert res.status_code == 200
    assert res.json()["status"] == "denied"
    assert db.query(WorkoutDay).filter(WorkoutDay.member_id == member.id).count() == 0


def test_athlete_profile_upsert_and_fetch(client, db):
    member, _ = _create_member_with_user(db)
    payload = {
        "primary_goal": "speed",
        "dietary_preferences": ["vegetarian", "gluten_free"],
        "experience_level": "intermediate",
    }
    with auth_patch(MEMBER_DECODED):
        res = client.put(f"/athlete-profile/{member.id}", json=payload, headers={"Authorization": MEMBER_TOKEN})
    assert res.status_code == 200
    data = res.json()
    assert data["primary_goal"] == "speed"
    assert data["dietary_preferences"] == ["vegetarian", "gluten_free"]

    with auth_patch(MEMBER_DECODED):
        res = client.get(f"/athlete-profile/{member.id}", headers={"Authorization": MEMBER_TOKEN})
    assert res.status_code == 200
    assert res.json()["experience_level"] == "intermediate"
