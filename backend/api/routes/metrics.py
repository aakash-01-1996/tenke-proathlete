from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from uuid import UUID

from db.session import get_db
from db.models import Metric, Member
from db.schemas import MetricCreate, MetricUpdate, MetricOut
from api.dependencies import require_coach_or_trainer, get_current_user

router = APIRouter()


def _compute_overall(fly_10yd, game_speed, vertical, broad_jump):
    """Auto-calculate overall progress (0-100) from available metrics."""
    entries = []
    if fly_10yd is not None:
        s = (1.45 - fly_10yd) / (1.45 - 0.85) * 100
        entries.append((max(0.0, min(100.0, s)), 0.30))
    if game_speed is not None:
        s = (game_speed - 12) / (23 - 12) * 100
        entries.append((max(0.0, min(100.0, s)), 0.20))
    if vertical is not None:
        s = (vertical - 12) / (42 - 12) * 100
        entries.append((max(0.0, min(100.0, s)), 0.25))
    if broad_jump is not None:
        s = (broad_jump - 60) / (132 - 60) * 100
        entries.append((max(0.0, min(100.0, s)), 0.25))
    if not entries:
        return None
    total_weight = sum(w for _, w in entries)
    return round(sum(score * (w / total_weight) for score, w in entries))


def _metric_or_404(metric_id: UUID, db: Session) -> Metric:
    metric = db.query(Metric).filter(Metric.id == metric_id).first()
    if not metric:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Metric not found")
    return metric


def _verify_member_exists(member_id: UUID, db: Session):
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")


# ── Admin list (coach/trainer) ────────────────────────────────────────────────

@router.get("/", response_model=List[MetricOut])
def list_all_metrics(
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """List all metric entries across all members, newest first. Coach/trainer only."""
    try:
        return db.query(Metric).order_by(Metric.recorded_at.desc()).all()
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load metrics. Please try again.",
        )


# ── Coach / Trainer writes ────────────────────────────────────────────────────

@router.post("/", response_model=MetricOut, status_code=status.HTTP_201_CREATED)
def create_metric(
    payload: MetricCreate,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Add a new metric entry for a member. Coach/trainer only."""
    _verify_member_exists(payload.member_id, db)
    try:
        data = payload.model_dump()
        data['overall_progress'] = _compute_overall(
            data.get('fly_10yd'), data.get('game_speed'),
            data.get('vertical'), data.get('broad_jump'),
        )
        metric = Metric(**data)
        db.add(metric)
        db.commit()
        db.refresh(metric)
        member = db.query(Member).filter(Member.id == metric.member_id).first()
        if member:
            member.last_active_at = datetime.now(timezone.utc)
            db.commit()
        return metric
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save metric. Please try again.",
        )


@router.put("/{metric_id}", response_model=MetricOut)
def update_metric(
    metric_id: UUID,
    payload: MetricUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Update an existing metric entry. Coach/trainer only."""
    metric = _metric_or_404(metric_id, db)
    try:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(metric, field, value)
        metric.overall_progress = _compute_overall(
            metric.fly_10yd, metric.game_speed,
            metric.vertical, metric.broad_jump,
        )
        db.commit()
        db.refresh(metric)
        member = db.query(Member).filter(Member.id == metric.member_id).first()
        if member:
            member.last_active_at = datetime.now(timezone.utc)
            db.commit()
        return metric
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update metric. Please try again.",
        )


@router.delete("/{metric_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_metric(
    metric_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Delete a metric entry. Coach/trainer only."""
    metric = _metric_or_404(metric_id, db)
    try:
        db.delete(metric)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete metric. Please try again.",
        )


# ── Read endpoints (coach/trainer + member self-access) ───────────────────────

@router.get("/member/{member_id}", response_model=List[MetricOut])
def get_metrics_for_member(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Get all metric entries for a member, ordered by date ascending.
    Coach/trainer can access any member. A member can only access their own data.
    """
    if user.role == "member" and str(user.ref_id) != str(member_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    _verify_member_exists(member_id, db)
    try:
        return (
            db.query(Metric)
            .filter(Metric.member_id == member_id)
            .order_by(Metric.recorded_at.asc())
            .all()
        )
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load metrics. Please try again.",
        )
