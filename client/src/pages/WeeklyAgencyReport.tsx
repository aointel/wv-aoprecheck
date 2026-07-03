import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, TrendingDown, Minus, Phone, CheckCircle, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface AgentWeeklyStats {
  id: string;
  name: string;
  email: string;
  weeklyStats: {
    dialed: number;
    reached: number;
    booked: number;
    presentations: number;
    sales: number;
    alp: number;
  };
  trend: 'up' | 'down' | 'stable';
  alpGoal: number; // $6,000 default
}

// Demo data - 10 agents
const DEMO_AGENTS: AgentWeeklyStats[] = [
  {
    id: '1',
    name: 'Chris LaFond',
    email: 'chrislafond@aoglobelife.com',
    weeklyStats: { dialed: 245, reached: 180, booked: 45, presentations: 38, sales: 12, alp: 7200 },
    trend: 'up',
    alpGoal: 6000
  },
  {
    id: '2',
    name: 'Tabitha McDermid',
    email: 'tabithamcdermid@aoglobelife.com',
    weeklyStats: { dialed: 198, reached: 142, booked: 32, presentations: 28, sales: 9, alp: 5400 },
    trend: 'up',
    alpGoal: 6000
  },
  {
    id: '3',
    name: 'Diana Blash',
    email: 'diankablash@aoglobelife.com',
    weeklyStats: { dialed: 178, reached: 125, booked: 28, presentations: 24, sales: 8, alp: 4800 },
    trend: 'stable',
    alpGoal: 6000
  },
  {
    id: '4',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@aoglobelife.com',
    weeklyStats: { dialed: 156, reached: 98, booked: 22, presentations: 19, sales: 6, alp: 3600 },
    trend: 'up',
    alpGoal: 6000
  },
  {
    id: '5',
    name: 'Michael Chen',
    email: 'michael.chen@aoglobelife.com',
    weeklyStats: { dialed: 142, reached: 89, booked: 18, presentations: 16, sales: 5, alp: 3000 },
    trend: 'down',
    alpGoal: 6000
  },
  {
    id: '6',
    name: 'Jessica Martinez',
    email: 'jessica.martinez@aoglobelife.com',
    weeklyStats: { dialed: 165, reached: 108, booked: 25, presentations: 21, sales: 7, alp: 4200 },
    trend: 'up',
    alpGoal: 6000
  },
  {
    id: '7',
    name: 'Robert Taylor',
    email: 'robert.taylor@aoglobelife.com',
    weeklyStats: { dialed: 134, reached: 82, booked: 16, presentations: 14, sales: 4, alp: 2400 },
    trend: 'stable',
    alpGoal: 6000
  },
  {
    id: '8',
    name: 'Emily Davis',
    email: 'emily.davis@aoglobelife.com',
    weeklyStats: { dialed: 189, reached: 134, booked: 30, presentations: 26, sales: 8, alp: 4800 },
    trend: 'up',
    alpGoal: 6000
  },
  {
    id: '9',
    name: 'David Wilson',
    email: 'david.wilson@aoglobelife.com',
    weeklyStats: { dialed: 123, reached: 76, booked: 14, presentations: 12, sales: 3, alp: 1800 },
    trend: 'down',
    alpGoal: 6000
  },
  {
    id: '10',
    name: 'Amanda Brown',
    email: 'amanda.brown@aoglobelife.com',
    weeklyStats: { dialed: 201, reached: 156, booked: 35, presentations: 30, sales: 10, alp: 6000 },
    trend: 'up',
    alpGoal: 6000
  }
];

