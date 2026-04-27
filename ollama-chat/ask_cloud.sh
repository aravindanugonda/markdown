#!/bin/bash

# =============================================================================
# Configuration & Defaults
# =============================================================================
EXTRACTION_MODEL="ministral-3:3b-cloud"
SESSION_DIR="${HOME}/.ask_cloud_sessions"

# Default values
MODEL="minimax-m2.5:cloud"
ATTACHMENT=""
USER_PROMPT=""
SESSION_NAME="session"
MEMORY_FILE_NAME="memory.json"
EXPORT_FILE=""

# Flags state
CLEAR_SESSION_FLAG=false
FORGET_MEMORY_FLAG=false
IGNORE_MEMORY_FLAG=false

# =============================================================================
# Argument Parsing
# =============================================================================
# Usage: ask-cloud -m <m|g|model> -a <@file> -p <prompt> -s <session|--clear> -u <memoryfile|--forget|--ignore> -e <export-md-name>
while getopts ":m:a:p:s:u:e:h" opt; do
  case ${opt} in
    m)
      # Model selection
      case $OPTARG in
        m) MODEL="minimax-m2.5:cloud" ;;
        g) MODEL="gemma3:27b-cloud" ;;
        *) MODEL=$OPTARG ;;
      esac
      ;;
    a)
      # Attachment
      ATTACHMENT=$OPTARG
      ;;
    p)
      # Prompt
      USER_PROMPT=$OPTARG
      ;;
    s)
      # Session name or --clear
      if [[ "$OPTARG" == "--clear" ]]; then
        CLEAR_SESSION_FLAG=true
      else
        SESSION_NAME=$OPTARG
      fi
      ;;
    u)
      # Memory file, --forget, or --ignore
      if [[ "$OPTARG" == "--forget" ]]; then
        FORGET_MEMORY_FLAG=true
      elif [[ "$OPTARG" == "--ignore" ]]; then
        IGNORE_MEMORY_FLAG=true
      else
        MEMORY_FILE_NAME=$OPTARG
      fi
      ;;
    e)
      # Export filename
      EXPORT_FILE=$OPTARG
      ;;
    h)
      echo "Usage: ask-cloud -m <model> -a <attachment> -p <prompt> -s <session> -u <memory> -e <export>"
      echo ""
      echo "Options:"
      echo "  -m <m|g|model> : Select model. 'm' = minimax-m2.5:cloud, 'g' = gemma3:27b-cloud (default: m)"
      echo "  -a <@file>     : Attachment file. Include @ prefix (e.g., -a @readme.txt)"
      echo "  -p <prompt>    : Your prompt/question (required)"
      echo "  -s <name>      : Session ID/Name. Use --clear to clear the session (default: session.json)"
      echo "  -u <name>      : Memory file. Use --forget to clear memory, --ignore to skip loading (default: memory.json)"
      echo "  -e <name>      : Export conversation to a markdown file"
      exit 0
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
    :)
      echo "Option -$OPTARG requires an argument." >&2
      exit 1
      ;;
  esac
done

# Validation
if [ -z "$USER_PROMPT" ]; then
    echo "Error: Prompt is required. Use -p <prompt>."
    exit 1
fi

# Initialize Session Directory
mkdir -p "$SESSION_DIR"

# =============================================================================
# Session Management
# =============================================================================
SESSION_FILE="${SESSION_DIR}/${SESSION_NAME}.json"

if [ "$CLEAR_SESSION_FLAG" = true ]; then
    rm -f "$SESSION_FILE"
    echo "Session '${SESSION_NAME}' cleared."
fi

# Load existing history or initialize empty array
if [ -f "$SESSION_FILE" ]; then
    HISTORY=$(cat "$SESSION_FILE")
else
    HISTORY="[]"
fi

# =============================================================================
# User Memory Management
# =============================================================================
MEMORY_FILE="${SESSION_DIR}/${MEMORY_FILE_NAME}"
MEMORY_CONTEXT=""

if [ "$IGNORE_MEMORY_FLAG" = true ]; then
    echo "Ignoring user memory."
elif [ "$FORGET_MEMORY_FLAG" = true ]; then
    echo '{"learned_facts": [], "last_updated": ""}' > "$MEMORY_FILE"
    echo "Memory file '${MEMORY_FILE_NAME}' cleared."
else
    # Initialize memory file if it doesn't exist
    if [ ! -f "$MEMORY_FILE" ]; then
        echo '{"learned_facts": [], "last_updated": ""}' > "$MEMORY_FILE"
    fi

    # Load Memory Context
    LEARNED_FACTS=$(cat "$MEMORY_FILE" | jq -r '.learned_facts // []')
    if [ "$LEARNED_FACTS" != "[]" ] && [ -n "$LEARNED_FACTS" ]; then
        MEMORY_CONTEXT="Previously learned about you (remember these for future responses):
