/**
 * Legend State v3 Store Index
 * 
 * Central export point for all observables and state management utilities
 */

// Export individual store observables
export { auth$, authActions, authComputed, authSelectors, initializeAuth } from './auth'
export { aiChat$, aiChatActions, aiChatComputed, aiChatSelectors } from './ai-chat'

// Import stores for internal use
import { auth$ } from './auth'
import { aiChat$ } from './ai-chat'

// Export types
export type { AuthUser, AuthSession } from './auth'
export type { 
  ChatMessage, 
  WebSocketState, 
  VoiceState, 
  ChatSettings 
} from './ai-chat'

// Root store interface for global state coordination
export interface RootStore {
  auth: typeof import('./auth').auth$
  aiChat: typeof import('./ai-chat').aiChat$
}

// Store management utilities
export const storeUtils = {
  // Reset all stores to initial state
  resetAll: () => {
    authActions.reset()
    aiChatActions.reset()
  },
  
  // Get all store states for debugging
  getDebugState: () => ({
    auth: auth$.get(),
    aiChat: aiChat$.get()
  }),
  
  // Subscribe to auth changes across the app
  onAuthChange: (callback: (isAuthenticated: boolean) => void) => {
    return auth$.isAuthenticated.onChange(callback)
  },
  
  // Subscribe to AI chat connection status
  onChatConnectionChange: (callback: (isConnected: boolean) => void) => {
    return aiChat$.websocket.isConnected.onChange(callback)
  }
}

// Development helpers
if (process.env.NODE_ENV === 'development') {
  // Attach stores to window for debugging
  ;(globalThis as unknown as Record<string, unknown>).__LEGEND_STORES__ = {
    auth: auth$,
    aiChat: aiChat$,
    getAuth: () => auth$.get(),
    getAIChat: () => aiChat$.get(),
    resetAll: storeUtils.resetAll,
    getDebugState: storeUtils.getDebugState
  }
}

// Export React hooks
export {
  useAuth,
  useAuthUser,
  useAuthState,
  useAuthSelector,
  useAuthActions,
  useAIChat,
  useAIChatMessages,
  useAIChatSettings,
  useAIChatWebSocket,
  useAIChatVoice,
  useAIChatState,
  useAIChatSelector,
  useAIChatActions,
  useStoreDebug
} from './hooks'

// Re-export Legend State utilities for convenience
export { observable } from '@legendapp/state'
export { syncObservable } from '@legendapp/state/sync'