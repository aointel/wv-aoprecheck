import { createClient } from '@supabase/supabase-js';
import { Call, User, Team } from '@shared/schema';

// Define Supabase table types
type SupabaseCall = {
  id: number;
  taalkuid: string;
  phone: string;
  first_name: string;
  last_name: string;
  monthly_premium: string;
  status: string;
  recording_url: string | null;
  transcription_text: string | null;
  screenshot_url: string | null;
  call_date: string | null;
  call_duration: string | null;
  team_id: number | null;
  agent_id: number | null;
  is_flagged: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
};

type SupabaseUser = {
  id: number;
  username: string;
  email: string;
  fullname: string;
  role: string;
  associate_id: string | null;
  manager_id: number | null;
  team_id: number | null;
  created_at: string;
  updated_at: string;
};

type SupabaseTeam = {
  id: number;
  name: string;
  parent_team_id: number | null;
  manager_id: number | null;
  created_at: string;
  updated_at: string;
};

type SupabaseHPPROPresentation = {
  id: number;
  taalkuid: string;
  presentation_date: string;
  agent_id: number | null;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  policy_type: string;
  policy_number: string | null;
  premium_amount: number;
  status: string;
  notes: string | null;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
};

// Environment variables for Supabase authentication
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_API_KEY || '';

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Supabase URL and API key must be provided as environment variables.');
  console.error('Make sure SUPABASE_URL and SUPABASE_API_KEY are set.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Test the connection
export async function testSupabaseConnection() {
  try {
    // Try querying all tables to test connection
    const tablesTests = await Promise.all([
      supabase.from('calls').select('count').limit(1),
      supabase.from('users').select('count').limit(1),
      supabase.from('teams').select('count').limit(1),
      supabase.from('hppro_presentations').select('count').limit(1)
    ]);
    
    // If any table gives an error except for "doesn't exist", consider it a failed connection
    for (const test of tablesTests) {
      if (test.error && !test.error.message.includes('does not exist')) {
        console.error('Supabase connection test failed:', test.error.message);
        return false;
      }
    }
    
    console.log('Supabase connection successful');
    
    // Check for ttaalk_raw_data table
    try {
      console.log('Checking for ttaalk_raw_data table...');
      const { data, error } = await supabase
        .from('ttaalk_raw_data')
        .select('count')
        .limit(1);
      
      if (error && error.message.includes('does not exist')) {
        console.log('ttaalk_raw_data table does not exist in Supabase.');
        console.log('This is okay - we will use the local database table that was already created.');
      } else {
        console.log('ttaalk_raw_data table already exists in Supabase');
      }
    } catch (ttaalkError) {
      console.error('Error checking ttaalk_raw_data table:', ttaalkError);
      console.log('Using local database for ttaalk_raw_data storage');
    }
    
    return true;
  } catch (err) {
    console.error('Error testing Supabase connection:', err);
    return false;
  }
}

// Helper function to check if tables exist in Supabase
export async function checkSupabaseTables() {
  try {
    const tables = ['calls', 'users', 'teams', 'hppro_presentations', 'ttaalk_raw_data'];
    const results: Record<string, boolean> = {};
    
    for (const table of tables) {
      const { error } = await supabase.from(table).select('count').limit(1);
      results[table] = !error || !error.message.includes('does not exist');
    }
    
    return results;
  } catch (err) {
    console.error('Error checking Supabase tables:', err);
    return {};
  }
}

// Helper function to fetch calls from Supabase
export async function fetchCallsFromSupabase(limit: number = 10, offset: number = 0) {
  try {
    const { data, error, count } = await supabase
      .from('calls')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Error fetching calls from Supabase:', error.message);
      return { calls: [], count: 0 };
    }
    
    return { calls: data || [], count: count || 0 };
  } catch (err) {
    console.error('Exception when fetching calls from Supabase:', err);
    return { calls: [], count: 0 };
  }
}

