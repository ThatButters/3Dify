from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    action: str = Field(index=True)  # "upload", "job_complete", "admin_action", etc.
    client_ip: Optional[str] = Field(default=None, index=True)
    job_id: Optional[str] = None
    detail: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
