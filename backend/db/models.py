import uuid
from sqlalchemy import Column, String, Integer, Float, ForeignKey, Enum, DateTime, Date, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base
import enum

class UserRole(str, enum.Enum):
    coach = "coach"
    trainer = "trainer"
    member = "member"

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    display_id = Column(Integer, unique=True, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.member)
    ref_id = Column(UUID(as_uuid=True), nullable=True)
    must_change_password = Column(Boolean, default=False, server_default='false', nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Trainer(Base):
    __tablename__ = "trainers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    display_id = Column(Integer, unique=True, nullable=True)  # e.g. 1, 2, 3 — shown as TRN-001
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, nullable=True)
    title = Column(String, nullable=True)           # e.g. "Coach", "Trainer", "Advisor"
    specializations = Column(String, nullable=True) # free-text
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Member(Base):
    __tablename__ = "members"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    display_id = Column(Integer, unique=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String)
    age = Column(Integer)
    weight = Column(String)
    height = Column(String)
    trainer_id = Column(UUID(as_uuid=True), ForeignKey("trainers.id"), nullable=True)
    package = Column(String, nullable=True)
    sessions_total = Column(Integer, nullable=True)
    sessions_left = Column(Integer, nullable=True)
    training_days = Column(String, nullable=True)  # comma-separated e.g. "M,W,F"
    training_time = Column(String, nullable=True)  # e.g. "7:00 AM"
    training_goal = Column(Text, nullable=True)    # HTML string from rich-text editor
    last_active_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class BookingRequest(Base):
    __tablename__ = "booking_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    experience = Column(String, nullable=True)   # beginner, intermediate, advanced, pro
    goal = Column(String, nullable=True)         # speed, strength, agility, vertical, overall, other
    goal_other = Column(String, nullable=True)   # filled when goal = "other"
    preferred_days = Column(String, nullable=True)  # comma-separated e.g. "M,W,F"
    message = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Event(Base):
    __tablename__ = "events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String, unique=True, nullable=False)  # e.g. "summer-camp-2026"
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=False)
    dates = Column(String, nullable=True)
    who_is_it_for = Column(String, nullable=True)
    whats_included = Column(String, nullable=True)
    location = Column(String, nullable=True)
    cover_image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DayChangeRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    denied = "denied"

class DayChangeRequest(Base):
    __tablename__ = "day_change_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(UUID(as_uuid=True), ForeignKey("members.id"), nullable=False)
    requested_days = Column(String, nullable=False)   # comma-separated e.g. "M,Th"
    note = Column(String, nullable=True)
    status = Column(Enum(DayChangeRequestStatus), nullable=False, default=DayChangeRequestStatus.pending)
    reviewed_by = Column(UUID(as_uuid=True), nullable=True)  # trainer/coach user id
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

class TrainerRemovalRequest(Base):
    __tablename__ = "trainer_removal_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trainer_id = Column(UUID(as_uuid=True), ForeignKey("trainers.id"), nullable=False)
    requested_by = Column(String, nullable=False)   # coach email
    reason = Column(String, nullable=True)
    status = Column(Enum(DayChangeRequestStatus), nullable=False, default=DayChangeRequestStatus.pending)
    reviewed_by = Column(String, nullable=True)     # head coach email
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)


