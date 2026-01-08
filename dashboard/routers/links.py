"""API routes for link queue management."""

import asyncio
import json
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.templating import Jinja2Templates

from .. import db
from ..services.llog_runner import llog_runner

router = APIRouter()
templates = Jinja2Templates(directory=Path(__file__).parent.parent / "templates")


@router.get("/")
async def list_links():
    """List all queued links."""
    links = await db.get_links()
    for link in links:
        if link.get("tags"):
            link["tags"] = json.loads(link["tags"])
    return links


@router.post("/", response_class=HTMLResponse)
async def add_link(request: Request, url: str = Form(...), tags: str = Form("")):
    """Add a new link to the queue."""
    tag_list = [t.strip().lstrip("#") for t in tags.split() if t.strip()]

    try:
        link_id = await db.add_link(url, tag_list)
        link = await db.get_link(link_id)
        link["tags"] = json.loads(link["tags"]) if link.get("tags") else []
        return templates.TemplateResponse(
            "_link_row.html", {"request": request, "link": link}
        )
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="URL already in queue")
        raise


@router.delete("/{link_id}")
async def delete_link(link_id: int):
    """Remove a link from the queue."""
    await db.delete_link(link_id)
    return Response(status_code=200)


@router.post("/{link_id}/retry")
async def retry_link(link_id: int):
    """Retry a failed link."""
    link = await db.get_link(link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    await db.update_link_status(link_id, "pending")
    return {"status": "queued for retry"}


@router.get("/process/stream")
async def process_next_link_stream():
    """Process the next pending link with SSE progress streaming."""
    link = await db.get_next_pending_link()
    if not link:
        async def no_links():
            yield f"data: {json.dumps({'type': 'error', 'message': 'No pending links'})}\n\n"
        return StreamingResponse(no_links(), media_type="text/event-stream")

    await db.update_link_status(link["id"], "processing")
    tags = json.loads(link["tags"]) if link["tags"] else []

    async def event_generator():
        yield f"data: {json.dumps({'type': 'start', 'link_id': link['id'], 'url': link['url']})}\n\n"

        stdout_lines = []
        stderr_lines = []
        return_code = 0

        try:
            from ..config import PROJECT_ROOT, LLOG_SCRIPT

            tag_args = [f"#{tag}" for tag in tags if tag]
            cmd = ["node", str(LLOG_SCRIPT), link["url"]] + tag_args

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(PROJECT_ROOT),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            async def read_stdout():
                while True:
                    line = await proc.stdout.readline()
                    if not line:
                        break
                    decoded = line.decode().rstrip()
                    stdout_lines.append(decoded)
                    yield decoded

            async def read_stderr():
                while True:
                    line = await proc.stderr.readline()
                    if not line:
                        break
                    decoded = line.decode().rstrip()
                    stderr_lines.append(decoded)

            stderr_task = asyncio.create_task(read_stderr())

            async for line in read_stdout():
                event_data = {"type": "progress", "message": line}
                yield f"data: {json.dumps(event_data)}\n\n"

            await stderr_task
            await proc.wait()
            return_code = proc.returncode or 0

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            await db.update_link_status(link["id"], "failed", error_message=str(e))
            return

        if return_code == 0:
            await db.update_link_status(link["id"], "completed")
            yield f"data: {json.dumps({'type': 'complete', 'success': True, 'link_id': link['id']})}\n\n"
        else:
            error_msg = f"Exit code: {return_code}"
            stderr_output = "\n".join(stderr_lines)
            await db.update_link_status(
                link["id"],
                "failed",
                error_message=error_msg,
                error_output=f"STDOUT:\n{chr(10).join(stdout_lines)}\n\nSTDERR:\n{stderr_output}",
            )
            yield f"data: {json.dumps({'type': 'complete', 'success': False, 'link_id': link['id'], 'error': error_msg})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/process")
async def process_next_link():
    """Process the next pending link using llog.js (non-streaming fallback)."""
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
