from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from uuid import UUID

from db.session import get_db
from db.models import ContactMessage
from db.schemas import ContactMessageCreate, ContactMessageOut
from api.dependencies import require_coach_or_trainer

router = APIRouter()


@router.post("/", response_model=ContactMessageOut, status_code=status.HTTP_201_CREATED)
def create_contact_message(
    payload: ContactMessageCreate,
    db: Session = Depends(get_db),
):
    """Public endpoint — anyone can submit a contact message."""
    try:
        msg = ContactMessage(**payload.model_dump())
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send your message. Please try again.",
        )


@router.get("/", response_model=List[ContactMessageOut])
def list_contact_messages(
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Coach/trainer views all contact messages, newest first."""
    try:
        return db.query(ContactMessage).order_by(ContactMessage.created_at.desc()).all()
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch messages.",
        )


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact_message(
    message_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Coach/trainer dismisses a contact message after handling it."""
    msg = db.query(ContactMessage).filter(ContactMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    try:
        db.delete(msg)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to dismiss message. Please try again.",
        )
