// TAALK ZOOM BRIDGE TEST SCRIPT - EXACTLY AS REQUESTED
import fetch from 'node-fetch';

async function testTaalkZoomCall() {
  console.log('🎥 Testing Taalk API with FULL Zoom bridge phone + all verification parameters');
  
  const callParams = {
    name: "sds sd",
    phone: "2532158782,,5038668699#,,#,,1#", // Zoom bridge with 253-215-8782
    agent: "68a5ff0fc8f1520e59acf3e6",
    campaign: "6747819a86c131c2cb203719", 
    retryMethod: 0,
    webhookUrl: "https://policy-verify-mmandella.replit.app/api/taalk/webhook",
    
    // ALL VERIFICATION DATA IN MAIN PAYLOAD
    Taalk_AgentFirstName: "Chris",
    Taalk_AgentLastName: "La Fond",
    Taalk_AgentPhone: "+15038668999",
    Taalk_AgentEmail: "chrislafond@aoglobelife.com",
    Taalk_ZoomId: "5038668699",
    Taalk_ZoomPassword: "1",
    Taalk_MemberFirstName: "sds",
    Taalk_MemberFiirstName: "sds",
    Taalk_MemberPhone: "5032018470",
    Taalk_PMemberFirstName: "sds",
    MemberFirstName: "sds",
    Taalk_ClientName: "sds sd",
    Taalk_ClientPhone: "5032018470",
    Taalk_MonthlyPremium: "22",
    Taalk_ALP: "22",
    Taalk_ACHdrawdate: "October 31st",
    Taalk_ACHdrawdateshort: "31st",
    Taalk_Location: "dd, NH",
    Taalk_ClientCountry: "United States",
    Taalk_ClientRegion: "NH",
    Taalk_ClientCity: "dd",
    Taalk_SessionId: "VER-1759112912396-Ph95oP",
    Taalk_VerificationMethod: "Zoom Call",
    Taalk_CallTimestamp: new Date().toISOString(),
    Taalk_CompanyName: "Globe Life AIL Division"
  };

  console.log('🔥 EXACT PAYLOAD:', JSON.stringify(callParams, null, 2));

  try {
    const response = await fetch('https://lets.taalk.ai/api/call?db=michaelmandella', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'curl/8.0',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4'
      },
      body: JSON.stringify(callParams)
    });

    const responseText = await response.text();
    console.log(`🎯 RESPONSE STATUS: ${response.status}`);
    console.log(`🎯 RESPONSE BODY: ${responseText}`);
    
    if (response.ok) {
      console.log('✅ SUCCESS: Taalk API accepted the call with full Zoom bridge + all verification data!');
    } else {
      console.log('❌ FAILED: Taalk API rejected the call');
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

testTaalkZoomCall();