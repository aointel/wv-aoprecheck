import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneCall, PhoneOff } from 'lucide-react';

export default function ConferenceTest() {
  const [conferenceStatus, setConferenceStatus] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);

  const checkConferenceStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/conference/keeper/status');
      const status = await response.json();
      setConferenceStatus(status);
    } catch (error) {
      console.error('Failed to check conference status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startConferenceKeeper = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/conference/keeper/start', { method: 'POST' });
      await checkConferenceStatus();
    } catch (error) {
      console.error('Failed to start conference keeper:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stopConferenceKeeper = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/conference/keeper/stop', { method: 'POST' });
      await checkConferenceStatus();
    } catch (error) {
      console.error('Failed to stop conference keeper:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Conference System Test</h1>
        <p className="text-muted-foreground">
          Test the auto-answer conference system for +16052500834
        </p>
      </div>

      <div className="grid gap-6">
        {/* Conference Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Live Conference Status
            </CardTitle>
            <CardDescription>
              Current status of the AO-Verification-Live conference room
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Conference Room:</span>
              <Badge variant="outline">AO-Verification-Live</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Auto-Answer Phone:</span>
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4" />
                <span className="font-mono">+16052500834</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span>Conference Keeper:</span>
              <Badge variant={conferenceStatus.active ? "default" : "secondary"}>
                {conferenceStatus.active ? "Active" : "Inactive"}
              </Badge>
            </div>

            {conferenceStatus.callSid && (
              <div className="flex items-center justify-between">
                <span>Background Call ID:</span>
                <span className="font-mono text-sm">{conferenceStatus.callSid}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={checkConferenceStatus} 
                variant="outline" 
                disabled={isLoading}
              >
                Check Status
              </Button>
              
              {!conferenceStatus.active && (
                <Button 
                  onClick={startConferenceKeeper} 
                  disabled={isLoading}
                >
                  Start Conference Keeper
                </Button>
              )}
              
              {conferenceStatus.active && (
                <Button 
                  onClick={stopConferenceKeeper} 
                  variant="destructive" 
                  disabled={isLoading}
                >
                  <PhoneOff className="w-4 h-4 mr-2" />
                  Stop Conference Keeper
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Testing Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <h3 className="font-semibold mb-2">✅ System Should Work Like This:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Call +16052500834 from any phone</li>
                  <li>Hear welcome message: "Welcome to AO Precheck verification system..."</li>
                  <li>Automatically join the "AO-Verification-Live" conference room</li>
                  <li>Stay connected with other callers in the same conference</li>
                  <li>Conference persists even when participants leave</li>
                </ol>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <h3 className="font-semibold mb-2">🎯 Expected Behavior:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>All calls to +16052500834 join the same persistent conference</li>
                  <li>Conference stays alive with multiple participants</li>
                  <li>No manual setup required - completely automatic</li>
                  <li>Background conference keeper maintains room persistence</li>
                </ul>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <h3 className="font-semibold mb-2">🔧 To Test:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Start the conference keeper above</li>
                  <li>Call +16052500834 from your phone</li>
                  <li>Verify you hear the welcome message and join the conference</li>
                  <li>Have someone else call the same number</li>
                  <li>Confirm both callers can hear each other in the conference</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}