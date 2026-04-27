# Ollama Chat - Flask Web Application

A Flask web application that brings your `ask_cloud.sh` CLI chat tool to the browser. Chat with Ollama cloud models, maintain persistent sessions with full conversation history, manage user memory (learned facts), attach files as context, and export conversations as Markdown.

## Features

- **Session Management**: Create, list, and clear chat sessions with persistent JSON storage
- **User Memory**: Automatic extraction and persistence of learned facts about you
- **File Attachments**: Include file content as context in your prompts
- **Conversation Export**: Save conversations as Markdown files directly to `md-reader/docs/`
- **Multiple Models**: Quick toggle between Minimax M2.5 and Gemma3 27B, or enter any custom model
- **Think Block Stripping**: Automatically removes `<think>...</think>` reasoning blocks from responses
- **Markdown Rendering**: Assistant responses render as formatted Markdown with syntax highlighting

## Quick Start

### Prerequisites

- Python 3.8+
- `OLLAMA_API_KEY` environment variable set
- Flask and requests (installed via `requirements.txt`)

### Setup

```bash
cd ollama-chat
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Run the App

Option 1: Direct Python
```bash
export OLLAMA_API_KEY=your_api_key_here
python app.py
```

Option 2: Using manage.sh from project root
```bash
export OLLAMA_API_KEY=your_api_key_here
cd ..
./manage.sh ollama-chat start
```

Then open your browser to **http://127.0.0.1:5001**

## Directory Structure

```
ollama-chat/
├── app.py                      # Flask application with all routes
├── config.py                   # Configuration, paths, API settings
├── requirements.txt            # Python dependencies
│
├── chat/                       # Chat logic modules
│   ├── __init__.py
│   ├── ollama_client.py       # HTTP client for Ollama API, think-block stripping
│   ├── session_manager.py     # Load/save/list/clear JSON session files
│   └── memory_manager.py      # Load/save/merge memory, fact extraction
│
├── sessions/                   # Local session storage (gitignored)
│   ├── session.json
│   ├── project-x.json
│   └── memory.json
│
├── static/
│   ├── css/styles.css         # Chat UI styling
│   └── js/chat.js             # Vanilla JavaScript frontend
│
└── templates/
    ├── layout.html            # Base template
    └── index.html             # Chat page
