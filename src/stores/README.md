# ⚡ Legend State v3 Modular Observable System

A powerful, ultra-fast state management system built with Legend State v3 featuring fine-grained reactivity and minimal re-renders for modern React applications.

## ✨ Features

- **⚡ Ultra-Fast**: Fastest React state library with fine-grained reactivity
- **🎯 Type Safety**: Full TypeScript support with inference
- **💾 Persistence**: Built-in sync system with localStorage/remote sync
- **🔄 Computed Values**: Reactive computed observables
- **🛠️ No Boilerplate**: Simple get() and set() API, no contexts/reducers
- **🧩 Modular**: Feature-based observable organization
- **📦 Tiny Bundle**: Only 4KB with massive performance gains
- **🔍 Debugging**: Development helpers and state inspection

## 🏗️ Architecture

```
src/stores/
├── auth.ts                  # Authentication observable
├── ai-chat.ts              # AI chat observable  
├── hooks.ts                # React hooks for observables
├── index.ts                # Store exports and utilities
└── README.md               # This file
```

## 🚀 Quick Start

### Creating an Observable

```typescript
import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'

// Define the store interface
interface CounterStore {
  count: number
  isLoading: boolean
  user: { name: string } | null
}

// Create the observable
export const counter$ = observable<CounterStore>({
  count: 0,
  isLoading: false,
  user: null
})

// Add persistence
syncObservable(counter$, {
  persist: {
    name: 'counter-state',
    retrySync: true,
    transform: {
      save: (value) => ({ count: value.count }), // Only persist count
      load: (value, state) => ({ ...state, count: value.count })
    }
  }
})

// Create actions
export const counterActions = {
  increment: () => counter$.count.set(prev => prev + 1),
  decrement: () => counter$.count.set(prev => prev - 1),
  setUser: (user: { name: string } | null) => counter$.user.set(user),
  reset: () => counter$.assign({ count: 0, isLoading: false, user: null })
}
```

### Using in React Components

```typescript
import { useObservable } from '@legendapp/state/react'
import { counter$, counterActions } from './stores/counter'

function CounterComponent() {
  // Subscribe to specific values for fine-grained updates
  const count = useObservable(counter$.count)
  const isLoading = useObservable(counter$.isLoading)
  const user = useObservable(counter$.user)
  
  // Or subscribe to entire observable
  const fullState = useObservable(counter$)
  
  return (
    <div>
      <p>Count: {count}</p>
      <p>User: {user?.name || 'None'}</p>
      <button onClick={counterActions.increment}>+</button>
      <button onClick={counterActions.decrement}>-</button>
      <button onClick={() => counterActions.setUser({ name: 'John' })}>
        Set User
      </button>
    </div>
  )
}
```

## 🛍️ Available Observables

### Auth Observable (`/stores/auth.ts`)

Manages user authentication, sessions, and permissions with fine-grained reactivity.

```typescript
import { useAuthState, authActions, authComputed } from '@/stores'

// Reactive hooks - only re-render when specific values change
const { user, isAuthenticated, isLoading, error } = useAuthState()

// Actions
authActions.login({ email, password })
authActions.logout()
authActions.setUser(user)

// Computed values
const displayName = authComputed.userDisplayName()
const hasAdminRole = authComputed.isAdmin()
```

**Features:**
- JWT token management with cookie persistence
- Session handling with auto-refresh
- Role-based permission checking
- Computed user display name and role checks
- Fine-grained updates (only components using specific auth properties re-render)

### AI Chat Observable (`/stores/ai-chat.ts`)

Manages AI chat conversations, WebSocket connections, and voice features with minimal re-renders.

```typescript
import { useAIChatState, aiChatActions, aiChatComputed } from '@/stores'

// Fine-grained subscriptions - each hook only re-renders for its specific data
const { messages, isLoading, settings, websocket, voice } = useAIChatState()

// Actions
aiChatActions.sendMessage('Hello AI!')
aiChatActions.connectWebSocket()
aiChatActions.updateSettings({ selectedModel: 'llama-3-8b' })

// Computed values
const lastMessage = aiChatComputed.lastMessage()
const canSend = aiChatComputed.canSend()
const stats = aiChatComputed.conversationStats()
```

**Features:**
- Real-time WebSocket chat with auto-reconnect
- Message history with streaming updates
- Voice recording/transcription support
- Model switching and settings persistence
- Function calling and artifacts integration
- Ultra-fine-grained updates (message components only re-render when their specific message changes)

