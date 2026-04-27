from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from pydantic import BaseModel

from db.session import get_db
from db.models import WorkoutExercise, Member, ExerciseWeightLog
from api.dependencies import get_current_user

router = APIRouter()

VALID_CATEGORIES = {'upper', 'lower', 'core'}


# ── Schemas ───────────────────────────────────────────────────────────────────

class ExerciseIn(BaseModel):
    category: str          # 'upper' | 'lower' | 'core'
    name: str
    sets: Optional[int] = None
    reps: Optional[int] = None
    duration: Optional[str] = None   # e.g. "20 min", "30 sec"


class ExerciseOut(BaseModel):
    id: UUID
    member_id: UUID
    category: str
    name: str
    sets: Optional[int]
    reps: Optional[int]
    duration: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class WeightLogIn(BaseModel):
    weight: str            # e.g. "45 lbs", "20 kg"
    logged_at: Optional[date] = None   # defaults to today if omitted


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


def _exercise_or_404(exercise_id: UUID, member_id: UUID, db: Session) -> WorkoutExercise:
    ex = db.query(WorkoutExercise).filter(
        WorkoutExercise.id == exercise_id,
        WorkoutExercise.member_id == member_id,
    ).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found.")
    return ex


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{member_id}", response_model=List[ExerciseOut])
def list_exercises(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get all workout exercises for a member. Coach, trainer, or the member themselves."""
    _member_or_404(member_id, db)
    return (
        db.query(WorkoutExercise)
        .filter(WorkoutExercise.member_id == member_id)
        .order_by(WorkoutExercise.created_at.asc())
        .all()
    )


@router.post("/{member_id}", response_model=ExerciseOut, status_code=status.HTTP_201_CREATED)
def add_exercise(
    member_id: UUID,
    payload: ExerciseIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Add a workout exercise. Coach, trainer, or the member themselves."""
    if payload.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"Category must be one of: {', '.join(VALID_CATEGORIES)}.")
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Exercise name is required.")
    if payload.reps is not None and payload.duration is not None:
        raise HTTPException(status_code=422, detail="Provide either reps or duration, not both.")
    _member_or_404(member_id, db)
    try:
        ex = WorkoutExercise(
            member_id=member_id,
            category=payload.category,
            name=payload.name.strip(),
            sets=payload.sets,
            reps=payload.reps,
            duration=payload.duration.strip() if payload.duration else None,
        )
        db.add(ex)
        db.commit()
        db.refresh(ex)
        return ex
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to add exercise.")


@router.put("/{member_id}/{exercise_id}", response_model=ExerciseOut)
def update_exercise(
    member_id: UUID,
    exercise_id: UUID,
    payload: ExerciseIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Edit a workout exercise. Coach, trainer, or the member themselves."""
    if payload.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"Category must be one of: {', '.join(VALID_CATEGORIES)}.")
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Exercise name is required.")
    if payload.reps is not None and payload.duration is not None:
        raise HTTPException(status_code=422, detail="Provide either reps or duration, not both.")
    ex = _exercise_or_404(exercise_id, member_id, db)
    try:
        ex.category = payload.category
        ex.name = payload.name.strip()
        ex.sets = payload.sets
        ex.reps = payload.reps
        ex.duration = payload.duration.strip() if payload.duration else None
        db.commit()
        db.refresh(ex)
        return ex
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update exercise.")


@router.delete("/{member_id}/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise(
    member_id: UUID,
    exercise_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Hard delete an exercise. Gone from DB immediately."""
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
