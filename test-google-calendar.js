// Test Google Calendar Integration
const BASE_URL = 'http://localhost:5000';

async function testGoogleCalendarIntegration() {
  console.log('🧪 Testing Google Calendar Integration...\n');
  
  try {
    // 1. Check status
    console.log('1. Checking authentication status...');
    const statusResponse = await fetch(`${BASE_URL}/api/google-calendar/status`);
    const status = await statusResponse.json();
    console.log('   Status:', status);
    
    if (!status.authenticated) {
      console.log('\n❌ User not authenticated with Google Calendar');
      
      // 2. Get auth URL
      console.log('2. Getting authentication URL...');
      const authResponse = await fetch(`${BASE_URL}/api/google-calendar/auth-url`);
      const authData = await authResponse.json();
      
      if (authData.success) {
        console.log('   ✅ Auth URL generated successfully');
        console.log('   📝 To authenticate, visit:', authData.authUrl);
        console.log('\n   📋 Steps to authenticate:');
        console.log('   1. Visit the URL above');
        console.log('   2. Complete Google OAuth flow');
        console.log('   3. Return here to test appointment creation');
      } else {
        console.log('   ❌ Failed to generate auth URL:', authData);
        return;
      }
    } else {
      console.log('   ✅ User is authenticated with Google Calendar');
      
      // 3. Test appointment creation
      console.log('\n3. Testing appointment creation...');
      const appointmentData = {
        summary: 'Test ConnectNow Appointment',
        description: 'Test appointment created by ConnectNow calendar sync system\n\nJoin Meeting: https://aointelligence.replit.app/video-meeting?room=test-123',
        startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        location: 'ConnectNow Virtual Meeting Room',
        attendeeEmail: 'test@example.com',
        appointmentId: 'test-' + Date.now()
      };
      
      console.log('   📅 Creating appointment:', appointmentData.summary);
      const createResponse = await fetch(`${BASE_URL}/api/google-calendar/events/appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData)
      });
      
      const createResult = await createResponse.json();
      
      if (createResponse.ok && createResult.success) {
        console.log('   ✅ Appointment created successfully!');
        console.log('   📊 Result:', {
          eventId: createResult.eventId,
          htmlLink: createResult.htmlLink,
          summary: createResult.summary
        });
      } else {
        console.log('   ❌ Failed to create appointment:', createResult);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testGoogleCalendarIntegration();