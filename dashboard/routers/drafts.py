"""API routes for draft management."""

import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from .. import db
from ..config import MEDIA_DIR
from ..services.blog_publisher import blog_publisher

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024  # 50MB

router = APIRouter()
templates = Jinja2Templates(directory=Path(__file__).parent.parent / "templates")


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


@router.post("/", response_class=HTMLResponse)
async def create_draft(request: Request, title: str = Form(...)):
    """Create a new draft."""
    draft_id = await db.create_draft(title)
    draft = await db.get_draft(draft_id)
    return templates.TemplateResponse(
        "_draft_card.html", {"request": request, "draft": draft}
    )


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
    return Response(status_code=200)


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
            draft_id=draft_id,
        )
        await db.mark_draft_published(draft_id, published_path)
        return {"status": "published", "path": published_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{draft_id}/media")
async def upload_media(draft_id: int, file: UploadFile = File(...)):
    """Upload a media file for a draft."""
    draft = await db.get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    content_type = file.content_type or ""
    is_image = content_type in ALLOWED_IMAGE_TYPES
    is_video = content_type in ALLOWED_VIDEO_TYPES

    if not is_image and not is_video:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {content_type}. Allowed: images (jpg, png, gif, webp) and videos (mp4, webm)"
        )

    content = await file.read()
    file_size = len(content)

    if is_image and file_size > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image too large. Maximum size is 10MB.")
    if is_video and file_size > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=400, detail="Video too large. Maximum size is 50MB.")

    draft_media_dir = MEDIA_DIR / "drafts" / str(draft_id)
    draft_media_dir.mkdir(parents=True, exist_ok=True)

    original_name = Path(file.filename) if file.filename else Path("file")
    extension = original_name.suffix.lower() or (".jpg" if is_image else ".mp4")
    unique_name = f"{uuid.uuid4().hex[:8]}{extension}"
    file_path = draft_media_dir / unique_name

    with open(file_path, "wb") as f:
        f.write(content)

    web_path = f"/img/drafts/{draft_id}/{unique_name}"
    return {"status": "uploaded", "path": web_path, "filename": unique_name}
