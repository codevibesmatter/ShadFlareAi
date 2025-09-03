/**
 * Store Demo Component
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
  useAuthSelector, 
  useAuthActions,
  useAIChat,
  useAIChatSelector, 
  useAIChatActions,
  storeUtils
} from '@/stores'

export function StoreDemo() {
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Auth store selectors
  const authUser = useAuthSelector((state) => state.user)
  const isAuthenticated = useAuthSelector((state) => state.isAuthenticated)
  const authError = useAuthSelector((state) => state.error)
  const authActions = useAuthActions()
  
  // AI Chat store selectors
  const chatMessages = useAIChatSelector((state) => state.messages)
  const chatSettings = useAIChatSelector((state) => state.settings)
  const chatWebSocket = useAIChatSelector((state) => state.websocket)
  const chatActions = useAIChatActions()
  
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
          <CardTitle>🔧 Modular Observable System Demo</CardTitle>
          <CardDescription>
            Real-time state management with Zustand-based observables
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
                <CardTitle className="text-sm">🔐 Auth Store</CardTitle>
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
                    {authUser?.email || "None"}
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
                <CardTitle className="text-sm">🤖 AI Chat Store</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Messages:</span>
                  <Badge variant="outline">
                    {chatMessages.length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">WebSocket:</span>
                  <Badge variant={chatWebSocket.isConnected ? "default" : "secondary"}>
                    {chatWebSocket.isConnected ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Model:</span>
                  <span className="text-xs text-muted-foreground">
                    {chatSettings.selectedModel}
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
          <CardTitle className="text-lg">🎮 Interactive Controls</CardTitle>
          <CardDescription>
            Test store actions and see real-time updates
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
                    email: 'demo@example.com',
                    role: ['user'],
                    exp: Date.now() + 3600000,
                    displayName: 'Demo User'
                  })}
                  size="sm"
                >
                  Set Demo User
                </Button>
                <Button 
                  onClick={() => authActions.logout()}
                  variant="outline"
                  size="sm"
                >
                  Logout
                </Button>
                <Button 
                  onClick={() => authActions.setError('Demo error message')}
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
                  onClick={() => chatActions.addMessage({
                    role: 'user',
                    content: 'This is a demo message!',
                    artifacts: []
                  })}
                  size="sm"
                >
                  Add User Message
                </Button>
                <Button 
                  onClick={() => chatActions.addMessage({
                    role: 'assistant',
                    content: 'This is a demo AI response!',
                    artifacts: []
                  })}
                  variant="outline"
                  size="sm"
                >
                  Add AI Message
                </Button>
                <Button 
                  onClick={() => chatActions.clearMessages()}
                  variant="destructive"
                  size="sm"
                >
                  Clear Messages
                </Button>
                <Button 
                  onClick={() => chatActions.updateSettings({
                    selectedModel: chatSettings.selectedModel === 'llama-3-8b' 
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
      
      {/* State Inspection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🔍 State Inspection</CardTitle>
          <CardDescription>
            Live view of store states (updates every 2s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="auth-state">
            <TabsList>
              <TabsTrigger value="auth-state">Auth State</TabsTrigger>
              <TabsTrigger value="chat-state">Chat State</TabsTrigger>
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