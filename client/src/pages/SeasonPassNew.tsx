import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  MdStar, 
  MdDiamond, 
  MdWorkspacePremium, 
  MdEmojiEvents, 
  MdSdCard,
  MdPayment,
  MdLocalOffer
} from 'react-icons/md';

// Current Season Configuration
const CURRENT_SEASON = {
  name: "Season 1: Season of Achievement",
  quarter: "Q1",
  year: 2025,
  startDate: new Date(2025, 0, 1), // January 1, 2025
  endDate: new Date(2025, 2, 31), // March 31, 2025
  maxRank: 20,
  rankXP: 100000 // XP needed per rank
};

// Progressive 1-20 Rank System with Visual Tiers
const getProgressiveRankStyle = (rank: number) => {
  if (rank <= 5) {
    // Novice Tier (1-5) - Basic gray
    return {
      outerRing: 'from-gray-600 to-gray-700',
      innerCircle: 'from-gray-700 to-gray-800',
      progressColor: '#9CA3AF',
      glowEffect: '',
      animation: ''
    };
  } else if (rank <= 10) {
    // Warrior Tier (6-10) - Amber/bronze
    return {
      outerRing: 'from-amber-600 to-orange-700',
      innerCircle: 'from-amber-700 to-orange-800',
      progressColor: '#F59E0B',
      glowEffect: 'shadow-lg shadow-amber-500/30',
      animation: ''
    };
  } else if (rank <= 15) {
    // Elite Tier (11-15) - Blue/purple with pulse
    return {
      outerRing: 'from-blue-600 to-purple-700',
      innerCircle: 'from-blue-700 to-purple-800',
      progressColor: '#3B82F6',
      glowEffect: 'shadow-xl shadow-blue-500/40',
      animation: 'animate-pulse'
    };
  } else {
    // Legendary Tier (16-20) - Gold/red NO BOUNCING
    return {
      outerRing: 'from-yellow-500 to-red-600',
      innerCircle: 'from-yellow-600 to-red-700',
      progressColor: '#EAB308',
      glowEffect: 'shadow-2xl shadow-yellow-500/50',
      animation: '' // NO animate-bounce per user request
    };
  }
};

const getTierForRank = (rank: number) => {
  if (rank <= 5) return { name: 'Novice Guardian', color: '#9CA3AF' };
  if (rank <= 10) return { name: 'Warrior Elite', color: '#F59E0B' };
  if (rank <= 15) return { name: 'Elite Champion', color: '#3B82F6' };
  return { name: 'Legendary Master', color: '#EAB308' };
};

// Season Pass Rewards Configuration
const SEASON_REWARDS = [
  // Premium Track Rewards
  { rank: 1, track: 'premium', name: 'Premium Credits', description: '500 bonus credits for premium subscribers', icon: MdPayment },
  { rank: 2, track: 'premium', name: 'Elite Badge', description: 'Exclusive elite status badge', icon: MdWorkspacePremium },
  { rank: 3, track: 'premium', name: 'VIP Access', description: 'Priority support and VIP features', icon: MdDiamond },
  { rank: 4, track: 'premium', name: 'Bonus XP', description: '+50% XP boost for next rank', icon: MdStar },
  { rank: 5, track: 'premium', name: 'Champion Title', description: 'Unlock Champion tier title', icon: MdEmojiEvents },
  { rank: 6, track: 'premium', name: 'Premium Skin', description: 'Exclusive UI theme unlock', icon: MdLocalOffer },

  // Free Track Rewards
  { rank: 1, track: 'free', name: 'Welcome Gift', description: '100 free credits to get started', icon: MdSdCard },
  { rank: 2, track: 'free', name: 'Basic Badge', description: 'Achievement progress badge', icon: MdStar },
  { rank: 3, track: 'free', name: 'Progress Boost', description: '+25% XP for next level', icon: MdWorkspacePremium },
  { rank: 4, track: 'free', name: 'Milestone Reward', description: 'Special milestone achievement', icon: MdEmojiEvents },
  { rank: 5, track: 'free', name: 'Guardian Status', description: 'Unlock Guardian tier benefits', icon: MdDiamond },
  { rank: 6, track: 'free', name: 'Community Access', description: 'Join exclusive community features', icon: MdLocalOffer },
];

