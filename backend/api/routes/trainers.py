from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from db.session import get_db
from db.models import Trainer, TrainerRemovalRequest, DayChangeRequestStatus
from db.schemas import TrainerCreate, TrainerUpdate, TrainerOut, TrainerRemovalRequestOut
from api.dependencies import require_coach_or_trainer, require_coach, guard_superuser_delete, is_privileged

router = APIRouter()


def _next_trainer_display_id(db: Session) -> int:
    from sqlalchemy import func as sqlfunc
    max_id = db.query(sqlfunc.max(Trainer.display_id)).scalar()
    return (max_id or 10) + 1


def _trainer_or_404(trainer_id: UUID, db: Session) -> Trainer:
    t = db.query(Trainer).filter(Trainer.id == trainer_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainer not found")
    return t


@router.get("/", response_model=List[TrainerOut])
def list_trainers(
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """List all trainers. Coach/trainer only."""
    from core.config import settings
    try:
        q = db.query(Trainer)
        if settings.SMTP_REPLY_TO:
            q = q.filter(Trainer.email != settings.SMTP_REPLY_TO)
        return q.order_by(Trainer.created_at.asc()).all()
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load trainers. Please try again.",
        )


@router.post("/", response_model=TrainerOut, status_code=status.HTTP_201_CREATED)
def create_trainer(
    payload: TrainerCreate,
    db: Session = Depends(get_db),
    user=Depends(require_coach),
):
    """Add a new trainer. Coach only."""
    existing = db.query(Trainer).filter(Trainer.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A trainer with this email already exists.",
        )
    try:
        trainer = Trainer(**payload.model_dump(), display_id=_next_trainer_display_id(db))
        db.add(trainer)
        db.commit()
        db.refresh(trainer)
        return trainer
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add trainer. Please try again.",
        )


@router.put("/{trainer_id}", response_model=TrainerOut)
def update_trainer(
    trainer_id: UUID,
    payload: TrainerUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_coach),
):
    """Update trainer info. Coach only."""
    trainer = _trainer_or_404(trainer_id, db)
    if payload.email and payload.email != trainer.email:
        conflict = db.query(Trainer).filter(Trainer.email == payload.email).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A trainer with this email already exists.",
            )
    try:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(trainer, field, value)
        db.commit()
        db.refresh(trainer)
        return trainer
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update trainer. Please try again.",
        )


@router.delete("/{trainer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trainer(
    trainer_id: UUID,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(require_coach),
):
    """
    Remove a trainer.
    - Superuser / head coach: delete immediately.
    - Regular coach: creates a pending removal request for head coach approval.
    """
    trainer = _trainer_or_404(trainer_id, db)
    guard_superuser_delete(trainer.email, user)

    if is_privileged(user.email):
        # Direct delete
        try:
            db.delete(trainer)
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to remove trainer. Please try again.")
    else:
        # Check if request already pending
        existing = db.query(TrainerRemovalRequest).filter(
            TrainerRemovalRequest.trainer_id == trainer_id,
            TrainerRemovalRequest.status == DayChangeRequestStatus.pending,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="A removal request for this trainer is already pending approval.")
        try:
            req = TrainerRemovalRequest(
                trainer_id=trainer_id,
                requested_by=user.email,
                reason=reason,
            )
            db.add(req)
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to submit removal request. Please try again.")
        # Return 202 to signal request was created (not deleted yet)
        from fastapi import Response
        raise HTTPException(status_code=202, detail="Removal request submitted for head coach approval.")


@router.get("/removal-requests", response_model=List[TrainerRemovalRequestOut])
def list_removal_requests(
    db: Session = Depends(get_db),
    user=Depends(require_coach),
):
    """List pending trainer removal requests. Coach only."""
    requests = db.query(TrainerRemovalRequest).order_by(TrainerRemovalRequest.created_at.desc()).all()
    result = []
    for r in requests:
        trainer = db.query(Trainer).filter(Trainer.id == r.trainer_id).first()
        out = TrainerRemovalRequestOut.model_validate(r)
        out.trainer_name = f"{trainer.first_name} {trainer.last_name}" if trainer else "Unknown"
        result.append(out)
    return result


@router.post("/removal-requests/{request_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
def approve_removal_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach),
):
    """Approve a trainer removal request. Head coach / superuser only."""
    if not is_privileged(user.email):
        raise HTTPException(status_code=403, detail="Only the head coach can approve removal requests.")

    req = db.query(TrainerRemovalRequest).filter(TrainerRemovalRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")
    if req.status != DayChangeRequestStatus.pending:
        raise HTTPException(status_code=400, detail="Request already reviewed.")

    trainer = db.query(Trainer).filter(Trainer.id == req.trainer_id).first()
    try:
        req.status = DayChangeRequestStatus.approved
        req.reviewed_by = user.email
        req.reviewed_at = datetime.now(timezone.utc)
        if trainer:
            db.delete(trainer)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to approve request. Please try again.")


@router.post("/removal-requests/{request_id}/deny", status_code=status.HTTP_204_NO_CONTENT)
def deny_removal_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach),
):
    """Deny a trainer removal request. Head coach / superuser only."""
    if not is_privileged(user.email):
        raise HTTPException(status_code=403, detail="Only the head coach can deny removal requests.")

    req = db.query(TrainerRemovalRequest).filter(TrainerRemovalRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")
    if req.status != DayChangeRequestStatus.pending:
        raise HTTPException(status_code=400, detail="Request already reviewed.")

    try:
        req.status = DayChangeRequestStatus.denied
        req.reviewed_by = user.email
        req.reviewed_at = datetime.now(timezone.utc)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to deny request. Please try again.")
