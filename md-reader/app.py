from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, render_template, request
from werkzeug.utils import secure_filename

from config import ALLOWED_EXTENSIONS, DOCS_ROOT, SECRET_KEY
from explorer.file_explorer import safe_resolve, list_directory
from renderer.markdown_renderer import MarkdownRenderer
from search.search_engine import SearchEngine

app = Flask(__name__)
app.config["SECRET_KEY"] = SECRET_KEY

renderer = MarkdownRenderer()
search_engine = SearchEngine()
search_engine.rebuild()


@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/list")
def api_list():
    user_path = request.args.get("path", "")
    try:
        return jsonify(list_directory(user_path))
    except (ValueError, FileNotFoundError) as exc:
        return jsonify({"error": str(exc)}), 400


@app.get("/api/view")
def api_view():
    user_path = request.args.get("path", "")
    try:
        path = safe_resolve(user_path)
        if path.suffix.lower() not in {".md", ".markdown"} or not path.is_file():
            return jsonify({"error": "Markdown file not found"}), 404
        markdown_text = path.read_text(encoding="utf-8", errors="ignore")
        return jsonify({"html": renderer.render(markdown_text), "path": user_path})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


def _resolve_upload_path(target_dir: Path, filename: str) -> Path:
    candidate = target_dir / filename
    stem = candidate.stem
    suffix = candidate.suffix
    counter = 1
    while candidate.exists():
        candidate = target_dir / f"{stem}-{counter}{suffix}"
        counter += 1
    return candidate


@app.post("/api/upload")
def api_upload():
    target_path = request.form.get("path", "")
    uploads = request.files.getlist("files")
    if not uploads:
        return jsonify({"error": "No files provided"}), 400

    try:
        target_dir = safe_resolve(target_path)
        if not target_dir.exists() or not target_dir.is_dir():
            return jsonify({"error": "Upload directory not found"}), 400

        saved: list[str] = []
        for upload in uploads:
            safe_name = secure_filename((upload.filename or "").strip())
            if not safe_name:
                continue
            if Path(safe_name).suffix.lower() not in ALLOWED_EXTENSIONS:
                continue

            output_path = _resolve_upload_path(target_dir, safe_name)
            upload.save(output_path)
            rel = str(output_path.relative_to(DOCS_ROOT)).replace("\\", "/")
            saved.append(rel)

        if not saved:
            return jsonify({"error": "No valid markdown files were uploaded"}), 400

        search_engine.rebuild()
        return jsonify({"uploaded": saved})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/file", methods=["DELETE"])
def api_delete_file():
    user_path = request.args.get("path", "")
    try:
        path = safe_resolve(user_path)
        if path.suffix.lower() not in ALLOWED_EXTENSIONS or not path.is_file():
            return jsonify({"error": "Markdown file not found"}), 404

        path.unlink()
        search_engine.rebuild()
        return jsonify({"deleted": user_path})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except OSError:
        return jsonify({"error": "Failed to delete file"}), 500


@app.get("/api/search")
def api_search():
    query = request.args.get("q", "")
    return jsonify({"results": search_engine.search(query)})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
