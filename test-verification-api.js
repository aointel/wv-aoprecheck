import fetch from 'node-fetch';

// Test script to verify our verification API endpoints
async function testVerificationAPI() {
  // First create a verification session
  const sessionPayload = {
    firstName: "John",
    lastName: "Smith", 
    spouseName: "Jane Smith",
    phone: "5032018470",
    city: "Portland",
    state: "OR",
    premium: "125.50",
    achDrawDate: "15th",
    achDrawDateShort: "15th",
    verificationMethod: "zoom",
    zoomRoomId: "5692241629",
    zoomPassword: "1",
    language: "en",
    agentFirstName: "Jane",
    agentLastName: "Agent",
    agentPhone: "2065551234"
  };

  console.log('Step 1: Creating verification session...');
  console.log(JSON.stringify(sessionPayload, null, 2));
  
  try {
    // Create the verification session first
    const sessionResponse = await fetch('http://localhost:5000/api/verification/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionPayload)
    });

    console.log('\nSession Creation Response Status:', sessionResponse.status);
    
    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.log('Session Creation Failed:', errorText);
      return;
    }

    const session = await sessionResponse.json();
    console.log('\n✅ Session created successfully:', {
      sessionId: session.sessionId,
      status: session.status,
      verificationMethod: session.verificationMethod
    });

    // Now test the zoom call initiation with the real session ID
    const zoomCallPayload = {
      sessionId: session.sessionId,
      clientInfo: {
        firstName: "John",
        lastName: "Smith", 
        phone: "5032018470",
        email: "john.smith@example.com",
        city: "Portland",
        state: "OR",
        zipCode: "97201"
      },
      agentPhone: "2065551234",
      agentProfile: {
        agentId: "AGT123",
        firstName: "Jane", 
        lastName: "Agent",
        email: "jane.agent@company.com",
        companyName: "Globe Life AIL Division",
        zoom_id: "5692241629",
        zoom_password: "1"
      },
      session: {
        premiumAmount: "125.50",
        achDrawDate: "15th",
        achDrawDateShort: "15th",
        agentEmail: "jane.agent@company.com"
      },
      zoomRoomId: "5692241629",
      zoomPassword: "1"
    };

    console.log('\n\nStep 2: Testing Zoom Call Initiation...');
    console.log('Using session ID:', session.sessionId);
    
    const response = await fetch('http://localhost:5000/api/verification/initiate-zoom-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(zoomCallPayload)
    });

    console.log('\nZoom Call Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('\nResponse Body:', responseText);
    
    if (response.ok) {
      console.log('\n✅ SUCCESS: Verification Zoom API call worked!');
      
      // Try to parse the response
      try {
        const result = JSON.parse(responseText);
        console.log('\n🎥 Zoom Call Details:', {
          success: result.success,
          callId: result.callId,
          message: result.message,
          zoomBridgePhone: result.zoomBridgePhone || 'Not provided'
        });
        
        // Show expected zoom bridge format
        const expectedFormat = `2532158782,,${zoomCallPayload.zoomRoomId}#,,#,,${zoomCallPayload.zoomPassword}#`;
        console.log('\n📞 Expected Zoom Bridge Format:', expectedFormat);
        
      } catch (parseError) {
        console.log('\n🎥 Non-JSON response received');
      }
    } else {
      console.log('\n❌ FAILED: Verification Zoom API call failed');
    }
    
  } catch (error) {
    console.error('\n💥 ERROR:', error.message);
  }
}

// Run the test
testVerificationAPI();