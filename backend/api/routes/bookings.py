from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from uuid import UUID

from db.session import get_db
from db.models import BookingRequest
from db.schemas import BookingRequestCreate, BookingRequestOut
from api.dependencies import require_coach_or_trainer

router = APIRouter()


@router.post("/", response_model=BookingRequestOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingRequestCreate,
    db: Session = Depends(get_db),
):
    """Public endpoint — anyone can submit a booking request."""
    try:
        booking = BookingRequest(
            **{k: v for k, v in payload.model_dump().items() if k != 'preferred_days'},
            preferred_days=",".join(payload.preferred_days) if payload.preferred_days else None,
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        return booking
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save your booking. Please try again.",
        )


@router.get("/", response_model=List[BookingRequestOut])
def list_bookings(
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Coach/trainer views all booking requests, newest first."""
    try:
        return db.query(BookingRequest).order_by(BookingRequest.created_at.desc()).all()
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch bookings.",
        )


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(
    booking_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Coach/trainer dismisses a booking request after handling it."""
    booking = db.query(BookingRequest).filter(BookingRequest.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    try:
        db.delete(booking)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to dismiss booking. Please try again.",
        )
