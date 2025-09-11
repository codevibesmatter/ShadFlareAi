/**
 * Legend State v3 React Hooks
 * 
 * Custom hooks for using Legend State observables in React components
 */

import { useSelector } from '@legendapp/state/react'
import { aiChat$, aiChatActions } from './ai-chat' // Import directly to avoid circular dependency

// AI Chat hooks
export const useAIChat = () => {
  return useSelector(aiChat$)
}

export const useAIChatMessages = () => {
  return useSelector(aiChat$.messages)
}

export const useAIChatSettings = () => {
  return useSelector(aiChat$.settings)
}

export const useAIChatWebSocket = () => {
  return useSelector(aiChat$.websocket)
}

export const useAIChatVoice = () => {
  return useSelector(aiChat$.voice)
}

export const useAIChatState = () => {
  // Use useSelector to get primitive values from observables
  const messages = useSelector(aiChat$.messages)
  const isLoading = useSelector(aiChat$.isLoading)
  const error = useSelector(aiChat$.error)
  const input = useSelector(aiChat$.input)
  
  // Flatten the settings to primitive values
  const settings = {
    selectedModel: useSelector(aiChat$.settings.selectedModel),
    useWebSocket: useSelector(aiChat$.settings.useWebSocket),
    enableFunctionCalling: useSelector(aiChat$.settings.enableFunctionCalling),
    enableArtifacts: useSelector(aiChat$.settings.enableArtifacts),
    temperature: useSelector(aiChat$.settings.temperature),
    maxTokens: useSelector(aiChat$.settings.maxTokens)
  }
  
  // Flatten the websocket to primitive values  
  const websocket = {
    isConnected: useSelector(aiChat$.websocket.isConnected),
    sessionId: useSelector(aiChat$.websocket.sessionId),
    connectionState: useSelector(aiChat$.websocket.connectionState),
    reconnectCount: useSelector(aiChat$.websocket.reconnectCount),
    lastError: useSelector(aiChat$.websocket.lastError)
  }
  
  // Flatten the voice to primitive values
  const voice = {
    isEnabled: useSelector(aiChat$.voice.isEnabled),
    isConnected: useSelector(aiChat$.voice.isConnected),
    selectedVoice: useSelector(aiChat$.voice.selectedVoice),
    selectedModel: useSelector(aiChat$.voice.selectedModel),
    isProcessing: useSelector(aiChat$.voice.isProcessing),
    isRecording: useSelector(aiChat$.voice.isRecording)
  }
  
  return {
    messages,
    isLoading,
    error,
    input,
    settings,
    websocket,
    voice
  }
}

export const useAIChatSelector = () => {
  return useSelector(aiChat$)
}

// Action hooks (return the actions directly)
export const useAIChatActions = () => {
  return { aiChatActions }
}

// Utility hooks
export const useStoreDebug = () => {
  return {
    aiChat: useSelector(aiChat$)
    // auth is now handled by Better Auth's useSession
  }
}
