from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    PROJECT_NAME: str = "AURA Virtual Fitting Room Gateway"
    API_V1_STR: str = "/v1"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://aura_user:aura_secret_pass@localhost:5432/aura_fitting_room"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "aura_minio_admin"
    MINIO_SECRET_KEY: str = "aura_minio_supersecret"
    MINIO_SECURE: bool = False
    MINIO_BUCKET_NAME: str = "aura-ephemeral-captures"
    STORAGE_TTL_MINUTES: int = 15

    # JWT
    JWT_SECRET_KEY: str = "aura_kiosk_secret_jwt_key_2026_x99"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

settings = Settings()