class SummerCampInquiry(Base):
    __tablename__ = "summer_camp_inquiries"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    child_name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    hear_about_us = Column(String, nullable=True)
    source = Column(String, nullable=True)
    read = Column(String, nullable=False, default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ContactMessage(Base):
    __tablename__ = "contact_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    concern = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CommunityPost(Base):
    __tablename__ = "community_posts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_email = Column(String, nullable=False)
    author_name = Column(String, nullable=False)
    content = Column(String, nullable=False)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CommunityComment(Base):
    __tablename__ = "community_comments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False)
    author_email = Column(String, nullable=False)
    author_name = Column(String, nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CommunityReport(Base):
    __tablename__ = "community_reports"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_type = Column(String, nullable=False)   # 'post' | 'comment'
    content_id = Column(UUID(as_uuid=True), nullable=False)
    post_id = Column(UUID(as_uuid=True), nullable=False)  # always the parent post id
    reported_by_email = Column(String, nullable=False)
    reason = Column(String, nullable=True)
    status = Column(String, nullable=False, default='pending')  # 'pending' | 'dismissed'
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class GameplanPDF(Base):
    __tablename__ = "gameplan_pdfs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=True)
    file_url = Column(String, nullable=False)   # Cloudinary URL
    cloudinary_public_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Metric(Base):
    __tablename__ = "metrics"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(UUID(as_uuid=True), ForeignKey("members.id"), nullable=False)
    recorded_at = Column(Date, nullable=False)
    fly_10yd = Column(Float, nullable=True)      # seconds (lower = better)
    game_speed = Column(Float, nullable=True)    # mph
    vertical = Column(Float, nullable=True)      # inches
    broad_jump = Column(Float, nullable=True)    # inches
    overall_progress = Column(Integer, nullable=True)  # 0–100 score
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WorkoutDay(Base):
    __tablename__ = "workout_days"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(UUID(as_uuid=True), ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    day_number = Column(Integer, nullable=False)   # 1, 2, 3 …
    label = Column(String, nullable=False, default='Workout')  # editable e.g. "Upper Body"
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WorkoutExercise(Base):
    __tablename__ = "workout_exercises"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(UUID(as_uuid=True), ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    day_id = Column(UUID(as_uuid=True), ForeignKey("workout_days.id", ondelete="CASCADE"), nullable=True)
    category = Column(String, nullable=True)    # kept for legacy data
    is_rest = Column(Boolean, nullable=False, default=False, server_default='false')
    rest_seconds = Column(Integer, nullable=True)  # e.g. 60, 90, 120
    name = Column(String, nullable=False)
    sets = Column(Integer, nullable=True)
    reps = Column(Integer, nullable=True)
    duration = Column(String, nullable=True)     # e.g. "20 min", "30 sec"
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ExerciseWeightLog(Base):
    __tablename__ = "exercise_weight_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("workout_exercises.id", ondelete="CASCADE"), nullable=False)
    weight = Column(String, nullable=False)      # e.g. "45 lbs", "20 kg"
    logged_at = Column(Date, nullable=False, server_default=func.current_date())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AthleteProfile(Base):
    __tablename__ = "athlete_profiles"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(UUID(as_uuid=True), ForeignKey("members.id", ondelete="CASCADE"), unique=True, nullable=False)
    primary_goal = Column(String, nullable=True)           # e.g. "speed", "strength", "vertical", "weight_loss"
    secondary_goals = Column(String, nullable=True)        # comma-separated
    workout_style = Column(String, nullable=True)          # e.g. "strength", "agility", "hybrid", "conditioning"
    experience_level = Column(String, nullable=True)       # "beginner", "intermediate", "advanced", "pro"
    target_weight = Column(String, nullable=True)          # e.g. "165 lbs"
    sessions_per_week_pref = Column(Integer, nullable=True)
    equipment_access = Column(String, nullable=True)        # comma-separated e.g. "gym,home,bands"
    injury_notes = Column(Text, nullable=True)
    dietary_preferences = Column(String, nullable=True)    # comma-separated e.g. "vegetarian,gluten_free"
    allergies = Column(Text, nullable=True)
    daily_calorie_target = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AIPlanRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    denied = "denied"
    failed = "failed"


class AIWorkoutPlanRequest(Base):
    __tablename__ = "ai_workout_plan_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(UUID(as_uuid=True), ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    requested_by = Column(UUID(as_uuid=True), nullable=False)
    trigger_source = Column(String, nullable=False)   # "member" | "coach"
    status = Column(Enum(AIPlanRequestStatus), nullable=False, default=AIPlanRequestStatus.pending)
    model_used = Column(String, nullable=True)
    raw_response_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    coach_notes = Column(Text, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)


class AIWorkoutPlanDay(Base):
    __tablename__ = "ai_workout_plan_days"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(UUID(as_uuid=True), ForeignKey("ai_workout_plan_requests.id", ondelete="CASCADE"), nullable=False)
    day_number = Column(Integer, nullable=False)
    label = Column(String, nullable=False, default="Workout")


class AIWorkoutPlanExercise(Base):
    __tablename__ = "ai_workout_plan_exercises"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_day_id = Column(UUID(as_uuid=True), ForeignKey("ai_workout_plan_days.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    sets = Column(Integer, nullable=True)
    reps = Column(Integer, nullable=True)
    duration = Column(String, nullable=True)
    is_rest = Column(Boolean, nullable=False, default=False, server_default='false')
    rest_seconds = Column(Integer, nullable=True)
    ai_rationale = Column(Text, nullable=True)   # coach-facing context only, not copied on approval


class NutritionPlan(Base):
    __tablename__ = "nutrition_plans"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(UUID(as_uuid=True), ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    daily_calories = Column(Integer, nullable=True)
    daily_protein_g = Column(Integer, nullable=True)
    daily_carbs_g = Column(Integer, nullable=True)
    daily_fat_g = Column(Integer, nullable=True)
    summary_notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default='true')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NutritionMeal(Base):
    __tablename__ = "nutrition_meals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("nutrition_plans.id", ondelete="CASCADE"), nullable=False)
    meal_order = Column(Integer, nullable=False)
    label = Column(String, nullable=False, default="Meal")
    food_items = Column(Text, nullable=True)
    calories = Column(Integer, nullable=True)
    protein_g = Column(Integer, nullable=True)
    carbs_g = Column(Integer, nullable=True)
    fat_g = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)


class AINutritionPlanRequest(Base):
    __tablename__ = "ai_nutrition_plan_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(UUID(as_uuid=True), ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    requested_by = Column(UUID(as_uuid=True), nullable=False)
    trigger_source = Column(String, nullable=False)   # "member" | "coach"
    status = Column(Enum(AIPlanRequestStatus), nullable=False, default=AIPlanRequestStatus.pending)
    model_used = Column(String, nullable=True)
    raw_response_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    coach_notes = Column(Text, nullable=True)
    daily_calories = Column(Integer, nullable=True)
    daily_protein_g = Column(Integer, nullable=True)
    daily_carbs_g = Column(Integer, nullable=True)
    daily_fat_g = Column(Integer, nullable=True)
    summary_notes = Column(Text, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)


class AINutritionPlanMeal(Base):
    __tablename__ = "ai_nutrition_plan_meals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(UUID(as_uuid=True), ForeignKey("ai_nutrition_plan_requests.id", ondelete="CASCADE"), nullable=False)
    meal_order = Column(Integer, nullable=False)
    label = Column(String, nullable=False, default="Meal")
    food_items = Column(Text, nullable=True)
    calories = Column(Integer, nullable=True)
    protein_g = Column(Integer, nullable=True)
    carbs_g = Column(Integer, nullable=True)
    fat_g = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
