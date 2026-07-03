import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle, Clock, User, Phone, MapPin, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface ClientData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  state?: string;
  leadType?: string;
}

interface PresentationPhase {
  phase: 'intro' | 'no-cost' | 'plus-collection' | 'needs-analysis' | 'benefit-summary' | 'complete' | 'verification' | 'unknown';
  timestamp: string;
  confidence?: number;
}

interface Presentation {
  id: string;
  session_id: string;
  agent_email: string;
  started_at: string;
  ended_at?: string;
  status: 'active' | 'completed' | 'abandoned';
  client_data: ClientData;
  current_phase: PresentationPhase;
  screenshot_count: number;
  duration_seconds?: number;
  video_url?: string;
}

const PHASE_LABELS = {
  intro: 'Introduction',
  'no-cost': 'No-Cost Benefits',
  'plus-collection': 'Plus Collection',
  'needs-analysis': 'Needs Analysis',
  'benefit-summary': 'Benefit Summary',
  complete: 'Complete',
  verification: 'Verification',
  unknown: 'In Progress'
};

const PHASE_COLORS = {
  intro: 'bg-blue-500',
  'no-cost': 'bg-purple-500',
  'plus-collection': 'bg-pink-500',
  'needs-analysis': 'bg-yellow-500',
  'benefit-summary': 'bg-green-500',
  complete: 'bg-teal-500',
  verification: 'bg-indigo-500',
  unknown: 'bg-gray-500'
};

export default function producerPresentations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activePresentations, setActivePresentations] = useState<Presentation[]>([]);
  const [recentPresentations, setRecentPresentations] = useState<Presentation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch presentations
  const fetchPresentations = async () => {
    if (!user?.email) return;

    try {
      console.log('📥 Fetching presentations for:', user.email);
      const response = await fetch(`/api/presentations/agent/${encodeURIComponent(user.email)}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to fetch presentations:', response.status, errorText);
        throw new Error('Failed to fetch presentations');
      }

      const data = await response.json();
      console.log('✅ Presentations data:', data);
      
      setActivePresentations(data.active || []);
      setRecentPresentations(data.recent || []);
    } catch (error) {
      console.error('❌ Error fetching presentations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load presentations',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPresentations();
    
    // Refresh every 5 seconds for real-time updates
    const interval = setInterval(fetchPresentations, 5000);
    return () => clearInterval(interval);
  }, [user?.email]);

  const handleStartVerification = (presentation: Presentation) => {
    // Store presentation data in sessionStorage for AOPrecheck to use
    sessionStorage.setItem('precheck_prefill', JSON.stringify({
      firstName: presentation.client_data.firstName,
      lastName: presentation.client_data.lastName,
      phone: presentation.client_data.phone,
      city: presentation.client_data.city,
      state: presentation.client_data.state,
      presentationId: presentation.session_id
    }));
    
    // Navigate to AOPrecheck page
    setLocation('/dashboard/ao-precheck');
    
    toast({
      title: 'Starting Verification',
      description: 'Opening AOI Precheck with client information'
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Just started';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const PresentationCard = ({ presentation, isActive }: { presentation: Presentation; isActive: boolean }) => {
    const phase = presentation.current_phase?.phase || 'unknown';
    const clientData = presentation.client_data || {};
    const clientName = [clientData.firstName, clientData.lastName].filter(Boolean).join(' ') || 'Unknown Client';
    const location = [clientData.city, clientData.state].filter(Boolean).join(', ') || 'Unknown Location';

    return (
      <Card className="relative overflow-hidden">
        {isActive && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 animate-pulse" />
        )}
        
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-blue-500" />
                {clientName}
                {isActive && (
                  <Badge variant="destructive" className="animate-pulse">
                    LIVE
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                {formatTime(presentation.started_at)}
                {isActive && presentation.duration_seconds && (
                  <span className="text-blue-600 font-medium">
                    • {formatDuration(presentation.duration_seconds)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Client Information */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-gray-500" />
              <span className="text-gray-700">
                {clientData.phone || 'No phone'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="text-gray-700">{location}</span>
            </div>
            {clientData.leadType && (
              <div className="flex items-center gap-2 text-sm col-span-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <Badge variant="outline">{clientData.leadType}</Badge>
              </div>
            )}
          </div>

          {/* Current Phase */}
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${PHASE_COLORS[phase]} ${isActive ? 'animate-pulse' : ''}`} />
                <span className="text-sm font-medium text-gray-700">
                  {PHASE_LABELS[phase]}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {presentation.screenshot_count} screenshots
              </div>
            </div>

            {/* Phase Progress Bar */}
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Intro</span>
                <span>Benefits</span>
                <span>Analysis</span>
                <span>Summary</span>
                <span>Complete</span>
              </div>
              <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full ${PHASE_COLORS[phase]} transition-all duration-500`}
                  style={{
                    width: `${getPhaseProgress(phase)}%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-3 border-t">
            {phase === 'complete' || phase === 'benefit-summary' ? (
              <Button 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                onClick={() => handleStartVerification(presentation)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Start AOI Precheck Verification
              </Button>
            ) : isActive ? (
              <Button 
                variant="outline" 
                className="w-full"
                disabled
              >
                <Play className="h-4 w-4 mr-2" />
                Presentation In Progress...
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleStartVerification(presentation)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Verify Client
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const getPhaseProgress = (phase: string): number => {
    const progressMap: Record<string, number> = {
      intro: 10,
      'no-cost': 30,
      'plus-collection': 50,
      'needs-analysis': 70,
      'benefit-summary': 90,
      complete: 100,
      verification: 100,
      unknown: 5
    };
    return progressMap[phase] || 5;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading presentations...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            My Presentations
          </h1>
          <p className="text-blue-200">
            Monitor your HPPRO presentations in real-time and start verifications
          </p>
        </div>

        {/* Active Presentations */}
        {activePresentations.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <h2 className="text-2xl font-bold text-white">
                Active Now ({activePresentations.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activePresentations.map((presentation) => (
                <PresentationCard 
                  key={presentation.id} 
                  presentation={presentation} 
                  isActive={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recent Presentations */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Recent Presentations ({recentPresentations.length})
          </h2>
          {recentPresentations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentPresentations.map((presentation) => (
                <PresentationCard 
                  key={presentation.id} 
                  presentation={presentation} 
                  isActive={false}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No recent presentations. Start a presentation in HPPRO to see it here!
              </CardContent>
            </Card>
          )}
        </div>

        {/* No presentations at all */}
        {activePresentations.length === 0 && recentPresentations.length === 0 && (
          <Card className="mt-8">
            <CardContent className="py-16 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No Presentations Yet
              </h3>
              <p className="text-gray-500">
                Open HPPRO and start a presentation to see it tracked here in real-time!
              </p>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
}

