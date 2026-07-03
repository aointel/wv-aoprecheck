import type { Express } from 'express';
import { parseStatesFromCustomer } from './taskrouter-service.js';

/** When false, /api/vdp/routing never returns 403 for negative credits (VDP always allowed to load config). */
const VDP_CREDIT_CHECKS_ENABLED = false;

// In-memory set of emails flagged to reconnect their VDP
const vdpReconnectFlags = new Set<string>();

// VDP Status API endpoints to support the real VDP functionality
export function setupVDPRoutes(app: Express) {
  
  // VDP Boost Activation - ONLY for cnsysop@aoglobelife.com
  app.post('/api/vdp/boost/activate', async (req, res) => {
    try {
      const userEmail = (req.headers['x-user-email'] as string) || (req.body.email as string);
      
      if (!userEmail) {
        return res.status(401).json({ error: 'User email required' });
      }
      
      // ONLY allow cnsysop@aoglobelife.com
      if (userEmail.toLowerCase() !== 'cnsysop@aoglobelife.com') {
        return res.status(403).json({ error: 'Boost feature not available' });
      }
      
      const { createClient } = await import('@supabase/supabase-js');
      const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = await import('./hardcoded-config');
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Check if user already has an active boost
      const { data: existingBoost, error: checkError } = await supabase
        .from('user_credits')
        .select('vdp_boost_active, vdp_boost_expires_at')
        .eq('email', userEmail.toLowerCase())
        .maybeSingle();
      
      if (checkError) {
        console.error('❌ Error checking boost status:', checkError);
        return res.status(500).json({ error: 'Failed to check boost status' });
      }
      
      // Check if boost is still active
      if (existingBoost?.vdp_boost_active && existingBoost?.vdp_boost_expires_at) {
        const expiresAt = new Date(existingBoost.vdp_boost_expires_at);
        if (expiresAt > new Date()) {
          return res.json({
            success: true,
            message: 'Boost already active',
            expiresAt: expiresAt.toISOString(),
            alreadyActive: true
          });
        }
      }
      
      // Charge 25 credits for boost
      const boostCost = 25; // 25 credits
      
      // Get current credits
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('credits_remaining, credits_purchased, credits_used')
        .eq('email', userEmail.toLowerCase())
        .maybeSingle();
      
      if (creditsError || !creditsData) {
        console.error('❌ Error fetching credits:', creditsError);
        return res.status(500).json({ error: 'Failed to fetch user credits' });
      }
      
      // Calculate new credits
      // credits_remaining is a generated column, so we only update credits_used
      // The database will automatically recalculate credits_remaining = credits_purchased - credits_used
      const newCreditsUsed = (creditsData.credits_used || 0) + boostCost;
      
      // Set boost expiration to 1 hour from now
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Update user_credits with boost status
      // Only update credits_used - credits_remaining is auto-calculated by the database
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          vdp_boost_active: true,
          vdp_boost_expires_at: expiresAt.toISOString(),
          credits_used: newCreditsUsed
          // Don't update credits_remaining - it's a generated column
        })
        .eq('email', userEmail.toLowerCase());
      
      if (updateError) {
        console.error('❌ Error activating boost:', updateError);
        // Check if it's a column doesn't exist error
        if (updateError.message?.includes('column') && updateError.message?.includes('does not exist')) {
          return res.status(500).json({ 
            error: 'Database columns not found. Please run the migration: add-vdp-boost-columns.sql',
            details: updateError.message 
          });
        }
        return res.status(500).json({ error: 'Failed to activate boost', details: updateError.message });
      }
      
      // Fetch updated credits to get the recalculated credits_remaining (generated column)
      const { data: updatedCredits } = await supabase
        .from('user_credits')
        .select('credits_remaining')
        .eq('email', userEmail.toLowerCase())
        .maybeSingle();
      
      const finalCreditsRemaining = updatedCredits?.credits_remaining ?? ((creditsData.credits_purchased || 0) - newCreditsUsed);
      
      // Create billing transaction
      const { error: billingError } = await supabase
        .from('billing_transactions')
        .insert({
          user_email: userEmail.toLowerCase(),
          transaction_type: 'vdp_boost',
          amount_usd: 25.00, // Keep as USD for billing records
          status: 'completed',
          transaction_date: new Date().toISOString(),
          metadata: {
            boost_duration_hours: 1,
            expires_at: expiresAt.toISOString(),
            credits_charged: 25
          }
        });
      
      if (billingError) {
        console.error('⚠️ Error creating billing transaction (non-critical):', billingError);
      }
      
      console.log(`✅ VDP Boost activated for ${userEmail} - expires at ${expiresAt.toISOString()}, credits remaining: ${finalCreditsRemaining}`);
      
      res.json({
        success: true,
        message: 'Boost activated successfully',
        expiresAt: expiresAt.toISOString(),
        creditsRemaining: finalCreditsRemaining,
        creditsCharged: 25
      });
      
    } catch (error: any) {
      console.error('❌ Error activating VDP boost:', error);
      res.status(500).json({ error: 'Failed to activate boost', details: error?.message });
    }
  });
  
  // VDP Boost Status - Check if boost is active
  app.get('/api/vdp/boost/status', async (req, res) => {
    try {
      const userEmail = (req.headers['x-user-email'] as string) || (req.query.email as string);
      
      if (!userEmail) {
        return res.status(401).json({ error: 'User email required' });
      }
      
      // ONLY allow cnsysop@aoglobelife.com
      if (userEmail.toLowerCase() !== 'cnsysop@aoglobelife.com') {
        return res.json({ active: false, available: false });
      }
      
      const { createClient } = await import('@supabase/supabase-js');
      const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = await import('./hardcoded-config');
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      const { data: creditsData, error } = await supabase
        .from('user_credits')
        .select('vdp_boost_active, vdp_boost_expires_at')
        .eq('email', userEmail.toLowerCase())
        .maybeSingle();
      
      if (error) {
        console.error('❌ Error checking boost status:', error);
        return res.status(500).json({ error: 'Failed to check boost status' });
      }
      
      const isActive = creditsData?.vdp_boost_active === true;
      const expiresAt = creditsData?.vdp_boost_expires_at ? new Date(creditsData.vdp_boost_expires_at) : null;
      const isExpired = expiresAt ? expiresAt <= new Date() : true;
      
      // If expired, update the status
      if (isActive && isExpired) {
        await supabase
          .from('user_credits')
          .update({ vdp_boost_active: false })
          .eq('email', userEmail.toLowerCase());
      }
      
      res.json({
        active: isActive && !isExpired,
        expiresAt: expiresAt?.toISOString() || null,
        available: true
      });
      
    } catch (error: any) {
      console.error('❌ Error checking boost status:', error);
      res.status(500).json({ error: 'Failed to check boost status' });
    }
  });

  // VDP Routing endpoint - gets user VDP configuration from Supabase
  app.post('/api/vdp/routing', async (req, res) => {
    try {
      const { email, context, demo } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const isDemoMode = demo === true || demo === 'true';
      console.log(`🔍 Looking up VDP routing for: ${email}${context ? `, context: "${context}"` : ''}${isDemoMode ? ', DEMO MODE' : ''}`);

      // Create direct Supabase client using hardcoded config
      const { createClient } = await import('@supabase/supabase-js');
      const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = await import('./hardcoded-config');
      const supabase = createClient(
        SUPABASE_URL, 
        SUPABASE_SERVICE_KEY
      );
      
      // Credit gate (optional): /connect only. AO Recruit (recruit | aorecruit) never credit-blocked here.
      const isRecruitingContext = context === 'recruit' || context === 'aorecruit';
      if (VDP_CREDIT_CHECKS_ENABLED && !isDemoMode && !isRecruitingContext) {
        console.log(`💰 Checking credits for ${email} before allowing VDP access...`);
        const { data: creditsData, error: creditsError } = await supabase
          .from('user_credits')
          .select('credits_remaining')
          .eq('email', email)
          .maybeSingle();
        
        // If no user_credits record exists, CREATE IT (as long as it's not a duplicate)
        if (!creditsData) {
          if (creditsError) {
            console.error(`❌ Error checking user_credits for ${email}:`, creditsError);
          }
          console.log(`📝 No user_credits record found for ${email} - creating one...`);
          
          // Get customer data to get associate_id and name - ONLY check company_email
          const { data: customerData } = await supabase
            .from('customers')
            .select('associate_id, first_name, last_name, agent_name, company_email, personal_email')
            .ilike('company_email', email.toLowerCase().trim())
            .maybeSingle();
          const associateId = customerData?.associate_id || null;
          const name = customerData?.agent_name || 
                      (customerData?.first_name && customerData?.last_name ? `${customerData.first_name} ${customerData.last_name}` : null) ||
                      email.split('@')[0];
          
          // Create user_credits record (ON CONFLICT DO NOTHING to avoid duplicates)
          const { data: newCreditsData, error: createError } = await supabase
            .from('user_credits')
            .insert({
              email: email.toLowerCase().trim(),
              associate_id: associateId,
              name: name,
              credits_used: 0,
              credits_purchased: 0,
              missed_calls: 0,
              aoi_missed_calls: 0
            })
            .select('credits_remaining')
            .single();
          
          if (createError) {
            // If it's a duplicate key error, that's fine - just fetch it
            if (createError.code === '23505' || createError.message?.includes('duplicate')) {
              console.log(`⚠️ user_credits record already exists (duplicate) - fetching it...`);
              const { data: existingCredits } = await supabase
                .from('user_credits')
                .select('credits_remaining')
                .eq('email', email)
                .maybeSingle();
              
              if (existingCredits) {
                const creditsRemaining = existingCredits.credits_remaining || 0;
                console.log(`✅ Found existing user_credits record: ${creditsRemaining} credits`);
                
                if (creditsRemaining < 0) {
                  console.log(`🚫 VDP ACCESS BLOCKED: ${email} has ${creditsRemaining} credits (NEGATIVE)`);
                  return res.status(403).json({
                    error: 'VDP_BLOCKED_INSUFFICIENT_CREDITS',
                    creditsRemaining,
                    message: 'VDP access denied: Your account has insufficient credits. Please add credits to continue.',
                    vdpActive: 'false'
                  });
                }
              }
            } else {
              console.error(`❌ Failed to create user_credits record for ${email}:`, createError);
              return res.status(500).json({
                error: 'VDP_SETUP_ERROR',
                message: 'Failed to set up user credits. Please contact support.',
                vdpActive: 'false'
              });
            }
          } else if (newCreditsData) {
            const creditsRemaining = newCreditsData.credits_remaining || 0;
            console.log(`✅ Created user_credits record for ${email}: ${creditsRemaining} credits`);
            
            if (creditsRemaining < 0) {
              console.log(`🚫 VDP ACCESS BLOCKED: ${email} has ${creditsRemaining} credits (NEGATIVE)`);
              return res.status(403).json({
                error: 'VDP_BLOCKED_INSUFFICIENT_CREDITS',
                creditsRemaining,
                message: 'VDP access denied: Your account has insufficient credits. Please add credits to continue.',
                vdpActive: 'false'
              });
            }
          }
        } else {
          const creditsRemaining = creditsData.credits_remaining || 0;
          console.log(`💰 ${email} has ${creditsRemaining} credits`);
          
          if (creditsRemaining < 0) {
            console.log(`🚫 VDP ACCESS BLOCKED: ${email} has ${creditsRemaining} credits (NEGATIVE - ANY negative is blocked)`);
            console.log(`🔥 IMMEDIATELY DISABLING VDP FOR AGENT WITH NEGATIVE CREDITS...`);
            
            // Auto-disable VDP IMMEDIATELY - ONLY check company_email
            const { error: updateError } = await supabase
              .from('customers')
              .update({ VDPACTIVE: 'INACTIVE' })
              .ilike('company_email', email.toLowerCase().trim());
            
            if (updateError) {
              console.error(`❌ FAILED TO DISABLE VDP: ${email} - Error:`, updateError);
            } else {
              console.log(`✅ VDP DISABLED SUCCESSFULLY for ${email}`);
            }
            
            return res.status(403).json({
              error: 'VDP_BLOCKED_INSUFFICIENT_CREDITS',
              creditsRemaining,
              message: 'VDP access denied: Your account has insufficient credits. Please add credits to continue.',
              vdpActive: 'false'
            });
          }
          
          console.log(`✅ Credit check passed for ${email} - Allowing VDP access`);
        }
      } else {
        if (!VDP_CREDIT_CHECKS_ENABLED) {
          console.log(`✅ VDP routing: credit checks disabled — allowing ${email}`);
        } else if (isDemoMode) {
          console.log(`🎭 DEMO MODE: Skipping credit check for ${email}`);
        } else if (isRecruitingContext) {
          console.log(`🎯 AO Recruit: Skipping credit check for ${email}`);
        }
      }
      console.log(`🔍 Querying Supabase customers table for: ${email}`);

      // CRITICAL: Check both company_email AND personal_email (case-insensitive)
      // Some users have their email in personal_email instead of company_email
      const normalizedEmail = email.toLowerCase().trim();
      const { data, error } = await supabase
        .from('customers')
        .select(`
          id,
          first_name,
          last_name,
          company_email,
          personal_email,
          associate_id,
          states,
          market,
          VDPACTIVE
        `)
        .or(`company_email.ilike.${normalizedEmail},personal_email.ilike.${normalizedEmail}`);

      console.log(`🔍 Supabase query result:`, { data, error, dataLength: data?.length });

      // Handle case where no customer data is found
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        console.log(`❌ No customer data found for ${email}`, { error: error?.message, dataExists: !!data, dataLength: data?.length, context });
        
        // For recruit context, provide a more helpful error message
        if (context === 'recruit' || context === 'aorecruit') {
          console.error(`🚨 VDP ROUTING ERROR on /ao-recruit: No customer record found for ${email}`);
          return res.status(404).json({ 
            error: `No VDP configuration found for ${email}`,
            message: 'Your account is not set up for AO Recruit VDP. Please contact support to enable VDP access.',
            context: 'recruit',
            vdpActive: 'false'
          });
        }
        
        return res.status(404).json({ error: `No VDP configuration found for ${email}` });
      }

      // CRITICAL FIX: Handle multiple customer records - prefer one with associate_id
      let customerData: any;
      if (Array.isArray(data)) {
        if (data.length === 1) {
          customerData = data[0];
        } else {
          // Multiple records found - prefer one with associate_id, then first one
          console.warn(`⚠️ Multiple customer records found for ${email} (${data.length} records) - selecting best match`);
          console.log(`   All records:`, data.map(c => ({ id: c.id, associate_id: c.associate_id, company_email: c.company_email, personal_email: c.personal_email })));
          const withAssociateId = data.find(c => c.associate_id && !String(c.associate_id).startsWith('333'));
          customerData = withAssociateId || data[0];
          console.log(`   ✅ Selected record: ID=${customerData.id}, associate_id=${customerData.associate_id}, VDPACTIVE=${customerData.VDPACTIVE}`);
          
          if (!customerData.associate_id) {
            console.error(`   ❌ Selected record has no associate_id - this will cause a 400 error`);
          }
        }
      } else {
        customerData = data;
      }

      // ❌ REMOVED: Fake associate_id generation (333XXX format) - NO LONGER ALLOWED
      // If no associate_id found, return error - DO NOT generate fake IDs
      if (!customerData.associate_id) {
        console.error(`🚨 VDP ROUTING ERROR: No associate_id found for ${email} on ${context || 'default'} context`);
        const errorMessage = context === 'recruit' || context === 'aorecruit'
          ? `No valid associate_id found for ${email}. Your AO Recruit account needs to be properly configured with an associate_id. Please contact support.`
          : `No valid associate_id found for ${email}. Customer record must have a valid associate_id from agent_hierarchy or producerlist.`;
        
        return res.status(400).json({ 
          error: `No valid associate_id found for ${email}`,
          message: errorMessage,
          context: context || 'default',
          vdpActive: 'false'
        });
      }
      
      // Validate associate_id is not a fake ID (starts with 333)
      const associateIdStr = String(customerData.associate_id);
      if (associateIdStr.startsWith('333')) {
        console.error(`🚨 VDP ROUTING ERROR: Fake associate_id detected: ${associateIdStr} (starts with 333) for ${email} on ${context || 'default'} context`);
        return res.status(400).json({ 
          error: `Invalid associate_id: ${associateIdStr}`,
          message: `Fake associate IDs (starting with 333) are not allowed. Your account needs a valid associate_id. Please contact support.`,
          context: context || 'default',
          vdpActive: 'false'
        });
      }

      console.log(`✅ Found VDP data for ${email}: Associate ID ${customerData.associate_id}`);

      // Merge states, licensed_states, etc. (empty [] on customers.states alone used to yield 0 states)
      let statesList = parseStatesFromCustomer(customerData);
      if (statesList.length === 0) {
        const { data: profileRow } = await supabase
          .from('agent_profiles')
          .select('license_states')
          .ilike('email', normalizedEmail)
          .maybeSingle();
        statesList = parseStatesFromCustomer({
          licensed_states: profileRow?.license_states,
        } as { states?: unknown; taalk_state?: unknown });
        if (statesList.length > 0) {
          console.log(`📋 VDP states fallback: ${statesList.length} from agent_profiles.license_states for ${email}`);
        }
      }
      if (statesList.length === 0) {
        console.warn(`⚠️ VDP routing: no state codes after customers + agent_profiles for ${email} — Taalk may not filter by license`);
      }

      // Determine market based on context, demo mode, or customer data
      let market = customerData.market;
      
      // 🎭 DEMO MODE: Set demo markets
      if (isDemoMode) {
        if (context === 'recruit' || context === 'aorecruit') {
          market = 'aorecruitdemo';
          console.log(`🎭 DEMO MODE: Setting market to "aorecruitdemo" for AO Recruit demo`);
        } else {
          market = 'aointeldemo';
          console.log(`🎭 DEMO MODE: Setting market to "aointeldemo" for AO Intel demo`);
        }
      }
      // 🚨 CRITICAL: FORCE market to 'aorecruit' for AO Recruit page (they're recruiting, that's it!)
      else if (context === 'recruit' || context === 'aorecruit') {
        market = 'aorecruit';
        console.log(`🎯 AORecruit context detected - FORCING market to "aorecruit" (recruiting only)`);
      } else if (!market) {
        // For /connect and other contexts, use customer table or default
        market = 'Veteran'; // Default fallback
        console.log(`✅ Using market from customers table: ${JSON.stringify(market)}`);
      } else {
        // /connect uses customer table values
        console.log(`✅ Using market from customers table: ${JSON.stringify(market)}`);
      }
      
      // Ensure market is always array format when context is recruit
      if ((context === 'recruit' || context === 'aorecruit') && !isDemoMode) {
        market = ['aorecruit'];
        console.log(`✅ FINAL market set to:`, market);
      }

      // Final market format - ensure it's an array; normalize "Globe" → "Globe Market"
      const normalizeTaalkMarket = (m: string): string =>
        (m === 'Globe') ? 'Globe Market' : m;
      const finalMarket = (Array.isArray(market) ? market : [market]).map(normalizeTaalkMarket);
      
      console.log(`📊 VDP Config: ${statesList.length} states, Market: ${JSON.stringify(finalMarket)}, Associate: ${customerData.associate_id}`);

      // Return VDP configuration (market is passed to Taalk only - no DB update)
      const vdpConfig = {
        success: true,
        customer_id: customerData.id,
        associate_id: customerData.associate_id,
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        email: customerData.company_email,
        states: statesList,
        market: finalMarket, // Always array format
        vdpActive: customerData.VDPACTIVE === 'ACTIVE' ? 'true' : 'false',
      };

      console.log(`🎯 Returning VDP config for ${email}:`, vdpConfig);

      res.json(vdpConfig);
    } catch (error) {
      console.error(`🚨 VDP ROUTING ERROR on /api/vdp/routing:`, error);
      console.error(`   Email: ${req.body?.email}, Context: ${req.body?.context}, Error:`, error instanceof Error ? error.message : String(error));
      res.status(500).json({ 
        error: 'Failed to get VDP routing data',
        message: error instanceof Error ? error.message : 'An unexpected error occurred while loading VDP configuration',
        context: req.body?.context || 'default',
        vdpActive: 'false'
      });
    }
  });

  // VDP Heartbeat endpoint
  app.post('/api/vdp/heartbeat', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      console.log(`🟢 VDP Heartbeat received from ${email} at ${new Date().toISOString()}`);
      
      res.json({ 
        success: true, 
        timestamp: new Date().toISOString(),
        message: 'VDP heartbeat acknowledged'
      });
    } catch (error) {
      console.error('VDP Heartbeat error:', error);
      res.status(500).json({ error: 'Failed to process VDP heartbeat' });
    }
  });

  // WebRTC Token endpoint for Twilio calling - LOGIN REQUIRED, identity from session only
  app.post('/api/twilio/webrtc-token', async (req, res) => {
    try {
      const userEmail = (req as any).session?.user?.email;
      if (!userEmail || typeof userEmail !== 'string' || !userEmail.includes('@')) {
        return res.status(401).json({ error: 'Login required', message: 'You must be signed in to use WebRTC.' });
      }
      const identity = userEmail.trim().toLowerCase();

      console.log(`🎯 WebRTC token requested for session user: ${identity}`);

      // Use the properly imported Twilio from the top of the file
      const twilio = (await import('twilio')).default;
      const AccessToken = twilio.jwt.AccessToken;
      const VoiceGrant = AccessToken.VoiceGrant;

      // Use hardcoded credentials from config
      const { 
        TWILIO_ACCOUNT_SID, 
        TWILIO_API_KEY, 
        TWILIO_API_SECRET, 
        TWILIO_TWIML_APP_SID 
      } = await import('./hardcoded-config');

      // Create an access token which we will sign and return to the client
      const accessToken = new AccessToken(
        TWILIO_ACCOUNT_SID,
        TWILIO_API_KEY,
        TWILIO_API_SECRET
      );

      // Set the Identity of the access token (session email only)
      accessToken.identity = identity;

      // Create a Voice grant and add to the access token
      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: TWILIO_TWIML_APP_SID,
        incomingAllow: true
      });
      accessToken.addGrant(voiceGrant);

      // Generate the token
      const token = accessToken.toJwt();

      console.log(`✅ WebRTC token generated for ${identity} (${token.length} chars)`);

      res.json({
        success: true,
        token: token,
        identity: identity
      });
    } catch (error) {
      console.error('WebRTC Token error:', error);
      res.status(500).json({ error: 'Failed to generate WebRTC token' });
    }
  });

  // VDP Set Online - API endpoint to control VDP online status
  app.post('/api/vdp/set-online', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      console.log(`🎯 VDP Set Online API called for: ${email}`);

      // Reuse the routing logic to get VDP data
      const { createClient } = await import('@supabase/supabase-js');
      const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = await import('./hardcoded-config');
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const { data: customerData, error } = await supabase
        .from('customers')
        .select(`
          id,
          first_name,
          last_name,
          company_email,
          associate_id,
          states,
          market,
          VDPACTIVE
        `)
        .ilike('company_email', email)
        .maybeSingle();

      if (error || !customerData) {
        console.error('❌ Error fetching VDP data:', error);
        return res.status(404).json({ error: 'VDP data not found for this email' });
      }

      // Process states and market (same logic as routing endpoint)
      const statesList = customerData.states 
        ? (Array.isArray(customerData.states) ? customerData.states : customerData.states.split(',').map((s: string) => s.trim()))
        : ['CA', 'TX', 'NC'];

      let market = customerData.market;
      const normalizeTaalkMarket2 = (m: string): string =>
        (m === 'Globe') ? 'Globe Market' : m;
      const finalMarket = (Array.isArray(market) ? market : (market ? [market] : ['Veteran'])).map(normalizeTaalkMarket2);
      const marketString = finalMarket[0];

      const vdpConfig = {
        success: true,
        command: 'open',
        agentId: String(customerData.associate_id || customerData.id || email),
        params: {
          states: statesList,
          market: marketString,
          first_name: customerData.first_name,
          last_name: customerData.last_name
        },
        customer_id: customerData.id,
        associate_id: customerData.associate_id,
        email: customerData.company_email
      };

      console.log(`✅ VDP Set Online response for ${email}:`, vdpConfig);
      res.json(vdpConfig);
    } catch (error) {
      console.error('❌ VDP Set Online error:', error);
      res.status(500).json({ error: 'Failed to set VDP online' });
    }
  });

  // VDP Set Offline - API endpoint to control VDP offline status
  app.post('/api/vdp/set-offline', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      console.log(`🎯 VDP Set Offline API called for: ${email}`);

      res.json({
        success: true,
        command: 'disconnect',
        message: 'VDP should be disconnected'
      });
    } catch (error) {
      console.error('❌ VDP Set Offline error:', error);
      res.status(500).json({ error: 'Failed to set VDP offline' });
    }
  });

  // GET /api/vdp/needs-reconnect?email=xxx — agent polls this; returns true once then clears
  app.get('/api/vdp/needs-reconnect', (req, res) => {
    const email = String(req.query.email || '').toLowerCase().trim();
    if (!email) return res.json({ reconnect: false });
    const reconnect = vdpReconnectFlags.has(email);
    if (reconnect) vdpReconnectFlags.delete(email);
    res.json({ reconnect });
  });

  // POST /api/admin/vdp-reconnect-globe — flag all Globe/Globe Market agents to reconnect
  app.post('/api/admin/vdp-reconnect-globe', async (req, res) => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = await import('./hardcoded-config');
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const { data: rows } = await supabase
        .from('customers')
        .select('company_email, market')
        .not('company_email', 'is', null);

      const flagged: string[] = [];
      for (const r of (rows || [])) {
        const m = String(r.market || '');
        if (m === 'Globe' || m === 'Globe Market') {
          const email = String(r.company_email).toLowerCase().trim();
          vdpReconnectFlags.add(email);
          flagged.push(email);
        }
      }

      console.log(`🔄 VDP reconnect flagged for ${flagged.length} Globe agents`);
      res.json({ success: true, flagged: flagged.length, emails: flagged });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}