/**
 * Script to test WebRTC call to 5032018470
 * Uses Puppeteer to automate browser and make the call
 */

import puppeteer from 'puppeteer';
import { PRODUCTION_URL } from './server/hardcoded-config';

async function testWebRTCCall() {
  console.log('🧪 Starting WebRTC Call Test to 5032018470...\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser so you can see it
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] // Allow microphone access
  });

  try {
    const page = await browser.newPage();
    
    // Set up console logging from the page
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('🔑') || text.includes('✅') || text.includes('❌') || 
          text.includes('📞') || text.includes('📡') || text.includes('🚀')) {
        console.log(`[Browser] ${text}`);
      }
    });

    console.log('1️⃣ Loading test page...');
    const testUrl = `${PRODUCTION_URL}/webrtc-call-test.html`;
    console.log(`   URL: ${testUrl}`);
    await page.goto(testUrl, { waitUntil: 'networkidle2' });

    console.log('2️⃣ Waiting for page to load and auto-start call...');
    
    // Wait for the call to be initiated
    await page.waitForFunction(() => {
      const status = document.getElementById('status');
      return status && (
        status.textContent?.includes('calling') || 
        status.textContent?.includes('connected') ||
        status.textContent?.includes('Device ready')
      );
    }, { timeout: 30000 });

    console.log('3️⃣ Call initiated! Waiting for connection...');
    
    // Wait for call to connect (or timeout after 30 seconds)
    try {
      await page.waitForFunction(() => {
        const status = document.getElementById('status');
        return status && (
          status.textContent?.includes('Connected') ||
          status.textContent?.includes('Error')
        );
      }, { timeout: 30000 });

      const finalStatus = await page.evaluate(() => {
        const status = document.getElementById('status');
        return status?.textContent || 'Unknown';
      });

      console.log(`\n✅ Final Status: ${finalStatus}`);
      
      if (finalStatus.includes('Connected')) {
        console.log('🎉 SUCCESS: WebRTC call connected to 5032018470!');
        console.log('\nCall is active. Press Ctrl+C to end the test.');
        
        // Keep browser open so call stays active
        await new Promise(() => {}); // Wait forever
      } else {
        console.log('❌ Call did not connect. Check browser for details.');
        await page.screenshot({ path: 'webrtc-test-error.png' });
        console.log('   Screenshot saved to webrtc-test-error.png');
      }
    } catch (error: any) {
      console.log('⏱️  Call timeout or error:', error.message);
      console.log('   Check browser window for current status');
    }

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    // Don't close browser automatically - let user see the result
    console.log('\n⚠️  Browser will stay open. Close it manually when done.');
  }
}

testWebRTCCall().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
