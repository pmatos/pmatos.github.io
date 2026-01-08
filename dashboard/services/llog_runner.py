"""Service for running llog.js to process links with real-time progress."""

import asyncio
import re
from dataclasses import dataclass, field
from typing import AsyncIterator

from ..config import PROJECT_ROOT, LLOG_SCRIPT

PROGRESS_STAGES = [
    ("📝", "acquired_lock", "Acquiring lock..."),
    ("✅ API", "api_validated", "Validating API key..."),
    ("🚀", "processing_url", "Starting processing..."),
    ("🔍", "fetching_content", "Fetching page content..."),
    ("✅ Successfully extracted", "content_extracted", "Content extracted"),
    ("🤖", "generating_summary", "Generating summary with AI..."),
    ("🏷️", "suggesting_tags", "Suggesting tags..."),
    ("✅ Added entry", "entry_added", "Entry added to linklog"),
    ("🔨", "building_site", "Building site..."),
    ("✅ Site built", "site_built", "Site built successfully"),
    ("📤", "committing", "Committing and pushing..."),
    ("✅ Changes committed", "pushed", "Changes pushed"),
    ("🌐", "verifying_deployment", "Verifying deployment..."),
    ("📡", "checking_deployment", "Checking deployment..."),
    ("✅ Deployment verified", "deployment_verified", "Deployment verified"),
    ("🎉", "completed", "Complete!"),
]


@dataclass
class LlogResult:
    success: bool
    stdout: str
    stderr: str
    return_code: int


@dataclass
class ProgressEvent:
    stage: str
    message: str
    raw_line: str
    is_error: bool = False


@dataclass
class ProcessingState:
    link_id: int
    is_running: bool = True
    events: list = field(default_factory=list)
    result: LlogResult | None = None


class LlogRunner:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._current_state: ProcessingState | None = None

    def _parse_progress(self, line: str) -> ProgressEvent | None:
        """Parse a line of output and return a progress event."""
        line = line.strip()
        if not line:
            return None

        for emoji, stage, description in PROGRESS_STAGES:
            if emoji in line:
                return ProgressEvent(
                    stage=stage,
                    message=description,
                    raw_line=line,
                )

        if line.startswith("❌") or "error" in line.lower():
            return ProgressEvent(
                stage="error",
                message=line,
                raw_line=line,
                is_error=True,
            )

        if line.startswith("⚠️"):
            return ProgressEvent(
                stage="warning",
                message=line,
                raw_line=line,
            )

        return ProgressEvent(
            stage="info",
            message=line,
            raw_line=line,
        )

    async def process_link_streaming(
        self, link_id: int, url: str, tags: list[str]
    ) -> AsyncIterator[ProgressEvent]:
        """Run llog.js and yield progress events as they happen."""
        async with self._lock:
            self._current_state = ProcessingState(link_id=link_id)

            tag_args = [f"#{tag}" for tag in tags if tag]
            cmd = ["node", str(LLOG_SCRIPT), url] + tag_args

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(PROJECT_ROOT),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout_lines = []
            stderr_lines = []

            async def read_stream(stream, lines_list, is_stderr=False):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    decoded = line.decode().rstrip()
                    lines_list.append(decoded)
                    event = self._parse_progress(decoded)
                    if event:
                        if is_stderr:
                            event.is_error = True
                        self._current_state.events.append(event)

            await asyncio.gather(
                read_stream(proc.stdout, stdout_lines),
                read_stream(proc.stderr, stderr_lines, is_stderr=True),
            )

            await proc.wait()

            result = LlogResult(
                success=(proc.returncode == 0),
                stdout="\n".join(stdout_lines),
                stderr="\n".join(stderr_lines),
                return_code=proc.returncode or 0,
            )

            self._current_state.result = result
            self._current_state.is_running = False

            for event in self._current_state.events:
                yield event

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

    def get_current_state(self) -> ProcessingState | None:
        """Get the current processing state."""
        return self._current_state

    def get_events_since(self, index: int) -> list[ProgressEvent]:
        """Get events that occurred after the given index."""
        if not self._current_state:
            return []
        return self._current_state.events[index:]


llog_runner = LlogRunner()
