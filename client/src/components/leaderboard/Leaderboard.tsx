import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Phone, MessageCircle, Calendar, Presentation, DollarSign } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  agentName: string;
  email: string;
  dials: number;
  reaches: number;
  bookings: number;
  presentations: number;
  sales: number;
  points: number;
  reachRate: number;
  bookingRate: number;
  avgDuration: number;
}

interface RankHistory {
  [email: string]: {
    previousRank: number;
    currentRank: number;
    lastChecked: number;
  };
}

interface LeaderboardProps {
  compact?: boolean;
  showRankOnly?: boolean;
  userEmail?: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ 
  compact = false, 
  showRankOnly = false, 
  userEmail 
}) => {
  const [rankHistory, setRankHistory] = useState<RankHistory>({});

  const { data: response, isLoading } = useQuery({
    queryKey: ['/api/leaderboard'],
    queryFn: async () => {
      const res = await fetch('/api/leaderboard', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    },
    refetchInterval: 15000, // Real-time updates every 15 seconds
  });

  const leaderboard: LeaderboardEntry[] = response?.leaderboard || [];
  
  // Find current user's rank
  const userRank = userEmail ? leaderboard.find(entry => entry.email === userEmail)?.rank : null;

  // Track rank changes every 15 minutes
  useEffect(() => {
    if (leaderboard.length === 0) return;

    const checkRankChanges = () => {
      const now = Date.now();
      const newHistory: RankHistory = { ...rankHistory };
      
      leaderboard.forEach(producer => {
        const existing = rankHistory[producer.email];
        
        if (existing) {
          // Check if 15 minutes have passed
          if (now - existing.lastChecked >= 15 * 60 * 1000) {
            // Update rank history
            newHistory[producer.email] = {
              previousRank: existing.currentRank,
              currentRank: producer.rank,
              lastChecked: now
            };
          } else {
            // Keep existing, but update current rank
            newHistory[producer.email] = {
              ...existing,
              currentRank: producer.rank
            };
          }
        } else {
          // First time seeing this producer
          newHistory[producer.email] = {
            previousRank: producer.rank,
            currentRank: producer.rank,
            lastChecked: now
          };
        }
      });
      
      setRankHistory(newHistory);
    };

    checkRankChanges();
  }, [leaderboard]);

  // Get 4-letter stock ticker: First 2 letters of first name + first 2 of last name
  // Example: DIANKA BLASH → DIBL, CHRIS LAFOND → CHLA, LEYNA TRAN → LYNA
  const getproducerTicker = (name: string): string => {
    // Special case for Leyna Tran
    if (name.trim().toUpperCase() === 'LEYNA TRAN') {
      return 'LYNA';
    }
    
    // Remove suffixes
    const suffixes = ['jr', 'sr', 'iii', 'ii', 'iv', 'v', 'jr.', 'sr.'];
    let cleanName = name.trim();
    suffixes.forEach(suffix => {
      const regex = new RegExp(`\\s+${suffix}\\s*$`, 'i');
      cleanName = cleanName.replace(regex, '');
    });
    
    const parts = cleanName.split(' ').filter(p => p.length > 0);
    
    if (parts.length === 0) return 'UNKN';
    
    // Get first name (first 2 letters)
    const firstName = parts[0].toUpperCase();
    const firstPart = firstName.substring(0, 2).padEnd(2, 'X');
    
    // Get last name (first 2 letters)
    if (parts.length === 1) {
      // Only one name - use first 2 + last 2
      return (firstName.substring(0, 2) + firstName.substring(Math.max(0, firstName.length - 2))).padEnd(4, 'X').substring(0, 4);
    }
    
    const lastName = parts[parts.length - 1].toUpperCase();
    const lastPart = lastName.substring(0, 2).padEnd(2, 'X');
    
    return (firstPart + lastPart).substring(0, 4);
  };

  // Get rank trend indicator
  const getRankTrend = (email: string) => {
    const history = rankHistory[email];
    if (!history) return <Minus className="h-3 w-3 text-gray-400" title="No change" />;
    
    const rankDiff = history.previousRank - history.currentRank; // Positive means moved up
    
    if (rankDiff > 0) {
      return (
        <div className="flex items-center gap-1 text-green-600" title={`↑ ${rankDiff} ${rankDiff === 1 ? 'spot' : 'spots'}`}>
          <TrendingUp className="h-3 w-3" />
          <span className="text-xs font-bold">+{rankDiff}</span>
        </div>
      );
    } else if (rankDiff < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600" title={`↓ ${Math.abs(rankDiff)} ${Math.abs(rankDiff) === 1 ? 'spot' : 'spots'}`}>
          <TrendingDown className="h-3 w-3" />
          <span className="text-xs font-bold">{rankDiff}</span>
        </div>
      );
    }
    
    return <Minus className="h-3 w-3 text-gray-400" title="No change" />;
  };

  if (isLoading) {
    return (
      <div className="bg-white text-slate-900 font-mono p-8 rounded border border-slate-200">
        <div className="text-center text-slate-500">Loading leaderboard...</div>
      </div>
    );
  }

  if (showRankOnly && userRank) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-primary font-bold">#{userRank}</span>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  return (
    <div className="relative bg-white text-slate-900 font-mono text-sm shadow-lg rounded-lg overflow-hidden">
      {/* Gradient Border */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-[2px]">
        <div className="bg-white h-full w-full rounded-lg" />
      </div>
      
      {/* Content */}
      <div className="relative">
        {/* Header */}
        <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-primary tracking-wider">DAILY LEADERBOARD</h2>
            <p className="text-xs text-slate-500 mt-1">{today}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Live</div>
            <div className="text-sm font-mono text-green-600">● ACTIVE</div>
          </div>
        </div>
      </div>

      {/* Column Headers - Icons Only */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 text-xs">
        <div className="grid grid-cols-7 gap-1 items-center">
          <div className="text-primary font-bold text-xs">RNK</div>
          <div className="text-primary font-bold text-xs">TICK</div>
          <div className="text-primary font-bold text-center" title="Dials">
            <Phone className="h-3 w-3 mx-auto" />
          </div>
          <div className="text-primary font-bold text-center" title="Reaches">
            <MessageCircle className="h-3 w-3 mx-auto" />
          </div>
          <div className="text-primary font-bold text-center" title="Bookings">
            <Calendar className="h-3 w-3 mx-auto" />
          </div>
          <div className="text-primary font-bold text-center text-xs">TRD</div>
          <div className="text-primary font-bold text-right text-xs">PTS</div>
        </div>
      </div>

      {/* Leaderboard Entries */}
      <div className="max-h-96 overflow-y-auto">
        {leaderboard.slice(0, compact ? 10 : 50).map((entry, index) => {
          const isCurrentUser = userEmail === entry.email;
          const isTopThree = index < 3;
          const ticker = getproducerTicker(entry.agentName);
          const rankColor = index === 0 ? 'text-yellow-600' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-orange-600' : 'text-slate-600';
          
          return (
            <div 
              key={entry.email}
              className={`border-b border-slate-200 px-3 py-1.5 hover:bg-blue-50 transition-colors ${
                isCurrentUser ? 'bg-purple-50 border-primary' : ''
              } ${isTopThree ? 'bg-slate-50' : ''}`}
            >
              <div className="grid grid-cols-7 gap-1 items-center">
                {/* Rank */}
                <div className={`font-bold text-sm ${rankColor}`}>
                  #{entry.rank}
                </div>

                {/* Ticker ONLY - NO FULL NAME */}
                <div className="text-base font-bold font-mono tracking-wider text-slate-900" title={entry.agentName}>
                  {ticker}
                </div>

                {/* Dials */}
                <div className="text-center font-bold text-sm text-blue-600">
                  {entry.dials}
                </div>

                {/* Reaches */}
                <div className="text-center font-bold text-sm text-green-600">
                  {entry.reaches}
                </div>

                {/* Bookings */}
                <div className="text-center font-bold text-sm text-purple-600">
                  {entry.bookings}
                </div>

                {/* Trend */}
                <div className="text-center flex justify-center">
                  {getRankTrend(entry.email)}
                </div>

                {/* Points */}
                <div className="text-right font-bold text-sm text-primary font-mono">
                  {typeof entry.points === 'number' ? entry.points.toLocaleString() : (entry.points || 0).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
        
        {leaderboard.length === 0 && (
          <div className="px-4 py-12 text-center text-gray-500">
            No producers found
          </div>
        )}
      </div>

        {/* Footer */}
        {!compact && (
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Scoring: Book 50 • Reach 25 • Dial 1</span>
              <span>Updates every 15s</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
