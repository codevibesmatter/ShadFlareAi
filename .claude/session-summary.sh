#!/bin/bash

# Session Summary Generator - Creates summary of current session
# Can be triggered manually or by Stop hook

# Cross-platform notification function with logging
send_notification() {
    local title="$1"
    local message="$2"
    local log_file="$CLAUDE_PROJECT_DIR/.claude/notification.log"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] NOTIFICATION: $title - $message" >> "$log_file"
    
    case "$(uname -s)" in
        Darwin*)
            # macOS
            if command -v osascript >/dev/null 2>&1; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Using osascript for macOS notification" >> "$log_file"
                osascript -e "display notification \"$message\" with title \"$title\"" 2>>"$log_file"
            else
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] osascript not found" >> "$log_file"
            fi
            ;;
        Linux*)
            # Linux
            if command -v notify-send >/dev/null 2>&1; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Using notify-send for Linux notification" >> "$log_file"
                notify-send "$title" "$message" 2>>"$log_file"
            elif command -v zenity >/dev/null 2>&1; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Using zenity for Linux notification" >> "$log_file"
                zenity --info --title="$title" --text="$message" --timeout=5 2>>"$log_file" &
            else
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] No notification tools found on Linux" >> "$log_file"
            fi
            ;;
        CYGWIN*|MINGW32*|MSYS*|MINGW*)
            # Windows
            if command -v powershell.exe >/dev/null 2>&1; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Using powershell for Windows notification" >> "$log_file"
                powershell.exe -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('$message', '$title', 'OK', 'Information')" 2>>"$log_file" &
            elif command -v msg >/dev/null 2>&1; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Using msg for Windows notification" >> "$log_file"
                msg * /time:5 "$title: $message" 2>>"$log_file" &
            else
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] No notification tools found on Windows" >> "$log_file"
            fi
            ;;
        *)
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Unknown OS: $(uname -s)" >> "$log_file"
            ;;
    esac
}

DATE_DIR="$CLAUDE_PROJECT_DIR/sessions/$(date +%Y-%m-%d)"
LATEST_SESSION=$(ls -d $DATE_DIR/session-* 2>/dev/null | sort -V | tail -1)

if [ -z "$LATEST_SESSION" ]; then
    echo "No active session found"
    exit 0
fi

PLAN_FILE="$LATEST_SESSION/plan.md"
WORK_LOG="$LATEST_SESSION/work-log.md"
SUMMARY_FILE="$LATEST_SESSION/summary.md"

# Always create work log if it doesn't exist
if [ ! -f "$WORK_LOG" ]; then
    echo "# Work Log - $(date +"%Y-%m-%d %H:%M")" > "$WORK_LOG"
    echo "" >> "$WORK_LOG"
    echo "## Session Activity" >> "$WORK_LOG"
    echo "- Session completed at $(date +"%H:%M:%S")" >> "$WORK_LOG"
fi

# Generate summary
cat > "$SUMMARY_FILE" <<EOF
# Session Summary - $(date +"%Y-%m-%d %H:%M")

## Session Duration
- Started: $(stat -c %y "$LATEST_SESSION" 2>/dev/null | cut -d' ' -f2 | cut -d'.' -f1)
- Current: $(date +"%H:%M:%S")

## Goals Achieved
EOF

# Extract completed goals from plan if exists
if [ -f "$PLAN_FILE" ]; then
    echo "### From Plan:" >> "$SUMMARY_FILE"
    grep "✅" "$PLAN_FILE" 2>/dev/null >> "$SUMMARY_FILE" || echo "- No completed goals marked" >> "$SUMMARY_FILE"
fi

echo "" >> "$SUMMARY_FILE"
echo "## Activity Summary" >> "$SUMMARY_FILE"

# Count activities from work log (now always exists)
READS=$(grep -c "Read:" "$WORK_LOG" 2>/dev/null)
MODS=$(grep -c "Modified:" "$WORK_LOG" 2>/dev/null)
EXECS=$(grep -c "Executed:" "$WORK_LOG" 2>/dev/null)

