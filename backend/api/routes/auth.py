from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from api.dependencies import get_current_user, is_privileged
from db.session import get_db
from db.models import Trainer, Member, User, UserRole

router = APIRouter()


class MeOut(BaseModel):
    email: str
    role: str
    name: Optional[str] = None
    ref_id: Optional[UUID] = None
    is_privileged: bool = False
    must_change_password: bool = False

    class Config:
        from_attributes = True


@router.get("/me", response_model=MeOut)
def get_me(user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns the authenticated user's email, role, ref_id, and privilege level."""
    name: Optional[str] = None
    if user.ref_id:
        if user.role.value in ("coach", "trainer"):
            row = db.query(Trainer).filter(Trainer.id == user.ref_id).first()
        else:
            row = db.query(Member).filter(Member.id == user.ref_id).first()
        if row:
            name = f"{row.first_name} {row.last_name}".strip()

    return MeOut(
        email=user.email,
        role=user.role.value,
        name=name,
        ref_id=user.ref_id,
        is_privileged=is_privileged(user.email),
        must_change_password=user.must_change_password,
    )


class VerifyIdentityIn(BaseModel):
    email: str
    display_id: int


@router.post("/verify-identity")
def verify_identity(payload: VerifyIdentityIn, db: Session = Depends(get_db)):
    """
    Check that email + display_id match a real account.
    Always returns {valid: bool} — never reveals which field was wrong.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.ref_id:
        return {"valid": False}

    if user.role == UserRole.member:
        row = db.query(Member).filter(
            Member.id == user.ref_id,
            Member.display_id == payload.display_id,
        ).first()
    else:
        row = db.query(Trainer).filter(
            Trainer.id == user.ref_id,
            Trainer.display_id == payload.display_id,
        ).first()

    return {"valid": row is not None}


@router.patch("/mark-password-changed", status_code=204)
def mark_password_changed(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Called after user sets their own password. Clears the force-change flag."""
    user.must_change_password = False
    db.add(user)
    db.commit()
