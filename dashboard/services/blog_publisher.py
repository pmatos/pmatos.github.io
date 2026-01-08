"""Service for publishing blog posts."""

import asyncio
from datetime import date

from slugify import slugify

from ..config import PROJECT_ROOT, BLOG_DIR


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

    async def publish(
        self, title: str, description: str, tags: list[str], content: str
    ) -> str:
        """Publish a blog post: create file, build, commit, push.

        Returns the path to the published file.
        """
        filename = self.generate_filename(title)
        filepath = BLOG_DIR / filename

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
