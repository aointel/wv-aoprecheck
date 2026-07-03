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

async function resetScottPasswordDirect() {
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

    console.log('✅ Admin login successful!');

    // Step 2: Try to get Scott's user info first
    console.log('🔍 Checking if Scott\'s account exists...');
    
    const checkOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/supabase-agents',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': loginResponse.headers['set-cookie']?.join('; ') || ''
      }
    };

    const checkResponse = await makeRequest(checkOptions);
    console.log('📝 User check status:', checkResponse.statusCode);

    if (checkResponse.statusCode === 200) {
      try {
        const userData = JSON.parse(checkResponse.data);
        const scottUser = userData.find(user => 
          user.company_email === 'scottmoerman@aoglobelife.com' || 
          user.email === 'scottmoerman@aoglobelife.com'
        );
        
        if (scottUser) {
          console.log('✅ Scott\'s user record found:', {
            name: `${scottUser.first_name} ${scottUser.last_name}`,
            email: scottUser.company_email || scottUser.email
          });
        } else {
          console.log('⚠️ Scott not found in user records, but account might still exist in Supabase Auth');
        }
      } catch (e) {
        console.log('📊 Could not parse user data, continuing...');
      }
    }

    console.log('🔄 Attempting direct password reset via auth service...');
    
    // Step 3: Try the auth-service resetPassword directly
    const resetOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/reset-password',  // Try the auth-service method
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': loginResponse.headers['set-cookie']?.join('; ') || ''
      }
    };

    const resetData = JSON.stringify({
      email: 'scottmoerman@aoglobelife.com',
      newPassword: 'aointel2025'
    });

    const resetResponse = await makeRequest(resetOptions, resetData);
    console.log('📝 Direct password reset status:', resetResponse.statusCode);
    console.log('📋 Direct password reset response:', resetResponse.data);

    // If that fails, try the admin route again
    if (resetResponse.statusCode !== 200) {
      console.log('🔄 Trying admin reset password endpoint...');
      
      const adminResetOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/admin/reset-password',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': loginResponse.headers['set-cookie']?.join('; ') || ''
        }
      };

      const adminResetData = JSON.stringify({
        email: 'scottmoerman@aoglobelife.com',
        password: 'aointel2025'
      });

      const adminResetResponse = await makeRequest(adminResetOptions, adminResetData);
      console.log('📝 Admin password reset status:', adminResetResponse.statusCode);
      console.log('📋 Admin password reset response:', adminResetResponse.data);
    }

    console.log('🧪 Testing Scott\'s login with new password...');
    
    // Step 4: Test Scott's login
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
      console.log('✅ SUCCESS! Scott can now log in with password "aointel2025"');
      try {
        const loginResult = JSON.parse(testLoginResponse.data);
        console.log('👤 Scott\'s login details:', {
          email: loginResult.user?.email,
          name: `${loginResult.profile?.firstName} ${loginResult.profile?.lastName}`,
          isAdmin: loginResult.user?.isAdmin
        });
      } catch (e) {
        console.log('✅ Scott login successful (could not parse details)');
      }
    } else {
      console.log('❌ Scott login still failing:', testLoginResponse.data);
    }

  } catch (error) {
    console.error('💥 Script error:', error.message);
  }
}

resetScottPasswordDirect();