## 🔧 Core Legend State v3 Features

### Fine-Grained Reactivity

Legend State tracks exactly which properties components use and only re-renders when those specific values change:

```typescript
const user$ = observable({ name: 'John', age: 30, email: 'john@example.com' })

// This component only re-renders when name changes
function NameComponent() {
  const name = useObservable(user$.name) // Only tracks name
  return <div>{name}</div>
}

// This component only re-renders when age changes  
function AgeComponent() {
  const age = useObservable(user$.age) // Only tracks age
  return <div>{age}</div>
}

// Updating email won't re-render either component above
user$.email.set('newemail@example.com') // No re-renders!
user$.name.set('Jane') // Only NameComponent re-renders
```

### Computed Observables

Automatic dependency tracking with reactive updates:

```typescript
const store$ = observable({
  firstName: 'John',
  lastName: 'Doe',
  // Computed values automatically track dependencies
  fullName: () => store$.firstName.get() + ' ' + store$.lastName.get()
})

// Usage in component
function FullNameComponent() {
  const fullName = useObservable(store$.fullName)
  return <div>{fullName}</div> // Only re-renders when firstName or lastName change
}
```

### Persistence with Sync

Automatic state persistence with transformations:

```typescript
syncObservable(store$, {
  persist: {
    name: 'my-store',
    retrySync: true,
    transform: {
      // Only persist specific fields
      save: (value) => ({
        preferences: value.preferences,
        settings: value.settings
      }),
      load: (value, state) => ({
        ...state,
        preferences: value.preferences || {},
        settings: value.settings || defaultSettings
      })
    }
  }
})
```

### Array Operations

Observable arrays with built-in reactivity:

```typescript
const todos$ = observable([
  { id: 1, text: 'Learn Legend State', completed: false }
])

// Add items
todos$.push({ id: 2, text: 'Build awesome app', completed: false })

// Update specific item - only that item's component re-renders
todos$[0].completed.set(true)

// In React component
function TodoList() {
  const todos = useObservable(todos$)
  
  return (
    <div>
      {todos.map((todo, index) => (
        <TodoItem key={todo.id} todo$={todos$[index]} />
      ))}
    </div>
  )
}

function TodoItem({ todo$ }) {
  const todo = useObservable(todo$)
  // This component only re-renders when this specific todo changes
  return (
    <div>
      <span>{todo.text}</span>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={(e) => todo$.completed.set(e.target.checked)}
      />
    </div>
  )
}
```

## 🎮 Development Tools

### Store Utils

Global store management utilities:

```typescript
import { storeUtils } from '@/stores'

// Reset all observables
storeUtils.resetAll()

// Get debug state
const debugState = storeUtils.getDebugState()

// Subscribe to auth changes globally
storeUtils.onAuthChange((isAuthenticated) => {
  console.log('Auth changed globally:', isAuthenticated)
})
```

### Debug Window

In development, stores are attached to `window.__LEGEND_STORES__`:

```javascript
// In browser console
__LEGEND_STORES__.auth        // Auth observable
__LEGEND_STORES__.aiChat      // AI Chat observable
__LEGEND_STORES__.getAuth()   // Get auth state
__LEGEND_STORES__.resetAll()  // Reset all stores
```

### Demo Routes

- **Route**: `/legend-demo` - Interactive Legend State playground
- **Enhanced Chat**: `/ai-chat-legend` - Showcases AI chat with Legend State
- **Performance**: Watch network tab - minimal re-renders and updates

## 📋 Legend State v3 Patterns

### Observable Creation Patterns

```typescript
// Simple primitive
const count$ = observable(0)

// Complex nested object
const user$ = observable({
  profile: {
    name: 'John',
    settings: {
      theme: 'dark',
      notifications: true
    }
  },
  preferences: []
})

// With computed values
const store$ = observable({
  items: [],
  // Computed count
  itemCount: () => store$.items.get().length,
  // Computed with complex logic
  hasItems: () => store$.items.get().length > 0
})
```

### Action Patterns

```typescript
// Simple setters
const actions = {
  setLoading: (loading: boolean) => store$.isLoading.set(loading),
  setError: (error: string | null) => store$.error.set(error)
}

// Complex updates with assign
const updateUser = (updates: Partial<User>) => {
  store$.user.assign(updates)
}

// Async actions
const fetchData = async () => {
  store$.isLoading.set(true)
  try {
    const data = await api.fetchData()
    store$.data.set(data)
  } catch (error) {
    store$.error.set(error.message)
  } finally {
    store$.isLoading.set(false)
  }
}

// Optimistic updates
const optimisticUpdate = (item: Item) => {
  // Update UI immediately
  store$.items.push(item)
  
  // Sync with server
  api.createItem(item).catch(() => {
    // Rollback on error
    store$.items.set(prev => prev.filter(i => i.id !== item.id))
  })
}
```

