import uuid
from sqlalchemy import Column, String, Integer, Float, ForeignKey, Enum, DateTime, Date, Boolean
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
