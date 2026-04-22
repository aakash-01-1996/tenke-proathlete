import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from uuid import UUID

from firebase_admin import auth as firebase_auth

from db.session import get_db
from db.models import Member, User, UserRole
from db.schemas import MemberCreate, MemberUpdate, MemberOut, MemberCreateOut
from api.dependencies import require_coach_or_trainer, get_current_user, guard_superuser_delete


def _generate_temp_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

router = APIRouter()


def _next_display_id(db: Session) -> int:
    from sqlalchemy import func as sqlfunc
    max_id = db.query(sqlfunc.max(Member.display_id)).scalar()
    return (max_id or 100) + 1


def _member_or_404(member_id: UUID, db: Session) -> Member:
    m = db.query(Member).filter(Member.id == member_id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return m


@router.get("/me", response_model=MemberOut)
def get_my_profile(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Member fetches their own profile."""
    if user.role != "member":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Members only")
    if not user.ref_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member profile not found")
    try:
        return _member_or_404(user.ref_id, db)
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load your profile. Please try again.",
        )


@router.get("/", response_model=List[MemberOut])
def list_members(
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """List all members. Coach/trainer only."""
    from core.config import settings
    try:
        q = db.query(Member)
        if settings.SMTP_REPLY_TO:
            q = q.filter(Member.email != settings.SMTP_REPLY_TO)
        return q.order_by(Member.display_id.asc()).all()
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load members. Please try again.",
        )


@router.get("/{member_id}", response_model=MemberOut)
def get_member(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Get a single member by ID."""
    try:
        return _member_or_404(member_id, db)
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load member. Please try again.",
        )


@router.post("/", response_model=MemberCreateOut, status_code=status.HTTP_201_CREATED)
def create_member(
    payload: MemberCreate,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Add a new member. Coach/trainer only. Creates Firebase account + User row."""
    existing = db.query(Member).filter(Member.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A member with this email already exists.",
        )

    temp_password = _generate_temp_password()

    # Create Firebase user
    try:
        firebase_auth.create_user(email=payload.email, password=temp_password)
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A Firebase account with this email already exists.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create login account. Please try again.",
        )

    try:
        data = payload.model_dump()
        training_days = data.pop("training_days", None)
        member = Member(
            **data,
            display_id=_next_display_id(db),
            training_days=",".join(training_days) if training_days else None,
        )
        db.add(member)
        db.flush()  # get member.id before committing

        # Create the User row linking to this member
        db_user = User(email=payload.email, role=UserRole.member, ref_id=member.id, must_change_password=True)
        db.add(db_user)
        db.commit()
        db.refresh(member)

        out = MemberCreateOut.model_validate(member)
        out.temp_password = temp_password
        return out
    except SQLAlchemyError:
        db.rollback()
        # Best-effort: delete the Firebase user we just created
        try:
            fb_user = firebase_auth.get_user_by_email(payload.email)
            firebase_auth.delete_user(fb_user.uid)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add member. Please try again.",
        )


@router.put("/{member_id}", response_model=MemberOut)
def update_member(
    member_id: UUID,
    payload: MemberUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Update a member's info. Coach/trainer only."""
    member = _member_or_404(member_id, db)
    old_email = member.email
    try:
        data = payload.model_dump(exclude_unset=True)
        if "training_days" in data:
            days = data.pop("training_days")
            member.training_days = ",".join(days) if days else None
        for field, value in data.items():
            setattr(member, field, value)

        # Keep User row email in sync
        new_email = data.get("email")
        if new_email and new_email != old_email:
            db_user = db.query(User).filter(User.email == old_email).first()
            if db_user:
                db_user.email = new_email

        db.commit()
        db.refresh(member)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update member. Please try again.",
        )

    # Best-effort Firebase email update
    new_email = payload.model_dump(exclude_unset=True).get("email")
    if new_email and new_email != old_email:
        try:
            fb_user = firebase_auth.get_user_by_email(old_email)
            firebase_auth.update_user(fb_user.uid, email=new_email)
        except Exception:
            pass  # Firebase user may not exist; not a hard failure

    return member


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Permanently remove a member, their User row, and their Firebase account."""
    member = _member_or_404(member_id, db)
    guard_superuser_delete(member.email, user)
    email = member.email
    try:
        # Remove User row first (FK safe — no cascade needed)
        db_user = db.query(User).filter(User.email == email).first()
        if db_user:
            db.delete(db_user)
        db.delete(member)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove member. Please try again.",
        )

    # Best-effort Firebase cleanup — after DB commit so a Firebase error doesn't
    # roll back the DB deletion.
    try:
        fb_user = firebase_auth.get_user_by_email(email)
        firebase_auth.delete_user(fb_user.uid)
    except Exception:
        pass  # Firebase user may not exist; not a hard failure


@router.post("/{member_id}/attend", response_model=MemberOut)
def mark_attended(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_coach_or_trainer),
):
    """Decrement sessions_left by 1. Coach/trainer only."""
    member = _member_or_404(member_id, db)
    if member.sessions_left is None:
        raise HTTPException(status_code=400, detail="No session count set for this member.")
    if member.sessions_left <= 0:
        raise HTTPException(status_code=400, detail="No sessions remaining.")
    try:
        member.sessions_left -= 1
        db.commit()
        db.refresh(member)
        return member
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update session count.")
