import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function VideoTestPage() {
  const [sessionId, setSessionId] = useState('lead-test123');
  const [isStarting, setIsStarting] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);

  const testStartMeeting = async () => {
    setIsStarting(true);
    try {
      console.log('[producer TEST] StartMeeting clicked for', sessionId);
      
      const response = await fetch('/api/video/admit', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ sessionId }),
        credentials: 'include'
      });
      
      console.log('[producer TEST] admit status', response.status);
      const result = await response.json().catch(()=>({}));
      console.log('[producer TEST] admit body', result);
      
      setLastResponse({
        status: response.status,
        ok: response.ok,
        body: result
      });
      
      if (response.ok) {
        console.log(`✅ Client admitted to session: ${sessionId}`);
        alert(`Success! Client admitted to session: ${sessionId}`);
      } else {
        console.error('❌ Failed to admit client', response.status, result);
        alert(`Failed: ${response.status} - ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.error('❌ Error starting meeting:', error);
      alert(`Error: ${error}`);
      setLastResponse({ error: error?.toString() });
    } finally {
      setIsStarting(false);
    }
  };

  const checkAccess = async () => {
    try {
      console.log('[producer TEST] Checking access for', sessionId);
      
      const response = await fetch(`/api/video/check-access?sessionId=${encodeURIComponent(sessionId)}`, { 
        credentials: "include" 
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[producer TEST] access check result:', result);
        alert(`Access check: ${JSON.stringify(result)}`);
        setLastResponse(result);
      }
    } catch (error) {
      console.error('❌ Error checking access:', error);
      alert(`Error: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 p-8">
      <div className="max-w-md mx-auto bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Video Meeting Test</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-green-200 mb-2">
              Session ID:
            </label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full p-3 rounded-lg bg-black bg-opacity-30 text-white border border-green-500"
              placeholder="lead-test123"
            />
          </div>

          <div className="space-y-3">
            <Button 
              onClick={testStartMeeting}
              disabled={isStarting}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isStarting ? 'Starting...' : 'Test Start Meeting (Admit Client)'}
            </Button>

            <Button 
              onClick={checkAccess}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Check Access Status
            </Button>
          </div>

          {lastResponse && (
            <div className="mt-6 p-4 bg-black bg-opacity-30 rounded-lg">
              <h3 className="text-green-200 font-medium mb-2">Last Response:</h3>
              <pre className="text-xs text-white overflow-auto">
                {JSON.stringify(lastResponse, null, 2)}
              </pre>
            </div>
          )}

          <div className="text-xs text-green-300 space-y-1">
            <p><strong>Test Instructions:</strong></p>
            <p>1. Click "Check Access Status" - should return admitted: false</p>
            <p>2. Click "Test Start Meeting" - should return ok: true</p>
            <p>3. Click "Check Access Status" again - should return admitted: true</p>
          </div>
        </div>
      </div>
    </div>
  );
}