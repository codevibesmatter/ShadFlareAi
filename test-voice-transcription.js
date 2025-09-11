import { chromium } from 'playwright';

(async () => {
  console.log('🚀 Starting Nova 3 transcription debug test...');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const context = await browser.newContext({
    permissions: ['microphone']
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to the application
    console.log('📍 Navigating to localhost:5174...');
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    // Check if we need to authenticate
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    if (currentUrl.includes('sign-in')) {
      console.log('🔐 Authenticating with test credentials...');
      await page.fill('input[type="email"]', 'demo@example.com');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
    }
    
    // Navigate to voice test page
    console.log('🎤 Navigating to voice test page...');
    await page.goto('http://localhost:5174/voice-test');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of initial state
    await page.screenshot({ 
      path: '.playwright-mcp/voice-test-initial.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: voice-test-initial.png');
    
    // Wait for WebSocket connection
    console.log('🔌 Waiting for WebSocket connection...');
    await page.waitForTimeout(3000);
    
    // Check connection status
    const connectionStatus = await page.locator('[class*="bg-green-500"], [class*="bg-red-500"]').first();
    const isConnected = await connectionStatus.evaluate(el => el.classList.contains('bg-green-500'));
    console.log('Connection status:', isConnected ? 'Connected' : 'Disconnected');
    
    // Take screenshot of connection status
    await page.screenshot({ 
      path: '.playwright-mcp/voice-test-connection.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: voice-test-connection.png');
    
    if (!isConnected) {
      // Try to connect manually
      console.log('🔄 Attempting manual connection...');
      await page.click('button:has-text("Connect & Record")');
      await page.waitForTimeout(5000);
    }
    
    // Test transcription functionality
    console.log('🧪 Testing transcription functionality...');
    
    const testTranscriptionBtn = page.locator('button:has-text("Test Transcription")');
    if (await testTranscriptionBtn.isVisible()) {
      await testTranscriptionBtn.click();
      console.log('✅ Clicked Test Transcription button');
      await page.waitForTimeout(3000);
    }
    
    // Test WAV file functionality
    console.log('🎵 Testing WAV file functionality...');
    
    const testWavBtn = page.locator('button:has-text("🎵 Test with WAV File")');
    if (await testWavBtn.isVisible()) {
      await testWavBtn.click();
      console.log('✅ Clicked Test WAV File button');
      await page.waitForTimeout(10000); // Wait longer for file processing
    }
    
    // Take screenshot of results
    await page.screenshot({ 
      path: '.playwright-mcp/voice-test-results.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: voice-test-results.png');
    
    // Check for any error messages
    const errorMessages = await page.locator('[class*="text-red"]').allTextContents();
    if (errorMessages.length > 0) {
      console.log('❌ Errors found:', errorMessages);
    }
    
    // Check transcription history
    const transcriptions = await page.locator('[class*="bg-gray-50"]').allTextContents();
    console.log('📝 Transcriptions found:', transcriptions);
    
    // Check console logs
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(`${msg.type()}: ${msg.text()}`);
    });
    
    console.log('🎯 Test completed successfully!');
    console.log('📋 Summary:');
    console.log('- Connection status:', isConnected ? '✅ Connected' : '❌ Disconnected');
    console.log('- Transcriptions found:', transcriptions.length);
    console.log('- Errors found:', errorMessages.length);
    
    // Keep browser open for manual inspection
    console.log('🔍 Browser staying open for manual inspection...');
    console.log('Press Ctrl+C to close when done');
    
    // Wait indefinitely for manual testing
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({ 
      path: '.playwright-mcp/voice-test-error.png',
      fullPage: true 
    });
    console.log('📸 Error screenshot saved: voice-test-error.png');
  }
})();