```

## API Endpoints

### Session Management

- **GET `/api/sessions`** — List all session names
- **GET `/api/session/<name>`** — Load full conversation history
- **DELETE `/api/session/<name>`** — Clear a session

### Memory Management

- **GET `/api/memory`** — Get learned facts and last update timestamp
- **POST `/api/memory/forget`** — Reset memory to empty

### Chat

- **POST `/api/chat`** — Send a message and get a response
  - **Form fields:**
    - `prompt` (required): User message
    - `session`: Session name (default: `"session"`)
    - `model`: Model name or shortcut (default: `"minimax-m2.5:cloud"`)
    - `memory_file`: Memory file name (default: `"memory.json"`)
    - `ignore_memory`: Skip loading learned facts (checkbox, optional)
    - `attachment`: File upload (optional)

  - **Response:**
    ```json
    {
      "content": "Assistant response with <think> blocks stripped",
      "session": "session-name",
      "memory_updated": true
    }
    ```

### Export

- **POST `/api/export/<name>`** — Export session to Markdown file in `md-reader/docs/`
  - **Response:**
    ```json
    {
      "filename": "session.md",
      "path": "/home/user/path/to/md-reader/docs/session.md"
    }
    ```

## Session & Memory Storage

### Session File Format

Sessions are stored as JSON arrays of message objects (OpenAI-compatible format):

```json
[
  {
    "role": "user",
    "content": "What is the capital of France?"
  },
  {
    "role": "assistant",
    "content": "The capital of France is Paris."
  }
]
```

**File location:** `ollama-chat/sessions/<name>.json`

### Memory File Format

Memory is stored as a JSON object with learned facts:

```json
{
  "learned_facts": [
    "User prefers Python",
    "User is interested in AI",
    "User works on Flask projects"
  ],
  "last_updated": "2026-04-27T15:30:00+00:00"
}
```

**File location:** `ollama-chat/sessions/memory.json`

## Configuration

Edit `config.py` to customize:

- **Session storage path:** `SESSION_DIR`
- **Markdown export destination:** `MD_READER_DOCS_DIR`
- **Default model:** `DEFAULT_MODEL`
- **Fact extraction model:** `EXTRACTION_MODEL`
- **Model shortcuts:** `MODEL_SHORTCUTS`
- **Allowed attachment file types:** `ALLOWED_ATTACHMENT_EXTENSIONS`
- **API endpoint:** `OLLAMA_API_URL`
- **API key:** `OLLAMA_API_KEY` (environment variable)

## How It Works

### Conversation Flow

1. **User sends a message** → Prompt is combined with memory context (if not ignored) and any attachment content
2. **API call** → Full message history is sent to Ollama
3. **Response processing** → `<think>` blocks are stripped, response is stored
4. **Memory extraction** → Asynchronously extracts new facts from the conversation
5. **Session saved** → Full message history is persisted to JSON
6. **Frontend updated** → Chat bubbles render with Markdown formatting

### Memory Extraction

After each message:
1. Last 10 messages are sent to the extraction model
2. Model identifies new facts about the user (experience, preferences, interests, etc.)
3. New facts are deduplicated and merged into `memory.json`
4. Memory is prepended to future prompts as context

### File Attachment

When you upload a file:
1. File content is read (text files only: `.txt`, `.md`, `.py`, `.js`, `.json`, `.yaml`, `.html`, `.css`)
2. Content is prepended to your prompt with context header
3. Full context + prompt are sent to the model
4. Message history stores the full context + prompt (not just the question)

### Export to md-reader

When you click "Export":
1. Entire conversation is converted to Markdown format
2. `<think>` blocks are stripped
3. File is saved to `md-reader/docs/` with session name
4. You can immediately view it in md-reader's web UI

## Usage Examples

### Starting the app

```bash
# Using manage.sh
./manage.sh ollama-chat start

# Or directly
cd ollama-chat
export OLLAMA_API_KEY=sk_...
python app.py
```

### In the browser

1. **Create a new session** — Type a name (e.g., "project-discussion") and click Create
2. **Type a message** — Use Shift+Enter for newlines, Enter to send
3. **Attach a file** — Click "📎 Attach File" to include code or docs as context
4. **Manage memory** — Uncheck "Ignore Memory" to use learned facts, click "Forget Memory" to reset
5. **Export** — Click "📤 Export" to save the conversation to md-reader
6. **Switch models** — Use the Model dropdown or type a custom model name

## Development

### Running Tests

All modules have been tested for:
- ✓ Session load/save/list (atomic writes, JSON format)
- ✓ Memory load/save/merge (deduplication, ISO timestamps)
- ✓ Think block stripping (regex, multiline support)
- ✓ Flask route registration (8 endpoints)
- ✓ Configuration initialization (paths created, env var reading)

### Debugging

View app logs:
```bash
tail -f ollama_chat.log
```

Check sessions directory:
```bash
ls -la ollama-chat/sessions/
```

Verify Flask routes:
```bash
python -c "from app import app; [print(f'{r.rule:<30} {r.methods}') for r in app.url_map.iter_rules() if r.endpoint != 'static']"
```

## Troubleshooting

**"OLLAMA_API_KEY not set"**
```bash
export OLLAMA_API_KEY=your_api_key_here
```

**"Virtual environment not found"**
```bash
cd ollama-chat
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Sessions not persisting**
- Check that `ollama-chat/sessions/` directory exists and is writable
- Verify JSON files are being created in that directory

**Memory not updating**
- Check that memory file is being created (`sessions/memory.json`)
- Verify API key is valid and fact extraction model is available

**Export not appearing in md-reader**
- Verify `md-reader/docs/` directory exists
- Check `config.py` has correct `MD_READER_DOCS_DIR` path
- Look in Flask logs for export errors

## License

Same as parent project.
