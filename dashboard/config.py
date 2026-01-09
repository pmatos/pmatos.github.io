"""Configuration for the blog dashboard."""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
CONFIG_FILE = Path.home() / "llog.conf"
DATABASE_PATH = PROJECT_ROOT / "dashboard.db"
BLOG_DIR = PROJECT_ROOT / "src" / "blog"
MEDIA_DIR = PROJECT_ROOT / "src" / "_11ty" / "_static" / "img"
LLOG_SCRIPT = PROJECT_ROOT / "llog.js"

HOST = "127.0.0.1"
PORT = 8888


def load_config_file() -> dict[str, str]:
    """Load config from ~/llog.conf (same format as llog.js uses)."""
    if not CONFIG_FILE.exists():
        return {}

    config = {}
    for line in CONFIG_FILE.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            if "=" in line:
                key, value = line.split("=", 1)
                config[key.strip()] = value.strip()
    return config


def get_api_key() -> str:
    """Get Claude API key from environment or config file (same sources as llog.js)."""
    if key := os.environ.get("ANTHROPIC_API_KEY"):
        return key
    if key := os.environ.get("CLAUDE_API_KEY"):
        return key

    config = load_config_file()
    if key := config.get("ANTHROPIC_API_KEY"):
        return key
    if key := config.get("CLAUDE_API_KEY"):
        return key

    raise ValueError(
        f"API key not found. Please set one of:\n"
        f"- Environment variable: ANTHROPIC_API_KEY or CLAUDE_API_KEY\n"
        f"- Config file: {CONFIG_FILE} with ANTHROPIC_API_KEY=your_key"
    )
