"""
Shared fixtures for all backend tests.

Strategy:
- Patch firebase_admin at import time so no service account file is needed.
- Use a file-based SQLite (test.db) so all connections share the same schema.
- Override the FastAPI get_db dependency to use SQLite sessions.
- Each test drops and recreates all tables for isolation.
"""

import os
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ── Patch Firebase BEFORE importing anything from the app ────────────────────

patch("firebase_admin._apps", {"[DEFAULT]": MagicMock()}).start()
patch("firebase_admin.initialize_app", return_value=MagicMock()).start()
patch("firebase_admin.credentials.Certificate", return_value=MagicMock()).start()
patch("firebase_admin.auth.verify_id_token", return_value={}).start()

# ── Now safe to import app modules ───────────────────────────────────────────

from fastapi.testclient import TestClient  # noqa: E402
import db.session as db_session  # noqa: E402
from db.session import Base, get_db  # noqa: E402
from db.models import User, UserRole  # noqa: E402
from main import app  # noqa: E402

# ── File-based SQLite so all connections share the same schema ────────────────

TEST_DB_PATH = "/tmp/proathelete_test.db"
SQLITE_URL = f"sqlite:///{TEST_DB_PATH}"
test_engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Redirect module-level references so app code uses SQLite
db_session.engine = test_engine
db_session.SessionLocal = TestingSessionLocal


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Per-test schema teardown/setup ────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_schema():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


# ── FastAPI client ────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ── DB session fixture ────────────────────────────────────────────────────────

@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ── Pre-built user fixtures ───────────────────────────────────────────────────

@pytest.fixture
def coach_user(db):
    user = User(email="coach@test.com", role=UserRole.coach)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def trainer_user(db):
    user = User(email="trainer@test.com", role=UserRole.trainer)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def member_user(db):
    user = User(email="member@test.com", role=UserRole.member)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── Auth helpers ──────────────────────────────────────────────────────────────

def auth_patch(decoded: dict):
    """Patch Firebase token verification to return `decoded`."""
    return patch("firebase_admin.auth.verify_id_token", return_value=decoded)


def make_coach_token(email: str = "coach@test.com"):
    return "Bearer mock-token", {"email": email, "uid": "coach-uid"}


def make_trainer_token(email: str = "trainer@test.com"):
    return "Bearer mock-token", {"email": email, "uid": "trainer-uid"}


def make_member_token(email: str = "member@test.com"):
    return "Bearer mock-token", {"email": email, "uid": "member-uid"}