export default function SeasonPassNew() {
  // Demo data for static display
  const [currentRank, setCurrentRank] = useState(8);
  const [currentXP] = useState(75000);
  const [hasSeasonPass] = useState(true);
  
  const xpProgress = (currentXP % CURRENT_SEASON.rankXP) / CURRENT_SEASON.rankXP * 100;
  const visibleRanks = Array.from({length: 6}, (_, i) => i + 1);

  const isRankUnlocked = (rank: number) => rank <= currentRank;
  const canClaimReward = (reward: any) => reward && isRankUnlocked(reward.rank);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Season Header */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">{CURRENT_SEASON.name}</h1>
            <p className="text-gray-400">Complete goals, Earn Points, Get Rewards!</p>
          </div>
          
          {/* Tier Badge Display */}
          <div className="text-center mt-4 text-lg text-gray-300">
            {currentRank <= 5 && "NOVICE TIER - Building Foundation"}
            {currentRank > 5 && currentRank <= 10 && "WARRIOR TIER - Elite Performance"}
            {currentRank > 10 && currentRank <= 15 && "ELITE TIER - Champion Status"}
            {currentRank > 15 && "LEGENDARY TIER - Ultimate Champion"}
          </div>
        </div>
      </div>

      {/* Main Season Pass Layout */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col lg:flex-row items-start gap-8">
          {/* Left Side - Progressive Rank Display */}
          <div className="relative flex-shrink-0 w-full lg:w-auto flex flex-col items-center">
            <div className={`w-48 h-48 lg:w-64 lg:h-64 relative ${getProgressiveRankStyle(currentRank).glowEffect} ${getProgressiveRankStyle(currentRank).animation}`}>
              {/* Outer decorative elements */}
              <div className="absolute inset-0">
                {/* Progressive rank display background */}
                <div className={`w-full h-full rounded-full bg-gradient-to-br ${getProgressiveRankStyle(currentRank).outerRing} border-4`}></div>
                
                {/* Progressive progress ring */}
                <svg className="absolute inset-2 w-60 h-60 transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#374151" strokeWidth="2" />
                  <circle
                    cx="50" cy="50" r="45" fill="none" stroke={getProgressiveRankStyle(currentRank).progressColor} strokeWidth="3"
                    strokeDasharray={`${xpProgress * 2.83} 283`} strokeLinecap="round"
                  />
                </svg>
                
                {/* Progressive center rank display */}
                <div className={`absolute inset-10 rounded-full bg-gradient-to-br ${getProgressiveRankStyle(currentRank).innerCircle} border-2 flex flex-col items-center justify-center ${getProgressiveRankStyle(currentRank).animation}`}>
                  <div className="text-lg text-gray-400 uppercase tracking-wider">Rank</div>
                  <div className="text-6xl font-bold text-white">{currentRank}</div>
                  <div className="w-16 h-0.5 bg-gradient-to-r from-transparent to-transparent my-2" style={{ 
                    backgroundImage: `linear-gradient(to right, transparent, ${getProgressiveRankStyle(currentRank).progressColor}, transparent)` 
                  }}></div>
                  <div className="text-sm text-gray-400">{getTierForRank(currentRank).name}</div>
                </div>
              </div>
            </div>
            
            {/* XP Progress - Centered Below Rank */}
            <div className="text-center mt-4">
              <div className="text-sm text-gray-300">
                {currentXP.toLocaleString()} / {CURRENT_SEASON.rankXP.toLocaleString()} XP
              </div>
            </div>

            {/* Season Pass Status - Centered Below XP */}
            <div className="text-center mt-4">
              <div className={cn(
                "px-6 py-2 rounded-lg border text-sm font-medium uppercase tracking-wider",
                hasSeasonPass 
                  ? "bg-green-600/20 border-green-500 text-green-400" 
                  : "bg-gray-600/20 border-gray-500 text-gray-400"
              )}>
                Season Pass {hasSeasonPass ? 'Active' : 'Inactive'} ✓
              </div>
            </div>
          </div>

          {/* Vertical Divider (Desktop Only) */}
          <div className="hidden lg:block mx-8 h-96 w-px bg-gradient-to-b from-transparent via-gray-500 to-transparent"></div>

          {/* Right Side - Reward Tracks */}
          <div className="flex-1 w-full overflow-hidden">
            <div className="mb-6">
              <div className="text-lg text-gray-400 uppercase tracking-wider mb-4">XP Progress</div>
              
              {/* Progress Bar for Current Rank */}
              <div className="mb-4 bg-gray-800 rounded-full h-3 relative overflow-hidden">
                <div 
                  className="h-full transition-all duration-500 rounded-full"
                  style={{
                    width: `${xpProgress}%`,
                    backgroundColor: getProgressiveRankStyle(currentRank).progressColor
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                  {Math.round(xpProgress)}% to Rank {currentRank + 1}
                </div>
              </div>
            </div>

            {/* Dual Track System */}
            <div className="space-y-6">
              {/* Premium Track */}
              <div className="relative">
                <div className="text-yellow-400 text-sm font-bold uppercase tracking-wider mb-4 text-center lg:text-left">Premium Track</div>
                <div className="flex space-x-4 overflow-x-auto pb-4" style={{ maxWidth: '100%', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {visibleRanks.map(rank => {
                    const reward = SEASON_REWARDS.find(r => r.rank === rank && r.track === 'premium');
                    const isUnlocked = isRankUnlocked(rank);
                    const canClaim = canClaimReward(reward);
                    const tier = getTierForRank(rank);
                    
                    return (
                      <div key={`premium-${rank}`} className="flex-shrink-0 w-16 h-16 relative group">
                        {reward ? (
                          <div 
                            className={cn(
                              "w-full h-full rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all",
                              "bg-gradient-to-br from-gray-800 to-gray-900",
                              canClaim 
                                ? "border-yellow-400 bg-yellow-600/20 hover:bg-yellow-600/30 shadow-lg shadow-yellow-400/50" 
                                : "border-gray-600",
                              !hasSeasonPass && "opacity-40"
                            )}
                            style={canClaim ? { borderColor: tier.color, boxShadow: `0 0 20px ${tier.color}40` } : {}}
                          >
                            <reward.icon className={cn(
                              "w-8 h-8 transition-colors",
                              canClaim ? "text-yellow-400" : "text-gray-500"
                            )} style={canClaim ? { color: tier.color } : {}} />
                            
                            {canClaim && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                            )}
                            
                            {/* Enhanced Premium Hover Modal */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gray-900/95 border border-yellow-400/50 text-white text-sm p-4 rounded-lg shadow-xl z-50 max-w-xs pointer-events-none">
                              <div className="font-bold text-yellow-400 mb-1">{reward.name}</div>
                              <div className="text-gray-300 text-xs mb-2">{reward.description}</div>
                              <div className="text-xs text-yellow-500 uppercase tracking-wider">
                                Rank {rank} • Premium Reward
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full border border-gray-700 rounded-lg bg-gray-800/30"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Connecting Line */}
              <div className="relative">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700"></div>
              </div>

              {/* Free Track */}
              <div className="relative">
                <div className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-4 text-center lg:text-left">Free Track</div>
                <div className="flex space-x-4 overflow-x-auto pb-4" style={{ maxWidth: '100%', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {visibleRanks.map(rank => {
                    const reward = SEASON_REWARDS.find(r => r.rank === rank && r.track === 'free');
                    const isUnlocked = isRankUnlocked(rank);
                    const canClaim = canClaimReward(reward);
                    const tier = getTierForRank(rank);
                    
                    return (
                      <div key={`free-${rank}`} className="flex-shrink-0 w-16 h-16 relative group">
                        {reward ? (
                          <div 
                            className={cn(
                              "w-full h-full rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all",
                              "bg-gradient-to-br from-gray-800 to-gray-900",
                              canClaim 
                                ? "border-blue-400 bg-blue-600/20 hover:bg-blue-600/30 shadow-lg shadow-blue-400/50" 
                                : "border-gray-600"
                            )}
                            style={canClaim ? { borderColor: tier.color, boxShadow: `0 0 20px ${tier.color}40` } : {}}
                          >
                            <reward.icon className={cn(
                              "w-8 h-8 transition-colors",
                              canClaim ? "text-blue-400" : "text-gray-500"
                            )} style={canClaim ? { color: tier.color } : {}} />
                            
                            {canClaim && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                            )}
                            
                            {/* Enhanced Free Hover Modal */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gray-900/95 border border-blue-400/50 text-white text-sm p-4 rounded-lg shadow-xl z-50 max-w-xs pointer-events-none">
                              <div className="font-bold text-blue-400 mb-1">{reward.name}</div>
                              <div className="text-gray-300 text-xs mb-2">{reward.description}</div>
                              <div className="text-xs text-blue-500 uppercase tracking-wider">
                                Rank {rank} • Free Reward
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full border border-gray-700 rounded-lg bg-gray-800/30"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}