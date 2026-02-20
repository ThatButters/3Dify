from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class IPBan(SQLModel, table=True):
    __tablename__ = "ip_bans"

    id: Optional[int] = Field(default=None, primary_key=True)
    ip_or_cidr: str = Field(index=True, unique=True)  # e.g. "1.2.3.4" or "10.0.0.0/8"
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
