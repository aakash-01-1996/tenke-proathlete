from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from uuid import UUID
from datetime import datetime, timezone

from db.session import get_db
from db.models import (
    Member, AthleteProfile, Metric,
    AIPlanRequestStatus,
    AIWorkoutPlanRequest, AIWorkoutPlanDay, AIWorkoutPlanExercise,
    AINutritionPlanRequest, AINutritionPlanMeal,
    WorkoutDay, WorkoutExercise,
    NutritionPlan, NutritionMeal,
)
from db.schemas import (
    AIWorkoutPlanRequestOut, AINutritionPlanRequestOut,
    AIWorkoutPlanExerciseEditIn, AINutritionPlanMealEditIn,
    AIPlanDenyIn,
)
from api.dependencies import get_current_user, require_coach_or_trainer
from services.ai_plan_generator import (
    generate_workout_plan, generate_nutrition_plan, AIGenerationError,
)

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _member_or_404(member_id: UUID, db: Session) -> Member:
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")
    return member


def _authorize_member(member_id: UUID, user) -> None:
    if user.role in ("coach", "trainer"):
        return
    if user.role == "member" and user.ref_id == member_id:
        return
    raise HTTPException(status_code=403, detail="Not authorized for this member")


def _trigger_source(user) -> str:
    return "coach" if user.role in ("coach", "trainer") else "member"


def _recent_metrics(member_id: UUID, db: Session, limit: int = 5):
    return (
        db.query(Metric)
        .filter(Metric.member_id == member_id)
        .order_by(Metric.recorded_at.desc())
        .limit(limit)
        .all()
    )


