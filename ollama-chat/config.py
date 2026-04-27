from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BASE_DIR = Path(__file__).resolve().parent
SESSION_DIR = BASE_DIR / "sessions"
MD_READER_DOCS_DIR = BASE_DIR.parent / "md-reader" / "docs"

SESSION_DIR.mkdir(parents=True, exist_ok=True)
MD_READER_DOCS_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_MODEL = "minimax-m2.5:cloud"
EXTRACTION_MODEL = "ministral-3:3b-cloud"
MODEL_SHORTCUTS = {
    "m": "minimax-m2.5:cloud",
    "g": "gemma3:27b-cloud",
}

OLLAMA_API_URL = "https://ollama.com/api/chat"
OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY", "")

ALLOWED_ATTACHMENT_EXTENSIONS = {".txt", ".md", ".py", ".js", ".json", ".yaml", ".yml", ".html", ".css"}

SECRET_KEY = "local-ollama-chat-dev"
