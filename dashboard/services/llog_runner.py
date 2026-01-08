"""Service for running llog.js to process links."""

import asyncio
from dataclasses import dataclass

from ..config import PROJECT_ROOT, LLOG_SCRIPT


@dataclass
class LlogResult:
    success: bool
    stdout: str
    stderr: str
    return_code: int


class LlogRunner:
    def __init__(self):
        self._lock = asyncio.Lock()

    async def process_link(self, url: str, tags: list[str]) -> LlogResult:
        """Run llog.js for a single link. Sequential processing guaranteed."""
        async with self._lock:
            tag_args = [f"#{tag}" for tag in tags if tag]
            cmd = ["node", str(LLOG_SCRIPT), url] + tag_args

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(PROJECT_ROOT),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()

            return LlogResult(
                success=(proc.returncode == 0),
                stdout=stdout.decode(),
                stderr=stderr.decode(),
                return_code=proc.returncode or 0,
            )


llog_runner = LlogRunner()
