// Test script to verify appointment booking works
const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || 'https://aoirail-production.up.railway.app';

async function testAppointmentBooking() {
  console.log('🧪 Testing appointment booking...\n');
  
  // Test data
  const testAppointment = {
    title: 'Test Appointment',
    description: 'Automated test appointment',
    appointmentType: 'presentation',
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(), // Tomorrow + 1 hour
    duration: 60,
    timezone: 'America/New_York',
    agentId: 'test-agent-id',
    agentEmail: 'test@example.com',
    agentName: 'Test Agent',
    leadId: 'test-lead-123',
    leadName: 'Test Lead',
    leadPhone: '5551234567',
    leadEmail: 'lead@example.com',
    meetingPlatform: 'AO Meet',
    twilioRoomName: 'lead-test-lead-123',
    status: 'scheduled',
    notes: 'This is a test appointment'
  };

  console.log('📅 Test appointment data:');
  console.log(JSON.stringify(testAppointment, null, 2));
  console.log('\n');

  try {
    console.log(`🌐 Sending POST request to ${API_BASE}/api/appointments...`);
    
    const response = await fetch(`${API_BASE}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testAppointment)
    });

    console.log(`📡 Response status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    console.log(`📄 Response body: ${responseText}\n`);

    if (!response.ok) {
      console.error('❌ APPOINTMENT BOOKING FAILED');
      console.error(`Status: ${response.status}`);
      console.error(`Error: ${responseText}`);
      process.exit(1);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Failed to parse response as JSON');
      console.error(`Raw response: ${responseText}`);
      process.exit(1);
    }

    console.log('✅ Response parsed successfully:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n');

    // Validate response structure
    if (!result.success) {
      console.error('❌ APPOINTMENT BOOKING FAILED');
      console.error(`Response indicates failure: ${result.error || result.message || 'Unknown error'}`);
      process.exit(1);
    }

    if (!result.appointment || !result.appointment.id) {
      console.error('❌ APPOINTMENT BOOKING FAILED');
      console.error('Response missing appointment data or ID');
      console.error(`Full response: ${JSON.stringify(result, null, 2)}`);
      process.exit(1);
    }

    console.log('🎉🎉🎉 SUCCESS! APPOINTMENT BOOKING WORKS! 🎉🎉🎉');
    console.log(`✅ Appointment created with ID: ${result.appointment.id}`);
    console.log(`✅ Title: ${result.appointment.title || testAppointment.title}`);
    console.log(`✅ Start: ${result.appointment.start_time || testAppointment.startTime}`);
    console.log(`✅ End: ${result.appointment.end_time || testAppointment.endTime}`);
    console.log('\n✅ APPOINTMENT SCHEDULING IS WORKING! ✅\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ APPOINTMENT BOOKING FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testAppointmentBooking();