$LEARNED_FACTS

---"
    fi
fi

# =============================================================================
# Process Attachment
# =============================================================================
FILE_CONTENT=""
if [[ "$ATTACHMENT" == @* ]]; then
    FILE_PATH="${ATTACHMENT#@}"
    if [ -f "$FILE_PATH" ]; then
        FILE_CONTENT=$(cat "$FILE_PATH")
        FULL_PROMPT="Context from $FILE_PATH:
$FILE_CONTENT

${MEMORY_CONTEXT}
Question: $USER_PROMPT"
    else
        echo "Error: File $FILE_PATH not found."
        exit 1
    fi
else
    FULL_PROMPT="${MEMORY_CONTEXT}
$USER_PROMPT"
fi

# =============================================================================
# 5. API Call (Main Model)
# =============================================================================
USER_MSG=$(jq -n --arg content "$FULL_PROMPT" '{"role": "user", "content": $content}')
MESSAGES=$(echo "$HISTORY" | jq ". + [$USER_MSG]")

RESPONSE=$(curl -s https://ollama.com/api/chat \
  -H "Authorization: Bearer $OLLAMA_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": $MESSAGES,
    \"stream\": false
  }")

# Error Check & Extract Content
if ! echo "$RESPONSE" | jq . >/dev/null 2>&1; then
    echo "Server Error: $RESPONSE"
    exit 1
fi

CONTENT=$(echo "$RESPONSE" | jq -r '.message.content // empty')

# =============================================================================
# 6. Fact Extraction (Memory Update)
# =============================================================================
if [ "$IGNORE_MEMORY_FLAG" = false ]; then
    CONVERSATION_TEXT=$(echo "$MESSAGES" | jq -r '.[-10:] | .[] | "\(.role): \(.content)"')

    EXTRACTION_PROMPT="Extract any NEW facts about the user from this conversation. 
Focus on: experience, goals, preferences, interests, tools, and background.
Return ONLY a JSON array of strings. If no new facts, return [].
Conversation:
$CONVERSATION_TEXT"

    PAYLOAD=$(jq -n --arg model "$EXTRACTION_MODEL" --arg prompt "$EXTRACTION_PROMPT" \
      '{model: $model, messages: [{role: "user", content: $prompt}], stream: false}')

    RAW_EXTRACTED=$(curl -s https://ollama.com/api/chat \
      -H "Authorization: Bearer $OLLAMA_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" | jq -r '.message.content // empty')

    # Remove <think> blocks and markdown code fences
    CLEAN_EXTRACTED=$(echo "$RAW_EXTRACTED" | sed 's/<think>.*<\/think>//g' | sed 's/```json//g; s/```//g' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')

    # Merge new facts
    if echo "$CLEAN_EXTRACTED" | jq -e . >/dev/null 2>&1; then
        CURRENT_FACTS=$(jq -r '.learned_facts // []' "$MEMORY_FILE")
        MERGED=$(jq -n --argjson cur "$CURRENT_FACTS" --argjson new "$CLEAN_EXTRACTED" \
          '$cur + $new | unique')

        jq --argjson facts "$MERGED" --arg date "$(date -Iseconds)" \
           '{"learned_facts": $facts, "last_updated": $date}' \
           < "$MEMORY_FILE" > "${MEMORY_FILE}.tmp" && mv "${MEMORY_FILE}.tmp" "$MEMORY_FILE"
        echo "Memory updated with new facts."
    fi
fi

# =============================================================================
# 7. Update Session History
# =============================================================================
ASSISTANT_MSG=$(jq -n --arg content "$CONTENT" '{"role": "assistant", "content": $content}')
UPDATED_HISTORY=$(echo "$MESSAGES" | jq ". + [$ASSISTANT_MSG]")
echo "$UPDATED_HISTORY" > "$SESSION_FILE"

# =============================================================================
# 8. Export to Markdown (Optional)
# =============================================================================
if [ -n "$EXPORT_FILE" ]; then
    # Convert JSON history to simple Markdown text
    # We iterate and concatenate, removing the thinking tags from the export as well
    > "$EXPORT_FILE" # Create/clear file
    echo "# Conversation Export" >> "$EXPORT_FILE"
    echo "" >> "$EXPORT_FILE"

    # Simple loop to print role: content
    # Using perl to clean thinking blocks from the exported file too
    echo "$UPDATED_HISTORY" | jq -r '.[] | "\(.role): \(.content)"' | perl -0777 -pe 's/<think>[\s\S]*?<\/think>//g' >> "$EXPORT_FILE"
    echo "Conversation exported to $EXPORT_FILE"
fi

# =============================================================================
# 9. Output to User
# =============================================================================
echo "$CONTENT" | perl -0777 -pe 's/<think>[\s\S]*?<\/think>//g'
