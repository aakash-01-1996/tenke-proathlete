"""
Run this once to insert the coach user into the DB after creating them in Firebase.

Usage:
  source venv/bin/activate
  python scripts/create_coach.py --email coach@example.com
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import argparse
from db.session import SessionLocal
from db.models import User, UserRole

def create_coach(email: str):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"User {email} already exists with role: {existing.role}")
            return

        user = User(email=email, role=UserRole.coach)
        db.add(user)
        db.commit()
        print(f"✓ Coach user created: {email}")
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True, help="Coach email address")
    args = parser.parse_args()
    create_coach(args.email)
