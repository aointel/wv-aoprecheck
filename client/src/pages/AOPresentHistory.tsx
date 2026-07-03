import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar, 
  Phone, 
  MapPin, 
  User, 
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Award,
  FileText,
  Download
} from 'lucide-react';

type PresentationStage = 
  | 'appointment_scheduled'
  | 'introduction_sent'
  | 'presentation_started'
  | 'needs_analysis'
  | 'benefits_presented'
  | 'verification_started'
  | 'completed_sale'
  | 'completed_no_sale';

interface HistoricalPresentation {
  id: string;
  clientName: string;
  clientPhone: string;
  clientCity: string;
  clientState: string;
  market: string;
  completedDate: Date;
  stage: PresentationStage;
  presentationResult: 'sale' | 'no_sale' | 'follow_up';
  alp?: number;
  agentName: string;
  agentEmail: string;
  duration: number; // minutes
  screenshotCount: number;
}

// Demo historical data - Past 20 presentations
const DEMO_HISTORY: HistoricalPresentation[] = [
  {
    id: 'h1',
    clientName: 'James Wilson',
    clientPhone: '(555) 345-6789',
    clientCity: 'Grand Rapids',
    clientState: 'Michigan',
    market: 'Veterans',
    completedDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    stage: 'completed_sale',
    presentationResult: 'sale',
    alp: 2400,
    agentName: 'Tabitha McDermid',
    agentEmail: 'tabithamcdermid@aoglobelife.com',
    duration: 45,
    screenshotCount: 28
  },
  {
    id: 'h2',
    clientName: 'Susan Brown',
    clientPhone: '(555) 678-9012',
    clientCity: 'Flint',
    clientState: 'Michigan',
    market: 'Veterans',
    completedDate: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    stage: 'completed_no_sale',
    presentationResult: 'no_sale',
    agentName: 'Amanda Arrieta',
    agentEmail: 'amandaarrieta@aoglobelife.com',
    duration: 32,
    screenshotCount: 15
  },
  {
    id: 'h3',
    clientName: 'Michael Anderson',
    clientPhone: '(555) 789-0123',
    clientCity: 'Kalamazoo',
    clientState: 'Michigan',
    market: 'Veterans',
    completedDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    stage: 'completed_sale',
    presentationResult: 'sale',
    alp: 3200,
    agentName: 'Chris LaFond',
    agentEmail: 'chrislafond@aoglobelife.com',
    duration: 52,
    screenshotCount: 34
  },
  {
    id: 'h4',
    clientName: 'Linda Garcia',
    clientPhone: '(555) 890-1234',
    clientCity: 'Dearborn',
    clientState: 'Michigan',
    market: 'Veterans',
    completedDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    stage: 'completed_sale',
    presentationResult: 'sale',
    alp: 1800,
    agentName: 'Kristina Pleshakova',
    agentEmail: 'kristinapleshakova@aoglobelife.com',
    duration: 38,
    screenshotCount: 22
  },
  {
    id: 'h5',
    clientName: 'David Martinez',
    clientPhone: '(555) 901-2345',
    clientCity: 'Warren',
    clientState: 'Michigan',
    market: 'Veterans',
    completedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    stage: 'completed_no_sale',
    presentationResult: 'follow_up',
    agentName: 'Diana Blash',
    agentEmail: 'diankablash@aoglobelife.com',
    duration: 28,
    screenshotCount: 12
  },
  {
    id: 'h6',
    clientName: 'Jennifer Lee',
    clientPhone: '(555) 012-3456',
    clientCity: 'Sterling Heights',
    clientState: 'Michigan',
    market: 'Veterans',
    completedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    stage: 'completed_sale',
    presentationResult: 'sale',
    alp: 2800,
    agentName: 'Richard LaFond',
    agentEmail: 'richardlafond@aoglobelife.com',
    duration: 48,
    screenshotCount: 31
  }
];

