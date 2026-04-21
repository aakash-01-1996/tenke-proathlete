from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from uuid import UUID
from datetime import datetime, timezone

from db.session import get_db
from db.models import DayChangeRequest, DayChangeRequestStatus, Member
from db.schemas import DayChangeRequestCreate, DayChangeRequestOut
from api.dependencies import get_current_user, require_coach_or_trainer

router = APIRouter()


@router.post("/", response_model=DayChangeRequestOut, status_code=status.HTTP_201_CREATED)
def create_request(
    payload: DayChangeRequestCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Member submits a training day change request."""
    if user.role != "member":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only members can submit requests")

    member_id = user.ref_id
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    try:
        req = DayChangeRequest(
            member_id=member_id,
            requested_days=",".join(payload.requested_days),
            note=payload.note,
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        return req
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit request. Please try again.",
        )


@router.get("/", response_model=List[DayChangeRequestOut])
def list_requests(
    status_filter: str = "pending",
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Coach/trainer views requests, filtered by status (default: pending)."""
    try:
        q = db.query(DayChangeRequest)
        if status_filter in ("pending", "approved", "denied"):
            q = q.filter(DayChangeRequest.status == status_filter)
        return q.order_by(DayChangeRequest.created_at.desc()).all()
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load requests. Please try again.",
        )


@router.post("/{request_id}/approve", response_model=DayChangeRequestOut)
def approve_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Approve a request and update the member's training days."""
    req = db.query(DayChangeRequest).filter(DayChangeRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.status != DayChangeRequestStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request already reviewed")

    try:
        member = db.query(Member).filter(Member.id == req.member_id).first()
        if member:
            member.training_days = req.requested_days  # already comma-separated

        req.status = DayChangeRequestStatus.approved
        req.reviewed_by = user.id
        req.reviewed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(req)
        return req
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to approve request. Please try again.",
        )


@router.post("/{request_id}/deny", response_model=DayChangeRequestOut)
def deny_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Deny a request — member's training days remain unchanged."""
    req = db.query(DayChangeRequest).filter(DayChangeRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.status != DayChangeRequestStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request already reviewed")

    try:
        req.status = DayChangeRequestStatus.denied
        req.reviewed_by = user.id
        req.reviewed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(req)
        return req
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deny request. Please try again.",
        )
