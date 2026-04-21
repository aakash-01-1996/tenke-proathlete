from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from uuid import UUID
from pydantic import BaseModel
from typing import Optional

from db.session import get_db
from db.models import GameplanPDF
from db.schemas import GameplanPDFOut
from api.dependencies import get_current_user, require_coach_or_trainer

router = APIRouter()


class GameplanPDFCreate(BaseModel):
    title: str
    category: str
    description: Optional[str] = None
    file_url: str
    cloudinary_public_id: Optional[str] = None


@router.get("/", response_model=List[GameplanPDFOut])
def list_pdfs(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(GameplanPDF).order_by(GameplanPDF.created_at.desc()).all()


@router.post("/", response_model=GameplanPDFOut, status_code=status.HTTP_201_CREATED)
def create_pdf(payload: GameplanPDFCreate, db: Session = Depends(get_db), user=Depends(require_coach_or_trainer)):
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Title is required.")
    try:
        pdf = GameplanPDF(
            title=payload.title.strip(),
            category=payload.category,
            description=payload.description,
            file_url=payload.file_url,
            cloudinary_public_id=payload.cloudinary_public_id,
        )
        db.add(pdf)
        db.commit()
        db.refresh(pdf)
        return pdf
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save PDF.")


@router.delete("/{pdf_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pdf(pdf_id: UUID, db: Session = Depends(get_db), user=Depends(require_coach_or_trainer)):
    pdf = db.query(GameplanPDF).filter(GameplanPDF.id == pdf_id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found.")
    # Best-effort delete from Cloudinary
    if pdf.cloudinary_public_id:
        try:
            import cloudinary.uploader
            cloudinary.uploader.destroy(pdf.cloudinary_public_id, resource_type="raw")
        except Exception:
            pass
    try:
        db.delete(pdf)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete PDF.")