### Hook Patterns

```typescript
// Create custom hooks for common patterns
export const useAuthUser = () => {
  return useObservable(auth$.user)
}

export const useIsAuthenticated = () => {
  return useObservable(auth$.isAuthenticated)
}

export const useChatMessages = () => {
  return useObservable(aiChat$.messages)
}

// Computed hook
export const useCanSend = () => {
  return useObservable(() => {
    const input = aiChat$.input.get()
    const isLoading = aiChat$.isLoading.get()
    return input.trim().length > 0 && !isLoading
  })
}
```

## 🧪 Testing

```typescript
import { auth$, authActions } from '@/stores/auth'

describe('Auth Observable', () => {
  beforeEach(() => {
    authActions.reset()
  })
  
  it('should authenticate user', () => {
    const user = { email: 'test@example.com', role: ['user'] }
    authActions.setUser(user)
    
    expect(auth$.user.get()).toEqual(user)
    expect(auth$.isAuthenticated.get()).toBe(true)
  })
  
  it('should compute display name', () => {
    authActions.setUser({
      email: 'john@example.com',
      displayName: 'John Doe'
    })
    
    expect(authComputed.userDisplayName()).toBe('John Doe')
  })
})
```

## 🎯 Best Practices

1. **Use Fine-Grained Subscriptions** - Subscribe to specific properties, not entire objects
2. **Leverage Computed Values** - Create reactive derived state instead of manual updates  
3. **Batch Updates** - Use `assign()` for multiple property updates
4. **Optimize Arrays** - Use observable arrays with individual item subscriptions
5. **Persist Strategically** - Only persist necessary data to reduce storage overhead
6. **Type Everything** - Use TypeScript interfaces for all observables
7. **Test Observables** - Unit test actions and computed values
8. **Debug Effectively** - Use browser dev tools and debug utilities

## 🔄 Migration from Other Libraries

### From Zustand

```typescript
// Old Zustand store
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 }))
}))

// New Legend State observable
const count$ = observable(0)
const increment = () => count$.set(prev => prev + 1)

// In component
const count = useObservable(count$) // More performant than Zustand
```

### From Redux/Context

```typescript
// Old Redux/Context approach
const [state, dispatch] = useContext(StateContext)

// New Legend State approach
const state = useObservable(store$) // Direct, no providers needed
const { field1, field2 } = useObservable(store$) // Fine-grained subscriptions
```

## 📈 Performance Benefits

Legend State v3 provides significant performance improvements:

- **Minimal Re-renders**: Only components using changed data re-render
- **Memory Efficient**: No unnecessary object creation or copying
- **Bundle Size**: 4KB vs 15KB+ for other state libraries
- **Startup Time**: Faster app initialization due to efficient observables
- **Runtime Performance**: Beats vanilla JS in some benchmarks

## 🤝 Contributing

1. Follow the established Legend State patterns
2. Add TypeScript types for everything
3. Include tests for new observables
4. Update documentation
5. Test with the demo route

## 📚 Advanced Usage

### Custom Sync Plugins

```typescript
// Custom sync plugin for API integration
syncObservable(store$, {
  persist: {
    name: 'api-sync',
    plugin: customApiPlugin({
      baseUrl: 'https://api.example.com',
      endpoints: {
        get: '/user/profile',
        set: '/user/profile'
      }
    })
  }
})
```

### Observable Composition

```typescript
// Compose multiple observables
const app$ = observable({
  auth: auth$.get(),
  chat: aiChat$.get(),
  ui: ui$.get()
})

// Subscribe to cross-observable computed values
const canAccessChat = () => {
  return auth$.isAuthenticated.get() && !auth$.isLoading.get()
}
```

### Advanced Reactivity

```typescript
// Custom reactive effects
const effect$ = observable(() => {
  const user = auth$.user.get()
  const settings = aiChat$.settings.get()
  
  // This runs whenever user or settings change
  if (user && settings) {
    updateUserChatSettings(user, settings)
  }
})
```

This Legend State v3 implementation provides the fastest, most efficient state management system available for React applications! ⚡🚀