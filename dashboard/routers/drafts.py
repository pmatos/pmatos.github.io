"""API routes for draft management."""

import json

from fastapi import APIRouter, Form, HTTPException

from .. import db
from ..services.blog_publisher import blog_publisher

router = APIRouter()


@router.get("/")
async def list_drafts():
    """List all drafts."""
    drafts = await db.get_drafts()
    for draft in drafts:
        if draft.get("tags"):
            draft["tags"] = json.loads(draft["tags"])
        if draft.get("ai_analysis"):
            draft["ai_analysis"] = json.loads(draft["ai_analysis"])
    return drafts


@router.post("/")
async def create_draft(title: str = Form(...)):
    """Create a new draft."""
    draft_id = await db.create_draft(title)
    draft = await db.get_draft(draft_id)
    return {"status": "created", "draft": draft}


@router.get("/{draft_id}")
async def get_draft(draft_id: int):
    """Get a specific draft."""
    draft = await db.get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if draft.get("tags"):
        draft["tags"] = json.loads(draft["tags"])
    if draft.get("ai_analysis"):
        draft["ai_analysis"] = json.loads(draft["ai_analysis"])
    return draft


@router.put("/{draft_id}")
async def update_draft(
    draft_id: int,
    title: str = Form(None),
    description: str = Form(None),
    tags: str = Form(None),
    content: str = Form(None),
    audience_notes: str = Form(None),
):
    """Update a draft."""
    draft = await db.get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    tag_list = None
    if tags is not None:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    await db.update_draft(
        draft_id,
        title=title,
        description=description,
        tags=tag_list,
        content=content,
        audience_notes=audience_notes,
    )

    updated_draft = await db.get_draft(draft_id)
    return {"status": "updated", "draft": updated_draft}


@router.delete("/{draft_id}")
async def delete_draft(draft_id: int):
    """Delete a draft."""
    await db.delete_draft(draft_id)
    return {"status": "deleted"}


@router.post("/{draft_id}/publish")
async def publish_draft(draft_id: int):
    """Publish a draft to the blog."""
    draft = await db.get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if not draft["title"]:
        raise HTTPException(status_code=400, detail="Draft must have a title")
    if not draft["content"]:
        raise HTTPException(status_code=400, detail="Draft must have content")

    tags = json.loads(draft["tags"]) if draft["tags"] else []
    description = draft["description"] or ""

    try:
        published_path = await blog_publisher.publish(
            title=draft["title"],
            description=description,
            tags=tags,
            content=draft["content"],
        )
        await db.mark_draft_published(draft_id, published_path)
        return {"status": "published", "path": published_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
