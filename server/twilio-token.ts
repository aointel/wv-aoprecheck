import twilio from 'twilio';
import { Request, Response } from 'express';

export function twilioToken(req: Request, res: Response) {
  try {
    // Updated credentials with your new working Twilio account
    const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
    const TWILIO_API_KEY = 'SK80ce6ceab1eb9df4a14c9a646f01304f';
    const TWILIO_API_SECRET = 'FbjtNK2OHaGAfoHkerTzE0har8KzsNLm';
    const TWILIO_TWIML_APP_SID = 'AP958ebb1810e2315e9ff008cc06e91c1d';

    console.log('🔧 Using hard-coded Twilio credentials for WebRTC');
    console.log(`✅ API Secret length: ${TWILIO_API_SECRET.length} characters`);
    console.log(`✅ API Secret starts with: ${TWILIO_API_SECRET.slice(0, 4)}...`);

    // Get email from header first (frontend sends x-user-email), then session
    const userEmail = (req.headers['x-user-email'] as string) || 
                     (req.headers['user-email'] as string) ||
                     (req as any).session?.user?.email;

    if (!userEmail || typeof userEmail !== 'string' || !userEmail.includes('@')) {
      console.error('❌ No valid email found:', { 
        header: req.headers['x-user-email'], 
        session: (req as any).session?.user?.email 
      });
      res.status(401).json({ error: 'Login required', message: 'You must be logged in to use WebRTC.' });
      return;
    }
    const identity = userEmail.trim().toLowerCase();
    // Allow multiple tokens - different components may need their own device instances
    // Token TTL is 1 hour, so old tokens expire naturally
    const agentName = req.query?.agentName || 'Unknown Agent';
    console.log(`Generated token for identity: ${identity} (${agentName})`);
    
    const token = new twilio.jwt.AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { 
        identity,
        ttl: 3600 // 1 hour token lifetime
      }
    );

    const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
      outgoingApplicationSid: TWILIO_TWIML_APP_SID,
      incomingAllow: true,
      pushCredentialSid: undefined // Disable push notifications for web
    });

    token.addGrant(voiceGrant);
    
    const jwtToken = token.toJwt();
    console.log(`Token length: ${jwtToken.length} characters`);
    console.log(`TWILIO_TWIML_APP_SID: ${TWILIO_TWIML_APP_SID}`);
    console.log(`AccountSid: ${TWILIO_ACCOUNT_SID.slice(0, 10)}...`);
    console.log(`ApiKey: ${TWILIO_API_KEY.slice(0, 10)}...`);
    
    res.json({ 
      token: jwtToken,
      identity: identity,
      appSid: TWILIO_TWIML_APP_SID
    });
  } catch (error) {
    console.error('❌ Token generation error:', error);
    res.status(500).json({ 
      error: 'Token generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}