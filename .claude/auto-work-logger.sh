#!/bin/bash

# Auto Work Logger - Tracks all tool usage in the current session
# Called by PostToolUse hook to maintain comprehensive work log

DATE_DIR="$CLAUDE_PROJECT_DIR/.claude/sessions/$(date +%Y-%m-%d)"
LATEST_SESSION=$(ls -d $DATE_DIR/session-* 2>/dev/null | sort -V | tail -1)
WORK_LOG="$LATEST_SESSION/work-log.md"

if [ ! -f "$WORK_LOG" ]; then
    # Initialize work log if it doesn't exist
    echo "# Work Log - $(date +%Y-%m-%d)" > "$WORK_LOG"
    echo "" >> "$WORK_LOG"
fi

# Extract tool info from stdin
TOOL_INFO=$(cat)
TOOL_NAME=$(echo "$TOOL_INFO" | grep -o '"tool":"[^"]*' | cut -d'"' -f4)
TIMESTAMP=$(date +"%H:%M:%S")

# Log based on tool type
case "$TOOL_NAME" in
    "Read")
        FILE_PATH=$(echo "$TOOL_INFO" | grep -o '"file_path":"[^"]*' | cut -d'"' -f4)
        echo "- [$TIMESTAMP] Read: $FILE_PATH" >> "$WORK_LOG"
        ;;
    "Write"|"Edit"|"MultiEdit")
        FILE_PATH=$(echo "$TOOL_INFO" | grep -o '"file_path":"[^"]*' | cut -d'"' -f4)
        echo "- [$TIMESTAMP] Modified: $FILE_PATH" >> "$WORK_LOG"
        ;;
    "Bash")
        COMMAND=$(echo "$TOOL_INFO" | grep -o '"command":"[^"]*' | cut -d'"' -f4 | head -c 50)
        echo "- [$TIMESTAMP] Executed: $COMMAND..." >> "$WORK_LOG"
        ;;
    "TodoWrite")
        echo "- [$TIMESTAMP] Updated task list" >> "$WORK_LOG"
        ;;
    *)
        echo "- [$TIMESTAMP] Used tool: $TOOL_NAME" >> "$WORK_LOG"
        ;;
esac