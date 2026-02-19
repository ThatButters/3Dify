from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models.job import Job, JobStatus

router = APIRouter(prefix="/api")


class FeedbackBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str | None = None


@router.post("/job/{job_id}/feedback")
async def submit_feedback(
    job_id: str,
    body: FeedbackBody,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != JobStatus.complete:
        raise HTTPException(400, "Can only give feedback on completed jobs")
    if job.feedback_rating is not None:
        raise HTTPException(400, "Feedback already submitted")

    job.feedback_rating = body.rating
    job.feedback_text = body.text
    await session.commit()

    return {"status": "ok"}
