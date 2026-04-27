#!/bin/bash

# Multi-app Management Script for md-reader and ollama-chat
# Usage: ./manage.sh {md-reader|ollama-chat} {start|stop|status|restart}

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Determine which app to manage
TARGET_APP="${1:-md-reader}"

case "$TARGET_APP" in
    md-reader)
        VENV_DIR="$APP_DIR/md-reader/venv"
        APP_WORK_DIR="$APP_DIR/md-reader"
        PID_FILE="$APP_DIR/.app.pid"
        LOG_FILE="$APP_DIR/app.log"
        PORT=5000
        ;;
    ollama-chat)
        VENV_DIR="$APP_DIR/ollama-chat/venv"
        APP_WORK_DIR="$APP_DIR/ollama-chat"
        PID_FILE="$APP_DIR/.ollama_chat.pid"
        LOG_FILE="$APP_DIR/ollama_chat.log"
        PORT=5001
        ;;
    *)
        echo "Usage: $0 {md-reader|ollama-chat} {start|stop|status|restart}"
        echo ""
        echo "Apps:"
        echo "  md-reader     - Markdown documentation reader (port 5000)"
        echo "  ollama-chat   - Ollama cloud chat with memory (port 5001)"
        exit 1
        ;;
esac

PYTHON="$VENV_DIR/bin/python"
COMMAND="${2:-status}"

# Check if venv exists
check_venv() {
    if [ ! -d "$VENV_DIR" ]; then
        echo -e "${RED}Error: Virtual environment not found at $VENV_DIR${NC}"
        echo "Please create it with:"
        echo "  cd $TARGET_APP && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
        exit 1
    fi
}

start() {
    check_venv

    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${YELLOW}$TARGET_APP is already running (PID: $pid)${NC}"
            return 0
        else
            rm -f "$PID_FILE"
        fi
    fi

    echo -e "${GREEN}Starting $TARGET_APP...${NC}"
    cd "$APP_WORK_DIR"
    nohup "$PYTHON" app.py > "$LOG_FILE" 2>&1 &
    local pid=$!
    echo "$pid" > "$PID_FILE"

    # Wait a moment for app to start
    sleep 2

    if kill -0 "$pid" 2>/dev/null; then
        echo -e "${GREEN}✓ $TARGET_APP started successfully (PID: $pid)${NC}"
        echo -e "${GREEN}Access at: http://127.0.0.1:$PORT${NC}"
        echo -e "${GREEN}View logs: tail -f $LOG_FILE${NC}"
    else
        echo -e "${RED}✗ Failed to start $TARGET_APP${NC}"
        echo "Logs:"
        tail -20 "$LOG_FILE"
        exit 1
    fi
}

stop() {
    if [ ! -f "$PID_FILE" ]; then
        echo -e "${YELLOW}$TARGET_APP is not running${NC}"
        return 0
    fi

    local pid=$(cat "$PID_FILE")

    if ! kill -0 "$pid" 2>/dev/null; then
        echo -e "${YELLOW}PID file exists but process not running, cleaning up${NC}"
        rm -f "$PID_FILE"
        return 0
    fi

    echo -e "${GREEN}Stopping $TARGET_APP (PID: $pid)...${NC}"
    kill "$pid" 2>/dev/null || true

    # Wait for graceful shutdown
    local count=0
    while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
        sleep 0.5
        ((count++))
    done

    # Force kill if still running
    if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
    fi

    rm -f "$PID_FILE"
    echo -e "${GREEN}✓ $TARGET_APP stopped${NC}"
}

status() {
    if [ ! -f "$PID_FILE" ]; then
        echo -e "${YELLOW}$TARGET_APP is not running${NC}"
        return 1
    fi

    local pid=$(cat "$PID_FILE")

    if kill -0 "$pid" 2>/dev/null; then
        echo -e "${GREEN}✓ $TARGET_APP is running (PID: $pid)${NC}"
        echo -e "${GREEN}Access at: http://127.0.0.1:$PORT${NC}"
        return 0
    else
        echo -e "${RED}✗ $TARGET_APP is not running (stale PID file)${NC}"
        rm -f "$PID_FILE"
        return 1
    fi
}

restart() {
    echo "Restarting $TARGET_APP..."
    stop
    sleep 1
    start
}

# Main script logic
case "$COMMAND" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    status)
        status
        ;;
    restart)
        restart
        ;;
    *)
        echo "Usage: $0 $TARGET_APP {start|stop|status|restart}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the application"
        echo "  stop    - Stop the application"
        echo "  status  - Check if the application is running"
        echo "  restart - Restart the application"
        exit 1
        ;;
esac
