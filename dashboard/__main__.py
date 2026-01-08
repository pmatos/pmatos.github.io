"""Entry point for the blog dashboard."""

import uvicorn

from .config import HOST, PORT, PROJECT_ROOT


def main():
    """Entry point for `uv run write!`"""
    print("Starting Blog Dashboard...")
    print(f"Project root: {PROJECT_ROOT}")
    print(f"Dashboard URL: http://{HOST}:{PORT}")
    print()

    uvicorn.run(
        "dashboard.app:app",
        host=HOST,
        port=PORT,
        reload=True,
        reload_dirs=[str(PROJECT_ROOT / "dashboard")],
    )


if __name__ == "__main__":
    main()