export default function WeeklyAgencyReport() {
  const currentWeek = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  // Fetch REAL weekly WAR data for all agents
  const { data: warData, isLoading } = useQuery({
    queryKey: ['weekly-war-data'],
    queryFn: async () => {
      const response = await fetch('/api/war/weekly-agency-stats');
      const data = await response.json();
      return data.agents || [];
    },
    refetchInterval: 60000 // Refresh every minute
  });
  
  const agents = warData || DEMO_AGENTS; // Fallback to demo if no data
  
  // Calculate totals
  const totals = agents.reduce((acc: any, agent: any) => ({
    dialed: acc.dialed + (agent.weeklyStats?.dialed || 0),
    reached: acc.reached + (agent.weeklyStats?.reached || 0),
    booked: acc.booked + (agent.weeklyStats?.booked || 0),
    presentations: acc.presentations + (agent.weeklyStats?.presentations || 0),
    sales: acc.sales + (agent.weeklyStats?.sales || 0),
    alp: acc.alp + (agent.weeklyStats?.alp || 0)
  }), { dialed: 0, reached: 0, booked: 0, presentations: 0, sales: 0, alp: 0 });

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getALPProgress = (alp: number, goal: number) => {
    const percentage = Math.min((alp / goal) * 100, 100);
    const exceeded = alp > goal;
    return { percentage, exceeded };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-6">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  Weekly Agency Report
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Week ending {currentWeek} • {DEMO_AGENTS.length} Active Agents
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Agency Totals */}
        <Card className="mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-bold text-gray-900">AGENCY WEEKLY TOTALS</h2>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{totals.dialed}</div>
                <div className="text-xs text-gray-600">📞 Dialed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{totals.reached}</div>
                <div className="text-xs text-gray-600">✅ Reached</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{totals.booked}</div>
                <div className="text-xs text-gray-600">📅 Booked</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{totals.presentations}</div>
                <div className="text-xs text-gray-600">🎬 Presentations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{totals.sales}</div>
                <div className="text-xs text-gray-600">💰 Sales</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">${totals.alp.toLocaleString()}</div>
                <div className="text-xs text-gray-600">💎 ALP</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agent List */}
        <div className="space-y-4">
          {agents.map((agent: AgentWeeklyStats) => {
            const { percentage, exceeded } = getALPProgress(agent.weeklyStats.alp, agent.alpGoal);
            
            return (
              <Card key={agent.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    
                    {/* Agent Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                          {agent.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{agent.name}</h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{agent.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(agent.trend)}
                        <Badge variant={agent.trend === 'up' ? 'default' : agent.trend === 'down' ? 'destructive' : 'secondary'}>
                          {agent.trend === 'up' ? 'Improving' : agent.trend === 'down' ? 'Declining' : 'Stable'}
                        </Badge>
                      </div>
                    </div>

                    {/* ALP Progress Bar - AO Gradient */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          ALP Progress
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          ${agent.weeklyStats.alp.toLocaleString()} 
                          {exceeded && <span className="text-green-600 ml-1">({Math.round(percentage)}%)</span>}
                          {!exceeded && <span className="text-slate-600"> / ${agent.alpGoal.toLocaleString()}</span>}
                        </span>
                      </div>
                      <div className="relative w-full h-8 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                        {/* AO Gradient Progress Bar */}
                        <div 
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 transition-all duration-500 flex items-center justify-end pr-3"
                          style={{ width: `${percentage}%` }}
                        >
                          <span className="text-white font-bold text-sm drop-shadow-lg">
                            {Math.round(percentage)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-6 gap-4 pt-2 border-t">
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">{agent.weeklyStats.dialed}</div>
                        <div className="text-xs text-gray-600">Dialed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-600">{agent.weeklyStats.reached}</div>
                        <div className="text-xs text-gray-600">Reached</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-purple-600">{agent.weeklyStats.booked}</div>
                        <div className="text-xs text-gray-600">Booked</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-indigo-600">{agent.weeklyStats.presentations}</div>
                        <div className="text-xs text-gray-600">Presentations</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-600">{agent.weeklyStats.sales}</div>
                        <div className="text-xs text-gray-600">Sales</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-yellow-600">${(agent.weeklyStats.alp / 1000).toFixed(1)}k</div>
                        <div className="text-xs text-gray-600">ALP</div>
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

      </div>
    </div>
  );
}

