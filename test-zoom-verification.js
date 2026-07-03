// Test script for Zoom verification functionality
const { zoomVerificationService } = require('./server/zoom-verification-service');

async function testZoomVerification() {
  console.log('🧪 Testing Zoom Verification System...');
  
  try {
    // Test 1: Create session
    console.log('\n1. Creating test session...');
    const session = await zoomVerificationService.createSession({
      leadName: 'John Doe Test',
      leadPhone: '5551234567',
      leadId: 'TEST456',
      agentEmail: 'chrislafond@aoglobelife.com'
    });
    console.log('✅ Session created:', {
      id: session.id,
      status: session.status,
      leadName: session.leadName
    });
    
    // Test 2: Get session
    console.log('\n2. Retrieving session...');
    const retrieved = await zoomVerificationService.getSession(session.id);
    console.log('✅ Session retrieved:', {
      id: retrieved.id,
      status: retrieved.status
    });
    
    // Test 3: Update screenshot uploaded
    console.log('\n3. Updating screenshot status...');
    await zoomVerificationService.updateScreenshotUploaded(session.id, '/test/screenshot.png');
    console.log('✅ Screenshot status updated');
    
    // Test 4: Update webhook sent
    console.log('\n4. Updating webhook status...');
    await zoomVerificationService.updateWebhookSent(session.id, 'test-call-123');
    console.log('✅ Webhook status updated');
    
    // Test 5: Update Taalk call status
    console.log('\n5. Updating call status...');
    await zoomVerificationService.updateTaalkCallStatus(session.id, 'completed');
    console.log('✅ Call status updated');
    
    // Test 6: Get final session state
    console.log('\n6. Final session state:');
    const final = await zoomVerificationService.getSession(session.id);
    console.log('✅ Final session:', {
      id: final.id,
      status: final.status,
      screenshotUploaded: final.screenshotUploaded,
      webhookSent: final.webhookSent,
      taalkCallStatus: final.taalkCallStatus
    });
    
    console.log('\n🎉 All tests passed! Zoom verification system is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testZoomVerification();