// Taalk Hotlead Service - Pulls successful calls from Taalk API every 15 minutes
// Excludes answering machines and converts real connects to hotleads

import { masterleadClient } from './local-masterlead-client';

interface TaalkCallResult {
  id: string;
  contact: {
    phone: string;
    firstName: string;
    lastName: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  disposition: string; // "answered", "no-answer", "answering-machine", "busy", "failed"
  duration: number; // Call duration in seconds
  callTime: string; // ISO timestamp
  agentId: string;
  campaignId: string;
  callId: string;
  recording?: string; // Recording URL if available
  transferStatus?: string; // "transferred", "not-transferred", "transfer-failed"
  transferDuration?: number; // Duration of transfer in seconds (if transferred)
  callDirection: "outbound" | "inbound"; // Whether it's a Taalk outbound call or inbound callback
}

interface TaalkApiResponse {
  success: boolean;
  data: TaalkCallResult[];
  totalCount: number;
  lastFetchTime?: string;
}

class TaalkHotleadService {
  private apiKey: string;
  private baseUrl: string;
  private lastFetchTime: Date;

  constructor() {
    this.apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
    this.baseUrl = "https://api.taalk.ai/api";
    this.lastFetchTime = new Date(Date.now() - (8 * 60 * 60 * 1000)); // Start from 8 hours ago
  }

