import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';

interface producerStat {
  email: string;
  name: string;
  dialed: number;
  reached: number;
  booked: number;
  source: string;
}

interface LeaderboardResponse {
  success: boolean;
  producers: producerStat[];
  timestamp: string;
}

export function LiveproducerTicker() {
  // Fetch Producer Leaderboard from /api/leaderboard
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['/api/leaderboard'],
    queryFn: async () => {
      const response = await fetch('/api/leaderboard');
      if (!response.ok) throw new Error('Failed to fetch Producer Leaderboard');
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds for live updates
  });
  
  const leaderboard = leaderboardData?.leaderboard || [];

  const calculateContactRate = (reached: number, dialed: number) => {
    if (dialed === 0) return 0;
    return Math.round((reached / dialed) * 100);
  };

  const calculateBookingRate = (booked: number, reached: number) => {
    if (reached === 0) return 0;
    return Math.round((booked / reached) * 100);
  };

  const getLeaderboardMessage = () => {
    if (isLoading || !leaderboard || leaderboard.length === 0) {
      return "Loading Producer Leaderboard...";
    }

    // Create scrolling message showing each producer's performance
    return leaderboard.map((producer: any) => {
      const contactRate = calculateContactRate(producer.reaches, producer.dials);
      const bookingRate = calculateBookingRate(producer.bookings, producer.reaches);
      
      const formatNumber = (num: number) => num === 0 ? 'Zero' : num.toString();
      
      return `${producer.agentName} • ${formatNumber(producer.dials)} dials • ${formatNumber(producer.reaches)} reached • ${formatNumber(producer.bookings)} booked • ${contactRate}% contact • ${bookingRate}% booking`;
    }).join(' • • • ');
  };

  return (
    <div className="relative overflow-hidden bg-black/90 rounded-lg border border-white/10 shadow-sm flex-1 mx-4">
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-blue-500/10 to-blue-600/10"></div>
      <div className="relative z-10 py-2 px-4">
        <div className="flex items-center gap-3 text-white">
          <div className="flex items-center gap-2 text-yellow-400 font-bold text-sm whitespace-nowrap flex-shrink-0">
            <TrendingUp className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
            <span>Live</span>
          </div>
          <div className="flex-1 overflow-hidden relative h-6">
            <div className="ticker-scroll absolute flex gap-16 whitespace-nowrap text-xs">
              <span className="text-green-400 font-semibold">{getLeaderboardMessage()}</span>
              <span className="text-green-400 font-semibold">{getLeaderboardMessage()}</span>
              <span className="text-green-400 font-semibold">{getLeaderboardMessage()}</span>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }
        .ticker-scroll {
          animation: ticker-scroll 180s linear infinite;
          display: inline-flex;
        }
        .ticker-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}