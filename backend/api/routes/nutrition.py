from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from uuid import UUID

from db.session import get_db
from db.models import Member, NutritionPlan, NutritionMeal
from db.schemas import NutritionPlanOut, NutritionMealOut
from api.dependencies import get_current_user

router = APIRouter()


@router.get("/{member_id}/plan", response_model=NutritionPlanOut)
def get_active_plan(
    member_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Returns the member's active nutrition plan, or 404 if none has been approved yet."""
    if user.role == "member" and user.ref_id != member_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this member")
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    try:
        plan = (
            db.query(NutritionPlan)
            .filter(NutritionPlan.member_id == member_id, NutritionPlan.is_active == True)  # noqa: E712
            .first()
        )
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active nutrition plan yet")
        meals = (
            db.query(NutritionMeal)
            .filter(NutritionMeal.plan_id == plan.id)
            .order_by(NutritionMeal.meal_order.asc())
            .all()
        )
        out = NutritionPlanOut.model_validate(plan)
        out.meals = [NutritionMealOut.model_validate(m) for m in meals]
        return out
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Failed to load nutrition plan.")
