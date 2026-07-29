from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

db_url = settings.DATABASE_URL

# Normalize URL to use psycopg2 driver (works best with Supabase on Vercel)
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and "+psycopg2" not in db_url and "+pg8000" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
elif "+pg8000" in db_url:
    db_url = db_url.replace("+pg8000", "+psycopg2")

engine = create_engine(
    db_url,
    pool_pre_ping=True,       # Vercel serverless: check connection before use
    pool_recycle=300,          # Recycle connections every 5 minutes
    connect_args={"sslmode": "require"},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
