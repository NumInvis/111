from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_prefix": "AGENT_"}

    llm_provider: str = ""
    llm_base_url: str = ""
    llm_model: str = ""
    llm_api_key: str = ""
    nestjs_api_url: str = "http://localhost:3000"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/variational_infinity"


@lru_cache
def get_settings() -> Settings:
    return Settings()