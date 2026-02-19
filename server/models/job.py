import enum
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import Column, Index, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlmodel import Field, SQLModel


class JobStatus(str, enum.Enum):
    pending = "pending"
    assigned = "assigned"
    processing = "processing"
    complete = "complete"
    failed = "failed"
    expired = "expired"


class Job(SQLModel, table=True):
    __tablename__ = "jobs"
    __table_args__ = (
        Index("ix_jobs_status_created", "status", "created_at"),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    status: JobStatus = Field(default=JobStatus.pending, index=True)

    # Upload info
    original_filename: str
    upload_path: str  # relative to UPLOAD_DIR
    thumbnail_path: Optional[str] = None
    image_hash: str  # SHA-256

    # Client info
    client_ip: str
    user_agent: Optional[str] = None

    # Generation settings
    settings: dict = Field(default_factory=dict, sa_column=Column(JSON))

    # Progress
    current_step: Optional[str] = None
    progress_pct: int = 0
    progress_message: Optional[str] = None

    # Results
    stl_path: Optional[str] = None  # relative to OUTPUT_DIR
    glb_path: Optional[str] = None
    vertex_count: Optional[int] = None
    face_count: Optional[int] = None
    is_watertight: Optional[bool] = None
    generation_time_s: Optional[float] = None

    # GPU metrics from worker
    gpu_metrics: Optional[dict] = Field(default=None, sa_column=Column(JSON))

    # Error info
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text))
    error_step: Optional[str] = None

    # Feedback
    feedback_rating: Optional[int] = None
    feedback_text: Optional[str] = Field(default=None, sa_column=Column(Text))

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    assigned_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
