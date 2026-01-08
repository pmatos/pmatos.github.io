"""API routes for AI-assisted writing analysis."""

import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import db
from ..services.claude_client import analyze_all_paragraphs

router = APIRouter()


class AnalyzeRequest(BaseModel):
    draft_id: int


@router.post("/analyze")
async def analyze_draft(request: AnalyzeRequest):
    """Analyze all paragraphs of a draft with AI."""
    draft = await db.get_draft(request.draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if not draft["content"]:
        raise HTTPException(status_code=400, detail="Draft has no content to analyze")

    tags = json.loads(draft["tags"]) if draft["tags"] else []
    audience_notes = draft["audience_notes"] or ""

    try:
        results = await analyze_all_paragraphs(
            content=draft["content"],
            audience_notes=audience_notes,
            tags=tags,
        )

        await db.update_draft(request.draft_id, ai_analysis=results)

        return {"status": "analyzed", "analysis": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
