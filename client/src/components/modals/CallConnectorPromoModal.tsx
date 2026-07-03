import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Phone, TrendingUp, MapPin, Activity, Zap, Video } from 'lucide-react';

interface CallConnectorPromoModalProps {
  userEmail: string;
}

export function CallConnectorPromoModal({ userEmail }: CallConnectorPromoModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!userEmail) return;

    const signedUpKey = 'call_connector_promo_signed_up';
    if (localStorage.getItem(signedUpKey) === 'true') return;

    const dismissKey = 'call_connector_promo_dismissed';
    const lastDismissed = localStorage.getItem(dismissKey);
    if (lastDismissed) {
      const hoursSince = (Date.now() - new Date(lastDismissed).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) return;
    }

    const timer = setTimeout(() => setIsOpen(true), 1000);
    return () => clearTimeout(timer);
  }, [userEmail]);

  const handleDismiss = () => {
    localStorage.setItem('call_connector_promo_dismissed', new Date().toISOString());
    setIsOpen(false);
  };

  const handleLearnMore = () => {
    fetch('/api/analytics/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'call_connector_promo_learn_more',
        userEmail: userEmail,
        timestamp: new Date().toISOString()
      })
    }).catch(e => console.error('Failed to track event:', e));
    
    // Navigate to Call Connector page or external link
    window.location.href = '/call-connector-pro';
  };
  
  const handleStartTrial = () => {
    // Mark as signed up - never show again
    localStorage.setItem('call_connector_promo_signed_up', 'true');
    
    // Track this event and notify team
    fetch('/api/analytics/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'call_connector_promo_apply',
        userEmail: userEmail,
        timestamp: new Date().toISOString()
      })
    }).catch(e => console.error('Failed to track event:', e));
    
    // Send notification to team
    fetch('/api/call-connector-pro/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: userEmail,
        timestamp: new Date().toISOString()
      })
    }).catch(e => console.error('Failed to send application:', e));
    
    setIsOpen(false);
    // Redirect to onboarding page
        // Signup removed - redirect to connect page instead
        window.location.href = '/dashboard/connect';
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl [&>button]:hidden">
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm hover:shadow-md hover:scale-110 bg-white dark:bg-gray-900"
          aria-label="Close"
          title="Close"
        >
          <X className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          <span className="sr-only">Close</span>
        </button>
        
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🚀 Get Call Connector Pro
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          {/* Hero Message */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
            <h3 className="text-xl font-semibold mb-2 text-blue-900 dark:text-blue-100">
              Replace your 3rd party dialer for half the cost and take Call Connector Pro for a spin!
            </h3>
            <p className="text-gray-700 dark:text-gray-300 font-semibold mb-3">
              From the team who brought you AO Intelligence.
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Leads will pre-load and you will be good to go in minutes.
            </p>
          </div>
          
          {/* Key Benefits */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-lg border">
              <Zap className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Power Dialer</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Click-to-dial with instant connection. No more waiting between calls.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-lg border">
              <MapPin className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Local Presence</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  50 state numbers - call from their area code for 2x pickup rates.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-lg border">
              <TrendingUp className="h-6 w-6 text-purple-500 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-sm mb-1">3x Productivity</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Producers using Call Connector average 250+ dials/day vs 80 manual.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-lg border">
              <Video className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-sm mb-1">AO Meet</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  The Zoom replacement - seamless video meetings built for producers.
                </p>
              </div>
            </div>
          </div>
          
          {/* CTAs */}
          <div className="flex gap-3 pt-2">
            <Button 
              onClick={handleStartTrial}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold h-12"
            >
              🚀 Let's go!
            </Button>
            <Button 
              onClick={handleDismiss}
              variant="outline"
              className="px-6"
            >
              Maybe Later
            </Button>
          </div>
          
          {/* Fine Print */}
          <p className="text-xs text-center text-gray-500">
            Unlimited dialing • 50 local numbers • Real-time tracking
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

