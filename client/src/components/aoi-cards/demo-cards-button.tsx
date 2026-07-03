import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface DemoCardsButtonProps {
  agentEmail: string;
  onCardsAdded?: () => void;
}

export function DemoCardsButton({ agentEmail, onCardsAdded }: DemoCardsButtonProps) {
  const { toast } = useToast();

  const handleAddDemoCards = async () => {
    try {
      console.log('🎯 Adding 5 demo AOI cards...');
      
      const response = await fetch('/api/war/add-demo-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentEmail })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Demo Cards Added',
          description: `Added ${data.cards.length} demo AOI cards for testing`
        });
        
        // Trigger callback to refresh AOI cards
        onCardsAdded?.();
        
        // Dispatch event to trigger refetch in ConnectCardDeck
        window.dispatchEvent(new Event('demoCardsAdded'));
      } else {
        throw new Error(data.error || 'Failed to add demo cards');
      }
    } catch (error) {
      console.error('❌ Failed to add demo cards:', error);
      toast({
        title: 'Error',
        description: 'Failed to add demo cards',
        variant: 'destructive'
      });
    }
  };

  return (
    <Button
      onClick={handleAddDemoCards}
      variant="outline"
      className="bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-700"
    >
      + Add 5 Demo AOI Cards
    </Button>
  );
}