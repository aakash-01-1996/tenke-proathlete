from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import auth, members, trainers, coaches, community, nutrition, metrics, inquiries, gameplan
from api.routes import day_change_requests, events, bookings, contact_messages

app = FastAPI(title="ProAthelete API")

from core.config import settings

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.ALLOWED_ORIGINS.split(",")],
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


@app.get("/")
def health_check():
    return {"status": "ok"}
