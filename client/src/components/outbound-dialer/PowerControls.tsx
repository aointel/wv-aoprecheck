import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MdPower, MdCheckCircle } from 'react-icons/md';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { segmentedFetch } from '@/lib/queryClient';

interface PowerControlsProps {
  onPowerStateChange: (isPowered: boolean, conferenceRoom?: string) => void;
  isPowered: boolean;
  conferenceRoom: string | null;
}

export default function PowerControls({
  onPowerStateChange,
  isPowered,
  conferenceRoom
}: PowerControlsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { authState } = useAuth();
  const { toast } = useToast();

  const handlePowerToggle = async () => {
    if (isPowered) {
      // Power off - just update state
      onPowerStateChange(false, null);
      toast({
        title: "Dialer Powered Off",
        description: "Ready to power on again"
      });
      return;
    }

    // Power on - create persistent conference
    setIsLoading(true);
    try {
      console.log('🔋 Powering on dialer for:', authState.user?.email);

      const response = await segmentedFetch('/api/outbound-dialer/power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          isActive: true,
          agentEmail: authState.user?.email 
        }),
      });

      const data = await response.json();
      console.log('📊 Power-on response:', data);

      if (data.success) {
        // Set the conference room to the persistent name
        const conferenceRoomName = `producer-${authState.user?.email?.split('@')[0]}-${Date.now()}`;
        onPowerStateChange(true, conferenceRoomName);

        console.log('✅ Dialer powered on and conference created');
        toast({
          title: "Dialer Powered On",
          description: "Conference Ready - Ready to start dialing"
        });
      } else {
        throw new Error(data.error || 'Failed to power on dialer');
      }
    } catch (error: any) {
      console.error('❌ Failed to power on dialer:', error);
      toast({
        title: "Power On Failed",
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MdPower className="w-5 h-5" />
          Dialer Power Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="font-medium">Status</p>
            <p className="text-sm text-muted-foreground">
              {isPowered ? 'Ready to dial' : 'Powered off'}
            </p>
          </div>
          
          <Button
            onClick={handlePowerToggle}
            disabled={isLoading}
            variant={isPowered ? "default" : "outline"}
            size="lg"
            className={isPowered ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {isLoading ? (
              "Powering On..."
            ) : isPowered ? (
              <>
                <MdCheckCircle className="mr-2 h-4 w-4" />
                Powered On
              </>
            ) : (
              <>
                <MdPower className="mr-2 h-4 w-4" />
                Power On
              </>
            )}
          </Button>
        </div>

        {isPowered && conferenceRoom && (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-500">
                Active
              </Badge>
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Conference: {conferenceRoom}
              </span>
            </div>
          </div>
        )}

        {!isPowered && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Click Power On to create conference and enable dialing
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}