import { test, expect } from '@playwright/test'

test.describe('Nova 3 Voice Transcription Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/')
    
    // Handle authentication first
    await page.waitForLoadState('networkidle')
    
    // Check if we need to authenticate
    const authForm = page.locator('form:has(input[type="email"])')
    if (await authForm.isVisible()) {
      console.log('🔐 Authenticating with test credentials...')
      
      // Fill in the authentication form
      await page.fill('input[type="email"]', 'demo@example.com')
      await page.fill('input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      
      // Wait for authentication to complete
      await page.waitForURL('**/dashboard', { timeout: 10000 })
    }
    
    // Navigate to the voice-test page
    console.log('🎵 Navigating to voice-test page...')
    await page.goto('/voice-test')
    
    // Wait for the page to load
    await expect(page.getByText('Voice Transcription Test')).toBeVisible()
    await expect(page.getByText('Test live speech-to-text using Cloudflare Nova-3')).toBeVisible()
    
    // Take initial screenshot
    await page.screenshot({ 
      path: '.playwright-mcp/voice-test-initial.png', 
      fullPage: true 
    })
  })

  test('should display voice test interface correctly', async ({ page }) => {
    // Verify all main components are visible
    await expect(page.getByText('Voice Transcription Test')).toBeVisible()
    await expect(page.getByText('Connection Status')).toBeVisible()
    await expect(page.getByText('Recording')).toBeVisible()
    await expect(page.getByText('Transcription History')).toBeVisible()
    
    // Check connection status indicators
    await expect(page.locator('div').filter({ hasText: /Connected|Disconnected/ }).first()).toBeVisible()
    
    // Verify recording button is present
    const recordingButton = page.getByRole('button', { name: /Connect & Record|Start Recording|Stop Recording/ })
    await expect(recordingButton).toBeVisible()
  })

  test('should establish WebSocket connection', async ({ page }) => {
    console.log('🔌 Testing WebSocket connection...')
    
    // Look for the connection status
    const connectionStatus = page.locator('[data-testid="connection-status"], .bg-red-500, .bg-green-500').first()
    
    // Wait a moment for auto-connection to occur (component connects in useEffect)
    await page.waitForTimeout(2000)
    
    // Take screenshot of connection attempt
    await page.screenshot({ 
      path: '.playwright-mcp/voice-test-connection-attempt.png', 
      fullPage: true 
    })
    
    // Check if connection is established
    const connectedBadge = page.locator('text=Connected')
    const disconnectedBadge = page.locator('text=Disconnected')
    
    if (await connectedBadge.isVisible()) {
      console.log('✅ WebSocket connection successful')
      await page.screenshot({ 
        path: '.playwright-mcp/voice-test-connected.png', 
        fullPage: true 
      })
    } else if (await disconnectedBadge.isVisible()) {
      console.log('❌ WebSocket connection failed')
      await page.screenshot({ 
        path: '.playwright-mcp/voice-test-disconnected.png', 
        fullPage: true 
      })
    }
    
    // Check for any error messages
    const errorMessage = page.locator('.text-red-600, .text-red-500')
    if (await errorMessage.isVisible()) {
      const errorText = await errorMessage.textContent()
      console.log('❌ Connection error:', errorText)
    }
  })

  test('should test WebSocket connection button manually', async ({ page }) => {
    console.log('🔌 Testing manual WebSocket connection...')
    
    // Click the recording/connection button to establish connection
    const connectionButton = page.getByRole('button', { name: /Connect & Record|Start Recording/ })
    await connectionButton.click()
    
    // Wait for connection attempt
    await page.waitForTimeout(3000)
    
    // Take screenshot after connection attempt
    await page.screenshot({ 
      path: '.playwright-mcp/voice-test-manual-connection.png', 
      fullPage: true 
    })
    
    // Check connection status
    const isConnected = await page.locator('text=Connected').isVisible()
    const isDisconnected = await page.locator('text=Disconnected').isVisible()
    
    console.log(`Connection status - Connected: ${isConnected}, Disconnected: ${isDisconnected}`)
  })

  test('should test Nova 3 transcription functionality', async ({ page }) => {
    console.log('🎤 Testing transcription functionality...')
    
    // Wait for potential auto-connection
    await page.waitForTimeout(2000)
    
    // Check if connected, if not try to connect
    const isConnected = await page.locator('text=Connected').isVisible()
    if (!isConnected) {
      const connectionButton = page.getByRole('button', { name: /Connect & Record|Start Recording/ })
      await connectionButton.click()
      await page.waitForTimeout(3000)
    }
    
    // Look for test transcription button
    const testTranscriptionBtn = page.getByRole('button', { name: 'Test Transcription' })
    
    if (await testTranscriptionBtn.isVisible()) {
      console.log('🧪 Clicking Test Transcription button...')
      await testTranscriptionBtn.click()
      
      // Wait for response
      await page.waitForTimeout(2000)
      
      // Take screenshot after test
      await page.screenshot({ 
        path: '.playwright-mcp/voice-test-transcription-test.png', 
        fullPage: true 
      })
      
      // Check if any transcription appears in history
      const historyCard = page.locator('text=Transcription History').locator('..').locator('..')
      const hasTranscriptions = await historyCard.locator('.bg-gray-50').count() > 0
      
      console.log(`Transcription history entries found: ${hasTranscriptions}`)
    } else {
      console.log('❌ Test Transcription button not available (possibly not connected)')
      await page.screenshot({ 
        path: '.playwright-mcp/voice-test-no-test-button.png', 
        fullPage: true 
      })
    }
  })

  test('should test WAV file transcription', async ({ page }) => {
    console.log('🎵 Testing WAV file transcription...')
    
    // Wait for potential auto-connection
    await page.waitForTimeout(2000)
    
    // Check if connected, if not try to connect
    const isConnected = await page.locator('text=Connected').isVisible()
    if (!isConnected) {
      const connectionButton = page.getByRole('button', { name: /Connect & Record|Start Recording/ })
      await connectionButton.click()
      await page.waitForTimeout(3000)
    }
    
    // Look for WAV file test button
    const wavTestBtn = page.getByRole('button', { name: /Test with WAV File/i })
    
    if (await wavTestBtn.isVisible()) {
      console.log('🎵 Clicking Test with WAV File button...')
      await wavTestBtn.click()
      
      // Wait longer for WAV file processing (chunked upload)
      await page.waitForTimeout(5000)
      
      // Take screenshot after WAV test
      await page.screenshot({ 
        path: '.playwright-mcp/voice-test-wav-test.png', 
        fullPage: true 
      })
      
      // Check transcription history for WAV file entry
      const historySection = page.locator('text=Transcription History').locator('..').locator('..')
      const wavEntry = historySection.locator('text*="Sent test WAV file"')
      
      if (await wavEntry.isVisible()) {
        console.log('✅ WAV file test entry found in history')
      } else {
        console.log('❌ No WAV file test entry found in history')
      }
      
      // Count total transcription entries
      const entries = await historySection.locator('.bg-gray-50').count()
      console.log(`Total transcription entries: ${entries}`)
    } else {
      console.log('❌ Test with WAV File button not available (possibly not connected)')
      await page.screenshot({ 
        path: '.playwright-mcp/voice-test-no-wav-button.png', 
        fullPage: true 
      })
    }
  })

  test('should test recording functionality (simulated)', async ({ page }) => {
    console.log('🎤 Testing recording functionality...')
    
    // Grant permissions for microphone access in the test
    await page.context().grantPermissions(['microphone'])
    
    // Wait for potential auto-connection
    await page.waitForTimeout(2000)
    
    // Check if connected, if not try to connect
    const isConnected = await page.locator('text=Connected').isVisible()
    if (!isConnected) {
      const connectionButton = page.getByRole('button', { name: /Connect & Record|Start Recording/ })
      await connectionButton.click()
      await page.waitForTimeout(3000)
    }
    
    // Try to start recording
    const recordingButton = page.getByRole('button', { name: /Start Recording/ })
    
    if (await recordingButton.isVisible()) {
      console.log('🎤 Attempting to start recording...')
      
      // Click to start recording (may fail due to browser/environment limitations)
      await recordingButton.click()
      
      // Wait to see if recording starts
      await page.waitForTimeout(2000)
      
      // Take screenshot
      await page.screenshot({ 
        path: '.playwright-mcp/voice-test-recording-attempt.png', 
        fullPage: true 
      })
      
      // Check if recording indicator appears
      const recordingIndicator = page.locator('.animate-pulse, text="Live Transcription"')
      const isRecording = await recordingIndicator.isVisible()
      
      if (isRecording) {
        console.log('✅ Recording started successfully')
        
        // Stop recording after a moment
        const stopButton = page.getByRole('button', { name: /Stop Recording/ })
        if (await stopButton.isVisible()) {
          await page.waitForTimeout(2000)
          await stopButton.click()
          console.log('🛑 Recording stopped')
        }
      } else {
        console.log('❌ Recording failed to start (likely due to browser permissions or environment)')
      }
    }
  })

  test('should test clear history functionality', async ({ page }) => {
    console.log('🧹 Testing clear history functionality...')
    
    // First, try to generate some transcription history
    await page.waitForTimeout(2000)
    
    // Try to connect and add test entries
    const isConnected = await page.locator('text=Connected').isVisible()
    if (!isConnected) {
      const connectionButton = page.getByRole('button', { name: /Connect & Record|Start Recording/ })
      await connectionButton.click()
      await page.waitForTimeout(3000)
    }
    
    // Add test transcription if possible
    const testTranscriptionBtn = page.getByRole('button', { name: 'Test Transcription' })
    if (await testTranscriptionBtn.isVisible()) {
      await testTranscriptionBtn.click()
      await page.waitForTimeout(2000)
    }
    
    // Find and click clear button
    const clearButton = page.getByRole('button', { name: 'Clear' })
    await expect(clearButton).toBeVisible()
    
    await clearButton.click()
    
    // Wait for clear action
    await page.waitForTimeout(1000)
    
    // Take screenshot after clearing
    await page.screenshot({ 
      path: '.playwright-mcp/voice-test-cleared.png', 
      fullPage: true 
    })
    
    // Verify history is cleared
    const noTranscriptionsMessage = page.locator('text="No transcriptions yet"')
    await expect(noTranscriptionsMessage).toBeVisible()
    
    console.log('✅ History cleared successfully')
  })

  test('should capture comprehensive debugging information', async ({ page }) => {
    console.log('🔍 Capturing comprehensive debugging information...')
    
    // Wait for page to settle
    await page.waitForTimeout(3000)
    
    // Capture console logs
    const logs: string[] = []
    page.on('console', msg => {
      logs.push(`${msg.type()}: ${msg.text()}`)
    })
    
    // Capture network failures
    const networkErrors: string[] = []
    page.on('response', response => {
      if (!response.ok()) {
        networkErrors.push(`${response.status()}: ${response.url()}`)
      }
    })
    
    // Capture WebSocket errors
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        if (event.payload.includes('error')) {
          console.log('WebSocket error frame:', event.payload)
        }
      })
    })
    
    // Try all functionality and capture states
    const states = {
      initialConnection: false,
      manualConnection: false,
      testTranscription: false,
      wavTest: false,
      errors: [] as string[]
    }
    
    // Test initial connection
    await page.waitForTimeout(2000)
    states.initialConnection = await page.locator('text=Connected').isVisible()
    
    // Test manual connection if needed
    if (!states.initialConnection) {
      const connectionButton = page.getByRole('button', { name: /Connect & Record|Start Recording/ })
      await connectionButton.click()
      await page.waitForTimeout(3000)
      states.manualConnection = await page.locator('text=Connected').isVisible()
    }
    
    // Test transcription functionality
    const testTranscriptionBtn = page.getByRole('button', { name: 'Test Transcription' })
    if (await testTranscriptionBtn.isVisible()) {
      await testTranscriptionBtn.click()
      await page.waitForTimeout(2000)
      states.testTranscription = true
    }
    
    // Test WAV functionality
    const wavTestBtn = page.getByRole('button', { name: /Test with WAV File/i })
    if (await wavTestBtn.isVisible()) {
      await wavTestBtn.click()
      await page.waitForTimeout(5000)
      states.wavTest = true
    }
    
    // Capture any error messages
    const errorElements = page.locator('.text-red-600, .text-red-500')
    const errorCount = await errorElements.count()
    for (let i = 0; i < errorCount; i++) {
      const errorText = await errorElements.nth(i).textContent()
      if (errorText) states.errors.push(errorText)
    }
    
    // Take final comprehensive screenshot
    await page.screenshot({ 
      path: '.playwright-mcp/voice-test-debug-final.png', 
      fullPage: true 
    })
    
    // Output debug information
    console.log('🔍 Debug Summary:')
    console.log(`Initial Connection: ${states.initialConnection}`)
    console.log(`Manual Connection: ${states.manualConnection}`)
    console.log(`Test Transcription Available: ${states.testTranscription}`)
    console.log(`WAV Test Available: ${states.wavTest}`)
    console.log(`Errors Found: ${states.errors.length}`)
    if (states.errors.length > 0) {
      states.errors.forEach((error, i) => console.log(`  Error ${i + 1}: ${error}`))
    }
    console.log(`Console Logs: ${logs.length}`)
    console.log(`Network Errors: ${networkErrors.length}`)
    
    // Write debug info to a file for later analysis
    const debugInfo = {
      timestamp: new Date().toISOString(),
      states,
      logs: logs.slice(0, 20), // Limit to prevent too much data
      networkErrors,
      url: page.url()
    }
    
    console.log('Debug Information:', JSON.stringify(debugInfo, null, 2))
  })
})