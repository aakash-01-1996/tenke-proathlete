from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from pydantic import BaseModel

from db.session import get_db
from db.models import WorkoutDay, WorkoutExercise, Member, ExerciseWeightLog
from api.dependencies import get_current_user, require_coach_or_trainer

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class DayIn(BaseModel):
    label: str = 'Workout'


class DayLabelIn(BaseModel):
    label: str


class ExerciseOut(BaseModel):
    id: UUID
    member_id: UUID
    day_id: Optional[UUID]
    category: Optional[str]
    is_rest: bool
    rest_seconds: Optional[int]
    name: str
    sets: Optional[int]
    reps: Optional[int]
    duration: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class DayOut(BaseModel):
    id: UUID
    member_id: UUID
    day_number: int
    label: str
    exercises: List[ExerciseOut] = []
    created_at: datetime

    class Config:
        from_attributes = True


class ExerciseIn(BaseModel):
    name: str
    sets: Optional[int] = None
    reps: Optional[int] = None
    duration: Optional[str] = None
    is_rest: bool = False
    rest_seconds: Optional[int] = None


class WeightLogIn(BaseModel):
    weight: str
    logged_at: Optional[date] = None


class WeightLogOut(BaseModel):
    id: UUID
    exercise_id: UUID
    weight: str
    logged_at: date
    created_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _member_or_404(member_id: UUID, db: Session) -> Member:
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")
    return member


def _day_or_404(day_id: UUID, member_id: UUID, db: Session) -> WorkoutDay:
    day = db.query(WorkoutDay).filter(
        WorkoutDay.id == day_id,
        WorkoutDay.member_id == member_id,
    ).first()
    if not day:
        raise HTTPException(status_code=404, detail="Workout day not found.")
    return day


def _exercise_or_404(exercise_id: UUID, member_id: UUID, db: Session) -> WorkoutExercise:
    ex = db.query(WorkoutExercise).filter(
        WorkoutExercise.id == exercise_id,
        WorkoutExercise.member_id == member_id,
    ).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found.")
    return ex


def _build_day_out(day: WorkoutDay, db: Session) -> DayOut:
    exercises = (
        db.query(WorkoutExercise)
        .filter(WorkoutExercise.day_id == day.id)
        .order_by(WorkoutExercise.created_at.asc())
        .all()
    )
    out = DayOut.model_validate(day)
    out.exercises = [ExerciseOut.model_validate(e) for e in exercises]
    return out


# ── Workout Day Routes ────────────────────────────────────────────────────────

