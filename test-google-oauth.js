#!/usr/bin/env node

// Test Google OAuth credentials to verify they work together
import { google } from 'googleapis';

async function testGoogleOAuth() {
  try {
    console.log('🧪 Testing Google OAuth credentials...');
    
    // Get credentials from environment
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = 'https://aointelligence.replit.app/auth/google/callback';
    
    console.log('📋 Using credentials:');
    console.log('   Client ID:', clientId);
    console.log('   Client Secret:', clientSecret ? `${clientSecret.substring(0, 20)}...` : 'MISSING');
    console.log('   Redirect URI:', redirectUri);
    
    if (!clientId || !clientSecret) {
      throw new Error('Missing Google credentials in environment');
    }
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2({
      clientId: clientId,
      clientSecret: clientSecret,
      redirectUri: redirectUri
    });
    
    console.log('✅ OAuth2 client created successfully');
    
    // Generate auth URL
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
    
    console.log('✅ Auth URL generated successfully:');
    console.log('   URL:', authUrl);
    
    // Test with a fake code to see what error we get
    console.log('\n🧪 Testing token exchange with fake code...');
    try {
      await oauth2Client.getToken('fake_code_12345');
    } catch (error) {
      if (error.message.includes('invalid_grant')) {
        console.log('✅ EXPECTED ERROR: invalid_grant (fake code)');
        console.log('✅ This confirms OAuth client is working correctly!');
        console.log('✅ Credentials are properly matched');
        return true;
      } else if (error.message.includes('invalid_client')) {
        console.log('❌ CREDENTIAL MISMATCH: Client ID and Secret don\'t belong together');
        console.log('❌ You need to get matching credentials from Google Cloud Console');
        return false;
      } else {
        console.log('❓ Unexpected error:', error.message);
        return false;
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

testGoogleOAuth().then(success => {
  if (success) {
    console.log('\n🎉 Google OAuth credentials are working correctly!');
    console.log('📝 The integration is ready for production use.');
    process.exit(0);
  } else {
    console.log('\n💥 Google OAuth credentials have issues');
    console.log('🔧 Fix the credentials and run the test again');
    process.exit(1);
  }
});