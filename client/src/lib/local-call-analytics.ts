/**
 * Local Call Analytics Service
 * Fetches call data directly from Twilio and Taalk APIs
 * Stores in IndexedDB for offline access
 */

// IndexedDB setup
const DB_NAME = 'call-analytics-db';
const DB_VERSION = 1;
const STORES = {
  TRANSFERS: 'transfers',
  ANALYTICS: 'analytics',
  RECORDINGS: 'recordings',
  TRANSCRIPTS: 'transcripts'
};

let db: IDBDatabase | null = null;

async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Transfers store
      if (!database.objectStoreNames.contains(STORES.TRANSFERS)) {
        const transfersStore = database.createObjectStore(STORES.TRANSFERS, { keyPath: 'transaction_id' });
        transfersStore.createIndex('agent_email', 'agent_email', { unique: false });
        transfersStore.createIndex('transaction_date', 'transaction_date', { unique: false });
      }

      // Analytics store
      if (!database.objectStoreNames.contains(STORES.ANALYTICS)) {
        const analyticsStore = database.createObjectStore(STORES.ANALYTICS, { keyPath: 'billing_transaction_id' });
        analyticsStore.createIndex('call_date', 'call_date', { unique: false });
      }

      // Recordings store (blob storage)
      if (!database.objectStoreNames.contains(STORES.RECORDINGS)) {
        database.createObjectStore(STORES.RECORDINGS, { keyPath: 'call_id' });
      }

      // Transcripts store
      if (!database.objectStoreNames.contains(STORES.TRANSCRIPTS)) {
        database.createObjectStore(STORES.TRANSCRIPTS, { keyPath: 'call_id' });
      }
    };
  });
}

