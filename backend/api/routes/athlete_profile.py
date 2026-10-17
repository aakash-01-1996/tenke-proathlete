from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from uuid import UUID

from db.session import get_db
from db.models import AthleteProfile, Member
from db.schemas import AthleteProfileIn, AthleteProfileOut
from api.dependencies import get_current_user

router = APIRouter()


def _authorize(member_id: UUID, user) -> None:
    if user.role in ("coach", "trainer"):
        return
    if user.role == "member" and user.ref_id == member_id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this member")


def _member_or_404(member_id: UUID, db: Session) -> Member:
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return member


@router.get("/{member_id}", response_model=AthleteProfileOut)
def get_profile(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    _authorize(member_id, user)
    _member_or_404(member_id, db)
    profile = db.query(AthleteProfile).filter(AthleteProfile.member_id == member_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Athlete profile not set up yet")
    return profile


@router.put("/{member_id}", response_model=AthleteProfileOut)
def upsert_profile(
    member_id: UUID,
    payload: AthleteProfileIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    _authorize(member_id, user)
    _member_or_404(member_id, db)
    try:
        profile = db.query(AthleteProfile).filter(AthleteProfile.member_id == member_id).first()
        if not profile:
            profile = AthleteProfile(member_id=member_id)
            db.add(profile)

        profile.primary_goal = payload.primary_goal
        profile.secondary_goals = ",".join(payload.secondary_goals) if payload.secondary_goals else None
        profile.workout_style = payload.workout_style
        profile.experience_level = payload.experience_level
        profile.target_weight = payload.target_weight
        profile.sessions_per_week_pref = payload.sessions_per_week_pref
        profile.equipment_access = ",".join(payload.equipment_access) if payload.equipment_access else None
        profile.injury_notes = payload.injury_notes
        profile.dietary_preferences = ",".join(payload.dietary_preferences) if payload.dietary_preferences else None
        profile.allergies = payload.allergies
        profile.daily_calorie_target = payload.daily_calorie_target
        profile.notes = payload.notes

        db.commit()
        db.refresh(profile)
        return profile
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save athlete profile.")
