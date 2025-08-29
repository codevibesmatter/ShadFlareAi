import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Send, Loader2, Bot, Wrench } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/conversation'
import { Message, MessageContent, MessageAvatar } from '@/components/message'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function AIChatPage() {
  // Using AI Elements components for better chat experience
  const [selectedModel, setSelectedModel] = useState('llama-3-8b')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enableFunctionCalling, setEnableFunctionCalling] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    try {
      // Use function calling API if enabled and supported model is selected
      const shouldUseFunctionCalling = enableFunctionCalling && (selectedModel === 'hermes-2-pro' || selectedModel === 'gemini-2.5-flash-lite')
      const apiEndpoint = shouldUseFunctionCalling ? '/api/chat-tools' : '/api/chat'
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          model: selectedModel,
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: ''
      }

      setMessages(prev => [...prev, assistantMessage])

      if (shouldUseFunctionCalling) {
        // Handle function calling response (non-streaming)
        const data: any = await response.json()
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessage.id 
              ? { ...m, content: data.content }
              : m
          )
        )
      } else {
        // Handle streaming response
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = new TextDecoder().decode(value)
          const lines = text.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6))
                const content = data.choices?.[0]?.delta?.content
                if (content) {
                  setMessages(prev => 
                    prev.map(m => 
                      m.id === assistantMessage.id 
                        ? { ...m, content: m.content + content }
                        : m
                    )
                  )
                }
              } catch (e) {
                // Ignore parsing errors for individual chunks
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Request was aborted, don't set error
        return
      }
      setError(err.message || 'Failed to send message')
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main fixed>
        <Card className='h-[calc(100vh-12rem)] flex flex-col'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-3 flex-shrink-0'>
            <div>
              <CardTitle>Chat Interface</CardTitle>
              <CardDescription>Ask questions and get AI-powered responses</CardDescription>
            </div>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-2'>
                <Switch 
                  id='function-calling'
                  checked={enableFunctionCalling}
                  onCheckedChange={setEnableFunctionCalling}
                  disabled={selectedModel !== 'hermes-2-pro' && selectedModel !== 'gemini-2.5-flash-lite'}
                />
                <Label htmlFor='function-calling' className='flex items-center gap-1 text-sm'>
                  <Wrench className='h-3 w-3' />
                  Tools
                </Label>
              </div>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className='w-48'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='llama-3-8b'>Llama 3 8B</SelectItem>
                  <SelectItem value='mistral-7b'>Mistral 7B</SelectItem>
                  <SelectItem value='qwen-1.5'>Qwen 1.5 14B</SelectItem>
                  <SelectItem value='codellama'>Code Llama</SelectItem>
                  <SelectItem value='hermes-2-pro'>Hermes 2 Pro (Function Calling)</SelectItem>
                  <SelectItem value='gemini-2.5-flash-lite'>Gemini 2.5 Flash Lite (AI Gateway)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          
          <CardContent className='flex flex-col flex-1 p-0 min-h-0'>
            <div className='flex-1 min-h-0 relative'>
              {messages.length === 0 && !isLoading ? (
                <div className='flex h-full items-center justify-center'>
                  <div className='text-center max-w-md'>
                    <Bot className='mx-auto h-12 w-12 text-muted-foreground/50' />
                    <p className='mt-4 text-muted-foreground'>
                      Start a conversation with the AI assistant
                    </p>
                    {enableFunctionCalling && (selectedModel === 'hermes-2-pro' || selectedModel === 'gemini-2.5-flash-lite') && (
                      <div className='mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg'>
                        <div className='flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2'>
                          <Wrench className='h-4 w-4' />
                          <span className='font-medium'>Function Calling Enabled</span>
                        </div>
                        <p className='text-sm text-blue-600 dark:text-blue-400'>
                          The AI can now use tools like calculator, current time, random numbers, task creation, and API testing.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Conversation className='max-h-[400px]'>
                  <ConversationContent>
                    {messages.map((message) => (
                      <Message key={message.id} from={message.role}>
                        <MessageAvatar
                          src={message.role === 'user' ? '/user-avatar.png' : '/bot-avatar.png'}
                          name={message.role === 'user' ? 'You' : 'AI'}
                        />
                        <MessageContent>
                          <div className='prose prose-sm dark:prose-invert max-w-none'>
                            <ReactMarkdown>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        </MessageContent>
                      </Message>
                    ))}
                    
                    {isLoading && (
                      <Message from="assistant">
                        <MessageAvatar
                          src="/bot-avatar.png"
                          name="AI"
                        />
                        <MessageContent>
                          <Loader2 className='h-4 w-4 animate-spin' />
                        </MessageContent>
                      </Message>
                    )}
                  </ConversationContent>
                  
                  <ConversationScrollButton />
                </Conversation>
              )}
              
              {error && (
                <div className='absolute bottom-0 left-0 right-0 text-center text-sm text-red-500 bg-background/80 p-2'>
                  Error: {error}
                </div>
              )}
            </div>

            <div className='border-t p-4 flex-shrink-0'>
              <form onSubmit={handleSubmit}>
                <div className='flex gap-2'>
                  <Input
                    value={input}
                    onChange={handleInputChange}
                    placeholder='Type your message...'
                    disabled={isLoading}
                    className='flex-1'
                  />
                  <Button type='submit' disabled={isLoading || !input.trim()}>
                    {isLoading ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      <Send className='h-4 w-4' />
                    )}
                  </Button>
                  {isLoading && (
                    <Button onClick={stop} variant='outline' type='button'>
                      Stop
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}

export const Route = createFileRoute('/_authenticated/ai-chat')({
  component: AIChatPage,
})