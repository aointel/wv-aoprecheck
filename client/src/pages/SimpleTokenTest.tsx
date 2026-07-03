import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SimpleTokenTest() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testToken = async () => {
    setLoading(true);
    setResult('Testing...');
    
    try {
      // Direct fetch test
      const response = await fetch('/api/video/token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          identity: 'TestUser',
          room: 'test-room' 
        })
      });
      
      const responseText = await response.text();
      
      if (response.ok) {
        const data = JSON.parse(responseText);
        setResult(`SUCCESS!\n\nStatus: ${response.status}\nToken: ${data.token.substring(0, 50)}...\nIdentity: ${data.identity}\nRoom: ${data.room}`);
      } else {
        setResult(`FAILED!\n\nStatus: ${response.status}\nError: ${responseText}`);
      }
      
    } catch (error) {
      setResult(`ERROR!\n\n${error}`);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Simple Token Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={testToken} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Testing...' : 'Test Token Request'}
            </Button>
            
            <Card>
              <CardContent className="pt-6">
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded min-h-[200px]">
                  {result || 'Click button to test token request'}
                </pre>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}