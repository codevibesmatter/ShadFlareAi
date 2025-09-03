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
import { Send, Loader2, Bot, Wrench, Sparkles, Mic, MicOff, Volume2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useEffect, useRef } from 'react'
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/conversation'
import { Message, MessageContent, MessageAvatar } from '@/components/message'
import { ArtifactMessageComponent } from '@/components/artifacts/artifact-message'
import { Actions, Action } from '@/components/actions'
import { Suggestions, Suggestion } from '@/components/suggestion'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/reasoning'
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, Share, BookmarkPlus } from 'lucide-react'
import { aiLog } from '@/lib/logger'

// Import Legend State hooks and actions
import { 
  useAIChatState,
  aiChatActions,
  aiChatComputed 
} from '@/stores'

function AIChatLegendPage() {
  // Use Legend State hooks for reactive state
  const {
    messages,
    isLoading,
    error,
    input,
    settings,
    websocket,
    voice
  } = useAIChatState()
  
  const conversationRef = useRef<HTMLDivElement | null>(null)
  
  const getContextualSuggestions = () => {
    if (messages.length === 0) {
      return [
        'Create a simple React component',
        'Write a Python function',
        'Help me debug this code',
        'Explain this concept',
        'Generate a HTML page'
      ]
    }
    
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'assistant') {
      if (lastMessage.artifacts && lastMessage.artifacts.length > 0) {
        return [
          'Modify the component',
          'Add more features',
          'Explain how this works',
          'Create a similar component',
          'Add styling'
        ]
      } else {
        return [
          'Can you show me code examples?',
          'Create an artifact for this',
          'Make this interactive',
          'Add more details',
          'What are the alternatives?'
        ]
      }
    }
    
    return [
      'Continue this conversation',
      'Ask a follow-up question',
      'Create something new',
      'Explain further',
      'Show me examples'
    ]
  }

  // Auto-connect WebSocket when component mounts
  useEffect(() => {
    if (settings.useWebSocket && !websocket.isConnected) {
      aiChatActions.connectWebSocket()
    }
    
    return () => {
      if (websocket.isConnected) {
        aiChatActions.disconnectWebSocket()
      }
    }
  }, [settings.useWebSocket])

  // Auto-scroll effect when messages change
  useEffect(() => {
    if (messages.length > 0 && conversationRef.current) {
      setTimeout(() => {
        const scrollContainer = conversationRef.current?.querySelector('[role="log"]')
        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth'
          })
        }
      }, 100)
    }
  }, [messages])

  // Additional effect to handle streaming content updates
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
      setTimeout(() => {
        const scrollContainer = conversationRef.current?.querySelector('[role="log"]')
        if (scrollContainer) {
          const shouldAutoScroll = scrollContainer.scrollTop + scrollContainer.clientHeight + 100 >= scrollContainer.scrollHeight
          if (shouldAutoScroll) {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: 'smooth'
            })
          }
        }
      }, 50)
    }
  }, [messages.map(m => m.content).join('')])
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    aiChatActions.setInput(e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    try {
      await aiChatActions.sendMessage(input.trim())
    } catch (error) {
      const logger = aiLog('ai-chat-legend.tsx')
      logger.error('Failed to send message', error)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    aiChatActions.setInput(suggestion)
  }

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const handleRegenerateResponse = (messageId: string) => {
    // Find the user message before this assistant message
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex > 0) {
      const userMessage = messages[messageIndex - 1]
      if (userMessage.role === 'user') {
        // Remove the assistant message and regenerate
        aiChatActions.removeMessage(messageId)
        aiChatActions.sendMessage(userMessage.content)
      }
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
              <CardTitle>Legend State Chat Interface</CardTitle>
              <CardDescription>AI-powered chat with Legend State v3 observables</CardDescription>
            </div>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-2'>
                <Switch 
                  id='websocket-mode'
                  checked={settings.useWebSocket}
                  onCheckedChange={(checked) => aiChatActions.updateSettings({ useWebSocket: checked })}
                />
                <Label htmlFor='websocket-mode' className='flex items-center gap-1 text-sm'>
                  WebSocket
                  {websocket.isConnected && <span className='h-2 w-2 bg-green-500 rounded-full ml-1' />}
                  {websocket.sessionId && typeof websocket.sessionId === 'string' && <span className='text-xs text-muted-foreground ml-1'>({websocket.sessionId.slice(0, 8)})</span>}
                </Label>
              </div>
              <div className='flex items-center gap-2'>
                <Switch 
                  id='function-calling'
                  checked={settings.enableFunctionCalling}
                  onCheckedChange={(checked) => aiChatActions.updateSettings({ enableFunctionCalling: checked })}
                  disabled={settings.selectedModel !== 'hermes-2-pro' && settings.selectedModel !== 'gemini-2.5-flash-lite'}
                />
                <Label htmlFor='function-calling' className='flex items-center gap-1 text-sm'>
                  <Wrench className='h-3 w-3' />
                  Tools
                </Label>
              </div>
              <div className='flex items-center gap-2'>
                <Switch 
                  id='artifacts'
                  checked={settings.enableArtifacts}
                  onCheckedChange={(checked) => aiChatActions.updateSettings({ enableArtifacts: checked })}
                />
                <Label htmlFor='artifacts' className='flex items-center gap-1 text-sm'>
                  <Sparkles className='h-3 w-3' />
                  Artifacts
                </Label>
              </div>
              <Select 
                value={settings.selectedModel} 
                onValueChange={(value) => aiChatActions.updateSettings({ selectedModel: value })}
              >
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
                    <p className='text-xs text-muted-foreground mt-2'>
                      Powered by Legend State v3 - Ultra-fast fine-grained reactivity
                    </p>
                    <div className='space-y-4 mt-6'>
                      {settings.enableFunctionCalling && (settings.selectedModel === 'hermes-2-pro' || settings.selectedModel === 'gemini-2.5-flash-lite') && (
                        <div className='p-3 bg-blue-50 dark:bg-blue-950 rounded-lg'>
                          <div className='flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2'>
                            <Wrench className='h-4 w-4' />
                            <span className='font-medium'>Function Calling Enabled</span>
                          </div>
                          <p className='text-sm text-blue-600 dark:text-blue-400'>
                            The AI can now use tools like calculator, current time, random numbers, task creation, and API testing.
                          </p>
                        </div>
                      )}
                      
                      {settings.enableArtifacts && (
                        <div className='p-3 bg-purple-50 dark:bg-purple-950 rounded-lg'>
                          <div className='flex items-center gap-2 text-purple-700 dark:text-purple-300 mb-2'>
                            <Sparkles className='h-4 w-4' />
                            <span className='font-medium'>Artifacts Enabled</span>
                          </div>
                          <p className='text-sm text-purple-600 dark:text-purple-400'>
                            The AI can create interactive artifacts like code components, HTML pages, and visualizations.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div ref={conversationRef} className='h-full'>
                  <Conversation className='h-full'>
                    <ConversationContent>
                      {messages.map((message, index) => {
                        const isLastMessage = index === messages.length - 1
                        const isStreaming = isLoading && isLastMessage && message.role === 'assistant'
                        
                        return (
                          <Message key={message.id} from={message.role}>
                            <MessageAvatar
                              src={message.role === 'user' ? '/user-avatar.png' : '/bot-avatar.png'}
                              name={message.role === 'user' ? 'You' : 'AI'}
                            />
                            <MessageContent>
                              {/* Add reasoning display for assistant messages */}
                              {message.role === 'assistant' && (
                                <Reasoning
                                  isStreaming={isStreaming}
                                  defaultOpen={false}
                                  duration={isStreaming ? 0 : Math.floor(Math.random() * 3) + 1}
                                >
                                  <ReasoningTrigger />
                                  <ReasoningContent>
                                    Analyzing the request and determining the best approach to provide a helpful and accurate response. Considering context, technical requirements, and user needs.
                                  </ReasoningContent>
                                </Reasoning>
                              )}
                              
                              <ArtifactMessageComponent 
                                message={message}
                              />
                              
                              {/* Add message actions for assistant messages */}
                              {message.role === 'assistant' && message.content && (
                                <Actions className="mt-2">
                                  <Action
                                    tooltip="Copy message"
                                    onClick={() => handleCopyMessage(message.content)}
                                  >
                                    <Copy size={14} />
                                  </Action>
                                  <Action
                                    tooltip="Good response"
                                    onClick={() => {
                                      const logger = aiLog('ai-chat-legend.tsx')
                                      logger.debug('Thumbs up clicked', { messageId: message.id })
                                    }}
                                  >
                                    <ThumbsUp size={14} />
                                  </Action>
                                  <Action
                                    tooltip="Poor response"
                                    onClick={() => {
                                      const logger = aiLog('ai-chat-legend.tsx')
                                      logger.debug('Thumbs down clicked', { messageId: message.id })
                                    }}
                                  >
                                    <ThumbsDown size={14} />
                                  </Action>
                                  <Action
                                    tooltip="Regenerate response"
                                    onClick={() => handleRegenerateResponse(message.id)}
                                  >
                                    <RefreshCw size={14} />
                                  </Action>
                                  <Action
                                    tooltip="Share message"
                                    onClick={() => {
                                      const logger = aiLog('ai-chat-legend.tsx')
                                      logger.debug('Share clicked', { messageId: message.id })
                                    }}
                                  >
                                    <Share size={14} />
                                  </Action>
                                  <Action
                                    tooltip="Save message"
                                    onClick={() => {
                                      const logger = aiLog('ai-chat-legend.tsx')
                                      logger.debug('Save clicked', { messageId: message.id })
                                    }}
                                  >
                                    <BookmarkPlus size={14} />
                                  </Action>
                                </Actions>
                              )}
                            </MessageContent>
                          </Message>
                        )
                      })}
                      
                      {isLoading && (
                        <Message from="assistant">
                          <MessageAvatar
                            src="/bot-avatar.png"
                            name="AI"
                          />
                          <MessageContent>
                            <div className='flex items-center gap-2'>
                              <Loader2 className='h-4 w-4 animate-spin' />
                              <span className='text-sm text-muted-foreground'>
                                {settings.useWebSocket ? `Connected via WebSocket ${websocket.isConnected ? '✓' : '✗'}` : 'Processing...'}
                              </span>
                            </div>
                          </MessageContent>
                        </Message>
                      )}
                    </ConversationContent>
                    
                    <ConversationScrollButton />
                  </Conversation>
                </div>
              )}
              
              {error && (
                <div className='absolute bottom-0 left-0 right-0 text-center text-sm text-red-500 bg-background/80 p-2'>
                  Error: {error}
                </div>
              )}
            </div>

            <div className='border-t p-4 flex-shrink-0'>
              {/* Add contextual suggestions */}
              {!isLoading && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    {messages.length === 0 ? 'Try these suggestions:' : 'Continue with:'}
                  </p>
                  <Suggestions>
                    {getContextualSuggestions().map((suggestion, index) => (
                      <Suggestion
                        key={index}
                        suggestion={suggestion}
                        onClick={handleSuggestionClick}
                      />
                    ))}
                  </Suggestions>
                </div>
              )}
              
              <form onSubmit={handleSubmit}>
                <div className='flex gap-2'>
                  <div className='flex-1 relative'>
                    <Input
                      value={input}
                      onChange={handleInputChange}
                      placeholder={voice.isEnabled ? 'Click microphone to speak...' : 'Type your message...'}
                      disabled={isLoading || voice.isRecording}
                      className='pr-12'
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={aiChatActions.toggleVoiceMode}
                      className='absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0'
                    >
                      <Volume2 className={`h-4 w-4 ${voice.isEnabled ? 'text-blue-500' : 'text-muted-foreground'}`} />
                    </Button>
                  </div>
                  
                  {voice.isEnabled ? (
                    <Button
                      type='button'
                      onClick={voice.isRecording ? aiChatActions.stopVoiceRecording : aiChatActions.startVoiceRecording}
                      disabled={voice.isProcessing}
                      className={`${voice.isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                    >
                      {voice.isProcessing ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : voice.isRecording ? (
                        <MicOff className='h-4 w-4' />
                      ) : (
                        <Mic className='h-4 w-4' />
                      )}
                    </Button>
                  ) : (
                    <Button 
                      type='submit' 
                      disabled={isLoading || !input.trim()}
                    >
                      {isLoading ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <Send className='h-4 w-4' />
                      )}
                    </Button>
                  )}
                  
                  {isLoading && (
                    <Button onClick={aiChatActions.stopGeneration} variant='outline' type='button'>
                      Stop
                    </Button>
                  )}
                </div>
              </form>

              {/* Debug info */}
              {process.env.NODE_ENV === 'development' && (
                <div className='mt-4 p-2 bg-muted/50 rounded text-xs space-y-1'>
                  <div>Messages: {messages.length} | Stats: {JSON.stringify(aiChatComputed.conversationStats())}</div>
                  <div>Can Send: {aiChatComputed.canSend() ? '✓' : '✗'} | Last: {aiChatComputed.lastMessage()?.role || 'none'}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}

export const Route = createFileRoute('/_authenticated/ai-chat-legend')({
  component: AIChatLegendPage,
})