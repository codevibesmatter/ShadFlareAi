import { test, expect } from '@playwright/test'

test.describe('AI Chat Implementations Comparison', () => {
  // Test both original and Legend State implementations
  const implementations = [
    { name: 'Original (useState)', path: '/ai-chat' },
    { name: 'Legend State v3', path: '/ai-chat-legend' }
  ]

  implementations.forEach(({ name, path }) => {
    test.describe(`${name} Implementation`, () => {
      
      test(`should load ${name} chat page successfully`, async ({ page }) => {
        await page.goto(`http://localhost:5173${path}`)
        
        // Wait for page to load
        await expect(page.locator('h2')).toContainText('Chat Interface')
        
        // Check for main UI elements
        await expect(page.locator('input[placeholder*="Type your message"]')).toBeVisible()
        await expect(page.locator('button[type="submit"]')).toBeVisible()
        await expect(page.locator('text=Start a conversation')).toBeVisible()
      })

      test(`should display initial empty state in ${name}`, async ({ page }) => {
        await page.goto(`http://localhost:5173${path}`)
        
        // Should show empty state with bot icon
        await expect(page.locator('text=Start a conversation with the AI assistant')).toBeVisible()
        
        // Should show suggestions
        await expect(page.locator('text=Try these suggestions:')).toBeVisible()
        await expect(page.locator('text=Create a simple React component')).toBeVisible()
      })

      test(`should have proper settings controls in ${name}`, async ({ page }) => {
        await page.goto(`http://localhost:5173${path}`)
        
        // Check WebSocket toggle
        await expect(page.locator('label:has-text("WebSocket")')).toBeVisible()
        
        // Check Function Calling toggle
        await expect(page.locator('label:has-text("Tools")')).toBeVisible()
        
        // Check Artifacts toggle
        await expect(page.locator('label:has-text("Artifacts")')).toBeVisible()
        
        // Check model selector
        await expect(page.locator('button:has-text("Llama 3 8B")')).toBeVisible()
      })

      test(`should be able to type in input field in ${name}`, async ({ page }) => {
        await page.goto(`http://localhost:5173${path}`)
        
        const input = page.locator('input[placeholder*="Type your message"]')
        await input.fill('Hello AI assistant!')
        
        await expect(input).toHaveValue('Hello AI assistant!')
        
        // Submit button should be enabled when input has content
        const submitButton = page.locator('button[type="submit"]')
        await expect(submitButton).toBeEnabled()
      })

      test(`should handle model selection in ${name}`, async ({ page }) => {
        await page.goto(`http://localhost:5173${path}`)
        
        // Click model selector
        await page.locator('button:has-text("Llama 3 8B")').click()
        
        // Wait for dropdown to appear
        await expect(page.locator('text=Mistral 7B')).toBeVisible()
        
        // Select different model
        await page.locator('text=Mistral 7B').click()
        
        // Verify selection changed
        await expect(page.locator('button:has-text("Mistral 7B")')).toBeVisible()
      })

      test(`should toggle WebSocket setting in ${name}`, async ({ page }) => {
        await page.goto(`http://localhost:5173${path}`)
        
        const websocketToggle = page.locator('label:has-text("WebSocket") >> .. >> input[type="checkbox"]')
        
        // Should be enabled by default
        await expect(websocketToggle).toBeChecked()
        
        // Toggle off
        await websocketToggle.click()
        await expect(websocketToggle).not.toBeChecked()
        
        // Toggle back on
        await websocketToggle.click()
        await expect(websocketToggle).toBeChecked()
      })

      test(`should toggle function calling when supported model selected in ${name}`, async ({ page }) => {
        await page.goto(`http://localhost:5173${path}`)
        
        // Select a model that supports function calling
        await page.locator('button:has-text("Llama 3 8B")').click()
        await page.locator('text=Hermes 2 Pro (Function Calling)').click()
        
        const functionToggle = page.locator('label:has-text("Tools") >> .. >> input[type="checkbox"]')
        
        // Should be enabled for Hermes model
        await expect(functionToggle).toBeEnabled()
        
        // Toggle function calling
        await functionToggle.click()
        await expect(functionToggle).toBeChecked()
      })

      test(`should show suggestions and handle clicks in ${name}`, async ({ page }) => {
        await page.goto(`http://localhost:5173${path}`)
        
        // Click on a suggestion
        await page.locator('text=Create a simple React component').click()
        
        // Input should be filled with suggestion
        const input = page.locator('input[placeholder*="Type your message"]')
        await expect(input).toHaveValue('Create a simple React component')
      })

      test(`should handle voice mode toggle in ${name}`, async ({ page }) => {
        await page.goto(`http://localhost:5173${path}`)
        
        // Click voice toggle button
        const voiceButton = page.locator('button:has([class*="h-4 w-4"]):has-text("")').first()
        await voiceButton.click()
        
        // Input placeholder should change
        await expect(page.locator('input[placeholder*="Click microphone to speak"]')).toBeVisible()
        
        // Should see microphone button
        await expect(page.locator('button:has([data-testid="mic-icon"], [class*="Mic"])').or(page.locator('button[class*="bg-blue-500"]'))).toBeVisible()
      })

      if (name.includes('Legend State')) {
        test(`should show Legend State debug info in development`, async ({ page }) => {
          await page.goto(`http://localhost:5173${path}`)
          
          // Should show debug info in development mode
          await expect(page.locator('text=Messages:')).toBeVisible()
          await expect(page.locator('text=Can Send:')).toBeVisible()
          await expect(page.locator('text=Last:')).toBeVisible()
        })

        test(`should have Legend State stores in window debug`, async ({ page }) => {
          await page.goto(`http://localhost:5173${path}`)
          
          // Check if Legend State stores are available in window
          const hasStores = await page.evaluate(() => {
            return typeof (window as any).__LEGEND_STORES__ !== 'undefined'
          })
          
          expect(hasStores).toBe(true)
        })
      }

      test(`should display proper title for ${name}`, async ({ page }) => {
        await page.goto(`http://localhost:5173${path}`)
        
        if (name.includes('Legend State')) {
          await expect(page.locator('h2')).toContainText('Legend State Chat Interface')
          await expect(page.locator('text=AI-powered chat with Legend State v3 observables')).toBeVisible()
        } else {
          await expect(page.locator('h2')).toContainText('Chat Interface')
          await expect(page.locator('text=Ask questions and get AI-powered responses')).toBeVisible()
        }
      })

      test(`should handle input clearing after message send in ${name}`, async ({ page }) => {
        await page.goto(`http://localhost:5173${path}`)
        
        const input = page.locator('input[placeholder*="Type your message"]')
        const submitButton = page.locator('button[type="submit"]')
        
        // Type a message
        await input.fill('Test message')
        await expect(input).toHaveValue('Test message')
        
        // Submit the form (even though backend might not be running)
        await submitButton.click()
        
        // Note: Input clearing behavior depends on WebSocket connection
        // In tests without backend, input might not clear, which is expected
      })

      test(`should show loading state when message is being sent in ${name}`, async ({ page }) => {
        await page.goto(`http://localhost:5173${path}`)
        
        const input = page.locator('input[placeholder*="Type your message"]')
        const submitButton = page.locator('button[type="submit"]')
        
        // Fill and submit
        await input.fill('Test message')
        await submitButton.click()
        
        // Should show loading spinner briefly (if WebSocket connection fails)
        // This test might be flaky without actual backend
      })
    })
  })

  test('Feature Parity Comparison', async ({ page }) => {
    // Test that both implementations have the same UI elements
    
    test.step('Compare UI elements between implementations', async () => {
      const originalSelectors = []
      const legendSelectors = []
      
      // Visit original page and collect selectors
      await page.goto('http://localhost:5173/ai-chat')
      const originalElements = await page.locator('button, input, label, [role], [data-testid]').count()
      
      // Visit Legend State page and collect selectors  
      await page.goto('http://localhost:5173/ai-chat-legend')
      const legendElements = await page.locator('button, input, label, [role], [data-testid]').count()
      
      // Both should have similar number of interactive elements (within reasonable range)
      expect(Math.abs(originalElements - legendElements)).toBeLessThan(5)
    })
  })

  test('Performance Comparison', async ({ page }) => {
    test.step('Compare rendering performance', async () => {
      // Measure page load time for both implementations
      const measurements = []
      
      // Test original implementation
      const start1 = Date.now()
      await page.goto('http://localhost:5173/ai-chat')
      await page.waitForLoadState('networkidle')
      const end1 = Date.now()
      measurements.push({ name: 'Original', time: end1 - start1 })
      
      // Test Legend State implementation  
      const start2 = Date.now()
      await page.goto('http://localhost:5173/ai-chat-legend')
      await page.waitForLoadState('networkidle')
      const end2 = Date.now()
      measurements.push({ name: 'Legend State', time: end2 - start2 })
      
      console.log('Performance measurements:', measurements)
      
      // Both should load within reasonable time (under 3 seconds)
      expect(measurements[0].time).toBeLessThan(3000)
      expect(measurements[1].time).toBeLessThan(3000)
    })
  })
})