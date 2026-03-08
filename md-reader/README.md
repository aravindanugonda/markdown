# Local Markdown Reader (Linux)

A lightweight, fully local Markdown documentation reader optimized for small Linux VMs.

## Highlights

- Runs on `localhost` only
- Recursive file explorer for markdown docs
- GitHub-style markdown rendering
- Syntax-highlighted code blocks (Pygments)
- Full-text search with Whoosh
- Dark / light theme toggle
- No external services required

## Architecture

- **Flask app** (`app.py`): API + UI routes
- **Explorer module** (`explorer/file_explorer.py`): safe path handling + directory listing
- **Renderer module** (`renderer/markdown_renderer.py`): markdown-it-py rendering + highlighting
- **Search module** (`search/search_engine.py`): index + query engine
- **Frontend** (`templates/`, `static/js`, `static/css`): two-panel interface

## Installation

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open: <http://localhost:5000>

## Usage

1. Place markdown files under `docs/`.
2. Open the app in browser.
3. Browse on the left panel, read rendered output on the right.
4. Use search bar to find content.
5. Toggle theme via the top-right button.

## Security Notes

- Path traversal is blocked.
- Files are restricted to the `docs/` directory.
- Hidden files are ignored.

## Screenshots

- _Placeholder_: `docs/screenshots/main-ui.png`

## Low-resource VM Tips

- Keep docs under a few thousand files for fast indexing.
- Restart app after very large documentation changes to rebuild index.
- Disable debug mode (already disabled by default).
