from __future__ import annotations

from whoosh import index, writing
from whoosh.fields import ID, TEXT, Schema
from whoosh.qparser import MultifieldParser

from config import DOCS_ROOT, INDEX_DIR
from explorer.file_explorer import iter_markdown_files


class SearchEngine:
    def __init__(self) -> None:
        self.schema = Schema(path=ID(stored=True, unique=True), filename=TEXT(stored=True), content=TEXT(stored=True))
        self.idx = self._open_or_create_index()

    def _open_or_create_index(self):
        if index.exists_in(INDEX_DIR):
            return index.open_dir(INDEX_DIR)
        return index.create_in(INDEX_DIR, self.schema)

    def rebuild(self) -> None:
        writer = self.idx.writer()
        writer.mergetype = writing.CLEAR
        for file_path in iter_markdown_files():
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            rel = str(file_path.relative_to(DOCS_ROOT)).replace("\\", "/")
            writer.add_document(path=rel, filename=file_path.name, content=content)
        writer.commit()

    def search(self, query: str, limit: int = 30) -> list[dict]:
        if not query.strip():
            return []
        parser = MultifieldParser(["filename", "content"], schema=self.idx.schema)
        q = parser.parse(query)
        results: list[dict] = []
        with self.idx.searcher() as searcher:
            for hit in searcher.search(q, limit=limit):
                snippet = hit.highlights("content") or "No snippet"
                results.append({"path": hit["path"], "filename": hit["filename"], "snippet": snippet})
        return results
