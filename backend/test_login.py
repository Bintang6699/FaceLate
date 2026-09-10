import sys
import os
from dotenv import load_dotenv
load_dotenv()
from app.database import SessionLocal
from app.models import Teacher

db = SessionLocal()
try:
    teachers = db.query(Teacher).all()
    print("Teachers in DB:")
    for t in teachers:
        print(f"- {t.email} / {t.name}")
        print(f"  Hash: {t.password_hash}")
except Exception as e:
    print("Error:", e)
finally:
    db.close()
