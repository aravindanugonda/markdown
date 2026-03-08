from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DOCS_ROOT = BASE_DIR / "docs"
INDEX_DIR = BASE_DIR / ".index"
ALLOWED_EXTENSIONS = {".md", ".markdown"}
SECRET_KEY = "local-md-reader-dev"

DOCS_ROOT.mkdir(parents=True, exist_ok=True)
INDEX_DIR.mkdir(parents=True, exist_ok=True)
