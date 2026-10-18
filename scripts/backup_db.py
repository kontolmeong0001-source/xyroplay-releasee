#!/usr/bin/env python3
"""Create a consistent SQLite backup via SQLite's online backup API.

Backups contain sensitive account data. This tool creates a private local copy;
operator must encrypt it before offsite storage. It does not schedule or upload.
"""
import argparse
import os
import sqlite3
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path, help="new backup file path")
    parser.add_argument("--source", type=Path, default=Path("/var/lib/xyroplay/xyroplay.sqlite3"), help="live SQLite DB path")
    args = parser.parse_args()
    dest = args.destination.expanduser().resolve()
    source = args.source.expanduser().resolve()
    if dest == source or dest.exists():
        parser.error("destination must be a new path different from source")
    dest.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(dest, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    os.close(fd)
    try:
        os.chmod(dest, 0o600)
        with sqlite3.connect(f"file:{source}?mode=ro", uri=True, timeout=30) as src, sqlite3.connect(dest, timeout=30) as dst:
            src.backup(dst)
            result = dst.execute("PRAGMA integrity_check").fetchone()
            if not result or result[0] != "ok":
                raise RuntimeError(f"backup integrity_check failed: {result!r}")
        print(f"Verified SQLite backup: {dest} (mode 0600). Encrypt before offsite storage.")
        return 0
    except Exception as exc:
        try:
            dest.unlink()
        except OSError:
            pass
        print(f"Backup failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
