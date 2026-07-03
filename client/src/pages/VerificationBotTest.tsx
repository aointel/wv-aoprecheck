import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Video, Bot, CheckCircle, XCircle } from 'lucide-react';

interface BotResponse {
  success: boolean;
  botCallSid?: string;
  conferenceName?: string;
  roomName?: string;
  botType?: string;
  verificationType?: string;
  accessToken?: string;
  identity?: string;
  message?: string;
}

export default function VerificationBotTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Voice Conference Bot Test
  const [conferenceName, setConferenceName] = useState('test-conference-' + Date.now());
  const [leadPhone, setLeadPhone] = useState('+15551234567');
  const [agentEmail, setAgentEmail] = useState('');
  
  // Video Room Bot Test
  const [roomName, setRoomName] = useState('video-room-' + Date.now());
  const [botIdentity, setBotIdentity] = useState('verification-bot-' + Date.now());

  const addVoiceBot = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/twilio/add-verification-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conferenceName,
          leadPhone,
          agentEmail,
          verificationType: 'voice'
        })
      });
      
      const data = await response.json();
      setResult(data);
      
      if (!data.success) {
        setError(data.error || 'Failed to add voice bot');
      }
    } catch (err) {
      setError('Network error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const addVideoBot = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/twilio/add-video-verification-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          leadPhone,
          agentEmail,
          verificationType: 'compliance',
          botType: 'voice-only'
        })
      });
      
      const data = await response.json();
      setResult(data);
      
      if (!data.success) {
        setError(data.error || 'Failed to add video bot');
      }
    } catch (err) {
      setError('Network error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const generateVideoToken = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/twilio/generate-video-bot-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          botIdentity
        })
      });
      
      const data = await response.json();
      setResult(data);
      
      if (!data.success) {
        setError(data.error || 'Failed to generate video token');
      }
    } catch (err) {
      setError('Network error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const removeBot = async () => {
    if (!result?.botCallSid) {
      setError('No bot call SID available to remove');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/twilio/remove-verification-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botCallSid: result.botCallSid
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setResult(null);
        setError(null);
      } else {
        setError(data.error || 'Failed to remove bot');
      }
    } catch (err) {
      setError('Network error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">🤖 Verification Bot Test</h1>
        <p className="text-muted-foreground">
          Test adding verification bots to Twilio voice conferences and video rooms
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Voice Conference Bot */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Voice Conference Bot
            </CardTitle>
            <CardDescription>
              Add a verification bot to an existing voice conference call
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Conference Name</label>
              <Input
                value={conferenceName}
                onChange={(e) => setConferenceName(e.target.value)}
                placeholder="test-conference-123"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Lead Phone</label>
              <Input
                value={leadPhone}
                onChange={(e) => setLeadPhone(e.target.value)}
                placeholder="+15551234567"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Producer Email</label>
              <Input
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
                placeholder="producer@example.com"
              />
            </div>
            <Button onClick={addVoiceBot} disabled={loading} className="w-full">
              <Bot className="h-4 w-4 mr-2" />
              Add Voice Bot to Conference
            </Button>
          </CardContent>
        </Card>

        {/* Video Room Bot */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Video Room Bot
            </CardTitle>
            <CardDescription>
              Add a verification bot to a video room or generate access token
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Room Name</label>
              <Input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="video-room-123"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Bot Identity</label>
              <Input
                value={botIdentity}
                onChange={(e) => setBotIdentity(e.target.value)}
                placeholder="verification-bot-001"
              />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Button onClick={addVideoBot} disabled={loading} variant="outline">
                <Bot className="h-4 w-4 mr-2" />
                Add Voice-Only Bot
              </Button>
              <Button onClick={generateVideoToken} disabled={loading}>
                <Video className="h-4 w-4 mr-2" />
                Generate Video Token
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {(result || error) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result?.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 font-medium">Error:</p>
                <p className="text-red-600">{error}</p>
              </div>
            )}
            
            {result && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant={result.success ? "default" : "destructive"}>
                    {result.success ? "Success" : "Failed"}
                  </Badge>
                  {result.botType && (
                    <Badge variant="outline">{result.botType}</Badge>
                  )}
                  {result.verificationType && (
                    <Badge variant="outline">{result.verificationType}</Badge>
                  )}
                </div>
                
                {result.message && (
                  <p className="text-sm text-muted-foreground">{result.message}</p>
                )}
                
                <div className="bg-gray-50 border rounded-lg p-4">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
                
                {result.botCallSid && (
                  <Button onClick={removeBot} variant="destructive" disabled={loading}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Remove Bot
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Information */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium">Voice Conference Bot:</h4>
            <p className="text-muted-foreground">
              Creates a new Twilio call that joins the specified conference as a muted participant. 
              The bot announces itself and can record the conversation for verification purposes.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium">Video Room Voice Bot:</h4>
            <p className="text-muted-foreground">
              Creates a voice call that bridges audio into the video room. Participants in the video room 
              will hear the bot's announcement and the bot can monitor audio.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium">Video Access Token:</h4>
            <p className="text-muted-foreground">
              Generates a Twilio Video access token that allows a programmatic participant to join 
              the video room. This can be used for silent monitoring or automated responses.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}