import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAIChatState } from '@/stores'

export const Route = createFileRoute('/_authenticated/ai-chat-legend-test')({
  component: AIChatLegendTestPage,
})

function AIChatLegendTestPage() {
  const { isLoading, input } = useAIChatState()

  return (
    <div className="flex-1 flex flex-col h-full max-w-4xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Legend State v3 Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>isLoading: {String(isLoading)}</p>
            <p>input: {input}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}