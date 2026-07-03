/**
 * RecruitInboundPanel — replaces Taalk VDP on /ao-recruit.
 * Uses Twilio WebRTC (same as /connect) for inbound recruit calls.
 * Hardcodes market=aorecruit in TaskRouter when agent goes online here.
 * Shows AI summary from recruit_candidates when call connects.
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MdPhone,
  MdPerson,
  MdLocationOn,
  MdWork,
  MdStar,
  MdCheckCircle,
  MdSchedule,
} from 'react-icons/md';

interface TaalkSummaryItem {
  key: string;
  value: string;
}

interface RecruitInboundPanelProps {
  userEmail: string;
}

function formatPhone(p?: string): string {
  if (!p) return '';
  const d = p.replace(/\D/g, '').replace(/^1/, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}

function parseSummary(raw: string | object | null): TaalkSummaryItem[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(arr)) return arr;
    return [];
  } catch { return []; }
}

function SummaryCard({ summary }: { summary: TaalkSummaryItem[] }) {
  if (!summary.length) return null;

  const getIcon = (key: string) => {
    const k = key.toLowerCase();
    if (k.includes('recap') || k.includes('summary')) return '📋';
    if (k.includes('next step')) return '➡️';
    if (k.includes('background') || k.includes('goal')) return '👤';
    if (k.includes('screening') || k.includes('status')) return '✅';
    if (k.includes('sentiment') || k.includes('rate')) return '⭐';
    if (k.includes('refuse') || k.includes('reject')) return '🚫';
    if (k.includes('ready') || k.includes('connect')) return '🤝';
    if (k.includes('interested') || k.includes('earning')) return '💰';
    if (k.includes('flexibility') || k.includes('home')) return '🏠';
    return '📌';
  };

  return (
    <Card className="border border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
          🤖 AI Interview Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary.map((item, i) => (
          <div key={i} className="text-xs">
            <div className="flex items-start gap-1.5">
              <span className="text-sm shrink-0">{getIcon(item.key)}</span>
              <div>
                <span className="font-semibold text-purple-800 dark:text-purple-200">{item.key}</span>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">{item.value}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function RecruitInboundPanel({ userEmail }: RecruitInboundPanelProps) {
  const [isOnline, setIsOnline] = useState(false);
  const [activeSummary, setActiveSummary] = useState<TaalkSummaryItem[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<any>(null);
  const queryClient = useQueryClient();

  // When going online, set TaskRouter market to aorecruit
  const handleToggle = async (online: boolean) => {
    setIsOnline(online);
    try {
      if (online) {
        await fetch('/api/agents/voice-online', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail },
          credentials: 'include',
          body: JSON.stringify({ email: userEmail, market: 'aorecruit' }),
        });
      } else {
        await fetch('/api/agents/voice-offline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail },
          credentials: 'include',
          body: JSON.stringify({ email: userEmail }),
        });
        setActiveSummary([]);
        setActiveCandidate(null);
      }
    } catch {}
  };

  // Heartbeat
  useEffect(() => {
    if (!isOnline || !userEmail) return;
    const send = async () => {
      try {
        await fetch('/api/vdp/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail },
          credentials: 'include',
          body: JSON.stringify({ email: userEmail }),
        });
        await fetch('/api/ao-recruit/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail },
          credentials: 'include',
          body: JSON.stringify({ email: userEmail }),
        });
      } catch {}
    };
    send();
    const interval = setInterval(send, 30000);
    return () => clearInterval(interval);
  }, [isOnline, userEmail]);

  // Poll for active recruit calls and get candidate summary
  const { data: pendingData } = useQuery({
    queryKey: ['/api/twilio/taskrouter/pending', userEmail],
    queryFn: async () => {
      const pendingUrl = `/api/twilio/taskrouter/pending?agentEmail=${encodeURIComponent(userEmail)}`;
      const res = await fetch(pendingUrl, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isOnline && !!userEmail,
    refetchInterval: 3000,
  });

  // Credits — use main app credits API
  const { data: creditData } = useQuery({
    queryKey: ['/api/user/credits', userEmail],
    queryFn: async () => {
      const url = `/api/user/credits?email=${encodeURIComponent(userEmail)}`;
      const res = await fetch(url, { credentials: 'include', headers: { 'x-user-email': userEmail } });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!userEmail,
  });

  const creditsRemaining = (creditData as any)?.credits_remaining ?? (creditData as any)?.creditsRemaining ?? '—';

  // Recent recruit connections
  const { data: recentConnections } = useQuery({
    queryKey: ['/api/dashboard/recent-calls', 'recruit', userEmail],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/recent-calls?range=today&type=recruit`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent font-bold">
              Recruit Inbound
            </CardTitle>
            <Badge
              variant={isOnline ? 'default' : 'secondary'}
              className={isOnline ? 'bg-green-500 text-white' : ''}
            >
              {isOnline ? '🟢 Online' : '⚫ Offline'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Accept Recruit Calls</span>
            <Switch checked={isOnline} onCheckedChange={handleToggle} />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Credits</span>
            <span className="font-bold text-lg">${creditsRemaining}</span>
          </div>

          <div className="text-center py-2">
            {isOnline ? (
              activeCandidate ? (
                <div className="text-sm text-green-600 font-medium animate-pulse">
                  📞 Recruit interview in progress...
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Waiting for recruit transfers...
                </div>
              )
            ) : (
              <div className="text-sm text-muted-foreground">
                Go online to receive recruit candidates
              </div>
            )}
          </div>

          {isOnline && (
            <div className="text-center">
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                Market: AO Recruit
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {activeSummary.length > 0 && <SummaryCard summary={activeSummary} />}

      {activeCandidate && (
        <Card className="border-2 border-green-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-600 flex items-center gap-2">
              <MdPerson className="w-4 h-4" />
              Active Candidate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {activeCandidate.name && (
              <div className="font-bold text-lg">{activeCandidate.name}</div>
            )}
            {activeCandidate.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MdPhone className="w-4 h-4" />
                {formatPhone(activeCandidate.phone)}
              </div>
            )}
            {activeCandidate.state && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MdLocationOn className="w-4 h-4" />
                {activeCandidate.city ? `${activeCandidate.city}, ${activeCandidate.state}` : activeCandidate.state}
              </div>
            )}
            <Badge className="bg-green-100 text-green-700 border-green-300">
              RECRUIT
            </Badge>
          </CardContent>
        </Card>
      )}

      {pendingData?.tasks && pendingData.tasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-600">
              ⏳ {pendingData.tasks.length} in queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingData.tasks.slice(0, 3).map((task: any) => (
              <div key={task.taskSid} className="flex items-center justify-between py-1 text-xs">
                <span>{task.market || '—'}</span>
                <span>{task.state || '—'}</span>
                <Badge variant="outline" className="text-[10px]">{task.waitSeconds}s</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {Array.isArray(recentConnections) && recentConnections.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Today's Recruit Connections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentConnections.slice(0, 8).map((call: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs border-b border-gray-100 pb-1">
                <span className="font-medium truncate max-w-[120px]">{call.notes || call.phoneNumber || '—'}</span>
                <span className="text-muted-foreground">{call.state || '—'}</span>
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-green-100 text-green-700"
                >
                  {call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : '—'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
