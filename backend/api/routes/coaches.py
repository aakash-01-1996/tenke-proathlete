import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List

from firebase_admin import auth as firebase_auth

from db.session import get_db
from db.models import User, UserRole
from db.schemas import CoachCreate, CoachOut
from api.dependencies import require_coach


router = APIRouter()


def _generate_temp_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


@router.get("/", response_model=List[dict])
def list_coaches(
    db: Session = Depends(get_db),
    user=Depends(require_coach),
):
    """List all coach accounts."""
    from core.config import settings
    coaches = db.query(User).filter(User.role == UserRole.coach).all()
    return [
        {
            "id": str(c.id),
            "display_id": c.display_id,
            "email": c.email,
            "first_name": c.first_name,
            "last_name": c.last_name,
            "phone": c.phone,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in coaches
        if c.email != settings.SMTP_REPLY_TO  # hide superuser
    ]


@router.post("/", response_model=CoachOut, status_code=status.HTTP_201_CREATED)
def create_coach(
    payload: CoachCreate,
    db: Session = Depends(get_db),
    user=Depends(require_coach),
):
    """Add a new coach. Any existing coach can do this."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    temp_password = _generate_temp_password()

    # Create Firebase account
    try:
        firebase_auth.create_user(email=payload.email, password=temp_password)
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A Firebase account with this email already exists.",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create login account. Please try again.",
        )

    try:
        from sqlalchemy import func as sqlfunc
        max_id = db.query(sqlfunc.max(User.display_id)).scalar() or 0
        coach_user = User(email=payload.email, first_name=payload.first_name, last_name=payload.last_name, role=UserRole.coach, must_change_password=True, display_id=max_id + 1)
        db.add(coach_user)
        db.commit()
        db.refresh(coach_user)
        return CoachOut(
            id=coach_user.id,
            email=coach_user.email,
            first_name=payload.first_name,
            last_name=payload.last_name,
            temp_password=temp_password,
        )
    except SQLAlchemyError:
        db.rollback()
        # Clean up Firebase user
        try:
            fb = firebase_auth.get_user_by_email(payload.email)
            firebase_auth.delete_user(fb.uid)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create coach. Please try again.",
        )


@router.delete("/{coach_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_coach(
    coach_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_coach),
):
    """Remove a coach account. Coach only."""
    from api.dependencies import guard_superuser_delete
    from uuid import UUID
    try:
        uid = UUID(coach_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID")

    coach = db.query(User).filter(User.id == uid, User.role == UserRole.coach).first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")

    guard_superuser_delete(coach.email, user)

    # No coach can delete another coach — only superuser can
    from api.dependencies import _is_superuser_email
    if not _is_superuser_email(user.email):
        raise HTTPException(status_code=403, detail="Only the platform owner can remove coach accounts.")

    # Prevent self-deletion
    if coach.id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account.")

    email = coach.email
    try:
        db.delete(coach)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove coach. Please try again.",
        )

    try:
        fb = firebase_auth.get_user_by_email(email)
        firebase_auth.delete_user(fb.uid)
    except Exception:
        pass
