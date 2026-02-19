import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# Add server root to path so models can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import settings as app_settings  # noqa: E402
from models.job import Job  # noqa: F401, E402
from models.ban import IPBan  # noqa: F401, E402
from models.audit_log import AuditLog  # noqa: F401, E402
from models.settings import RuntimeSetting  # noqa: F401, E402
from sqlmodel import SQLModel  # noqa: E402

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use DATABASE_URL from app config (env var / .env), not from alembic.ini
_db_url = app_settings.database_url

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    context.configure(url=_db_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(_db_url)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
