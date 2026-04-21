from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

from core.config import settings
from db.session import get_db
from db.models import User, UserRole

# Initialise Firebase Admin SDK once
if not firebase_admin._apps:
    import os, json
    sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        cred = credentials.Certificate(json.loads(sa_json))
    else:
        cred = credentials.Certificate("firebase_service_account.json")
    firebase_admin.initialize_app(cred)

bearer_scheme = HTTPBearer()


def _is_superuser_email(email: str) -> bool:
    su = settings.SMTP_REPLY_TO
    return bool(su and email == su)


def is_head_coach(email: str) -> bool:
    hc = settings.SMTP_HOST_USER.strip()
    return bool(hc and email == hc)


def is_privileged(email: str) -> bool:
    """Superuser or head coach — can act without approval."""
    return _is_superuser_email(email) or is_head_coach(email)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    email = decoded.get("email")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Auto-provision superuser on first login — no one else gets in without being added
        if _is_superuser_email(email):
            user = User(email=email, role=UserRole.coach)
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Superuser always gets coach-level role in memory — never stored differently
    if _is_superuser_email(email):
        user.role = UserRole.coach

    return user


def require_coach(user: User = Depends(get_current_user)) -> User:
    if user.role != "coach":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Coach access only")
    return user


def require_coach_or_trainer(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("coach", "trainer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Coach or trainer access only")
    return user


def require_member(user: User = Depends(get_current_user)) -> User:
    if user.role != "member":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Member access only")
    return user


def guard_superuser_delete(target_email: str, acting_user: User) -> None:
    """Raise 403 if anyone tries to delete the superuser account."""
    if _is_superuser_email(target_email) and not _is_superuser_email(acting_user.email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account cannot be deleted.",
        )
