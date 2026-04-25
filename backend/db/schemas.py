from pydantic import BaseModel, field_validator, EmailStr
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID

VALID_EXPERIENCE = {"beginner", "intermediate", "advanced", "pro"}
VALID_GOALS = {"speed", "strength", "agility", "vertical", "overall", "other"}
VALID_DAYS = {"M", "T", "W", "Th", "F", "Sa", "Su"}


# ── Booking Requests ─────────────────────────────────────────────────────────

class BookingRequestCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    age: Optional[int] = None
    experience: Optional[str] = None
    goal: Optional[str] = None
    goal_other: Optional[str] = None
    preferred_days: Optional[List[str]] = None
    message: Optional[str] = None

    @field_validator('first_name', 'last_name')
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Name cannot be empty')
        if len(v) > 100:
            raise ValueError('Name too long')
        return v

    @field_validator('age')
    @classmethod
    def age_valid(cls, v):
        if v is not None and not (5 <= v <= 100):
            raise ValueError('Age must be between 5 and 100')
        return v

    @field_validator('experience')
    @classmethod
    def experience_valid(cls, v):
        if v is not None and v not in VALID_EXPERIENCE:
            raise ValueError(f'Experience must be one of: {", ".join(VALID_EXPERIENCE)}')
        return v

    @field_validator('goal')
    @classmethod
    def goal_valid(cls, v):
        if v is not None and v not in VALID_GOALS:
            raise ValueError(f'Goal must be one of: {", ".join(VALID_GOALS)}')
        return v

    @field_validator('goal_other')
    @classmethod
    def goal_other_required_if_other(cls, v, info):
        if info.data.get('goal') == 'other' and not (v or '').strip():
            raise ValueError('Please describe your goal')
        return v

    @field_validator('preferred_days')
    @classmethod
    def days_valid(cls, v):
        if v:
            invalid = [d for d in v if d not in VALID_DAYS]
            if invalid:
                raise ValueError(f'Invalid days: {", ".join(invalid)}')
        return v

    @field_validator('message')
    @classmethod
    def message_length(cls, v):
        if v and len(v) > 1000:
            raise ValueError('Message too long (max 1000 characters)')
        return v


