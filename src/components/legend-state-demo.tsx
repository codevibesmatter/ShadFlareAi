/**
 * Legend State v3 Demo Component
 * 
 * Demonstrates the modular observable system with live state inspection
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { JsonViewer } from '@/components/ui/json-viewer'
import { 
  useAuth,
  useAuthState, 
  useAIChat,
  useAIChatState,
  authActions,
  aiChatActions,
  storeUtils
} from '@/stores'

export function LegendStateDemo() {
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Auth state using Legend State hooks
  const { user, isAuthenticated, error: authError } = useAuthState()
  
  // AI Chat state using Legend State hooks  
  const { messages, settings, websocket } = useAIChatState()
  
  // Full store states for JSON view
  const fullAuthState = useAuth()
  const fullChatState = useAIChat()
  
  // Force refresh for demo
  const refresh = () => setRefreshKey(prev => prev + 1)
  
  useEffect(() => {
    // Auto-refresh every 2 seconds for demo
    const interval = setInterval(refresh, 2000)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="space-y-6" key={refreshKey}>
      <Card>
        <CardHeader>
          <CardTitle>⚡ Legend State v3 Modular Observable Demo</CardTitle>
          <CardDescription>
            Ultra-fast fine-grained reactive state management with Legend State
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Global Actions */}
          <div className="flex gap-2">
            <Button 
              onClick={() => storeUtils.resetAll()}
              variant="destructive"
              size="sm"
            >
              Reset All Stores
            </Button>
            <Button 
              onClick={() => console.log('Debug state:', storeUtils.getDebugState())}
              variant="outline"
              size="sm"
            >
              Log Debug State
            </Button>
            <Button onClick={refresh} variant="ghost" size="sm">
              Refresh View
            </Button>
          </div>
          
          {/* Store Status Overview */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">🔐 Auth Observable</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Status:</span>
                  <Badge variant={isAuthenticated ? "default" : "secondary"}>
                    {isAuthenticated ? "Authenticated" : "Guest"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">User:</span>
                  <span className="text-xs text-muted-foreground">
                    {user?.email || "None"}
                  </span>
                </div>
                {authError && (
                  <div className="text-xs text-red-500">
                    Error: {authError}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">🤖 AI Chat Observable</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Messages:</span>
                  <Badge variant="outline">
                    {messages.length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">WebSocket:</span>
                  <Badge variant={websocket.isConnected ? "default" : "secondary"}>
                    {websocket.isConnected ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Model:</span>
                  <span className="text-xs text-muted-foreground">
                    {settings.selectedModel}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
      
      {/* Interactive Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🎮 Interactive Legend State Actions</CardTitle>
          <CardDescription>
            Test observable actions and see real-time fine-grained updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="auth">
            <TabsList>
              <TabsTrigger value="auth">Auth Actions</TabsTrigger>
              <TabsTrigger value="chat">Chat Actions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="auth" className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => authActions.setUser({
                    accountNo: 'demo-123',
                    email: 'legend@example.com',
                    role: ['user'],
                    exp: Date.now() + 3600000,
                    displayName: 'Legend State User'
                  })}
                  size="sm"
                >
                  Set Legend User
                </Button>
                <Button 
                  onClick={() => authActions.logout()}
                  variant="outline"
                  size="sm"
                >
                  Logout
                </Button>
                <Button 
                  onClick={() => authActions.setError('Legend State demo error')}
                  variant="destructive"
                  size="sm"
                >
                  Set Error
                </Button>
                <Button 
                  onClick={() => authActions.setError(null)}
                  variant="ghost"
                  size="sm"
                >
                  Clear Error
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="chat" className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => aiChatActions.addMessage({
                    role: 'user',
                    content: 'This is a Legend State demo message! ⚡',
                    artifacts: []
                  })}
                  size="sm"
                >
                  Add User Message
                </Button>
                <Button 
                  onClick={() => aiChatActions.addMessage({
                    role: 'assistant',
                    content: 'This is a demo AI response powered by Legend State v3! 🚀',
                    artifacts: []
                  })}
                  variant="outline"
                  size="sm"
                >
                  Add AI Message
                </Button>
                <Button 
                  onClick={() => aiChatActions.clearMessages()}
                  variant="destructive"
                  size="sm"
                >
                  Clear Messages
                </Button>
                <Button 
                  onClick={() => aiChatActions.updateSettings({
                    selectedModel: settings.selectedModel === 'llama-3-8b' 
                      ? 'mistral-7b' 
                      : 'llama-3-8b'
                  })}
                  variant="ghost"
                  size="sm"
                >
                  Toggle Model
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Legend State Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">⚡ Legend State v3 Features</CardTitle>
          <CardDescription>
            Key advantages of Legend State over other state libraries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">🚀 Performance</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Fine-grained reactivity</li>
                <li>• Minimal re-renders</li>
                <li>• Fastest React state library</li>
                <li>• Only 4KB bundle size</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">🧠 Developer Experience</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• No boilerplate code</li>
                <li>• Intuitive get() and set() API</li>
                <li>• TypeScript support</li>
                <li>• No contexts or providers</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">🔄 Reactivity</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Automatic dependency tracking</li>
                <li>• Computed observables</li>
                <li>• Async observables</li>
                <li>• Deep nested objects</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">💾 Persistence</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Built-in sync system</li>
                <li>• Local storage integration</li>
                <li>• Remote sync plugins</li>
                <li>• Optimistic updates</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* State Inspection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🔍 Observable State Inspection</CardTitle>
          <CardDescription>
            Live view of Legend State observables (updates every 2s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="auth-state">
            <TabsList>
              <TabsTrigger value="auth-state">Auth Observable</TabsTrigger>
              <TabsTrigger value="chat-state">Chat Observable</TabsTrigger>
            </TabsList>
            
            <TabsContent value="auth-state">
              <div className="max-h-96 overflow-auto">
                <JsonViewer data={fullAuthState} />
              </div>
            </TabsContent>
            
            <TabsContent value="chat-state">
              <div className="max-h-96 overflow-auto">
                <JsonViewer data={fullChatState} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}