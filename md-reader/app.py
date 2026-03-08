from __future__ import annotations

from flask import Flask, jsonify, render_template, request

from config import SECRET_KEY
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


@app.get("/api/search")
def api_search():
    query = request.args.get("q", "")
    return jsonify({"results": search_engine.search(query)})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
