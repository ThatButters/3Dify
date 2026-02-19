import secrets
import sys

from pydantic_settings import BaseSettings


def _require_token(name: str) -> str:
    """Return a secure random token for dev, but warn loudly."""
    token = secrets.token_urlsafe(48)
    print(
        f"WARNING: {name} not set — using random token for this session. "
        f"Set {name} in .env for production.",
        file=sys.stderr,
    )
    return token


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    # Database — MUST be set via DATABASE_URL env var or .env file
    database_url: str = "sqlite+aiosqlite:///ptp.db"

    # Auth — no defaults; generates random tokens if unset (safe but ephemeral)
    worker_auth_token: str = ""
    admin_auth_token: str = ""

    # File storage
    upload_dir: str = "uploads"
    output_dir: str = "outputs"
    max_upload_bytes: int = 20 * 1024 * 1024  # 20 MB
    allowed_extensions: list[str] = ["jpg", "jpeg", "png", "webp"]

    # Rate limiting
    rate_limit_per_day: int = 20
    rate_limit_cache_ttl_s: int = 60

    # Job settings
    job_timeout_s: int = 600  # 10 minutes
    cleanup_interval_s: int = 120

    # Default generation settings
    default_steps: int = 50
    default_guidance: float = 5.0
    default_octree_res: int = 384
    default_seed: int = 42
    default_height_mm: float = 100.0

    # Server
    cors_origins: list[str] = ["http://localhost:3000"]
    max_pending_jobs: int = 50

    def model_post_init(self, __context) -> None:
        if not self.worker_auth_token:
            self.worker_auth_token = _require_token("WORKER_AUTH_TOKEN")
        if not self.admin_auth_token:
            self.admin_auth_token = _require_token("ADMIN_AUTH_TOKEN")


settings = Settings()
