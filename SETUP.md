# Setup Guide

## Environment Configuration

This project uses a `.env` file to manage environment variables, particularly the `OLLAMA_API_KEY`.

### 1. Create Your `.env` File

**Option A: Copy from template**
```bash
cp .env.example .env
```

**Option B: Create manually**
```bash
echo "OLLAMA_API_KEY=sk_your_key_here" > .env
```

### 2. Add Your API Key

Edit `.env` and replace `sk_your_key_here` with your actual Ollama Cloud API key:

```
OLLAMA_API_KEY=sk_abc123def456...
```

### 3. Verify Setup

```bash
cd ollama-chat
source venv/bin/activate
python -c "from config import OLLAMA_API_KEY; print(f'✓ API Key loaded: {OLLAMA_API_KEY[:20]}...')"
```

## Running the Applications

### Start md-reader (Port 5000)
```bash
./manage.sh md-reader start
# Open http://127.0.0.1:5000
```

### Start ollama-chat (Port 5001)
```bash
./manage.sh ollama-chat start
# Open http://127.0.0.1:5001
```

### Start Both
```bash
./manage.sh md-reader start &
./manage.sh ollama-chat start
```

### Check Status
```bash
./manage.sh md-reader status
./manage.sh ollama-chat status
```

### Stop Applications
```bash
./manage.sh md-reader stop
./manage.sh ollama-chat stop
```

## Project Structure

```
markdown/
├── .env                      # Your environment variables (GITIGNORED)
├── .env.example             # Template for .env
├── manage.sh                # Start/stop both apps
├── .gitignore               # Excludes .env, sessions, logs
│
├── md-reader/               # Markdown documentation reader
│   ├── app.py
│   ├── requirements.txt
│   ├── venv/
│   ├── docs/               # Markdown files you upload/view
│   └── ...
│
└── ollama-chat/             # Ollama cloud chat with memory
    ├── app.py
    ├── config.py            # Loads from ../.env
    ├── requirements.txt
    ├── venv/
    ├── sessions/            # Chat sessions & memory (GITIGNORED)
    ├── chat/               # Core modules
    ├── static/             # CSS, JS
    ├── templates/          # HTML
    └── ...
```

## First Time Setup

### 1. Clone and enter project
```bash
cd /home/anugonda/workspaces/codex/markdown
```

### 2. Create `.env` from template
```bash
cp .env.example .env
```

### 3. Edit `.env` with your API key
```bash
# Replace sk_your_key_here with your actual key
nano .env
```

### 4. Verify dependencies are installed
```bash
# For ollama-chat
cd ollama-chat
source venv/bin/activate
pip install -r requirements.txt

# For md-reader
cd ../md-reader
source venv/bin/activate
pip install -r requirements.txt
```

### 5. Start the apps
```bash
cd ..
./manage.sh ollama-chat start
./manage.sh md-reader start
```

### 6. Open in browser
- **Ollama Chat:** http://127.0.0.1:5001
- **Markdown Reader:** http://127.0.0.1:5000

## Environment Variables

### Required
- `OLLAMA_API_KEY` — Your Ollama Cloud API key (required to use the chat app)

### Optional
- `DEFAULT_MODEL` — Default chat model (default: `minimax-m2.5:cloud`)
- `EXTRACTION_MODEL` — Model for fact extraction (default: `ministral-3:3b-cloud`)

Example with custom models:
```
OLLAMA_API_KEY=sk_...
DEFAULT_MODEL=gemma4:31b-cloud
EXTRACTION_MODEL=ministral-3:3b-cloud
```

## Security Notes

⚠️ **Important:** 
- `.env` is in `.gitignore` and will NOT be committed to git
- Never commit `.env` to version control
- `.env.example` is safe to commit — it shows the format without secrets
- If you accidentally commit `.env`, you should rotate your API key immediately

## Troubleshooting

### "OLLAMA_API_KEY not set" error
```bash
# Check if .env exists
ls -la .env

# Check if OLLAMA_API_KEY is in .env
grep OLLAMA_API_KEY .env

# Verify it's being loaded
cd ollama-chat
source venv/bin/activate
python -c "import os; from dotenv import load_dotenv; load_dotenv('../.env'); print(os.getenv('OLLAMA_API_KEY'))"
```

### "Virtual environment not found"
```bash
# Recreate venv for ollama-chat
cd ollama-chat
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Or for md-reader
cd ../md-reader
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Port already in use
If port 5000 or 5001 is already in use:
```bash
# Check what's using the port
lsof -i :5001  # for ollama-chat
lsof -i :5000  # for md-reader

# Kill the process
kill -9 <PID>
```

## Development

### Adding Dependencies

For ollama-chat:
```bash
cd ollama-chat
source venv/bin/activate
pip install new-package
pip freeze > requirements.txt
```

### Running Tests
```bash
cd ollama-chat
source venv/bin/activate
python -m pytest tests/
```

### View Logs
```bash
tail -f app.log          # md-reader logs
tail -f ollama_chat.log  # ollama-chat logs
```

## More Information

- **md-reader:** See `md-reader/README.md`
- **ollama-chat:** See `ollama-chat/README.md`
- **Conversion details:** See `ollama-chat/CONVERSION_NOTES.md`
