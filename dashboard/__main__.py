"""Entry point for the blog dashboard."""

import argparse
import os
import signal
import sys

import uvicorn

from .config import HOST, PORT, PID_FILE, PROJECT_ROOT


def write_pid():
    """Write current process ID to PID file."""
    PID_FILE.write_text(str(os.getpid()))


def remove_pid():
    """Remove PID file if it exists."""
    if PID_FILE.exists():
        PID_FILE.unlink()


def stop_server():
    """Stop a running server using the PID file."""
    if not PID_FILE.exists():
        print("No server appears to be running (PID file not found)")
        return 1

    try:
        pid = int(PID_FILE.read_text().strip())
    except ValueError:
        print("Invalid PID file content")
        remove_pid()
        return 1

    try:
        os.kill(pid, signal.SIGTERM)
        print(f"Sent SIGTERM to process {pid}")
        remove_pid()
        return 0
    except ProcessLookupError:
        print(f"Process {pid} not found (server may have already stopped)")
        remove_pid()
        return 1
    except PermissionError:
        print(f"Permission denied to stop process {pid}")
        return 1


def start_server():
    """Start the blog dashboard server."""
    print("Starting Blog Dashboard...")
    print(f"Project root: {PROJECT_ROOT}")
    print(f"Dashboard URL: http://{HOST}:{PORT}")
    print()

    write_pid()
    try:
        uvicorn.run(
            "dashboard.app:app",
            host=HOST,
            port=PORT,
            reload=True,
            reload_dirs=[str(PROJECT_ROOT / "dashboard")],
        )
    finally:
        remove_pid()


def main():
    """Entry point for `uv run write`"""
    parser = argparse.ArgumentParser(description="Blog Dashboard server")
    parser.add_argument(
        "--stop",
        action="store_true",
        help="Stop a running server",
    )
    args = parser.parse_args()

    if args.stop:
        sys.exit(stop_server())
    else:
        start_server()


if __name__ == "__main__":
    main()
