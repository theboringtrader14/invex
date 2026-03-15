from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://localhost:6379"
    jwt_secret_key: str = "dev-jwt-secret"
    jwt_algorithm: str = "HS256"
    anthropic_api_key: str = ""
    zerodha_api_key: str = ""
    zerodha_api_secret: str = ""
    # Angel One — Mom
    angelone_mom_client_id: str = ""
    angelone_mom_password: str = ""
    angelone_mom_api_key: str = ""
    angelone_mom_totp_secret: str = ""
    # Angel One — Wife
    angelone_wife_client_id: str = ""
    angelone_wife_password: str = ""
    angelone_wife_api_key: str = ""
    angelone_wife_totp_secret: str = ""
    port: int = 8001

    class Config:
        env_file = ".env"

settings = Settings()
