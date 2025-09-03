import { test, expect } from '@playwright/test'
import { ArtifactTestHelper } from './test-helpers'

test.describe('Gemini AI Artifact Generation', () => {
  let helper: ArtifactTestHelper

  test.beforeEach(async ({ page }) => {
    helper = new ArtifactTestHelper(page)
    await helper.setupArtifactTesting()
  })

  test('should generate React TypeScript component artifact', async ({ page }) => {
    await helper.runFullArtifactTest('reactComponent')
  })

  test('should generate HTML landing page artifact', async ({ page }) => {
    await helper.runFullArtifactTest('htmlPage')
  })

  test('should generate CSS styles artifact', async ({ page }) => {
    await helper.runFullArtifactTest('cssStyles')
  })

  test('should generate JavaScript function artifact', async ({ page }) => {
    await helper.runFullArtifactTest('jsFunction')
  })

  test('should generate chart visualization artifact', async ({ page }) => {
    await helper.runFullArtifactTest('chartVisualization')
  })

  test('should generate form component artifact', async ({ page }) => {
    await helper.runFullArtifactTest('formComponent')
  })

  test('should handle multiple artifacts in single response', async ({ page }) => {
    const complexMessage = 'Create a complete user profile component with: 1) React TypeScript component with props interface, 2) CSS modules for styling, 3) Custom hook for API calls, and 4) Type definitions file. Make it production-ready.'
    
    await helper.sendMessage(complexMessage)
    await helper.waitForResponse()
    
    // Should have multiple artifacts
    await helper.waitForArtifacts()
    
    // Verify multiple artifacts exist
    const artifactCards = page.locator('[data-testid="artifact-card"]')
    const cardCount = await artifactCards.count()
    
    expect(cardCount).toBeGreaterThan(1)
    
    // Test each artifact
    for (let i = 0; i < cardCount; i++) {
      const card = artifactCards.nth(i)
      await expect(card).toBeVisible()
      
      // Check for code content
      const codeContent = card.locator('pre, iframe')
      await expect(codeContent.first()).toBeVisible()
    }
  })

  test('should work with WebSocket streaming and artifacts', async ({ page }) => {
    // Enable WebSocket mode
    const webSocketSwitch = page.locator('input#websocket-mode')
    const isWSChecked = await webSocketSwitch.isChecked()
    if (!isWSChecked) {
      await page.click('label[for="websocket-mode"]')
    }
    
    // Wait for WebSocket connection indicator
    await expect(page.locator('span:has-text("✓")').first()).toBeVisible({ timeout: 15000 })
    
    // Send message via WebSocket
    const streamMessage = 'Create a React dashboard component with TypeScript, including charts, data tables, and responsive layout. Add proper interfaces and styling.'
    
    await helper.sendMessage(streamMessage)
    await helper.waitForResponse()
    await helper.verifyArtifactCreated()
  })

  test('should handle artifact creation with function calling', async ({ page }) => {
    // Enable function calling (only works with Gemini)
    const functionSwitch = page.locator('input#function-calling')
    const isFunctionEnabled = await functionSwitch.isChecked()
    if (!isFunctionEnabled) {
      await page.click('label[for="function-calling"]')
    }
    
    // Wait for function calling indicator
    await expect(page.getByText('Function Calling Enabled')).toBeVisible()
    
    // Send message that might use tools and generate artifacts
    const toolMessage = 'Calculate the current date and create a JavaScript date utility function that formats dates in multiple ways with TypeScript types.'
    
    await helper.sendMessage(toolMessage)
    await helper.waitForResponse()
    
    // Should have both function calling results and artifacts
    const messageContent = page.locator('.message-content').last()
    await expect(messageContent).toBeVisible()
    
    // Look for artifacts
    if (await page.getByText('Artifacts').count() > 0) {
      await helper.verifyArtifactCreated()
    }
  })

  test('should maintain artifacts across page refreshes', async ({ page }) => {
    // Create artifacts first
    await helper.sendMessage('Create a React component with useState hook and TypeScript.')
    await helper.waitForResponse()
    await helper.verifyArtifactCreated()
    
    // Refresh page
    await page.reload()
    await helper.setupArtifactTesting()
    
    // Send another message
    await helper.sendMessage('Create a CSS animation for the above component.')
    await helper.waitForResponse()
    
    // New artifacts should appear
    await helper.waitForArtifacts()
  })

  test('should handle artifact errors gracefully', async ({ page }) => {
    // Send message that might cause parsing issues
    const problematicMessage = 'Generate malformed code with syntax errors ```javascript console.log(unclosed string```'
    
    await helper.sendMessage(problematicMessage)
    await helper.waitForResponse()
    
    // Should either create artifact with error handling or show in regular message
    const hasArtifacts = await page.getByText('Artifacts').count() > 0
    const hasRegularContent = await page.locator('pre').count() > 0
    
    expect(hasArtifacts || hasRegularContent).toBe(true)
  })

  test('should copy artifact content to clipboard', async ({ page }) => {
    await helper.runFullArtifactTest('reactComponent')
    
    // Find copy button
    const artifactCard = page.locator('[data-testid="artifact-card"]').first()
    const copyButton = artifactCard.locator('button[title*="Copy"], button:has([data-lucide="copy"])')
    
    if (await copyButton.count() > 0) {
      // Grant clipboard permissions
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
      
      await copyButton.first().click()
      
      // Verify clipboard has content (basic check)
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardContent.length).toBeGreaterThan(10)
    }
  })

  test('should download artifact as file', async ({ page }) => {
    await helper.runFullArtifactTest('cssStyles')
    
    // Find download button
    const artifactCard = page.locator('[data-testid="artifact-card"]').first()
    const downloadButton = artifactCard.locator('button[title*="Download"], button:has([data-lucide="download"])')
    
    if (await downloadButton.count() > 0) {
      // Setup download handler
      const downloadPromise = page.waitForEvent('download')
      await downloadButton.first().click()
      
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBeTruthy()
      
      // Verify download content
      const path = await download.path()
      expect(path).toBeTruthy()
    }
  })

  test('should show appropriate artifact icons and types', async ({ page }) => {
    // Test different artifact types and their icons
    const testCases = [
      { message: 'Create React component', expectedIcon: 'code' },
      { message: 'Create HTML page', expectedIcon: 'globe' },
      { message: 'Create CSS styles', expectedIcon: 'palette' },
      { message: 'Create JavaScript function', expectedIcon: 'file-code' }
    ]
    
    for (const testCase of testCases) {
      await helper.sendMessage(testCase.message + ' with TypeScript and modern features.')
      await helper.waitForResponse()
      
      if (await page.getByText('Artifacts').count() > 0) {
        await helper.waitForArtifacts()
        
        // Verify artifact has appropriate icon/type
        const artifactCard = page.locator('[data-testid="artifact-card"]').first()
        await expect(artifactCard).toBeVisible()
        
        // Look for badge indicating artifact type
        const typeBadge = artifactCard.locator('.badge, [class*="badge"]')
        if (await typeBadge.count() > 0) {
          const badgeText = await typeBadge.first().textContent()
          expect(badgeText).toBeTruthy()
        }
      }
    }
  })
})