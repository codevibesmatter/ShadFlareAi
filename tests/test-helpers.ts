import { Page, expect } from '@playwright/test'

export class ArtifactTestHelper {
  constructor(private page: Page) {}

  async setupArtifactTesting() {
    // Go to AI chat page
    await this.page.goto('/ai-chat')
    
    // Wait for chat interface
    await expect(this.page.getByText('Chat Interface')).toBeVisible()
    
    // Enable artifacts
    await this.ensureArtifactsEnabled()
    
    // Switch to Gemini for reliable artifact generation
    await this.switchToGemini()
  }

  async ensureArtifactsEnabled() {
    const artifactsSwitch = this.page.locator('input#artifacts')
    const isChecked = await artifactsSwitch.isChecked()
    if (!isChecked) {
      await this.page.click('label[for="artifacts"]')
    }
    
    // Verify artifacts notification appears
    await expect(this.page.getByText('Artifacts Enabled')).toBeVisible()
  }

  async switchToGemini() {
    // Click model dropdown
    const modelDropdown = this.page.locator('button[role="combobox"]')
    await modelDropdown.click()
    
    // Select Gemini model
    await this.page.click('div[role="option"]:has-text("Gemini 2.5 Flash Lite")')
    
    // Verify model selection
    await expect(this.page.getByText('Gemini 2.5 Flash Lite')).toBeVisible()
  }

  async sendMessage(message: string) {
    const messageInput = this.page.locator('input[placeholder="Type your message..."]')
    const sendButton = this.page.locator('button[type="submit"]')
    
    await messageInput.fill(message)
    await sendButton.click()
  }

  async waitForResponse() {
    // Wait for loading to start
    await expect(this.page.locator('.animate-spin')).toBeVisible({ timeout: 5000 })
    
    // Wait for loading to complete
    await expect(this.page.locator('.animate-spin')).not.toBeVisible({ timeout: 45000 })
  }

  async waitForArtifacts() {
    // Wait for artifacts section to appear
    await expect(this.page.getByText('Artifacts')).toBeVisible({ timeout: 10000 })
  }

  async verifyArtifactCreated() {
    await this.waitForArtifacts()
    
    // Verify artifact card exists
    const artifactCard = this.page.locator('[data-testid="artifact-card"]')
    await expect(artifactCard.first()).toBeVisible()
    
    return artifactCard
  }

  async testArtifactInteractions() {
    const artifactCard = await this.verifyArtifactCreated()
    
    // Test preview/code tabs if available
    const previewTab = this.page.getByRole('tab', { name: /preview/i })
    const codeTab = this.page.getByRole('tab', { name: /code/i })
    
    if (await previewTab.count() > 0 && await codeTab.count() > 0) {
      await codeTab.click()
      await expect(this.page.locator('pre code')).toBeVisible()
      
      await previewTab.click()
      // Preview content varies by artifact type
    }
    
    // Test copy button
    const copyButton = artifactCard.locator('button').first()
    if (await copyButton.count() > 0) {
      await copyButton.click()
    }
    
    return true
  }

  async testArtifactCollapsing() {
    await this.waitForArtifacts()
    
    // Click to collapse artifacts
    const artifactsToggle = this.page.getByText('Artifacts').first()
    await artifactsToggle.click()
    
    // Should be collapsed now
    await this.page.waitForTimeout(500)
    
    // Click to expand again
    await artifactsToggle.click()
    
    // Verify artifacts are visible again
    await expect(this.page.locator('[data-testid="artifact-card"]').first()).toBeVisible()
  }

  // Predefined test messages that reliably generate artifacts
  getTestMessages() {
    return {
      reactComponent: 'Create a React TypeScript component for a modern button with hover effects, loading state, and different variants (primary, secondary, danger). Include proper TypeScript interfaces.',
      
      htmlPage: 'Build a complete HTML landing page with a hero section, navigation bar, features section, and footer. Include modern CSS with flexbox/grid, animations, and responsive design.',
      
      cssStyles: 'Create comprehensive CSS styles for a card component with glassmorphism effects, hover animations, dark mode support, and responsive behavior. Include variables and transitions.',
      
      jsFunction: 'Write a TypeScript utility function that sorts an array of objects by multiple properties with proper type definitions, error handling, and comprehensive JSDoc documentation.',
      
      chartVisualization: 'Create an interactive bar chart using HTML, CSS, and JavaScript with data visualization, hover effects, and responsive design. Include sample data.',
      
      formComponent: 'Build a complete contact form with HTML structure, CSS styling, and JavaScript validation. Include field validation, error messages, and submit handling.',
      
      apiInterface: 'Create a TypeScript interface and service class for handling REST API calls with proper error handling, request/response types, and async/await patterns.'
    }
  }

  async runFullArtifactTest(messageKey: keyof ReturnType<typeof this.getTestMessages>) {
    const messages = this.getTestMessages()
    const message = messages[messageKey]
    
    console.log(`Testing artifact creation with: ${messageKey}`)
    
    // Send message
    await this.sendMessage(message)
    
    // Wait for response
    await this.waitForResponse()
    
    // Verify artifact creation
    await this.verifyArtifactCreated()
    
    // Test interactions
    await this.testArtifactInteractions()
    
    // Test collapsing
    await this.testArtifactCollapsing()
    
    console.log(`✅ Artifact test completed for: ${messageKey}`)
    
    return true
  }
}