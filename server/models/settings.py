from typing import Optional

from sqlmodel import Field, SQLModel


class RuntimeSetting(SQLModel, table=True):
    __tablename__ = "runtime_settings"

    key: str = Field(primary_key=True)
    value: str
    description: Optional[str] = None
