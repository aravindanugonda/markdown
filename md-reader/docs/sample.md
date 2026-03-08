# Sample Documentation

Welcome to the **Local Markdown Reader**.

## Features

- Browse markdown files
- Search content quickly
- Toggle light/dark mode
- Render code with syntax highlighting

## Task List

- [x] Build local Flask server
- [x] Render markdown-it-py output
- [ ] Add extra themes

## Code Example

```python
from pathlib import Path

root = Path("docs")
for md_file in root.glob("*.md"):
    print(md_file.name)
```

## Table Example

| Component | Purpose |
|-----------|---------|
| explorer  | list files |
| renderer  | convert markdown to HTML |
| search    | full-text lookup |

## Image Example

![Architecture](https://dummyimage.com/800x120/333/fff.png&text=Local+Only+Reader)

## Link Example

Read [Flask docs](https://flask.palletsprojects.com/) when online.
