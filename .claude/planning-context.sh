#!/bin/bash

# Planning Context Hook - Injects session planning context into Claude's normal flow
# Uses UserPromptSubmit to provide planning awareness without subprocess overhead

SESSION_DIR="$CLAUDE_PROJECT_DIR/sessions/$(date +%Y-%m-%d)"
LATEST_SESSION=$(ls -d $SESSION_DIR/session-* 2>/dev/null | sort -V | tail -1)

if [ -z "$LATEST_SESSION" ]; then
    echo '{"shouldBlock": false}'
    exit 0
fi

PLAN_FILE="$LATEST_SESSION/plan.md"
WORK_LOG="$LATEST_SESSION/work-log.md"
SESSION_NAME=$(basename "$LATEST_SESSION")

# Read current session state
CURRENT_GOALS=""
if [ -f "$PLAN_FILE" ]; then
    # Extract current goals and status
    CURRENT_GOALS=$(grep -E "^- \[.\]" "$PLAN_FILE" 2>/dev/null | head -5)
    COMPLETED_COUNT=$(grep -c "✅\|☑\|\[x\]" "$PLAN_FILE" 2>/dev/null || echo 0)
    TOTAL_COUNT=$(grep -c "- \[" "$PLAN_FILE" 2>/dev/null || echo 0)
else
    CURRENT_GOALS="No plan file exists yet"
    COMPLETED_COUNT=0
    TOTAL_COUNT=0
fi

# Recent activity summary
RECENT_ACTIVITY=""
if [ -f "$WORK_LOG" ]; then
    ACTIVITY_COUNT=$(grep -c "Used tool\|Modified\|Read\|Executed" "$WORK_LOG" 2>/dev/null || echo 0)
    RECENT_ACTIVITY=$(tail -3 "$WORK_LOG" 2>/dev/null | grep -E "\[.*\]" | sed 's/^/  /')
fi

# Create consistent planning nudge for all prompts
PLANNING_CONTEXT="📋 **Session Planning Context**

**Current Session:** $SESSION_NAME
**Progress:** $COMPLETED_COUNT/$TOTAL_COUNT goals completed

**Current Goals:**
$CURRENT_GOALS

**Planning Guidance:**
- Consider updating the session plan as you work
- Mark goals as completed (✅) when finished
- Add new goals if the user's request suggests them
- Keep the plan aligned with the evolving conversation

Session plan located at: $PLAN_FILE"

# Output context injection
cat <<EOF
{
    "shouldBlock": false,
    "additionalContext": "$PLANNING_CONTEXT"
}
EOF