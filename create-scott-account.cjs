const http = require('http');

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        resolve({ 
          statusCode: res.statusCode, 
          data: responseData,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function createScottAccount() {
  try {
    console.log('🔐 Logging in as admin (cnsysop@aoglobelife.com)...');
    
    // Step 1: Login as admin
    const loginOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const loginData = JSON.stringify({
      email: 'cnsysop@aoglobelife.com',
      password: 'CNsysop2025!'
    });

    const loginResponse = await makeRequest(loginOptions, loginData);
    console.log('📝 Admin login status:', loginResponse.statusCode);
    
    if (loginResponse.statusCode !== 200) {
      console.log('❌ Admin login failed:', loginResponse.data);
      return;
    }

    let adminCookies = '';
    let adminUser;
    try {
      const loginResult = JSON.parse(loginResponse.data);
      adminUser = loginResult.user;
      console.log('✅ Admin login successful!');
      console.log('👤 Admin user:', adminUser?.email);
    } catch (e) {
      console.log('⚠️ Login response not JSON, checking for cookies...');
    }

    // Check for Set-Cookie header (this is how Express session auth works)
    const cookies = loginResponse.headers['set-cookie'];
    if (cookies) {
      adminCookies = cookies.join('; ');
      console.log('🍪 Got admin session cookies');
    } else {
      console.log('❌ No authentication cookies received');
      return;
    }

    console.log('👤 Creating Scott\'s account...');
    
    // Step 2: Create Scott's account using signup endpoint
    const signupOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/signup',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookies
      }
    };

    const signupData = JSON.stringify({
      email: 'scottmoerman@aoglobelife.com',
      password: 'aointel2025',
      firstName: 'Scott',
      lastName: 'Moerman',
      phone: '+1-555-0000',  // Default phone
      zoomId: '',
      zoomPassword: '1'  // Default zoom password
    });

    const signupResponse = await makeRequest(signupOptions, signupData);
    console.log('📝 Account creation status:', signupResponse.statusCode);
    
    if (signupResponse.statusCode === 200 || signupResponse.statusCode === 201) {
      console.log('✅ Scott\'s account created successfully!');
      console.log('📋 Account details:', signupResponse.data);
    } else {
      console.log('❌ Account creation failed:', signupResponse.data);
      return;
    }

    console.log('🧪 Testing Scott\'s new login...');
    
    // Step 3: Test Scott's login
    const testLoginOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const testLoginData = JSON.stringify({
      email: 'scottmoerman@aoglobelife.com',
      password: 'aointel2025'
    });

    const testLoginResponse = await makeRequest(testLoginOptions, testLoginData);
    console.log('📝 Scott login test status:', testLoginResponse.statusCode);
    
    if (testLoginResponse.statusCode === 200) {
      console.log('✅ Scott can now log in successfully!');
      console.log('👤 Login response:', testLoginResponse.data);
    } else {
      console.log('⚠️ Scott login verification failed:', testLoginResponse.data);
    }

  } catch (error) {
    console.error('💥 Script error:', error.message);
  }
}

createScottAccount();