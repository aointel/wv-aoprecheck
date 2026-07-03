import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface HPProComponentProps {
  currentLead?: any;
}

export function HPProComponent({ currentLead }: HPProComponentProps) {
  const openHPPro = () => {
    // Open HP Pro in a new window/tab
    window.open('https://hp.aoglobelife.com/', '_blank');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/80">
        Open HP Pro to access lead management and quoting tools.
      </p>
      
      <Button 
        onClick={openHPPro}
        className="w-full bg-orange-600 hover:bg-orange-700"
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Open HP Pro
      </Button>
      
      {currentLead && (
        <div className="text-xs text-white/60 space-y-1">
          <p>Lead: {currentLead.name}</p>
          <p>Phone: {currentLead.phone}</p>
          <p>Market: {currentLead.market}</p>
        </div>
      )}
    </div>
  );
}