const STAGE_INFO: Record<PresentationStage, { label: string; color: string; progress: number }> = {
  appointment_scheduled: { label: 'Appointment Scheduled', color: 'from-blue-500 to-cyan-500', progress: 15 },
  introduction_sent: { label: 'Introduction Sent', color: 'from-purple-500 to-blue-500', progress: 30 },
  presentation_started: { label: 'Presentation Started', color: 'from-indigo-500 to-purple-500', progress: 45 },
  needs_analysis: { label: 'Needs Analysis', color: 'from-pink-500 to-purple-500', progress: 60 },
  benefits_presented: { label: 'Benefits Presented', color: 'from-orange-500 to-pink-500', progress: 75 },
  verification_started: { label: 'Verification Started', color: 'from-yellow-500 to-orange-500', progress: 90 },
  completed_sale: { label: 'Sale Complete', color: 'from-green-500 to-emerald-500', progress: 100 },
  completed_no_sale: { label: 'No Sale', color: 'from-gray-400 to-gray-500', progress: 100 }
};

export default function AOPresentHistory() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = DEMO_HISTORY.filter(p => 
    p.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.clientPhone.includes(searchTerm) ||
    p.agentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTimeAgo = (date: Date) => {
    const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const totalSales = filteredHistory.filter(p => p.presentationResult === 'sale').length;
  const totalALP = filteredHistory
    .filter(p => p.presentationResult === 'sale')
    .reduce((sum, p) => sum + (p.alp || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="container mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-10 w-10 text-purple-600" />
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Presentation History
                </h1>
                <p className="text-slate-600">
                  Review past appointments and presentation results
                </p>
              </div>
            </div>
            
            {/* Stats Summary */}
            <div className="flex gap-4">
              <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-0">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{totalSales}</div>
                    <div className="text-xs text-slate-600">Sales</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-0">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">${(totalALP / 1000).toFixed(1)}k</div>
                    <div className="text-xs text-slate-600">Total ALP</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <Card className="mb-6 bg-white/80 backdrop-blur-sm shadow-lg border-0">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by client name, phone, or agent..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* History Grid - iOS Style Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHistory.map((presentation) => {
            const stageInfo = STAGE_INFO[presentation.stage];
            
            return (
              <Card 
                key={presentation.id} 
                className="overflow-hidden hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white/80 backdrop-blur-sm"
                style={{
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)'
                }}
              >
                {/* Progress Header with Gradient */}
                <div className={`h-2 bg-gradient-to-r ${stageInfo.color}`} />
                
                <CardContent className="p-6">
                  
                  {/* Client Info */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-bold text-slate-900">
                        {presentation.clientName}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {formatTimeAgo(presentation.completedDate)}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-blue-500" />
                        <span className="font-mono">{presentation.clientPhone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-green-500" />
                        <span>{presentation.clientCity}, {presentation.clientState}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-purple-500" />
                        <span className="font-semibold text-purple-700">{presentation.market}</span>
                      </div>
                    </div>
                  </div>

                  {/* Presentation Stats */}
                  <div className="mb-4 p-3 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-slate-500">Duration</div>
                        <div className="font-bold text-slate-900">{presentation.duration} min</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Screenshots</div>
                        <div className="font-bold text-slate-900">{presentation.screenshotCount}</div>
                      </div>
                    </div>
                  </div>

                  {/* Result Badge */}
                  <div className="mb-4">
                    {presentation.presentationResult === 'sale' && presentation.alp && (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                            <span className="font-bold text-green-700">Sale Complete</span>
                          </div>
                          <span className="text-2xl font-bold text-green-600">
                            ${presentation.alp.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-green-600 mt-1">ALP Commission</div>
                      </div>
                    )}
                    {presentation.presentationResult === 'no_sale' && (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-gray-300">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-slate-600" />
                          <span className="font-semibold text-slate-700">No Sale</span>
                        </div>
                      </div>
                    )}
                    {presentation.presentationResult === 'follow_up' && (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300">
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-orange-600" />
                          <span className="font-semibold text-orange-700">Follow Up Scheduled</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Agent Info */}
                  <div className="mb-4 pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <User className="w-3 h-3" />
                      <span>{presentation.agentName}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Review Slide Deck
                    </Button>
                    
                    {presentation.presentationResult === 'sale' && (
                      <Button
                        variant="outline"
                        className="w-full border-2 border-green-300 text-green-700 hover:bg-green-50 font-semibold"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Send Proposal
                      </Button>
                    )}
                  </div>

                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredHistory.length === 0 && (
          <Card className="p-12 text-center bg-white/80 backdrop-blur-sm shadow-lg">
            <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              No Presentations Found
            </h3>
            <p className="text-slate-500">
              Your presentation history will appear here
            </p>
          </Card>
        )}

      </div>
    </div>
  );
}

