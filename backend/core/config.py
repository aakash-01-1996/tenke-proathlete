from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    FIREBASE_PROJECT_ID: str
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    SMTP_REPLY_TO: str = ""
    SMTP_HOST_USER: str = ""   # head coach
    ALLOWED_ORIGINS: str = "http://localhost:3000"  # comma-separated in prod

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
