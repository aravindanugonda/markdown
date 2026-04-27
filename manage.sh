#!/bin/bash

# Markdown Reader Application Management Script
# Usage: ./manage.sh {start|stop|status|restart}

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$APP_DIR/md-reader/venv"
PID_FILE="$APP_DIR/.app.pid"
LOG_FILE="$APP_DIR/app.log"
PYTHON="$VENV_DIR/bin/python"
FLASK_APP="$APP_DIR/md-reader/app.py"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if venv exists
check_venv() {
    if [ ! -d "$VENV_DIR" ]; then
        echo -e "${RED}Error: Virtual environment not found at $VENV_DIR${NC}"
        echo "Please create it with: cd md-reader && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
        exit 1
    fi
}

start() {
    check_venv

    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${YELLOW}Application is already running (PID: $pid)${NC}"
            return 0
        else
            rm -f "$PID_FILE"
        fi
    fi

    echo -e "${GREEN}Starting Flask application...${NC}"
    cd "$APP_DIR/md-reader"
    nohup "$PYTHON" app.py > "$LOG_FILE" 2>&1 &
    local pid=$!
    echo "$pid" > "$PID_FILE"

    # Wait a moment for app to start
    sleep 2

    if kill -0 "$pid" 2>/dev/null; then
        echo -e "${GREEN}✓ Application started successfully (PID: $pid)${NC}"
        echo -e "${GREEN}Access the app at: http://127.0.0.1:5000${NC}"
        echo -e "${GREEN}View logs: tail -f $LOG_FILE${NC}"
    else
        echo -e "${RED}✗ Failed to start application${NC}"
        echo "Logs:"
        tail -20 "$LOG_FILE"
        exit 1
    fi
}

stop() {
    if [ ! -f "$PID_FILE" ]; then
        echo -e "${YELLOW}Application is not running${NC}"
        return 0
    fi

    local pid=$(cat "$PID_FILE")

    if ! kill -0 "$pid" 2>/dev/null; then
        echo -e "${YELLOW}PID file exists but process not running, cleaning up${NC}"
        rm -f "$PID_FILE"
        return 0
    fi

    echo -e "${GREEN}Stopping Flask application (PID: $pid)...${NC}"
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
    echo -e "${GREEN}✓ Application stopped${NC}"
}

status() {
    if [ ! -f "$PID_FILE" ]; then
        echo -e "${YELLOW}Application is not running${NC}"
        return 1
    fi

    local pid=$(cat "$PID_FILE")

    if kill -0 "$pid" 2>/dev/null; then
        echo -e "${GREEN}✓ Application is running (PID: $pid)${NC}"
        echo -e "${GREEN}Access the app at: http://127.0.0.1:5000${NC}"
        return 0
    else
        echo -e "${RED}✗ Application is not running (stale PID file)${NC}"
        rm -f "$PID_FILE"
        return 1
    fi
}

restart() {
    echo "Restarting application..."
    stop
    sleep 1
    start
}

# Main script logic
case "${1:-status}" in
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
        echo "Usage: $0 {start|stop|status|restart}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the Flask application"
        echo "  stop    - Stop the Flask application"
        echo "  status  - Check if the application is running"
        echo "  restart - Restart the application"
        exit 1
        ;;
esac
