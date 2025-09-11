#!/bin/bash

# Progress Tracker - Monitors session progress and provides status updates
# Integrates with TodoWrite tool updates

DATE_DIR="$CLAUDE_PROJECT_DIR/.claude/sessions/$(date +%Y-%m-%d)"
LATEST_SESSION=$(ls -d $DATE_DIR/session-* 2>/dev/null | sort -V | tail -1)
PROGRESS_FILE="$LATEST_SESSION/progress.json"
STATS_FILE="$LATEST_SESSION/stats.md"

# Initialize progress file if needed
if [ ! -f "$PROGRESS_FILE" ]; then
    cat > "$PROGRESS_FILE" <<EOF
{
  "session_start": "$(date -Iseconds)",
  "total_tasks": 0,
  "completed_tasks": 0,
  "in_progress": 0,
  "tools_used": {},
  "files_touched": []
}
EOF
fi

# Parse todo updates from stdin if provided
if [ ! -t 0 ]; then
    TODO_INFO=$(cat)
    
    # Count todo statuses
    TOTAL=$(echo "$TODO_INFO" | grep -o '"status"' | wc -l)
    COMPLETED=$(echo "$TODO_INFO" | grep -o '"status":"completed"' | wc -l)
    IN_PROGRESS=$(echo "$TODO_INFO" | grep -o '"status":"in_progress"' | wc -l)
    
    # Update progress JSON
    jq --arg total "$TOTAL" \
       --arg completed "$COMPLETED" \
       --arg progress "$IN_PROGRESS" \
       '.total_tasks = ($total | tonumber) | 
        .completed_tasks = ($completed | tonumber) |
        .in_progress = ($progress | tonumber)' \
       "$PROGRESS_FILE" > "$PROGRESS_FILE.tmp" && mv "$PROGRESS_FILE.tmp" "$PROGRESS_FILE"
fi

# Generate readable stats
cat > "$STATS_FILE" <<EOF
# Progress Statistics

## Task Progress
$(jq -r '"- Total Tasks: \(.total_tasks)\n- Completed: \(.completed_tasks)\n- In Progress: \(.in_progress)\n- Pending: \(.total_tasks - .completed_tasks - .in_progress)"' "$PROGRESS_FILE")

## Completion Rate
$(jq -r 'if .total_tasks > 0 then "**\((.completed_tasks * 100 / .total_tasks) | floor)%** Complete" else "No tasks tracked" end' "$PROGRESS_FILE")

## Session Time
- Started: $(jq -r '.session_start' "$PROGRESS_FILE" | cut -d'T' -f2 | cut -d'+' -f1)
- Elapsed: $(python3 -c "
from datetime import datetime
start = '$(jq -r '.session_start' "$PROGRESS_FILE")'
now = datetime.now().isoformat()
diff = datetime.fromisoformat(now[:19]) - datetime.fromisoformat(start[:19])
hours, remainder = divmod(diff.seconds, 3600)
minutes, seconds = divmod(remainder, 60)
print(f'{hours}h {minutes}m {seconds}s')
" 2>/dev/null || echo "N/A")

Last Updated: $(date +"%H:%M:%S")
EOF

# Output completion percentage for hook feedback
if [ "$1" == "--percentage" ]; then
    jq -r 'if .total_tasks > 0 then "\((.completed_tasks * 100 / .total_tasks) | floor)" else "0"' "$PROGRESS_FILE"
fi