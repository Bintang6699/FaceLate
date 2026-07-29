from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 1 day by default
    FRONTEND_URL: Optional[str] = None  # comma-separated extra allowed origins

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
