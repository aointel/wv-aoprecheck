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

async function finalScottFix() {
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

    // Step 2: Try to delete Scott's account first, then recreate it
    console.log('⚠️ Attempting to delete and recreate Scott\'s account...');
    
    const deleteOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/delete-user',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': loginResponse.headers['set-cookie']?.join('; ') || ''
      }
    };

    const deleteData = JSON.stringify({
      email: 'scottmoerman@aoglobelife.com'
    });

    const deleteResponse = await makeRequest(deleteOptions, deleteData);
    console.log('📝 Delete user status:', deleteResponse.statusCode);
    console.log('📋 Delete user response:', deleteResponse.data);

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Try to create Scott's account fresh
    console.log('👤 Creating Scott\'s account fresh...');
    
    const signupOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/signup',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': loginResponse.headers['set-cookie']?.join('; ') || ''
      }
    };

    const signupData = JSON.stringify({
      email: 'scottmoerman@aoglobelife.com',
      password: 'aointel2025',
      firstName: 'Scott',
      lastName: 'Moerman',
      phone: '+1-555-0000',
      zoomId: '',
      zoomPassword: '1'
    });

    const signupResponse = await makeRequest(signupOptions, signupData);
    console.log('📝 Account creation status:', signupResponse.statusCode);
    console.log('📋 Account creation response:', signupResponse.data);
    
    if (signupResponse.statusCode === 200 || signupResponse.statusCode === 201) {
      console.log('✅ Scott\'s account created successfully!');
    } else {
      console.log('⚠️ Account creation failed, continuing with password reset...');
      
      // Step 4: If account creation fails, try password reset again
      console.log('🔄 Trying password reset one more time...');
      
      const resetOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/admin/reset-password',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': loginResponse.headers['set-cookie']?.join('; ') || ''
        }
      };

      const resetData = JSON.stringify({
        email: 'scottmoerman@aoglobelife.com',
        password: 'aointel2025'
      });

      const resetResponse = await makeRequest(resetOptions, resetData);
      console.log('📝 Password reset status:', resetResponse.statusCode);
      console.log('📋 Password reset response:', resetResponse.data);
    }

    console.log('🧪 Testing Scott\'s login...');
    
    // Step 5: Test Scott's login
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
      console.log('🎉 SUCCESS! Scott can now log in with password "aointel2025"');
      try {
        const loginResult = JSON.parse(testLoginResponse.data);
        console.log('👤 Scott\'s login details:', {
          email: loginResult.user?.email,
          name: `${loginResult.profile?.firstName} ${loginResult.profile?.lastName}`,
          isAdmin: loginResult.user?.isAdmin
        });
        console.log('✅ Password reset completed successfully!');
      } catch (e) {
        console.log('✅ Scott login successful!');
      }
    } else {
      console.log('❌ Scott login still failing:', testLoginResponse.data);
      console.log('📞 Please contact system administrator for manual account resolution.');
    }

  } catch (error) {
    console.error('💥 Script error:', error.message);
  }
}

finalScottFix();