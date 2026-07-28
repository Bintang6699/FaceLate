"""
Script untuk membuat akun admin pertama.
Jalankan SEKALI saja dari folder backend:
  .\\venv\\Scripts\\python.exe seed_admin.py
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

import bcrypt
from app.database import SessionLocal, engine, Base
from app.models import Teacher

# ============================================================
# UBAH INI sesuai keinginan Anda
ADMIN_NAME     = "Admin"
ADMIN_EMAIL    = "admin@smp01dompu.sch.id"
ADMIN_PASSWORD = "admin123"
# ============================================================

Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    existing = db.query(Teacher).filter(Teacher.email == ADMIN_EMAIL).first()
    if existing:
        print(f"[!] Akun dengan email '{ADMIN_EMAIL}' sudah ada. Tidak perlu dibuat lagi.")
    else:
        # Hash password using bcrypt directly
        password_bytes = ADMIN_PASSWORD.encode("utf-8")
        hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())

        admin = Teacher(
            email=ADMIN_EMAIL,
            name=ADMIN_NAME,
            password_hash=hashed.decode("utf-8")
        )
        db.add(admin)
        db.commit()
        print("=" * 50)
        print("[OK] Akun admin berhasil dibuat!")
        print(f"   Email    : {ADMIN_EMAIL}")
        print(f"   Password : {ADMIN_PASSWORD}")
        print("=" * 50)
        print("Sekarang login di http://localhost:3000/login")
        print("Setelah login, segera ganti password di menu Settings!")
finally:
    db.close()
