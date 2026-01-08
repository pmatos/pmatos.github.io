"""FastAPI application for the blog dashboard."""

import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import db
from .routers import links, drafts, ai

DASHBOARD_DIR = Path(__file__).parent
TEMPLATES_DIR = DASHBOARD_DIR / "templates"
STATIC_DIR = DASHBOARD_DIR / "static"


def parse_json_fields(items: list[dict], fields: list[str]) -> list[dict]:
    """Parse JSON string fields into Python objects."""
    for item in items:
        for field in fields:
            if item.get(field):
                item[field] = json.loads(item[field])
    return items


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    yield


app = FastAPI(title="Blog Dashboard", lifespan=lifespan)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

templates = Jinja2Templates(directory=TEMPLATES_DIR)

app.include_router(links.router, prefix="/api/links", tags=["links"])
app.include_router(drafts.router, prefix="/api/drafts", tags=["drafts"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Dashboard home page."""
    all_links = parse_json_fields(await db.get_links(), ["tags"])
    all_drafts = parse_json_fields(await db.get_drafts(), ["tags", "ai_analysis"])

    pending_links = sum(1 for link in all_links if link["status"] == "pending")
    failed_links = sum(1 for link in all_links if link["status"] == "failed")
    draft_count = sum(1 for draft in all_drafts if draft["status"] == "draft")

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "pending_links": pending_links,
            "failed_links": failed_links,
            "draft_count": draft_count,
            "recent_links": all_links[:5],
            "recent_drafts": all_drafts[:5],
        },
    )


@app.get("/links", response_class=HTMLResponse)
async def links_page(request: Request):
    """Link queue management page."""
    all_links = parse_json_fields(await db.get_links(), ["tags"])
    return templates.TemplateResponse(
        "links.html",
        {"request": request, "links": all_links},
    )


@app.get("/drafts", response_class=HTMLResponse)
async def drafts_page(request: Request):
    """Drafts listing page."""
    all_drafts = parse_json_fields(await db.get_drafts(), ["tags", "ai_analysis"])
    return templates.TemplateResponse(
        "drafts.html",
        {"request": request, "drafts": all_drafts},
    )


@app.get("/drafts/{draft_id}/edit", response_class=HTMLResponse)
async def editor_page(request: Request, draft_id: int):
    """Blog post editor page."""
    draft = await db.get_draft(draft_id)
    if not draft:
        return HTMLResponse("Draft not found", status_code=404)

    if draft.get("tags"):
        draft["tags"] = json.loads(draft["tags"])
    if draft.get("ai_analysis"):
        draft["ai_analysis"] = json.loads(draft["ai_analysis"])

    return templates.TemplateResponse(
        "editor.html",
        {"request": request, "draft": draft},
    )
