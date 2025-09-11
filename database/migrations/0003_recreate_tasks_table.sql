-- Recreate tasks table without foreign key constraints
CREATE TABLE IF NOT EXISTS "task" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo' CHECK("status" IN ('backlog', 'todo', 'in progress', 'done', 'canceled')),
    "label" TEXT CHECK("label" IN ('bug', 'feature', 'documentation')),
    "priority" TEXT NOT NULL DEFAULT 'medium' CHECK("priority" IN ('low', 'medium', 'high', 'critical')),
    "assignee" TEXT,
    "dueDate" INTEGER,
    "createdAt" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    "updatedAt" INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS "idx_task_userId" ON "task"("userId");
CREATE INDEX IF NOT EXISTS "idx_task_status" ON "task"("status");
CREATE INDEX IF NOT EXISTS "idx_task_priority" ON "task"("priority");
CREATE INDEX IF NOT EXISTS "idx_task_createdAt" ON "task"("createdAt");