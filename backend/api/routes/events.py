from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from uuid import UUID
from datetime import date

from db.session import get_db
from db.models import Event
from db.schemas import EventCreate, EventUpdate, EventOut
from api.dependencies import require_coach
from core.cloudinary_utils import delete_image

router = APIRouter()


@router.get("/", response_model=List[EventOut])
def list_events(
    active_only: bool = False,
    db: Session = Depends(get_db),
):
    """
    Public endpoint — returns all events.
    Pass ?active_only=true to get only events whose end_date >= today.
    """
    try:
        q = db.query(Event)
        if active_only:
            q = q.filter(Event.end_date >= date.today())
        return q.order_by(Event.end_date.asc()).all()
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load events. Please try again.",
        )


@router.get("/{slug}", response_model=EventOut)
def get_event_by_slug(
    slug: str,
    db: Session = Depends(get_db),
):
    """Public endpoint — fetch a single event by its slug."""
    try:
        event = db.query(Event).filter(Event.slug == slug).first()
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load event. Please try again.",
        )
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@router.post("/", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    user=Depends(require_coach),
):
    """Create a new event. Coach only."""
    existing = db.query(Event).filter(Event.slug == payload.slug).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'An event with slug "{payload.slug}" already exists. Choose a different slug.',
        )
    try:
        event = Event(**payload.model_dump())
        db.add(event)
        db.commit()
        db.refresh(event)
        return event
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create event. Please try again.",
        )


@router.put("/{event_id}", response_model=EventOut)
def update_event(
    event_id: UUID,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_coach),
):
    """Update an event. Coach only."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    # Check slug uniqueness if slug is being changed
    new_slug = payload.slug
    if new_slug and new_slug != event.slug:
        conflict = db.query(Event).filter(Event.slug == new_slug).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'An event with slug "{new_slug}" already exists.',
            )
    old_image_url = event.cover_image_url
    try:
        data = payload.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(event, field, value)
        db.commit()
        db.refresh(event)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update event. Please try again.",
        )

    # If cover image was replaced, delete the old one from Cloudinary
    new_image_url = data.get("cover_image_url")
    if new_image_url and new_image_url != old_image_url and old_image_url:
        delete_image(old_image_url)

    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach),
):
    """Delete an event. Coach only."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    image_url = event.cover_image_url
    try:
        db.delete(event)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete event. Please try again.",
        )

    # Delete cover image from Cloudinary after DB commit
    if image_url:
        delete_image(image_url)
