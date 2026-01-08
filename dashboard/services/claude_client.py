"""Claude API client for AI-assisted writing analysis."""

import json
from typing import Optional

import httpx

from ..config import get_api_key

API_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-5"


def build_analysis_prompt(
    paragraph: str,
    context: str,
    audience_notes: str,
    tags: list[str],
    is_last: bool,
) -> str:
    """Build the prompt for paragraph analysis."""
    full_context = context if not is_last else f"{context}\n\n{paragraph}"

    return f"""You are a writing assistant helping analyze a blog post paragraph.

AUDIENCE & CONTEXT:
{audience_notes or "General technical audience"}

TAGS: {', '.join(tags) if tags else "None specified"}

{"FULL POST:" if is_last else "PREVIOUS PARAGRAPHS:"}
{full_context if full_context.strip() else "(This is the first paragraph)"}

CURRENT PARAGRAPH TO ANALYZE:
{paragraph}

Please provide feedback in JSON format with these fields:
- "summary": Brief summary of what this paragraph does (1 sentence)
- "suggestions": Array of objects with:
  - "type": "addition" | "removal" | "rewrite"
  - "description": What to add/remove/rewrite and why
  - "example": Optional suggested text
- "overall_rating": "good" | "needs_work" | "significant_issues"
- "flow_with_context": How well it flows from previous content (1 sentence)

Respond only with valid JSON."""


async def analyze_paragraph(
    paragraph: str,
    context: str,
    audience_notes: str,
    tags: list[str],
    is_last: bool,
) -> dict:
    """Analyze a paragraph with context."""
    api_key = get_api_key()
    prompt = build_analysis_prompt(paragraph, context, audience_notes, tags, is_last)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            API_URL,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60.0,
        )
        response.raise_for_status()
        data = response.json()

        content = data["content"][0]["text"].strip()
        if content.startswith("```"):
            lines = content.split("\n")
            lines = lines[1:]  # Remove opening ```json or ```
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]  # Remove closing ```
            content = "\n".join(lines)
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return {
                "summary": "Failed to parse AI response",
                "suggestions": [],
                "overall_rating": "needs_work",
                "flow_with_context": content[:200],
                "raw_response": content,
            }


async def analyze_all_paragraphs(
    content: str,
    audience_notes: str,
    tags: list[str],
) -> list[dict]:
    """Analyze all paragraphs with accumulating context."""
    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]

    if not paragraphs:
        return []

    results = []
    for i, paragraph in enumerate(paragraphs):
        context = "\n\n".join(paragraphs[:i])
        is_last = i == len(paragraphs) - 1

        result = await analyze_paragraph(
            paragraph=paragraph,
            context=context,
            audience_notes=audience_notes,
            tags=tags,
            is_last=is_last,
        )
        result["paragraph_index"] = i
        result["paragraph_text"] = paragraph
        results.append(result)

    return results
