from __future__ import annotations

from pathlib import Path

from config import ALLOWED_EXTENSIONS, DOCS_ROOT


def _is_within_root(path: Path) -> bool:
    try:
        path.resolve().relative_to(DOCS_ROOT.resolve())
        return True
    except ValueError:
        return False


def safe_resolve(user_path: str | None) -> Path:
    """Resolve a user path under DOCS_ROOT, blocking traversal."""
    target = (DOCS_ROOT / (user_path or "")).resolve()
    if not _is_within_root(target):
        raise ValueError("Path outside docs root")
    return target


def list_directory(user_path: str | None = "") -> dict:
    target = safe_resolve(user_path)
    if not target.exists() or not target.is_dir():
        raise FileNotFoundError("Directory not found")

    files: list[dict] = []
    for item in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
        if item.name.startswith("."):
            continue
        if item.is_dir():
            files.append({"name": item.name, "type": "directory"})
            continue
        if item.suffix.lower() in ALLOWED_EXTENSIONS:
            files.append({"name": item.name, "type": "file"})

    rel = str(target.relative_to(DOCS_ROOT)).replace("\\", "/")
    return {"path": rel, "files": files}


def iter_markdown_files() -> list[Path]:
    return [
        path
        for path in DOCS_ROOT.rglob("*")
        if path.is_file()
        and not any(part.startswith(".") for part in path.parts)
        and path.suffix.lower() in ALLOWED_EXTENSIONS
    ]