// Helper function to synchronize a call to Supabase
export async function syncCallToSupabase(call: Partial<Call>): Promise<SupabaseCall | null> {
  try {
    // Map from our local schema to Supabase schema
    const supabaseCall: Partial<SupabaseCall> = {
      id: call.id,
      taalkuid: call.taalkUID,
      phone: call.phone,
      first_name: call.firstName,
      last_name: call.lastName,
      monthly_premium: call.monthlyPremium,
      status: call.status,
      recording_url: call.recordingUrl,
      transcription_text: call.transcriptionText,
      screenshot_url: call.screenshotUrl,
      call_date: call.callDate ? call.callDate.toISOString() : null,
      call_duration: call.callDuration,
      team_id: call.teamId,
      agent_id: call.agentId,
      is_flagged: call.isFlagged
    };
    
    const { data, error } = await supabase
      .from('calls')
      .upsert(supabaseCall, { onConflict: 'id' })
      .select()
      .single();
    
    if (error) {
      console.error('Error syncing call to Supabase:', error.message);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Exception when syncing call to Supabase:', err);
    return null;
  }
}

// Helper function to delete a call from Supabase
export async function deleteCallFromSupabase(id: number) {
  try {
    const { error } = await supabase
      .from('calls')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error(`Error deleting call id ${id} from Supabase:`, error.message);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`Exception when deleting call id ${id} from Supabase:`, err);
    return false;
  }
}

// Helper function to fetch HPPROPresentations from Supabase
export async function fetchHPPROPresentationsFromSupabase(limit: number = 10, offset: number = 0) {
  try {
    const { data, error, count } = await supabase
      .from('hppro_presentations')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Error fetching HPPRO presentations from Supabase:', error.message);
      return { presentations: [], count: 0 };
    }
    
    return { presentations: data || [], count: count || 0 };
  } catch (err) {
    console.error('Exception when fetching HPPRO presentations from Supabase:', err);
    return { presentations: [], count: 0 };
  }
}

// Helper function to fetch users from Supabase
export async function fetchUsersFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) {
      console.error('Error fetching users from Supabase:', error.message);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Exception when fetching users from Supabase:', err);
    return [];
  }
}

// Helper function to fetch teams from Supabase
export async function fetchTeamsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*');
    
    if (error) {
      console.error('Error fetching teams from Supabase:', error.message);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Exception when fetching teams from Supabase:', err);
    return [];
  }
}

// Define TTaalk raw data type
type SupabaseTTaalkRawData = {
  id: number;
  recording_id: string;
  date_recorded: string;
  time_recorded: string;
  phone: string;
  name?: string;
  duration?: string;
  voicemail?: string;
  picked_by?: string;
  sms?: string;
  clicked?: string;
  transferred?: string;
  duration_after_transfer?: string;
  transfer_delay?: string;
  transfer_status?: string;
  persona?: string;
  client_first_name?: string;
  agent_last_name?: string;
  monthly_premium?: string;
  agent_first_name?: string;
  client_home_phone?: string;
  recording_url?: string;
  processed: boolean;
  taalkuid?: string;
  imported_at: string;
  processed_at?: string;
  notes?: string;
};

// Helper function to save TTaalk raw data to Supabase
export async function saveTTaalkRawDataToSupabase(record: Partial<SupabaseTTaalkRawData>): Promise<SupabaseTTaalkRawData | null> {
  try {
    console.log('Saving TTaalk raw data to Supabase:', record.recording_id);
    
    const { data, error } = await supabase
      .from('ttaalk_raw_data')
      .upsert(record, { onConflict: 'recording_id' })
      .select()
      .single();
    
    if (error) {
      console.error('Error saving TTaalk raw data to Supabase:', error.message);
      return null;
    }
    
    console.log('Successfully saved TTaalk raw data to Supabase:', record.recording_id);
    return data;
  } catch (err) {
    console.error('Exception when saving TTaalk raw data to Supabase:', err);
    return null;
  }
}

// Helper function to fetch TTaalk raw data from Supabase
export async function fetchTTaalkRawDataFromSupabase(limit: number = 10, offset: number = 0) {
  try {
    const { data, error, count } = await supabase
      .from('ttaalk_raw_data')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Error fetching TTaalk raw data from Supabase:', error.message);
      return { records: [], count: 0 };
    }
    
    return { records: data || [], count: count || 0 };
  } catch (err) {
    console.error('Exception when fetching TTaalk raw data from Supabase:', err);
    return { records: [], count: 0 };
  }
}