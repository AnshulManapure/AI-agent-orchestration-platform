from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    GEMINI_API_KEY: str
    TELEGRAM_BOT_TOKEN: str

    class Config:
        env_file = ".env"

settings = Settings()