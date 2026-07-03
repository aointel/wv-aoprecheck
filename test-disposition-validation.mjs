// Test script to verify disposition validation is working correctly
// Tests the /api/outbound-dialer/save-disposition endpoint

import https from 'https';

const BASE_URL = 'https://aoi-rail.onrender.com'; // Update if different
// const BASE_URL = 'http://localhost:5000'; // For local testing

// Test cases
const testCases = [
  {
    name: 'Test 1: Booked disposition with answered call',
    description: 'Should succeed - call was answered',
    body: {
      leadId: 1, // Replace with actual test lead ID
      disposition: 'booked',
      agentEmail: 'test@aoglobelife.com', // Replace with test agent
      leadPhone: '+15551234567', // Replace with test phone that has answered call
      callDuration: 120
    },
    expectedStatus: 200,
    expectedError: null
  },
  {
    name: 'Test 2: Booked disposition without answered call',
    description: 'Should fail - call was not answered',
    body: {
      leadId: 1,
      disposition: 'booked',
      agentEmail: 'test@aoglobelife.com',
      leadPhone: '+15559876543', // Phone with no answered call
      callDuration: 0
    },
    expectedStatus: 400,
    expectedError: 'Call must be answered to set this disposition'
  },
  {
    name: 'Test 3: No Answer disposition without call',
    description: 'Should succeed - no_answer does not require answered call',
    body: {
      leadId: 1,
      disposition: 'no_answer',
      agentEmail: 'test@aoglobelife.com',
      leadPhone: '+15559876543',
      callDuration: 0
    },
    expectedStatus: 200,
    expectedError: null
  },
  {
    name: 'Test 4: Sale disposition with answered call',
    description: 'Should succeed - call was answered',
    body: {
      leadId: 1,
      disposition: 'sale',
      agentEmail: 'test@aoglobelife.com',
      leadPhone: '+15551234567', // Phone with answered call
      callDuration: 300
    },
    expectedStatus: 200,
    expectedError: null
  },
  {
    name: 'Test 5: Not Interested without answered call',
    description: 'Should fail - requires answered call',
    body: {
      leadId: 1,
      disposition: 'not_interested',
      agentEmail: 'test@aoglobelife.com',
      leadPhone: '+15559876543', // No answered call
      callDuration: 0
    },
    expectedStatus: 400,
    expectedError: 'Call must be answered to set this disposition'
  },
  {
    name: 'Test 6: Wrong Number disposition',
    description: 'Should succeed - wrong_number does not require answered call',
    body: {
      leadId: 1,
      disposition: 'wrong_number',
      agentEmail: 'test@aoglobelife.com',
      leadPhone: '+15559876543',
      callDuration: 0
    },
    expectedStatus: 200,
    expectedError: null
  },
  {
    name: 'Test 7: Missing required fields',
    description: 'Should fail - missing leadId',
    body: {
      disposition: 'booked',
      agentEmail: 'test@aoglobelife.com'
    },
    expectedStatus: 400,
    expectedError: 'Lead ID and disposition are required'
  },
  {
    name: 'Test 8: Instant Presentation with answered call',
    description: 'Should succeed - call was answered',
    body: {
      leadId: 1,
      disposition: 'instant_presentation',
      agentEmail: 'test@aoglobelife.com',
      leadPhone: '+15551234567', // Phone with answered call
      callDuration: 60
    },
    expectedStatus: 200,
    expectedError: null
  }
];

// Helper function to make HTTP request
function makeRequest(testCase) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(testCase.body);
    
    const url = new URL(BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: '/api/outbound-dialer/save-disposition',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const client = url.protocol === 'https:' ? https : require('http');
    
    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        let parsedData;
        try {
          parsedData = JSON.parse(responseData);
        } catch (e) {
          parsedData = responseData;
        }
        
        resolve({
          status: res.statusCode,
          data: parsedData,
          headers: res.headers
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Run all tests
async function runTests() {
  console.log('🧪 Starting Disposition Validation Tests\n');
  console.log(`📍 Testing endpoint: ${BASE_URL}/api/outbound-dialer/save-disposition\n`);
  console.log('⚠️  NOTE: Update test cases with real lead IDs, agent emails, and phone numbers\n');
  console.log('💡 To test properly, you need:');
  console.log('   1. A real lead ID from your database');
  console.log('   2. A real agent email');
  console.log('   3. A phone number that has an answered call in twilio_call_logs');
  console.log('   4. A phone number that does NOT have an answered call\n');
  
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Test ${i + 1}: ${testCase.name}`);
    console.log(`Description: ${testCase.description}`);
    console.log(`Expected Status: ${testCase.expectedStatus}`);
    if (testCase.expectedError) {
      console.log(`Expected Error: ${testCase.expectedError}`);
    }
    console.log(`Request Body:`, JSON.stringify(testCase.body, null, 2));
    
    try {
      const response = await makeRequest(testCase);
      
      console.log(`\nResponse Status: ${response.status}`);
      console.log(`Response Data:`, JSON.stringify(response.data, null, 2));
      
      // Check if test passed
      const statusMatch = response.status === testCase.expectedStatus;
      let errorMatch = true;
      
      if (testCase.expectedError) {
        const errorMessage = response.data?.error || response.data?.details || '';
        errorMatch = errorMessage.includes(testCase.expectedError) || 
                     errorMessage.toLowerCase().includes(testCase.expectedError.toLowerCase());
      }
      
      if (statusMatch && errorMatch) {
        console.log(`✅ PASSED`);
        passed++;
      } else {
        console.log(`❌ FAILED`);
        if (!statusMatch) {
          console.log(`   Expected status ${testCase.expectedStatus}, got ${response.status}`);
        }
        if (!errorMatch && testCase.expectedError) {
          console.log(`   Expected error containing "${testCase.expectedError}"`);
          console.log(`   Got: ${response.data?.error || response.data?.details || 'No error message'}`);
        }
        failed++;
      }
    } catch (error) {
      console.log(`❌ FAILED - Request Error:`);
      console.error(`   ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Total: ${testCases.length}`);
  console.log(`   🎯 Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%\n`);
  
  if (failed > 0) {
    console.log('⚠️  Some tests failed. Review the output above for details.\n');
    console.log('💡 TIP: Make sure you updated the test cases with real data from your database.\n');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Fatal error running tests:', error);
  process.exit(1);
});


