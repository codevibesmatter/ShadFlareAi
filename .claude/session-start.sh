#!/bin/bash

# Get today's date
DATE=$(date '+%Y-%m-%d')
DATE_DIR="$CLAUDE_PROJECT_DIR/sessions/${DATE}"

# Create date directory if it doesn't exist
mkdir -p "$DATE_DIR"

# Check for active session marker (survives autocompact)
ACTIVE_SESSION_FILE="$CLAUDE_PROJECT_DIR/sessions/.active-session"
if [ -f "$ACTIVE_SESSION_FILE" ]; then
    ACTIVE_SESSION=$(cat "$ACTIVE_SESSION_FILE")
    
    # If active session directory exists, reuse it
    if [ -d "$ACTIVE_SESSION" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] SESSION REUSE (active) - Directory: $ACTIVE_SESSION" >> "$CLAUDE_PROJECT_DIR/sessions/session.log"
        echo "$ACTIVE_SESSION" > "$CLAUDE_PROJECT_DIR/sessions/current-session"
        echo "Reusing active session: $ACTIVE_SESSION"
        exit 0
    fi
fi

# Find the most recent session for today
LAST_SESSION=$(ls -d ${DATE_DIR}/session-* 2>/dev/null | sort -V | tail -1)

# Create new session
SESSION_NUM=1
if [ -n "$LAST_SESSION" ]; then
    # Extract the session number and increment
    LAST_NUM=$(basename "$LAST_SESSION" | sed 's/session-//')
    SESSION_NUM=$((LAST_NUM + 1))
fi

# Create the new session directory
NEW_SESSION_DIR="${DATE_DIR}/session-${SESSION_NUM}"
mkdir -p "$NEW_SESSION_DIR"

# Log the session start
echo "[$(date '+%Y-%m-%d %H:%M:%S')] SESSION START - Directory: $NEW_SESSION_DIR" >> "$CLAUDE_PROJECT_DIR/sessions/session.log"

# Save current session info for other hooks to use
echo "$NEW_SESSION_DIR" > "$CLAUDE_PROJECT_DIR/sessions/current-session"

# Mark this as the active session (survives autocompact)
echo "$NEW_SESSION_DIR" > "$ACTIVE_SESSION_FILE"

echo "Created new session: $NEW_SESSION_DIR"