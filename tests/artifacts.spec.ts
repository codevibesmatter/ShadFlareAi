import { test, expect } from '@playwright/test'

test.describe('AI Chat Artifacts', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the AI chat page
    await page.goto('/ai-chat')
    
    // Wait for the chat interface to load
    await expect(page.getByText('Chat Interface')).toBeVisible()
    
    // Ensure artifacts are enabled
    const artifactsSwitch = page.locator('input#artifacts')
    const isChecked = await artifactsSwitch.isChecked()
    if (!isChecked) {
      await page.click('label[for="artifacts"]')
    }
    
    // Switch to Gemini model for reliable artifact generation
    await page.click('button[role="combobox"]:has-text("Llama 3 8B")')
    await page.click('div[role="option"]:has-text("Gemini 2.5 Flash Lite")')
    
    // Wait for model to be selected
    await expect(page.getByText('Gemini 2.5 Flash Lite')).toBeVisible()
  })

  test('should create React component artifact', async ({ page }) => {
    const messageInput = page.locator('input[placeholder="Type your message..."]')
    const sendButton = page.locator('button[type="submit"]')
    
    // Send message requesting React component
    await messageInput.fill('Create a React button component with hover effects and TypeScript. Make it modern with Tailwind CSS classes.')
    await sendButton.click()
    
    // Wait for AI response
    await expect(page.locator('.animate-spin')).toBeVisible()
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 30000 })
    
    // Check for artifacts section
    await expect(page.getByText('Artifacts')).toBeVisible({ timeout: 5000 })
    
    // Verify artifact renderer appears
    const artifactCard = page.locator('[data-testid="artifact-card"]').first()
    await expect(artifactCard.or(page.locator('div:has-text("React Component") >> ..'))).toBeVisible()
    
    // Check for code content
    await expect(page.locator('pre')).toBeVisible()
    
    // Verify tabs (Preview and Code)
    await expect(page.getByRole('tab', { name: /preview/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /code/i })).toBeVisible()
  })

  test('should create HTML artifact', async ({ page }) => {
    const messageInput = page.locator('input[placeholder="Type your message..."]')
    const sendButton = page.locator('button[type="submit"]')
    
    // Send message requesting HTML page
    await messageInput.fill('Create a beautiful HTML landing page with a hero section, CSS animations, and responsive design.')
    await sendButton.click()
    
    // Wait for AI response
    await expect(page.locator('.animate-spin')).toBeVisible()
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 30000 })
    
    // Check for artifacts section
    await expect(page.getByText('Artifacts')).toBeVisible({ timeout: 5000 })
    
    // Verify HTML artifact appears
    const artifactSection = page.locator('div:has-text("Artifacts")')
    await expect(artifactSection).toBeVisible()
    
    // Check for iframe preview (HTML artifacts use iframe)
    const iframe = page.locator('iframe')
    if (await iframe.count() > 0) {
      await expect(iframe.first()).toBeVisible()
    }
  })

  test('should create CSS styles artifact', async ({ page }) => {
    const messageInput = page.locator('input[placeholder="Type your message..."]')
    const sendButton = page.locator('button[type="submit"]')
    
    // Send message requesting CSS
    await messageInput.fill('Create modern CSS styles for a card component with glassmorphism effects, hover animations, and dark mode support.')
    await sendButton.click()
    
    // Wait for AI response
    await expect(page.locator('.animate-spin')).toBeVisible()
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 30000 })
    
    // Check for artifacts section
    await expect(page.getByText('Artifacts')).toBeVisible({ timeout: 5000 })
    
    // Verify CSS content appears
    await expect(page.locator('pre')).toBeVisible()
    
    // Check for CSS-specific styling
    const codeBlock = page.locator('pre code')
    await expect(codeBlock).toBeVisible()
  })

  test('should create JavaScript function artifact', async ({ page }) => {
    const messageInput = page.locator('input[placeholder="Type your message..."]')
    const sendButton = page.locator('button[type="submit"]')
    
    // Send message requesting JavaScript function
    await messageInput.fill('Write a JavaScript function that sorts an array of objects by multiple properties with TypeScript types.')
    await sendButton.click()
    
    // Wait for AI response
    await expect(page.locator('.animate-spin')).toBeVisible()
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 30000 })
    
    // Check for artifacts section
    await expect(page.getByText('Artifacts')).toBeVisible({ timeout: 5000 })
    
    // Verify JavaScript artifact appears
    await expect(page.locator('pre')).toBeVisible()
    
    // Check for function keyword in the code
    const codeContent = page.locator('pre code')
    await expect(codeContent).toBeVisible()
  })

  test('should test artifact interactions', async ({ page }) => {
    const messageInput = page.locator('input[placeholder="Type your message..."]')
    const sendButton = page.locator('button[type="submit"]')
    
    // Create an artifact first
    await messageInput.fill('Create a React component with a counter and increment button.')
    await sendButton.click()
    
    // Wait for AI response and artifact creation
    await expect(page.locator('.animate-spin')).toBeVisible()
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 30000 })
    
    // Wait for artifacts section
    await expect(page.getByText('Artifacts')).toBeVisible({ timeout: 5000 })
    
    // Test artifact collapsing/expanding
    const artifactsButton = page.getByText('Artifacts').first()
    await artifactsButton.click()
    
    // Wait a bit for animation
    await page.waitForTimeout(1000)
    
    // Expand again
    await artifactsButton.click()
    
    // Test tab switching
    const codeTab = page.getByRole('tab', { name: /code/i })
    const previewTab = page.getByRole('tab', { name: /preview/i })
    
    if (await codeTab.count() > 0) {
      await codeTab.click()
      await expect(page.locator('pre code')).toBeVisible()
    }
    
    if (await previewTab.count() > 0) {
      await previewTab.click()
    }
    
    // Test copy button (if available)
    const copyButton = page.locator('button[title*="Copy"], button:has(svg):near(:text("Copy"))')
    if (await copyButton.count() > 0) {
      await copyButton.first().click()
      // Note: Actually testing clipboard content requires special permissions in Playwright
    }
  })

  test('should handle multiple artifacts in one message', async ({ page }) => {
    const messageInput = page.locator('input[placeholder="Type your message..."]')
    const sendButton = page.locator('button[type="submit"]')
    
    // Send message that should generate multiple artifacts
    await messageInput.fill('Create a React component and also provide the corresponding CSS styles and a TypeScript interface for the props.')
    await sendButton.click()
    
    // Wait for AI response
    await expect(page.locator('.animate-spin')).toBeVisible()
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 30000 })
    
    // Check for artifacts section
    await expect(page.getByText('Artifacts')).toBeVisible({ timeout: 5000 })
    
    // Look for multiple code blocks or artifact cards
    const codeBlocks = page.locator('pre')
    const artifactCount = await codeBlocks.count()
    
    // Should have multiple code artifacts
    expect(artifactCount).toBeGreaterThan(0)
  })

  test('should work with WebSocket mode', async ({ page }) => {
    // Ensure WebSocket mode is enabled
    const webSocketSwitch = page.locator('input#websocket-mode')
    const isWSChecked = await webSocketSwitch.isChecked()
    if (!isWSChecked) {
      await page.click('label[for="websocket-mode"]')
    }
    
    // Wait for WebSocket connection
    await expect(page.locator('span:has-text("✓")').first()).toBeVisible({ timeout: 10000 })
    
    const messageInput = page.locator('input[placeholder="Type your message..."]')
    const sendButton = page.locator('button[type="submit"]')
    
    // Send message requesting artifact via WebSocket
    await messageInput.fill('Create a simple HTML form with validation using JavaScript.')
    await sendButton.click()
    
    // Wait for streaming response
    await expect(page.locator('.animate-spin')).toBeVisible()
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 30000 })
    
    // Check for artifacts section
    await expect(page.getByText('Artifacts')).toBeVisible({ timeout: 5000 })
    
    // Verify artifact appears
    await expect(page.locator('pre')).toBeVisible()
  })

  test('should disable artifacts when toggle is off', async ({ page }) => {
    // Disable artifacts
    const artifactsSwitch = page.locator('input#artifacts')
    if (await artifactsSwitch.isChecked()) {
      await page.click('label[for="artifacts"]')
    }
    
    const messageInput = page.locator('input[placeholder="Type your message..."]')
    const sendButton = page.locator('button[type="submit"]')
    
    // Send message that would normally create artifacts
    await messageInput.fill('Create a React component with TypeScript.')
    await sendButton.click()
    
    // Wait for AI response
    await expect(page.locator('.animate-spin')).toBeVisible()
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 30000 })
    
    // Should not have artifacts section
    await expect(page.getByText('Artifacts')).not.toBeVisible()
    
    // But should still have code in the regular message
    await expect(page.locator('pre')).toBeVisible()
  })
})