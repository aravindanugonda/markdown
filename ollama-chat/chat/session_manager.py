import json
from pathlib import Path


def load_session(session_dir: Path, name: str) -> list[dict]:
    session_file = session_dir / f"{name}.json"

    if not session_file.exists():
        return []

    try:
        with open(session_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def save_session(session_dir: Path, name: str, messages: list[dict]) -> None:
    session_file = session_dir / f"{name}.json"
    temp_file = session_dir / f"{name}.json.tmp"

    try:
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(messages, f, indent=2, ensure_ascii=False)

        temp_file.replace(session_file)
    except IOError as e:
        raise Exception(f"Failed to save session: {str(e)}")


def clear_session(session_dir: Path, name: str) -> None:
    session_file = session_dir / f"{name}.json"

    try:
        if session_file.exists():
            session_file.unlink()
    except OSError as e:
        raise Exception(f"Failed to clear session: {str(e)}")


def list_sessions(session_dir: Path) -> list[str]:
    try:
        # Filter out memory.json and temp files
        sessions = [f.stem for f in session_dir.glob("*.json") if f.stem != "memory"]
        return sorted(sessions)
    except OSError:
        return []
