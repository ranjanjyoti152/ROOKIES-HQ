from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://rookishq:rookishq_secret@localhost:5432/rookishq"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET: str = "change-me-in-production-use-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