  /**
   * Fetch call results from Taalk API since last fetch time
   * TODO: Replace with correct Taalk API endpoint for fetching call results
   */
  async fetchTaalkCallResults(): Promise<TaalkCallResult[]> {
    try {
      console.log(`🔍 TAALK HOTLEADS: Attempting to fetch calls since ${this.lastFetchTime.toISOString()}`);
      
      // Try endpoints based on official Swagger documentation
      const endpoints = [
        // From Swagger docs - try variations with parameters
        `/calls?db=michaelmandella&since=${this.lastFetchTime.toISOString()}`,
        `/calls?db=michaelmandella&from=${this.lastFetchTime.toISOString()}`,
        `/calls?db=michaelmandella&start=${this.lastFetchTime.toISOString()}`,
        `/calls?db=michaelmandella&limit=100`,
        `/calls?db=michaelmandella`,
        // Try campaign-based call listings
        `/campaign2s/calls?db=michaelmandella&since=${this.lastFetchTime.toISOString()}`,
        `/campaign2s?db=michaelmandella`,  // List campaigns first, then get calls
        // Alternative base URL from documentation
        `/api/calls?db=michaelmandella&since=${this.lastFetchTime.toISOString()}`,
        `/api/monitor/calls?db=michaelmandella&since=${this.lastFetchTime.toISOString()}`
      ];

      // Also try the alternative base URL mentioned in docs
      const altBaseUrl = 'https://lets.taalk.ai/api';

      // Try both base URLs
      const baseUrls = [this.baseUrl, altBaseUrl];
      
      for (const baseUrl of baseUrls) {
        console.log(`🔍 Trying base URL: ${baseUrl}`);
        
        for (const endpoint of endpoints) {
          try {
            console.log(`🔍 Trying endpoint: ${baseUrl}${endpoint}`);
            
            const response = await fetch(`${baseUrl}${endpoint}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
              }
            });

            console.log(`📊 Response status: ${response.status} for ${endpoint}`);
            
            if (response.ok) {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                console.log(`✅ TAALK CALLS: Found working endpoint ${baseUrl}${endpoint}, fetched ${data?.length || 0} calls`);
                return data || [];
              } else {
                const text = await response.text();
                console.log(`⚠️ Non-JSON response from ${baseUrl}${endpoint}:`, text.substring(0, 200));
              }
            }
          } catch (endpointError) {
            console.log(`❌ Endpoint ${baseUrl}${endpoint} failed:`, endpointError.message);
            continue;
          }
        }
      }

      console.error('❌ All Taalk API endpoints failed - no working call data endpoint found');
      console.log('📝 NOTE: Need correct Taalk API documentation for call retrieval endpoint');
      return [];

    } catch (error) {
      console.error('❌ TAALK FETCH ERROR:', error);
      return [];
    }
  }

  /**
   * Filter calls to identify hotleads based on user-defined criteria:
   * 1. Taalk outbound calls: Human connects that either don't transfer OR transfer < 10 seconds
   * 2. Inbound callbacks: Any callback where transfer < 10 seconds
   */
  filterHotleads(calls: TaalkCallResult[]): TaalkCallResult[] {
    const hotleads = calls.filter(call => {
      // First, must be a human connect (not answering machine)
      const isHuman = (
        call.disposition === 'answered' &&
        call.disposition !== 'answering-machine' &&
        call.disposition !== 'voicemail' &&
        call.disposition !== 'no-answer' &&
        call.disposition !== 'busy' &&
        call.disposition !== 'failed'
      );

      if (!isHuman) {
        console.log(`🚫 NOT HUMAN: ${call.contact.phone} - ${call.disposition}`);
        return false;
      }

      // HOTLEAD CRITERIA 1: Taalk outbound calls
      if (call.callDirection === 'outbound') {
        // Either no transfer OR transfer < 10 seconds (never got assigned)
        const noTransfer = !call.transferStatus || call.transferStatus === 'not-transferred' || call.transferStatus === 'transfer-failed';
        const shortTransfer = call.transferStatus === 'transferred' && (call.transferDuration || 0) < 10;
        
        const isHotlead = noTransfer || shortTransfer;
        
        if (isHotlead) {
          console.log(`🔥 TAALK HOTLEAD: ${call.contact.phone} - ${noTransfer ? 'No transfer' : `Short transfer (${call.transferDuration}s)`}`);
        } else {
          console.log(`✅ SUCCESSFUL TRANSFER: ${call.contact.phone} - Transfer: ${call.transferDuration}s (not hotlead)`);
        }
        
        return isHotlead;
      }
      
      // HOTLEAD CRITERIA 2: Inbound callbacks with short/failed transfer
      if (call.callDirection === 'inbound') {
        const shortTransfer = !call.transferStatus || call.transferStatus === 'not-transferred' || call.transferStatus === 'transfer-failed' || ((call.transferDuration || 0) < 10);
        
        if (shortTransfer) {
          console.log(`🔥 CALLBACK HOTLEAD: ${call.contact.phone} - Short/failed transfer (${call.transferDuration || 0}s)`);
        } else {
          console.log(`✅ SUCCESSFUL CALLBACK TRANSFER: ${call.contact.phone} - Transfer: ${call.transferDuration}s (not hotlead)`);
        }
        
        return shortTransfer;
      }

      return false;
    });

    console.log(`🔥 HOTLEADS IDENTIFIED: ${hotleads.length} hotleads out of ${calls.length} total calls`);
    return hotleads;
  }

  /**
   * Convert Taalk call results to masterleads and insert into Postgres (masterlead).
   */
  async convertToHotleads(hotleadCalls: TaalkCallResult[]): Promise<number> {
    if (hotleadCalls.length === 0) {
      return 0;
    }

    let successCount = 0;
    
    for (const call of hotleadCalls) {
      try {
        // Check if this lead already exists in masterleads table
        const { data: existingLead } = await masterleadClient
          .from('masterlead')
          .select('id')
          .eq('phone', call.contact.phone)
          .maybeSingle();

        if (existingLead) {
          console.log(`⚠️ DUPLICATE: ${call.contact.phone} already exists in masterleads`);
          continue;
        }

        // Determine hotlead type and source details
        const isCallback = call.callDirection === 'inbound';
        const hotleadType = isCallback ? 'callback' : 'taalk-outbound';
        const reason = this.getHotleadReason(call);

        // Create masterlead record for hotlead (snake_case keys for local PG client)
        const masterlead = {
          first_name: call.contact.firstName || 'Unknown',
          last_name: call.contact.lastName || 'Unknown', 
          phone: call.contact.phone,
          email: call.contact.email || null,
          address: call.contact.address || null,
          city: call.contact.city || null,
          state: call.contact.state || null,
          zip: call.contact.zip || null,
          taalk_market: 'Veteran',
          source: `Taalk-${hotleadType}`,
          status: 'available',
          priority: 'high',
          cn_email: null,
          cnresolution: 'pending',
          is_hot_lead: true,
          hotlead_type: hotleadType,
          hotlead_reason: reason,
          taalk_call_id: call.callId,
          taalk_duration: call.duration,
          taalk_agent_id: call.agentId,
          taalk_transfer_duration: call.transferDuration || 0,
          taalk_transfer_status: call.transferStatus || 'not-transferred',
          call_time: call.callTime,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error } = await masterleadClient
          .from('masterlead')
          .insert(masterlead);

        if (error) {
          console.error(`❌ INSERT ERROR for ${call.contact.phone}:`, error);
        } else {
          console.log(`✅ MASTERLEAD ${hotleadType.toUpperCase()}: ${call.contact.phone} - ${reason} (cnresolution: pending)`);
          successCount++;
        }

      } catch (error) {
        console.error(`❌ CONVERT ERROR for ${call.contact.phone}:`, error);
      }
    }

    console.log(`📊 MASTERLEAD CONVERSION: Created ${successCount} new masterleads from ${hotleadCalls.length} qualified calls`);
    return successCount;
  }

  /**
   * Determine the reason why this call became a hotlead
   */
  private getHotleadReason(call: TaalkCallResult): string {
    if (call.callDirection === 'inbound') {
      return call.transferDuration && call.transferDuration < 10 
        ? `Callback - short transfer (${call.transferDuration}s)` 
        : 'Callback - no transfer';
    } else {
      if (!call.transferStatus || call.transferStatus === 'not-transferred' || call.transferStatus === 'transfer-failed') {
        return 'Outbound - no transfer';
      } else {
        return `Outbound - short transfer (${call.transferDuration}s)`;
      }
    }
  }

  /**
   * Main process - runs every 15 minutes to pull Taalk calls and convert to hotleads
   */
  async processTaalkToHotleads(): Promise<{ processed: number, converted: number }> {
    console.log('🚀 TAALK HOTLEAD PROCESS: Starting Taalk to hotlead conversion');
    
    try {
      // Step 1: Fetch all calls since last run (both outbound and inbound)
      const allCalls = await this.fetchTaalkCallResults();
      
      // Step 2: Filter for hotleads based on user criteria
      // - Taalk outbound: Human connects that don't transfer OR transfer < 10 seconds
      // - Inbound callbacks: Any callback with transfer < 10 seconds
      const hotleadCalls = this.filterHotleads(allCalls);
      
      // Step 3: Convert qualified calls to hotleads
      const converted = await this.convertToHotleads(hotleadCalls);
      
      // Update last fetch time
      this.lastFetchTime = new Date();
      
      console.log(`✅ TAALK PROCESS COMPLETE: Processed ${allCalls.length} calls, converted ${converted} to hotleads`);
      
      return {
        processed: allCalls.length,
        converted
      };

    } catch (error) {
      console.error('❌ TAALK HOTLEAD PROCESS ERROR:', error);
      return { processed: 0, converted: 0 };
    }
  }

  /**
   * Get process statistics
   */
  getStats() {
    return {
      service: 'Taalk Hotlead Service',
      lastFetchTime: this.lastFetchTime,
      status: 'active'
    };
  }
}

// Export singleton instance
export const taalkHotleadService = new TaalkHotleadService();

// SQL Query to insert Taalk hotleads directly into masterleads table
export const TAALK_TO_MASTERLEADS_QUERY = `
-- Insert Taalk hotleads into masterleads table with cn_email=null and cnresolution='pending'
-- Based on user criteria:
-- 1. Taalk outbound: Human connects that don't transfer OR transfer < 10 seconds  
-- 2. Inbound callbacks: Any callback with transfer < 10 seconds

INSERT INTO masterlead (
  firstName, lastName, phone, email, address, city, state, zip,
  market, source, status, priority, cn_email, cnresolution, is_hot_lead,
  hotlead_type, hotlead_reason, taalk_call_id, taalk_duration, 
  taalk_agent_id, taalk_transfer_duration, taalk_transfer_status,
  call_time, created_at, updated_at
)
SELECT 
  COALESCE(tc.first_name, 'Unknown') as firstName,
  COALESCE(tc.last_name, 'Unknown') as lastName,
  tc.phone,
  tc.email,
  tc.address,
  tc.city,
  tc.state,
  tc.zip,
  'Veteran' as market,
  CASE 
    WHEN tc.call_direction = 'inbound' THEN 'Taalk-callback'
    ELSE 'Taalk-outbound'
  END as source,
  'available' as status,
  'high' as priority,
  NULL as cn_email,                              -- No cn_email as requested
  'pending' as cnresolution,                     -- Set to pending as requested
  true as is_hot_lead,                           -- CRITICAL: Mark as hotlead
  CASE 
    WHEN tc.call_direction = 'inbound' THEN 'callback'
    ELSE 'taalk-outbound'
  END as hotlead_type,
  CASE 
    WHEN tc.call_direction = 'inbound' AND (tc.transfer_duration < 10 OR tc.transfer_status != 'transferred') 
      THEN 'Callback - short/no transfer'
    WHEN tc.call_direction = 'outbound' AND (tc.transfer_duration < 10 OR tc.transfer_status != 'transferred')
      THEN 'Outbound - short/no transfer'
    ELSE 'Other'
  END as hotlead_reason,
  tc.call_id as taalk_call_id,
  tc.duration as taalk_duration,
  tc.agent_id as taalk_agent_id,
  COALESCE(tc.transfer_duration, 0) as taalk_transfer_duration,
  COALESCE(tc.transfer_status, 'not-transferred') as taalk_transfer_status,
  tc.call_time,
  NOW() as created_at,
  NOW() as updated_at
FROM taalk_calls tc
LEFT JOIN masterlead ml ON ml.phone = tc.phone
WHERE 
  tc.call_time >= NOW() - INTERVAL '15 minutes'   -- Only last 15 minutes
  AND tc.disposition = 'answered'                  -- Only answered calls (human connects)
  AND tc.disposition NOT IN (                     -- Exclude non-human connects
    'answering-machine', 
    'voicemail', 
    'no-answer', 
    'busy', 
    'failed'
  )
  AND (
    -- CRITERIA 1: Outbound calls that don't transfer or transfer < 10 seconds
    (tc.call_direction = 'outbound' AND 
     (tc.transfer_status IS NULL OR tc.transfer_status != 'transferred' OR tc.transfer_duration < 10))
    OR
    -- CRITERIA 2: Inbound callbacks with transfer < 10 seconds
    (tc.call_direction = 'inbound' AND 
     (tc.transfer_status IS NULL OR tc.transfer_status != 'transferred' OR tc.transfer_duration < 10))
  )
  AND ml.id IS NULL                              -- Don't duplicate existing masterleads
ORDER BY tc.call_time DESC;
`;