class BookingRequestOut(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    age: Optional[int]
    experience: Optional[str]
    goal: Optional[str]
    goal_other: Optional[str]
    preferred_days: Optional[List[str]]
    message: Optional[str]
    created_at: datetime

    @field_validator('preferred_days', mode='before')
    @classmethod
    def parse_preferred_days(cls, v):
        if isinstance(v, str):
            return [d.strip() for d in v.split(',') if d.strip()]
        return v

    class Config:
        from_attributes = True


# ── Members ──────────────────────────────────────────────────────────────────

class MemberCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    age: Optional[int] = None
    weight: Optional[str] = None
    height: Optional[str] = None
    trainer_id: Optional[UUID] = None
    package: Optional[str] = None
    sessions_total: Optional[int] = None
    sessions_left: Optional[int] = None
    training_days: Optional[List[str]] = None  # e.g. ["M", "W", "F"]


class MemberUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[int] = None
    weight: Optional[str] = None
    height: Optional[str] = None
    trainer_id: Optional[UUID] = None
    package: Optional[str] = None
    sessions_total: Optional[int] = None
    sessions_left: Optional[int] = None
    training_days: Optional[List[str]] = None


class MemberOut(BaseModel):
    id: UUID
    display_id: int
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    age: Optional[int]
    weight: Optional[str]
    height: Optional[str]
    trainer_id: Optional[UUID]
    package: Optional[str]
    sessions_total: Optional[int]
    sessions_left: Optional[int]
    training_days: Optional[List[str]]
    training_goal: Optional[str] = None
    created_at: datetime
    last_active_at: Optional[datetime] = None

    @field_validator('training_days', mode='before')
    @classmethod
    def parse_training_days(cls, v):
        if isinstance(v, str):
            return [d.strip() for d in v.split(',') if d.strip()]
        return v

    class Config:
        from_attributes = True


class MemberCreateOut(MemberOut):
    """Returned only on POST /members/ — includes the generated temp password."""
    temp_password: str = ""


# ── Trainers ─────────────────────────────────────────────────────────────────

class TrainerCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    title: Optional[str] = None
    specializations: Optional[str] = None

    @field_validator('first_name', 'last_name')
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Name cannot be empty')
        if len(v) > 100:
            raise ValueError('Name too long')
        return v


class TrainerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    specializations: Optional[str] = None


class TrainerOut(BaseModel):
    id: UUID
    display_id: Optional[int] = None
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    title: Optional[str]
    specializations: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Trainer Removal Requests ─────────────────────────────────────────────────

class TrainerRemovalRequestOut(BaseModel):
    id: UUID
    trainer_id: UUID
    trainer_name: Optional[str] = None
    requested_by: str
    reason: Optional[str]
    status: str
    reviewed_by: Optional[str]
    created_at: datetime
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Coaches ──────────────────────────────────────────────────────────────────

class CoachCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr

    @field_validator('first_name', 'last_name')
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Name cannot be empty')
        return v


class CoachOut(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    temp_password: str


# ── Events ───────────────────────────────────────────────────────────────────

class EventCreate(BaseModel):
    slug: str
    title: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: date
    dates: Optional[str] = None
    who_is_it_for: Optional[str] = None
    whats_included: Optional[str] = None
    location: Optional[str] = None
    cover_image_url: Optional[str] = None

    @field_validator('slug')
    @classmethod
    def slug_valid(cls, v: str) -> str:
        import re
        v = v.strip().lower()
        if not v:
            raise ValueError('Slug cannot be empty')
        if not re.match(r'^[a-z0-9]+(?:-[a-z0-9]+)*$', v):
            raise ValueError('Slug must be lowercase letters, numbers, and hyphens only (e.g. summer-camp-2026)')
        if len(v) > 80:
            raise ValueError('Slug too long (max 80 characters)')
        return v

    @field_validator('title')
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Title cannot be empty')
        return v


class EventUpdate(BaseModel):
    slug: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    dates: Optional[str] = None
    who_is_it_for: Optional[str] = None
    whats_included: Optional[str] = None
    location: Optional[str] = None
    cover_image_url: Optional[str] = None

    @field_validator('slug')
    @classmethod
    def slug_valid(cls, v):
        if v is None:
            return v
        import re
        v = v.strip().lower()
        if not v:
            raise ValueError('Slug cannot be empty')
        if not re.match(r'^[a-z0-9]+(?:-[a-z0-9]+)*$', v):
            raise ValueError('Slug must be lowercase letters, numbers, and hyphens only')
        if len(v) > 80:
            raise ValueError('Slug too long (max 80 characters)')
        return v


class EventOut(BaseModel):
    id: UUID
    slug: str
    title: str
    description: Optional[str]
    start_date: Optional[date]
    end_date: date
    dates: Optional[str]
    who_is_it_for: Optional[str]
    whats_included: Optional[str]
    location: Optional[str]
    cover_image_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Day Change Requests ───────────────────────────────────────────────────────

class DayChangeRequestCreate(BaseModel):
    requested_days: List[str]  # e.g. ["M", "W", "F"]
    note: Optional[str] = None


class DayChangeRequestOut(BaseModel):
    id: UUID
    member_id: UUID
    requested_days: List[str]
    note: Optional[str]
    status: str
    reviewed_by: Optional[UUID]
    created_at: datetime
    reviewed_at: Optional[datetime]

    @field_validator('requested_days', mode='before')
    @classmethod
    def parse_requested_days(cls, v):
        if isinstance(v, str):
            return [d.strip() for d in v.split(',') if d.strip()]
        return v

    class Config:
        from_attributes = True


# ── Contact Messages ─────────────────────────────────────────────────────────

class ContactMessageCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    concern: str

    @field_validator('name')
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Name cannot be empty')
        if len(v) > 100:
            raise ValueError('Name too long')
        return v

    @field_validator('concern')
    @classmethod
    def concern_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Please describe your concern')
        if len(v) > 2000:
            raise ValueError('Message too long (max 2000 characters)')
        return v

    @field_validator('phone')
    @classmethod
    def phone_length(cls, v):
        if v and len(v) > 20:
            raise ValueError('Phone number too long')
        return v


class ContactMessageOut(BaseModel):
    id: UUID
    name: str
    email: str
    phone: Optional[str]
    concern: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Community ────────────────────────────────────────────────────────────────

class CommentOut(BaseModel):
    id: UUID
    post_id: UUID
    author_email: str
    author_name: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class PostCreate(BaseModel):
    content: str
    image_url: Optional[str] = None

class PostOut(BaseModel):
    id: UUID
    author_email: str
    author_name: str
    content: str
    image_url: Optional[str]
    created_at: datetime
    comments: List[CommentOut] = []

    class Config:
        from_attributes = True

class CommentCreate(BaseModel):
    content: str


# ── Gameplan ─────────────────────────────────────────────────────────────────

class GameplanPDFOut(BaseModel):
    id: UUID
    title: str
    category: str
    description: Optional[str]
    file_url: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Metrics ─────────────────────────────────────────────────────────────────

class MetricCreate(BaseModel):
    member_id: UUID
    recorded_at: date
    fly_10yd: Optional[float] = None
    game_speed: Optional[float] = None
    vertical: Optional[float] = None
    broad_jump: Optional[float] = None
    overall_progress: Optional[int] = None


class MetricUpdate(BaseModel):
    recorded_at: Optional[date] = None
    fly_10yd: Optional[float] = None
    game_speed: Optional[float] = None
    vertical: Optional[float] = None
    broad_jump: Optional[float] = None
    overall_progress: Optional[int] = None


class MetricOut(BaseModel):
    id: UUID
    member_id: UUID
    recorded_at: date
    fly_10yd: Optional[float]
    game_speed: Optional[float]
    vertical: Optional[float]
    broad_jump: Optional[float]
    overall_progress: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
