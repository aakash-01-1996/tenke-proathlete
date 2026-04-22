from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from core.config import settings
from api.routes import auth, members, trainers, coaches, community, nutrition, metrics, inquiries, gameplan
from api.routes import day_change_requests, events, bookings, contact_messages
from api.dependencies import require_coach_or_trainer
from db.session import get_db
from db.models import Trainer, User, UserRole
from sqlalchemy.orm import Session

app = FastAPI(title="ProAthelete API")
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(members.router, prefix="/members", tags=["members"])
app.include_router(trainers.router, prefix="/trainers", tags=["trainers"])
app.include_router(coaches.router, prefix="/coaches", tags=["coaches"])
app.include_router(community.router, prefix="/community", tags=["community"])
app.include_router(nutrition.router, prefix="/nutrition", tags=["nutrition"])
app.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
app.include_router(inquiries.router, prefix="/inquiries", tags=["inquiries"])
app.include_router(gameplan.router, prefix="/gameplan", tags=["gameplan"])
app.include_router(day_change_requests.router, prefix="/day-change-requests", tags=["day-change-requests"])
app.include_router(events.router, prefix="/events", tags=["events"])
app.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
app.include_router(contact_messages.router, prefix="/contact-messages", tags=["contact-messages"])


@app.get("/staff")
def list_staff(db: Session = Depends(get_db), user=Depends(require_coach_or_trainer)):
    """Return all trainers + coaches combined for assignment dropdowns."""
    from core.config import settings
    result = []
    for t in db.query(Trainer).order_by(Trainer.first_name).all():
        result.append({"id": str(t.id), "first_name": t.first_name, "last_name": t.last_name, "role": "trainer"})
    for c in db.query(User).filter(User.role == UserRole.coach).order_by(User.first_name).all():
        if c.email == settings.SMTP_REPLY_TO:
            continue
        result.append({"id": str(c.id), "first_name": c.first_name or c.email, "last_name": c.last_name or "", "role": "coach"})
    return result


@app.get("/")
def health_check():
    return {"status": "ok"}