# Ensure variables are integers (grep -c always returns a number)
READS=${READS:-0}
MODS=${MODS:-0}
EXECS=${EXECS:-0}

TOTAL_ACTIONS=$((READS + MODS + EXECS))

# If no manual actions logged, check git activity since session start
if [ "$TOTAL_ACTIONS" -eq 0 ] && [ -d "$LATEST_SESSION" ] && git rev-parse --git-dir >/dev/null 2>&1; then
    SESSION_START=$(stat -c %Y "$LATEST_SESSION" 2>/dev/null || echo 0)
    
    # Count commits since session start
    COMMIT_COUNT=0
    if [ "$SESSION_START" -gt 0 ]; then
        COMMIT_COUNT=$(git rev-list --count --since="@$SESSION_START" HEAD 2>/dev/null || echo 0)
    fi
    
    # Count modified files (staged + unstaged)
    MODIFIED_COUNT=$(git diff --name-only HEAD 2>/dev/null | wc -l || echo 0)
    STAGED_COUNT=$(git diff --name-only --cached 2>/dev/null | wc -l || echo 0)
    
    GIT_ACTIVITY=$((COMMIT_COUNT + MODIFIED_COUNT + STAGED_COUNT))
    
    if [ "$GIT_ACTIVITY" -gt 0 ]; then
        TOTAL_ACTIONS=$GIT_ACTIVITY
        # Update the counts for display
        READS=$COMMIT_COUNT
        MODS=$MODIFIED_COUNT
        EXECS=$STAGED_COUNT
    fi
fi

# Display activity with appropriate labels
if [ "$GIT_ACTIVITY" -gt 0 ] 2>/dev/null; then
    echo "- Git commits: $READS" >> "$SUMMARY_FILE"
    echo "- Modified files: $MODS" >> "$SUMMARY_FILE" 
    echo "- Staged files: $EXECS" >> "$SUMMARY_FILE"
    echo "- Total git activity: $TOTAL_ACTIONS" >> "$SUMMARY_FILE"
else
    echo "- Files read: $READS" >> "$SUMMARY_FILE"
    echo "- Files modified: $MODS" >> "$SUMMARY_FILE"
    echo "- Commands executed: $EXECS" >> "$SUMMARY_FILE"
    echo "- Total actions: $TOTAL_ACTIONS" >> "$SUMMARY_FILE"
fi

echo "" >> "$SUMMARY_FILE"
echo "## Recent Activity" >> "$SUMMARY_FILE"
tail -10 "$WORK_LOG" >> "$SUMMARY_FILE"

# Git activity if repo exists
if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "" >> "$SUMMARY_FILE"
    echo "## Git Activity" >> "$SUMMARY_FILE"
    echo "\`\`\`" >> "$SUMMARY_FILE"
    git log --oneline -5 2>/dev/null >> "$SUMMARY_FILE"
    echo "\`\`\`" >> "$SUMMARY_FILE"
fi

echo "Session summary created: $SUMMARY_FILE"

# Send notification based on session importance  
SESSION_NAME=$(basename "$LATEST_SESSION")
PROJECT_NAME=$(basename "$CLAUDE_PROJECT_DIR")
SETUP_COMPLETE_FLAG="$CLAUDE_PROJECT_DIR/.claude/setup-complete"

if [ "$SESSION_NAME" = "session-1" ] && [ ! -f "$SETUP_COMPLETE_FLAG" ]; then
    # First time session-1 completes
    send_notification "Claude Session Complete" "[$PROJECT_NAME] Initial session setup completed"
    touch "$SETUP_COMPLETE_FLAG"
elif [ "$TOTAL_ACTIONS" -ge 3 ]; then
    send_notification "Claude Session Complete" "[$PROJECT_NAME] Session completed with $TOTAL_ACTIONS actions"
else
    # Only log, no notification for minimal activity sessions
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUMMARY: Skipped notification for minimal activity session ($TOTAL_ACTIONS actions)" >> "$CLAUDE_PROJECT_DIR/.claude/notification.log"
fi