/**
 * JSON Viewer Component
 * 
 * Simple JSON viewer with syntax highlighting
 */

import { cn } from '@/lib/utils'

interface JsonViewerProps {
  data: unknown
  className?: string
}

export function JsonViewer({ data, className }: JsonViewerProps) {
  const jsonString = JSON.stringify(data, null, 2)
  
  return (
    <pre className={cn(
      "bg-muted/50 p-4 rounded-lg text-xs overflow-auto",
      "border border-border",
      className
    )}>
      <code className="text-foreground">
        {jsonString}
      </code>
    </pre>
  )
}