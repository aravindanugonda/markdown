from __future__ import annotations

from markdown_it import MarkdownIt
from mdit_py_plugins.tasklists import tasklists_plugin
from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import get_lexer_by_name
from pygments.lexers.special import TextLexer


class MarkdownRenderer:
    def __init__(self) -> None:
        self.md = (
            MarkdownIt("commonmark", {"html": False, "linkify": True, "typographer": True})
            .enable("table")
            .enable("strikethrough")
            .enable("image")
            .enable("link")
            .use(tasklists_plugin)
        )
        self.md.options["highlight"] = self._highlight

    @staticmethod
    def _highlight(code: str, lang: str | None, _attrs: str = "") -> str:
        try:
            lexer = get_lexer_by_name(lang) if lang else TextLexer()
        except Exception:
            lexer = TextLexer()

        formatter = HtmlFormatter(cssclass="codehilite", nowrap=False)
        return highlight(code, lexer, formatter)

    def render(self, markdown_text: str) -> str:
        rendered = self.md.render(markdown_text)
        return f'<div class="markdown-body">{rendered}</div>'