@router.get("/{member_id}/days", response_model=List[DayOut])
def list_days(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all workout days for a member, ordered by day_number."""
    _member_or_404(member_id, db)
    days = (
        db.query(WorkoutDay)
        .filter(WorkoutDay.member_id == member_id)
        .order_by(WorkoutDay.day_number.asc())
        .all()
    )
    return [_build_day_out(d, db) for d in days]


@router.post("/{member_id}/days", response_model=DayOut, status_code=status.HTTP_201_CREATED)
def add_day(
    member_id: UUID,
    payload: DayIn,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Add a new workout day. Coach/trainer only."""
    _member_or_404(member_id, db)
    label = payload.label.strip() or 'Workout'
    try:
        # Next day_number = max existing + 1
        from sqlalchemy import func as sqlfunc
        max_num = db.query(sqlfunc.max(WorkoutDay.day_number)).filter(
            WorkoutDay.member_id == member_id
        ).scalar() or 0
        day = WorkoutDay(member_id=member_id, day_number=max_num + 1, label=label)
        db.add(day)
        db.commit()
        db.refresh(day)
        return _build_day_out(day, db)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to add workout day.")


@router.patch("/{member_id}/days/{day_id}", response_model=DayOut)
def rename_day(
    member_id: UUID,
    day_id: UUID,
    payload: DayLabelIn,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Rename a workout day label. Coach/trainer only."""
    day = _day_or_404(day_id, member_id, db)
    label = payload.label.strip()
    if not label:
        raise HTTPException(status_code=422, detail="Label cannot be empty.")
    try:
        day.label = label
        db.commit()
        db.refresh(day)
        return _build_day_out(day, db)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to rename day.")


@router.delete("/{member_id}/days/{day_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_day(
    member_id: UUID,
    day_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Delete a workout day and all its exercises. Coach/trainer only."""
    day = _day_or_404(day_id, member_id, db)
    try:
        db.delete(day)  # CASCADE deletes exercises and their weight logs
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete workout day.")


# ── Exercise Routes ───────────────────────────────────────────────────────────

@router.post("/{member_id}/days/{day_id}/exercises", response_model=ExerciseOut, status_code=status.HTTP_201_CREATED)
def add_exercise(
    member_id: UUID,
    day_id: UUID,
    payload: ExerciseIn,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Add an exercise to a workout day."""
    _day_or_404(day_id, member_id, db)
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Exercise name is required.")
    if payload.reps is not None and payload.duration is not None:
        raise HTTPException(status_code=422, detail="Provide either reps or duration, not both.")
    try:
        ex = WorkoutExercise(
            member_id=member_id,
            day_id=day_id,
            name=payload.name.strip(),
            sets=payload.sets,
            reps=payload.reps,
            duration=payload.duration.strip() if payload.duration else None,
            is_rest=payload.is_rest,
            rest_seconds=payload.rest_seconds,
        )
        db.add(ex)
        db.commit()
        db.refresh(ex)
        return ex
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to add exercise.")


@router.put("/{member_id}/days/{day_id}/exercises/{exercise_id}", response_model=ExerciseOut)
def update_exercise(
    member_id: UUID,
    day_id: UUID,
    exercise_id: UUID,
    payload: ExerciseIn,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Edit an exercise."""
    _day_or_404(day_id, member_id, db)
    ex = _exercise_or_404(exercise_id, member_id, db)
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Exercise name is required.")
    if payload.reps is not None and payload.duration is not None:
        raise HTTPException(status_code=422, detail="Provide either reps or duration, not both.")
    try:
        ex.name = payload.name.strip()
        ex.sets = payload.sets
        ex.reps = payload.reps
        ex.duration = payload.duration.strip() if payload.duration else None
        ex.is_rest = payload.is_rest
        ex.rest_seconds = payload.rest_seconds
        db.commit()
        db.refresh(ex)
        return ex
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update exercise.")


@router.delete("/{member_id}/days/{day_id}/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise(
    member_id: UUID,
    day_id: UUID,
    exercise_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Delete an exercise."""
    _day_or_404(day_id, member_id, db)
    ex = _exercise_or_404(exercise_id, member_id, db)
    try:
        db.delete(ex)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete exercise.")


# ── Weight Log Routes ─────────────────────────────────────────────────────────

@router.get("/{member_id}/{exercise_id}/logs", response_model=List[WeightLogOut])
def list_weight_logs(
    member_id: UUID,
    exercise_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get full weight history for an exercise, newest first."""
    _exercise_or_404(exercise_id, member_id, db)
    return (
        db.query(ExerciseWeightLog)
        .filter(ExerciseWeightLog.exercise_id == exercise_id)
        .order_by(ExerciseWeightLog.logged_at.desc())
        .all()
    )


@router.post("/{member_id}/{exercise_id}/logs", response_model=WeightLogOut, status_code=status.HTTP_201_CREATED)
def log_weight(
    member_id: UUID,
    exercise_id: UUID,
    payload: WeightLogIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Log a weight entry for an exercise."""
    if not payload.weight.strip():
        raise HTTPException(status_code=422, detail="Weight is required.")
    _exercise_or_404(exercise_id, member_id, db)
    try:
        log = ExerciseWeightLog(
            exercise_id=exercise_id,
            weight=payload.weight.strip(),
            logged_at=payload.logged_at or date.today(),
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to log weight.")


@router.delete("/{member_id}/{exercise_id}/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_weight_log(
    member_id: UUID,
    exercise_id: UUID,
    log_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Delete a single weight log entry."""
    _exercise_or_404(exercise_id, member_id, db)
    log = db.query(ExerciseWeightLog).filter(
        ExerciseWeightLog.id == log_id,
        ExerciseWeightLog.exercise_id == exercise_id,
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Weight log not found.")
    try:
        db.delete(log)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete weight log.")
