/**
 * Legend State v3 Configuration
 * 
 * Global configuration for persistence and sync
 */

import { configureObservableSync } from '@legendapp/state/sync'
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage'

// Configure global sync settings for browser environment
configureObservableSync({
  persist: {
    plugin: ObservablePersistLocalStorage,
    retrySync: true // Persist pending changes and retry
  }
})

// Initialize the persistence system early
// This ensures localStorage is available for all observables
if (typeof window !== 'undefined') {
  console.log('Legend State v3: LocalStorage persistence configured')
}