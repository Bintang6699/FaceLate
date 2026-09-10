import os
import sys
import bcrypt
import sqlalchemy
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Append current dir to path to import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
print("Connecting to:", DATABASE_URL.split("@")[-1] if DATABASE_URL else "None")

engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 10})
Session = sessionmaker(bind=engine)
session = Session()

try:
    from app.models import Teacher
    teacher = session.query(Teacher).filter(Teacher.email.ilike("admin@smp01dompu.sch.id")).first()
    if not teacher:
        print("Teacher not found!")
        # Let's check all teachers
        teachers = session.query(Teacher).all()
        print(f"Total teachers in DB: {len(teachers)}")
        for t in teachers:
            print(f"- {t.email}")
    else:
        print("Found teacher:", teacher.email)
        print("Hash in DB:", teacher.password_hash)
        
        # Test password
        test_pass = "admin123"
        try:
            matched = bcrypt.checkpw(test_pass.encode('utf-8'), teacher.password_hash.encode('utf-8'))
            print(f"Password '{test_pass}' match:", matched)
        except Exception as e:
            print("Bcrypt error:", e)
except Exception as e:
    print("DB Error:", e)
finally:
    session.close()
