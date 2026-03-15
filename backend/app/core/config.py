from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://localhost:6379"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    anthropic_api_key: str = ""
    zerodha_api_key: str = ""
    zerodha_api_secret: str = ""
    angel_one_api_key: str = ""
    port: int = 8001

    class Config:
        env_file = ".env"

settings = Settings()