// Get credentials from localStorage (user should set these)
export function getCredentials() {
  const twilioSid = localStorage.getItem('twilio_account_sid');
  const twilioToken = localStorage.getItem('twilio_auth_token');
  const taalkApiKey = localStorage.getItem('taalk_api_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';
  
  return {
    twilioSid,
    twilioToken,
    taalkApiKey
  };
}

export function setCredentials(credentials: { twilioSid?: string; twilioToken?: string; taalkApiKey?: string }) {
  if (credentials.twilioSid) localStorage.setItem('twilio_account_sid', credentials.twilioSid);
  if (credentials.twilioToken) localStorage.setItem('twilio_auth_token', credentials.twilioToken);
  if (credentials.taalkApiKey) localStorage.setItem('taalk_api_key', credentials.taalkApiKey);
}

// Fetch calls from Twilio API
export async function fetchTwilioCalls(startDate?: Date, endDate?: Date): Promise<any[]> {
  const { twilioSid, twilioToken } = getCredentials();
  
  if (!twilioSid || !twilioToken) {
    throw new Error('Twilio credentials not configured. Please set twilio_account_sid and twilio_auth_token in localStorage.');
  }

  const auth = btoa(`${twilioSid}:${twilioToken}`);
  let url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json?PageSize=1000`;
  
  if (startDate) {
    url += `&StartTime>=${startDate.toISOString().split('T')[0]}`;
  }
  if (endDate) {
    url += `&StartTime<=${endDate.toISOString().split('T')[0]}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${auth}`
    }
  });

  if (!response.ok) {
    throw new Error(`Twilio API error: ${response.status}`);
  }

  const data = await response.json();
  return data.calls || [];
}

// Fetch recording from Twilio
export async function fetchTwilioRecording(callSid: string): Promise<Blob | null> {
  const { twilioSid, twilioToken } = getCredentials();
  
  if (!twilioSid || !twilioToken) {
    throw new Error('Twilio credentials not configured');
  }

  // Get recordings for this call
  const auth = btoa(`${twilioSid}:${twilioToken}`);
  const recordingsUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls/${callSid}/Recordings.json`;
  
  const recordingsResponse = await fetch(recordingsUrl, {
    headers: { 'Authorization': `Basic ${auth}` }
  });

  if (!recordingsResponse.ok) {
    return null;
  }

  const recordingsData = await recordingsResponse.json();
  if (!recordingsData.recordings || recordingsData.recordings.length === 0) {
    return null;
  }

  const recording = recordingsData.recordings[0];
  const recordingSid = recording.sid;

  // Download the actual recording
  const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Recordings/${recordingSid}.mp3`;
  const downloadResponse = await fetch(recordingUrl, {
    headers: { 'Authorization': `Basic ${auth}` }
  });

  if (!downloadResponse.ok) {
    return null;
  }

  return await downloadResponse.blob();
}

// Fetch transcript from Taalk API
export async function fetchTaalkTranscript(taalkCallId: string): Promise<string | null> {
  const { taalkApiKey } = getCredentials();
  
  if (!taalkApiKey) {
    throw new Error('Taalk API key not configured');
  }

  try {
    const transcriptUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/transcript?db=michaelmandella`;
    const response = await fetch(transcriptUrl, {
      headers: { 'Authorization': `Bearer ${taalkApiKey}` }
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error('Error fetching Taalk transcript:', error);
    return null;
  }
}

// Fetch recording from Taalk API
export async function fetchTaalkRecording(taalkCallId: string): Promise<Blob | null> {
  const { taalkApiKey } = getCredentials();
  
  if (!taalkApiKey) {
    throw new Error('Taalk API key not configured');
  }

  try {
    const recordingUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/recording?db=michaelmandella`;
    const response = await fetch(recordingUrl, {
      headers: { 'Authorization': `Bearer ${taalkApiKey}` }
    });

    if (!response.ok) {
      return null;
    }

    return await response.blob();
  } catch (error) {
    console.error('Error fetching Taalk recording:', error);
    return null;
  }
}

// Store transfer in IndexedDB
export async function storeTransfer(transfer: any): Promise<void> {
  const database = await initDB();
  const transaction = database.transaction([STORES.TRANSFERS], 'readwrite');
  const store = transaction.objectStore(STORES.TRANSFERS);
  await store.put(transfer);
}

// Get transfers from IndexedDB
export async function getTransfers(filters?: {
  agentEmail?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<any[]> {
  const database = await initDB();
  const transaction = database.transaction([STORES.TRANSFERS], 'readonly');
  const store = transaction.objectStore(STORES.TRANSFERS);
  
  let index: IDBIndex;
  if (filters?.agentEmail) {
    index = store.index('agent_email');
    const request = index.getAll(filters.agentEmail);
    const transfers = await new Promise<any[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    
    // Filter by date if needed
    if (filters.startDate || filters.endDate) {
      return transfers.filter(t => {
        const date = new Date(t.transaction_date);
        if (filters.startDate && date < filters.startDate) return false;
        if (filters.endDate && date > filters.endDate) return false;
        return true;
      });
    }
    
    return transfers;
  }
  
  // Get all
  const request = store.getAll();
  const transfers = await new Promise<any[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  
  // Filter by date if needed
  if (filters?.startDate || filters?.endDate) {
    return transfers.filter(t => {
      const date = new Date(t.transaction_date);
      if (filters.startDate && date < filters.startDate) return false;
      if (filters.endDate && date > filters.endDate) return false;
      return true;
    });
  }
  
  return transfers;
}

// Store analytics in IndexedDB
export async function storeAnalytics(analytics: any): Promise<void> {
  const database = await initDB();
  const transaction = database.transaction([STORES.ANALYTICS], 'readwrite');
  const store = transaction.objectStore(STORES.ANALYTICS);
  await store.put(analytics);
}

// Get analytics from IndexedDB
export async function getAnalytics(billingTransactionId: string): Promise<any | null> {
  const database = await initDB();
  const transaction = database.transaction([STORES.ANALYTICS], 'readonly');
  const store = transaction.objectStore(STORES.ANALYTICS);
  const request = store.get(billingTransactionId);
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Store recording blob in IndexedDB
export async function storeRecording(callId: string, blob: Blob): Promise<void> {
  const database = await initDB();
  const transaction = database.transaction([STORES.RECORDINGS], 'readwrite');
  const store = transaction.objectStore(STORES.RECORDINGS);
  await store.put({ call_id: callId, blob, stored_at: new Date().toISOString() });
}

// Get recording from IndexedDB
export async function getRecording(callId: string): Promise<Blob | null> {
  const database = await initDB();
  const transaction = database.transaction([STORES.RECORDINGS], 'readonly');
  const store = transaction.objectStore(STORES.RECORDINGS);
  const request = store.get(callId);
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const result = request.result;
      resolve(result?.blob || null);
    };
    request.onerror = () => reject(request.error);
  });
}

// Store transcript in IndexedDB
export async function storeTranscript(callId: string, transcript: string): Promise<void> {
  const database = await initDB();
  const transaction = database.transaction([STORES.TRANSCRIPTS], 'readwrite');
  const store = transaction.objectStore(STORES.TRANSCRIPTS);
  await store.put({ call_id: callId, transcript, stored_at: new Date().toISOString() });
}

// Get transcript from IndexedDB
export async function getTranscript(callId: string): Promise<string | null> {
  const database = await initDB();
  const transaction = database.transaction([STORES.TRANSCRIPTS], 'readonly');
  const store = transaction.objectStore(STORES.TRANSCRIPTS);
  const request = store.get(callId);
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const result = request.result;
      resolve(result?.transcript || null);
    };
    request.onerror = () => reject(request.error);
  });
}

// Sync function: Fetch from APIs and store locally
export async function syncCallData(taalkCallIds: string[]): Promise<void> {
  console.log('🔄 Syncing call data from APIs...');
  
  // Fetch transcripts from Taalk
  for (const callId of taalkCallIds) {
    try {
      // Check if we already have it
      const existing = await getTranscript(callId);
      if (existing) {
        console.log(`✅ Transcript already cached for ${callId}`);
        continue;
      }
      
      const transcript = await fetchTaalkTranscript(callId);
      if (transcript) {
        await storeTranscript(callId, transcript);
        console.log(`✅ Stored transcript for ${callId}`);
      }
    } catch (error) {
      console.error(`❌ Error syncing transcript for ${callId}:`, error);
    }
  }
  
  console.log('✅ Sync complete');
}

// Clear all local data
export async function clearLocalData(): Promise<void> {
  const database = await initDB();
  const transaction = database.transaction([
    STORES.TRANSFERS,
    STORES.ANALYTICS,
    STORES.RECORDINGS,
    STORES.TRANSCRIPTS
  ], 'readwrite');
  
  await Promise.all([
    new Promise((resolve, reject) => {
      transaction.objectStore(STORES.TRANSFERS).clear().onsuccess = () => resolve(undefined);
      transaction.objectStore(STORES.TRANSFERS).clear().onerror = () => reject(transaction.error);
    }),
    new Promise((resolve, reject) => {
      transaction.objectStore(STORES.ANALYTICS).clear().onsuccess = () => resolve(undefined);
      transaction.objectStore(STORES.ANALYTICS).clear().onerror = () => reject(transaction.error);
    }),
    new Promise((resolve, reject) => {
      transaction.objectStore(STORES.RECORDINGS).clear().onsuccess = () => resolve(undefined);
      transaction.objectStore(STORES.RECORDINGS).clear().onerror = () => reject(transaction.error);
    }),
    new Promise((resolve, reject) => {
      transaction.objectStore(STORES.TRANSCRIPTS).clear().onsuccess = () => resolve(undefined);
      transaction.objectStore(STORES.TRANSCRIPTS).clear().onerror = () => reject(transaction.error);
    })
  ]);
  
  console.log('✅ Local data cleared');
}
