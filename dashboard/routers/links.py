"""API routes for link queue management."""

import json

from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import HTMLResponse

from .. import db
from ..services.llog_runner import llog_runner

router = APIRouter()


@router.get("/")
async def list_links():
    """List all queued links."""
    links = await db.get_links()
    for link in links:
        if link.get("tags"):
            link["tags"] = json.loads(link["tags"])
    return links


@router.post("/")
async def add_link(url: str = Form(...), tags: str = Form("")):
    """Add a new link to the queue."""
    tag_list = [t.strip().lstrip("#") for t in tags.split() if t.strip()]

    try:
        link_id = await db.add_link(url, tag_list)
        link = await db.get_link(link_id)
        return {"status": "success", "link": link}
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="URL already in queue")
        raise


@router.delete("/{link_id}")
async def delete_link(link_id: int):
    """Remove a link from the queue."""
    await db.delete_link(link_id)
    return {"status": "deleted"}


@router.post("/{link_id}/retry")
async def retry_link(link_id: int):
    """Retry a failed link."""
    link = await db.get_link(link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    await db.update_link_status(link_id, "pending")
    return {"status": "queued for retry"}


@router.post("/process")
async def process_next_link():
    """Process the next pending link using llog.js."""
    link = await db.get_next_pending_link()
    if not link:
        return {"status": "no pending links"}

    await db.update_link_status(link["id"], "processing")

    tags = json.loads(link["tags"]) if link["tags"] else []
    result = await llog_runner.process_link(link["url"], tags)

    if result.success:
        await db.update_link_status(link["id"], "completed")
        return {
            "status": "success",
            "link_id": link["id"],
            "output": result.stdout,
        }
    else:
        error_msg = f"Exit code: {result.return_code}"
        await db.update_link_status(
            link["id"],
            "failed",
            error_message=error_msg,
            error_output=f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}",
        )
        return {
            "status": "failed",
            "link_id": link["id"],
            "error": error_msg,
            "output": result.stdout,
            "stderr": result.stderr,
        }


@router.get("/{link_id}/error")
async def get_link_error(link_id: int):
    """Get detailed error info for a failed link."""
    link = await db.get_link(link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    return {
        "url": link["url"],
        "status": link["status"],
        "error_message": link["error_message"],
        "error_output": link["error_output"],
    }