def _workout_request_or_404(request_id: UUID, db: Session) -> AIWorkoutPlanRequest:
    req = db.query(AIWorkoutPlanRequest).filter(AIWorkoutPlanRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Workout plan request not found.")
    return req


def _nutrition_request_or_404(request_id: UUID, db: Session) -> AINutritionPlanRequest:
    req = db.query(AINutritionPlanRequest).filter(AINutritionPlanRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Nutrition plan request not found.")
    return req


def _build_workout_request_out(req: AIWorkoutPlanRequest, db: Session) -> AIWorkoutPlanRequestOut:
    days = (
        db.query(AIWorkoutPlanDay)
        .filter(AIWorkoutPlanDay.request_id == req.id)
        .order_by(AIWorkoutPlanDay.day_number.asc())
        .all()
    )
    out = AIWorkoutPlanRequestOut.model_validate(req)
    out.days = []
    for d in days:
        exercises = (
            db.query(AIWorkoutPlanExercise)
            .filter(AIWorkoutPlanExercise.plan_day_id == d.id)
            .all()
        )
        from db.schemas import AIWorkoutPlanDayOut, AIWorkoutPlanExerciseOut
        day_out = AIWorkoutPlanDayOut.model_validate(d)
        day_out.exercises = [AIWorkoutPlanExerciseOut.model_validate(e) for e in exercises]
        out.days.append(day_out)
    return out


def _build_nutrition_request_out(req: AINutritionPlanRequest, db: Session) -> AINutritionPlanRequestOut:
    meals = (
        db.query(AINutritionPlanMeal)
        .filter(AINutritionPlanMeal.request_id == req.id)
        .order_by(AINutritionPlanMeal.meal_order.asc())
        .all()
    )
    out = AINutritionPlanRequestOut.model_validate(req)
    from db.schemas import AINutritionPlanMealOut
    out.meals = [AINutritionPlanMealOut.model_validate(m) for m in meals]
    return out


# ── Generation ────────────────────────────────────────────────────────────────

@router.post("/{member_id}/generate-workout", response_model=AIWorkoutPlanRequestOut, status_code=status.HTTP_201_CREATED)
def generate_workout(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Trigger an AI-suggested workout plan. Member (self) or coach/trainer."""
    _authorize_member(member_id, user)
    member = _member_or_404(member_id, db)
    profile = db.query(AthleteProfile).filter(AthleteProfile.member_id == member_id).first()
    metrics = _recent_metrics(member_id, db)

    req = AIWorkoutPlanRequest(
        member_id=member_id,
        requested_by=user.id,
        trigger_source=_trigger_source(user),
        status=AIPlanRequestStatus.pending,
    )

    try:
        plan, model_used, raw_json = generate_workout_plan(member, profile, metrics)
    except AIGenerationError as e:
        req.status = AIPlanRequestStatus.failed
        req.error_message = str(e)
        try:
            db.add(req)
            db.commit()
            db.refresh(req)
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to record generation failure.")
        return _build_workout_request_out(req, db)

    try:
        req.model_used = model_used
        req.raw_response_json = raw_json
        db.add(req)
        db.flush()
        for day in plan.days:
            day_row = AIWorkoutPlanDay(request_id=req.id, day_number=day.day_number, label=day.label)
            db.add(day_row)
            db.flush()
            for ex in day.exercises:
                db.add(AIWorkoutPlanExercise(
                    plan_day_id=day_row.id,
                    name=ex.name,
                    sets=ex.sets,
                    reps=ex.reps,
                    duration=ex.duration,
                    is_rest=ex.is_rest,
                    rest_seconds=ex.rest_seconds,
                    ai_rationale=ex.rationale,
                ))
        db.commit()
        db.refresh(req)
        return _build_workout_request_out(req, db)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save generated workout plan.")


@router.post("/{member_id}/generate-nutrition", response_model=AINutritionPlanRequestOut, status_code=status.HTTP_201_CREATED)
def generate_nutrition(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Trigger an AI-suggested nutrition plan. Member (self) or coach/trainer."""
    _authorize_member(member_id, user)
    member = _member_or_404(member_id, db)
    profile = db.query(AthleteProfile).filter(AthleteProfile.member_id == member_id).first()
    metrics = _recent_metrics(member_id, db)

    req = AINutritionPlanRequest(
        member_id=member_id,
        requested_by=user.id,
        trigger_source=_trigger_source(user),
        status=AIPlanRequestStatus.pending,
    )

    try:
        plan, model_used, raw_json = generate_nutrition_plan(member, profile, metrics)
    except AIGenerationError as e:
        req.status = AIPlanRequestStatus.failed
        req.error_message = str(e)
        try:
            db.add(req)
            db.commit()
            db.refresh(req)
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to record generation failure.")
        return _build_nutrition_request_out(req, db)

    try:
        req.model_used = model_used
        req.raw_response_json = raw_json
        req.daily_calories = plan.daily_calories
        req.daily_protein_g = plan.daily_protein_g
        req.daily_carbs_g = plan.daily_carbs_g
        req.daily_fat_g = plan.daily_fat_g
        req.summary_notes = plan.summary_notes
        db.add(req)
        db.flush()
        for meal in plan.meals:
            db.add(AINutritionPlanMeal(
                request_id=req.id,
                meal_order=meal.meal_order,
                label=meal.label,
                food_items=meal.food_items,
                calories=meal.calories,
                protein_g=meal.protein_g,
                carbs_g=meal.carbs_g,
                fat_g=meal.fat_g,
                notes=meal.notes,
            ))
        db.commit()
        db.refresh(req)
        return _build_nutrition_request_out(req, db)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save generated nutrition plan.")


# ── Listing / detail (coach review) ──────────────────────────────────────────

@router.get("/workout-requests", response_model=List[AIWorkoutPlanRequestOut])
def list_workout_requests(
    status_filter: str = "pending",
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    try:
        q = db.query(AIWorkoutPlanRequest)
        if status_filter in ("pending", "approved", "denied", "failed"):
            q = q.filter(AIWorkoutPlanRequest.status == status_filter)
        reqs = q.order_by(AIWorkoutPlanRequest.created_at.desc()).all()
        return [_build_workout_request_out(r, db) for r in reqs]
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Failed to load workout plan requests.")


@router.get("/nutrition-requests", response_model=List[AINutritionPlanRequestOut])
def list_nutrition_requests(
    status_filter: str = "pending",
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    try:
        q = db.query(AINutritionPlanRequest)
        if status_filter in ("pending", "approved", "denied", "failed"):
            q = q.filter(AINutritionPlanRequest.status == status_filter)
        reqs = q.order_by(AINutritionPlanRequest.created_at.desc()).all()
        return [_build_nutrition_request_out(r, db) for r in reqs]
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Failed to load nutrition plan requests.")


@router.get("/workout-requests/{request_id}", response_model=AIWorkoutPlanRequestOut)
def get_workout_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    req = _workout_request_or_404(request_id, db)
    return _build_workout_request_out(req, db)


@router.get("/nutrition-requests/{request_id}", response_model=AINutritionPlanRequestOut)
def get_nutrition_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    req = _nutrition_request_or_404(request_id, db)
    return _build_nutrition_request_out(req, db)


# ── Coach edits to drafts (before approval) ──────────────────────────────────

@router.patch("/workout-requests/{request_id}/days/{day_id}/exercises/{exercise_id}", response_model=AIWorkoutPlanRequestOut)
def edit_workout_exercise(
    request_id: UUID,
    day_id: UUID,
    exercise_id: UUID,
    payload: AIWorkoutPlanExerciseEditIn,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    req = _workout_request_or_404(request_id, db)
    if req.status != AIPlanRequestStatus.pending:
        raise HTTPException(status_code=400, detail="Request already reviewed")
    day = db.query(AIWorkoutPlanDay).filter(AIWorkoutPlanDay.id == day_id, AIWorkoutPlanDay.request_id == request_id).first()
    if not day:
        raise HTTPException(status_code=404, detail="Draft day not found.")
    ex = db.query(AIWorkoutPlanExercise).filter(AIWorkoutPlanExercise.id == exercise_id, AIWorkoutPlanExercise.plan_day_id == day_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Draft exercise not found.")
    try:
        ex.name = payload.name.strip()
        ex.sets = payload.sets
        ex.reps = payload.reps
        ex.duration = payload.duration
        ex.is_rest = payload.is_rest
        ex.rest_seconds = payload.rest_seconds
        db.commit()
        db.refresh(req)
        return _build_workout_request_out(req, db)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update draft exercise.")


@router.patch("/nutrition-requests/{request_id}/meals/{meal_id}", response_model=AINutritionPlanRequestOut)
def edit_nutrition_meal(
    request_id: UUID,
    meal_id: UUID,
    payload: AINutritionPlanMealEditIn,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    req = _nutrition_request_or_404(request_id, db)
    if req.status != AIPlanRequestStatus.pending:
        raise HTTPException(status_code=400, detail="Request already reviewed")
    meal = db.query(AINutritionPlanMeal).filter(AINutritionPlanMeal.id == meal_id, AINutritionPlanMeal.request_id == request_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Draft meal not found.")
    try:
        meal.label = payload.label.strip()
        meal.food_items = payload.food_items
        meal.calories = payload.calories
        meal.protein_g = payload.protein_g
        meal.carbs_g = payload.carbs_g
        meal.fat_g = payload.fat_g
        meal.notes = payload.notes
        db.commit()
        db.refresh(req)
        return _build_nutrition_request_out(req, db)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update draft meal.")


# ── Approve / deny ────────────────────────────────────────────────────────────

@router.post("/workout-requests/{request_id}/approve", response_model=AIWorkoutPlanRequestOut)
def approve_workout_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Approve a draft: appends new WorkoutDay/WorkoutExercise rows for the member.
    Existing days are left untouched — no destructive replace."""
    req = _workout_request_or_404(request_id, db)
    if req.status != AIPlanRequestStatus.pending:
        raise HTTPException(status_code=400, detail="Request already reviewed")

    try:
        from sqlalchemy import func as sqlfunc
        max_num = db.query(sqlfunc.max(WorkoutDay.day_number)).filter(
            WorkoutDay.member_id == req.member_id
        ).scalar() or 0

        draft_days = (
            db.query(AIWorkoutPlanDay)
            .filter(AIWorkoutPlanDay.request_id == req.id)
            .order_by(AIWorkoutPlanDay.day_number.asc())
            .all()
        )
        for i, draft_day in enumerate(draft_days, start=1):
            real_day = WorkoutDay(member_id=req.member_id, day_number=max_num + i, label=draft_day.label)
            db.add(real_day)
            db.flush()
            draft_exercises = (
                db.query(AIWorkoutPlanExercise)
                .filter(AIWorkoutPlanExercise.plan_day_id == draft_day.id)
                .all()
            )
            for de in draft_exercises:
                db.add(WorkoutExercise(
                    member_id=req.member_id,
                    day_id=real_day.id,
                    name=de.name,
                    sets=de.sets,
                    reps=de.reps,
                    duration=de.duration,
                    is_rest=de.is_rest,
                    rest_seconds=de.rest_seconds,
                ))

        req.status = AIPlanRequestStatus.approved
        req.reviewed_by = user.id
        req.reviewed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(req)
        return _build_workout_request_out(req, db)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to approve workout plan.")


@router.post("/workout-requests/{request_id}/deny", response_model=AIWorkoutPlanRequestOut)
def deny_workout_request(
    request_id: UUID,
    payload: AIPlanDenyIn,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    req = _workout_request_or_404(request_id, db)
    if req.status != AIPlanRequestStatus.pending:
        raise HTTPException(status_code=400, detail="Request already reviewed")
    try:
        req.status = AIPlanRequestStatus.denied
        req.coach_notes = payload.coach_notes
        req.reviewed_by = user.id
        req.reviewed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(req)
        return _build_workout_request_out(req, db)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to deny workout plan.")


@router.post("/nutrition-requests/{request_id}/approve", response_model=AINutritionPlanRequestOut)
def approve_nutrition_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Approve a draft: creates a new active NutritionPlan + meals, deactivating any
    existing active plan for the member in the same transaction."""
    req = _nutrition_request_or_404(request_id, db)
    if req.status != AIPlanRequestStatus.pending:
        raise HTTPException(status_code=400, detail="Request already reviewed")

    try:
        db.query(NutritionPlan).filter(
            NutritionPlan.member_id == req.member_id,
            NutritionPlan.is_active == True,  # noqa: E712
        ).update({"is_active": False})

        plan = NutritionPlan(
            member_id=req.member_id,
            daily_calories=req.daily_calories,
            daily_protein_g=req.daily_protein_g,
            daily_carbs_g=req.daily_carbs_g,
            daily_fat_g=req.daily_fat_g,
            summary_notes=req.summary_notes,
            is_active=True,
        )
        db.add(plan)
        db.flush()

        draft_meals = (
            db.query(AINutritionPlanMeal)
            .filter(AINutritionPlanMeal.request_id == req.id)
            .order_by(AINutritionPlanMeal.meal_order.asc())
            .all()
        )
        for dm in draft_meals:
            db.add(NutritionMeal(
                plan_id=plan.id,
                meal_order=dm.meal_order,
                label=dm.label,
                food_items=dm.food_items,
                calories=dm.calories,
                protein_g=dm.protein_g,
                carbs_g=dm.carbs_g,
                fat_g=dm.fat_g,
                notes=dm.notes,
            ))

        req.status = AIPlanRequestStatus.approved
        req.reviewed_by = user.id
        req.reviewed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(req)
        return _build_nutrition_request_out(req, db)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to approve nutrition plan.")


@router.post("/nutrition-requests/{request_id}/deny", response_model=AINutritionPlanRequestOut)
def deny_nutrition_request(
    request_id: UUID,
    payload: AIPlanDenyIn,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    req = _nutrition_request_or_404(request_id, db)
    if req.status != AIPlanRequestStatus.pending:
        raise HTTPException(status_code=400, detail="Request already reviewed")
    try:
        req.status = AIPlanRequestStatus.denied
        req.coach_notes = payload.coach_notes
        req.reviewed_by = user.id
        req.reviewed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(req)
        return _build_nutrition_request_out(req, db)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to deny nutrition plan.")
