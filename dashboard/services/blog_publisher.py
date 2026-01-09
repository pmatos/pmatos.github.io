"""Service for publishing blog posts."""

import asyncio
import re
import shutil
from datetime import date
from pathlib import Path

from slugify import slugify

from ..config import PROJECT_ROOT, BLOG_DIR, MEDIA_DIR


class BlogPublisher:
    def generate_filename(self, title: str) -> str:
        """Generate date-prefixed filename."""
        today = date.today().isoformat()
        slug = slugify(title)
        return f"{today}-{slug}.md"

    def generate_frontmatter(
        self, title: str, description: str, tags: list[str]
    ) -> str:
        """Generate YAML frontmatter."""
        tags_yaml = ", ".join(f'"{t}"' for t in tags)
        today = date.today().isoformat()
        return f'''---
title: {title}
description: {description}
tags: [{tags_yaml}]
date: {today}
layout: article.njk
permalink: "blog/{{{{ title | slugify }}}}.html"
---

'''

    async def _run_command(self, cmd: list[str]) -> tuple[str, str]:
        """Run a command and return stdout, stderr."""
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(PROJECT_ROOT),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(
                f"Command failed: {' '.join(cmd)}\n"
                f"stdout: {stdout.decode()}\n"
                f"stderr: {stderr.decode()}"
            )
        return stdout.decode(), stderr.decode()

    def _process_draft_media(self, content: str, draft_id: int) -> str:
        """Move draft media to dated folder and update paths in content."""
        today = date.today()
        year = str(today.year)
        month = f"{today.month:02d}"

        draft_media_dir = MEDIA_DIR / "drafts" / str(draft_id)
        if not draft_media_dir.exists():
            return content

        dated_media_dir = MEDIA_DIR / year / month
        dated_media_dir.mkdir(parents=True, exist_ok=True)

        pattern = rf'/img/drafts/{draft_id}/([^"\'\s\)]+)'
        matches = re.findall(pattern, content)

        for filename in matches:
            src_path = draft_media_dir / filename
            if src_path.exists():
                dst_path = dated_media_dir / filename
                counter = 1
                while dst_path.exists():
                    stem = Path(filename).stem
                    suffix = Path(filename).suffix
                    dst_path = dated_media_dir / f"{stem}_{counter}{suffix}"
                    counter += 1
                shutil.move(str(src_path), str(dst_path))
                new_web_path = f"/img/{year}/{month}/{dst_path.name}"
                old_web_path = f"/img/drafts/{draft_id}/{filename}"
                content = content.replace(old_web_path, new_web_path)

        if draft_media_dir.exists():
            for leftover in draft_media_dir.iterdir():
                leftover.unlink()
            draft_media_dir.rmdir()

        drafts_dir = MEDIA_DIR / "drafts"
        if drafts_dir.exists() and not any(drafts_dir.iterdir()):
            drafts_dir.rmdir()

        return content

    async def publish(
        self, title: str, description: str, tags: list[str], content: str, draft_id: int | None = None
    ) -> str:
        """Publish a blog post: create file, build, commit, push.

        Returns the path to the published file.
        """
        filename = self.generate_filename(title)
        filepath = BLOG_DIR / filename

        if draft_id is not None:
            content = self._process_draft_media(content, draft_id)

        full_content = self.generate_frontmatter(title, description, tags) + content
        filepath.write_text(full_content)

        await self._run_command(["npm", "run", "go!"])

        await self._run_command(["git", "add", "."])
        await self._run_command(
            ["git", "commit", "-m", f"Publish blog post: {title}"]
        )
        await self._run_command(["git", "push", "origin", "main"])

        return str(filepath)


blog_publisher = BlogPublisher()
