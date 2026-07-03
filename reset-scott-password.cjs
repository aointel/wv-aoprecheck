const http = require('http');

// Helper to make HTTP requests
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: responseData
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function resetScottPassword() {
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

    console.log('🔄 Resetting Scott\'s password...');
    
    // Step 2: Reset Scott's password using admin auth
    const resetOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/reset-password',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookies
      }
    };

    const resetData = JSON.stringify({
      email: 'scottmoerman@aoglobelife.com',
      password: 'aointel2025'
    });

    const resetResponse = await makeRequest(resetOptions, resetData);
    console.log('📝 Password reset status:', resetResponse.statusCode);
    
    if (resetResponse.statusCode === 200) {
      try {
        const resetResult = JSON.parse(resetResponse.data);
        console.log('✅ PASSWORD RESET SUCCESS!');
        console.log('🎉 Scott can now log in with: scottmoerman@aoglobelife.com / aointel2025');
      } catch (e) {
        console.log('✅ Password reset completed (response not JSON)');
        console.log('🎉 Scott can now log in with: scottmoerman@aoglobelife.com / aointel2025');
      }
    } else {
      console.log('❌ Password reset failed:', resetResponse.data);
    }

    // Step 3: Test Scott's login to verify
    console.log('🧪 Testing Scott\'s new login...');
    
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

    const testResponse = await makeRequest(testLoginOptions, testLoginData);
    console.log('📝 Scott login test status:', testResponse.statusCode);
    
    if (testResponse.statusCode === 200) {
      console.log('🎊 VERIFICATION SUCCESS! Scott\'s password reset is working!');
    } else {
      console.log('⚠️ Scott login verification failed:', testResponse.data.substring(0, 200));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetScottPassword();