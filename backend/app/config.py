from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

# backend/ directory (parent of app/), so .env is found regardless of the
# working directory uvicorn is launched from
BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 1 day by default
    FRONTEND_URL: Optional[str] = None  # comma-separated extra allowed origins

    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env")

settings = Settings()
