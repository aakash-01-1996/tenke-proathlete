from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr
from datetime import datetime

from db.session import get_db
from db.models import SummerCampInquiry
from api.dependencies import require_coach

router = APIRouter()


class InquiryCreate(BaseModel):
    first_name: str
    last_name: str
    child_name: str
    age: int
    email: EmailStr
    phone: str
    hear_about_us: Optional[str] = None
    source: Optional[str] = None


class InquiryOut(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    child_name: str
    age: int
    email: str
    phone: str
    hear_about_us: Optional[str]
    source: Optional[str]
    read: bool
    created_at: datetime


def _to_out(i: SummerCampInquiry) -> InquiryOut:
    return InquiryOut(
        id=i.id,
        first_name=i.first_name,
        last_name=i.last_name,
        child_name=i.child_name,
        age=i.age,
        email=i.email,
        phone=i.phone,
        hear_about_us=i.hear_about_us,
        source=i.source,
        read=(i.read == "true"),
        created_at=i.created_at,
    )


@router.post("/", response_model=InquiryOut, status_code=status.HTTP_201_CREATED)
def create_inquiry(payload: InquiryCreate, db: Session = Depends(get_db)):
    try:
        inquiry = SummerCampInquiry(
            first_name=payload.first_name.strip(),
            last_name=payload.last_name.strip(),
            child_name=payload.child_name.strip(),
            age=payload.age,
            email=payload.email,
            phone=payload.phone.strip(),
            hear_about_us=payload.hear_about_us,
            source=payload.source,
            read="false",
        )
        db.add(inquiry)
        db.commit()
        db.refresh(inquiry)
        return _to_out(inquiry)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to submit inquiry.")


@router.get("/", response_model=List[InquiryOut])
def list_inquiries(db: Session = Depends(get_db), user=Depends(require_coach)):
    return [_to_out(i) for i in db.query(SummerCampInquiry).order_by(SummerCampInquiry.created_at.desc()).all()]


@router.patch("/{inquiry_id}/read", response_model=InquiryOut)
def mark_read(inquiry_id: UUID, db: Session = Depends(get_db), user=Depends(require_coach)):
    inquiry = db.query(SummerCampInquiry).filter(SummerCampInquiry.id == inquiry_id).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found.")
    inquiry.read = "true"
    db.commit()
    db.refresh(inquiry)
    return _to_out(inquiry)


@router.delete("/{inquiry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inquiry(inquiry_id: UUID, db: Session = Depends(get_db), user=Depends(require_coach)):
    inquiry = db.query(SummerCampInquiry).filter(SummerCampInquiry.id == inquiry_id).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found.")
    try:
        db.delete(inquiry)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete inquiry.")


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
def clear_all_inquiries(db: Session = Depends(get_db), user=Depends(require_coach)):
    """Bulk delete all inquiries. Use after exporting data post-event."""
    try:
        db.query(SummerCampInquiry).delete()
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to clear inquiries.")
