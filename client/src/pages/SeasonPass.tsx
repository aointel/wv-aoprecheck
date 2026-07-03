import { useState } from 'react';
import { cn } from '@/lib/utils';
// Note: useAuth hook removed - will use static demo data
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
  name: "Season of Achievement",
  quarter: "Q1",
  year: 2025,
  startDate: new Date(2025, 8, 1), // September 1, 2025
  endDate: new Date(2025, 11, 31), // December 31, 2025
  maxRank: 20,
  rankXP: 100000 // XP needed per rank (like Destiny's 100k XP)
};

// Destiny-style ranking system based on authentic tier structure
const DESTINY_RANK_TIERS = {
  // Guardian Ranks (1-20) - Basic progression
  GUARDIAN: { 
    minRank: 1, 
    maxRank: 20, 
    color: '#4A90E2',
    name: 'Guardian',
    description: 'New Light Guardian beginning their journey'
  },
  
  // Crystal Tier (21-40) - Intermediate progression  
  CRYSTAL: { 
    minRank: 21, 
    maxRank: 40, 
    color: '#5DD5F0',
    name: 'Crystal',
    description: 'Seasoned warrior with crystal clarity'
  },
  
  // Legendary Tier (41-70) - Advanced progression
  LEGENDARY: { 
    minRank: 41, 
    maxRank: 70, 
    color: '#F4A623',
    name: 'Legendary',
    description: 'Elite Guardian of legendary status'
  },
  
  // Master Tier (71-90) - Expert progression
  MASTER: { 
    minRank: 71, 
    maxRank: 90, 
    color: '#B256F4',
    name: 'Master',
    description: 'Master Guardian commanding respect'
  },
  
  // Grandmaster Tier (91-100) - Ultimate progression
  GRANDMASTER: { 
    minRank: 91, 
    maxRank: 100, 
    color: '#FF6B6B',
    name: 'Grandmaster',
    description: 'Ultimate Guardian at peak performance'
  }
};

// Function to get tier for a given rank
const getTierForRank = (rank: number) => {
  for (const tier of Object.values(DESTINY_RANK_TIERS)) {
    if (rank >= tier.minRank && rank <= tier.maxRank) {
      return tier;
    }
  }
  return DESTINY_RANK_TIERS.GUARDIAN; // Default fallback
};

// Destiny-style Season Pass Rewards with proper badge emblems
const SEASON_REWARDS = Array.from({ length: 100 }, (_, i) => {
  const rank = i + 1;
  const isFreeReward = rank % 5 === 0; // Free rewards every 5 ranks
  const isPremiumReward = rank % 3 === 0; // Premium rewards every 3 ranks
  const tier = getTierForRank(rank);
  
  // Authentic Destiny badge rewards based on your uploaded screenshots
  const getAuthenticBadge = (rank: number, tier: any) => {
    // Map authentic Destiny badges to each tier from your screenshots
    const badgeMapping = {
      'Guardian': {
        name: 'Crystal Guardian Badge',
        icon: MdStar,
        rarity: 'common',
        description: 'Crystal Shard - New Light Guardian',
        badgeStyle: 'border-cyan-400 bg-cyan-900/20 text-cyan-100',
        glowColor: 'cyan'
      },
      'Crystal': {
        name: 'Crystal Mastery Badge', 
        icon: MdDiamond,
        rarity: 'rare',
        description: 'Crystal Mastery - Proven Guardian',
        badgeStyle: 'border-blue-400 bg-blue-900/20 text-blue-100',
        glowColor: 'blue'
      },
      'Legendary': {
        name: 'Legendary Crown Badge',
        icon: MdWorkspacePremium,
        rarity: 'legendary',
        description: 'Legendary Crown - Elite Guardian Status',
        badgeStyle: 'border-orange-400 bg-orange-900/20 text-orange-100',
        glowColor: 'gold'
      },
      'Master': {
        name: 'Master Emblem Badge',
        icon: MdEmojiEvents,
        rarity: 'exotic',
        description: 'Master Emblem - Commanding Respect',
        badgeStyle: 'border-purple-400 bg-purple-900/20 text-purple-100',
        glowColor: 'purple'
      },
      'Grandmaster': {
        name: 'Grandmaster Seal',
        icon: MdSdCard,
        rarity: 'pinnacle',
        description: 'Grandmaster Seal - Ultimate Achievement',
        badgeStyle: 'border-red-400 bg-red-900/20 text-red-100',
        glowColor: 'red'
      }
    };
    
    return badgeMapping[tier.name as keyof typeof badgeMapping] || badgeMapping.Guardian;
  };
  
  if (isFreeReward) {
    const badge = getAuthenticBadge(rank, tier);
    return {
      rank,
      track: 'free',
      type: 'badge',
      name: badge.name,
      icon: badge.icon,
      rarity: badge.rarity,
      tierColor: tier.color,
      badgeStyle: badge.badgeStyle,
      glowColor: badge.glowColor,
      description: `${badge.description} - Rank ${rank} achievement`
    };
  } else if (isPremiumReward) {
    return {
      rank,
      track: 'premium',
      type: 'commission',
      name: `$${rank * 75} Bonus`,
      icon: MdPayment,
      rarity: 'legendary',
      tierColor: tier.color,
      description: `Premium commission bonus - ${tier.name} tier achievement`
    };
  } else {
    return {
      rank,
      track: rank % 2 === 0 ? 'premium' : 'free',
      type: 'materials',
      name: 'Guardian Essence',
      icon: MdLocalOffer,
      rarity: 'common',
      tierColor: tier.color,
      description: `${tier.description} - Essential Guardian materials`
    };
  }
});

// Progressive rank styling based on tier
const getProgressiveRankStyle = (rank: number) => {
  if (rank <= 5) { // Novice (1-5)
    return {
      outerRing: 'from-gray-700 to-gray-900 border-gray-600',
      progressColor: '#60A5FA',
      innerCircle: 'from-gray-800 to-black border-gray-600',
      glowEffect: '',
      animation: ''
    };
  } else if (rank <= 10) { // Warrior (6-10)
    return {
      outerRing: 'from-amber-700 to-amber-900 border-amber-600',
      progressColor: '#F59E0B',
      innerCircle: 'from-amber-800 to-black border-amber-600',
      glowEffect: 'shadow-lg shadow-amber-500/20',
      animation: ''
    };
  } else if (rank <= 15) { // Elite (11-15)
    return {
      outerRing: 'from-blue-700 to-purple-900 border-blue-500',
      progressColor: '#3B82F6',
      innerCircle: 'from-blue-800 to-purple-900 border-blue-500',
      glowEffect: 'shadow-xl shadow-blue-500/30',
      animation: 'animate-pulse'
    };
  } else { // Legendary (16-20)
    return {
      outerRing: 'from-yellow-500 to-red-600 border-yellow-400',
      progressColor: '#EF4444',
      innerCircle: 'from-yellow-600 to-red-900 border-yellow-400',
      glowEffect: 'shadow-2xl shadow-yellow-500/50',
      animation: ''
    };
  }
};

export default function SeasonPass() {
  const [currentRank, setCurrentRank] = useState(1); // Start at rank 1
  const [currentXP, setCurrentXP] = useState(67000); // Mock current XP within rank
  const [hasSeasonPass, setHasSeasonPass] = useState(true); // Mock premium status

  // Calculate progress within current rank
  const xpProgress = (currentXP / CURRENT_SEASON.rankXP) * 100;
  
  // Calculate days until season starts
  const daysUntilStart = Math.ceil((CURRENT_SEASON.startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  // Get visible ranks for track display (current rank +/- 10)
  const visibleRanks = Array.from({ length: 21 }, (_, i) => Math.max(1, currentRank - 10) + i)
    .filter(rank => rank <= CURRENT_SEASON.maxRank);

  // Get reward for specific rank
  const getRewardForRank = (rank: number) => {
    return SEASON_REWARDS.find(reward => reward.rank === rank);
  };

  // Check if rank is unlocked
  const isRankUnlocked = (rank: number) => {
    return rank <= currentRank;
  };

  // Check if reward can be claimed (premium track needs season pass)
  const canClaimReward = (reward: any) => {
    if (!reward) return false;
    if (reward.track === 'free') return isRankUnlocked(reward.rank);
    return isRankUnlocked(reward.rank) && hasSeasonPass;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">
      {/* Season 15 Header - Goes above everything */}
      <div className="relative overflow-hidden border-b border-gray-700">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/30 via-purple-900/30 to-red-900/30"></div>
        <div className="relative z-10 container mx-auto px-4 py-6">
          <div className="text-center">
            <div className="text-4xl font-bold mb-2 tracking-wider">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                SEASON 15
              </span>
            </div>
            <div className="text-2xl text-yellow-400 uppercase tracking-widest font-bold mb-2">
              SEASON OF ACHIEVEMENT
            </div>
            <div className="text-lg text-red-400 font-semibold">
              Starts in: {daysUntilStart} days
            </div>
          </div>
        </div>
      </div>

      {/* Rank Preview Slider */}
      <div className="container mx-auto px-4 py-4 border-b border-gray-700">
        <div className="flex items-center justify-center space-x-4">
          <div className="text-sm text-gray-400 font-semibold">RANK PREVIEW:</div>
          <input
            type="range"
            min="1"
            max="20"
            value={currentRank}
            onChange={(e) => setCurrentRank(parseInt(e.target.value))}
            className="w-64 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${getProgressiveRankStyle(currentRank).progressColor} 0%, ${getProgressiveRankStyle(currentRank).progressColor} ${(currentRank / 20) * 100}%, #374151 ${(currentRank / 20) * 100}%, #374151 100%)`
            }}
          />
          <div className="text-lg text-white font-bold min-w-[3rem]">
            {currentRank}/20
          </div>
        </div>
        <div className="text-center mt-2">
          <div className="text-xs text-gray-500">
            {currentRank <= 5 && "NOVICE TIER - Basic Guardian"}
            {currentRank > 5 && currentRank <= 10 && "WARRIOR TIER - Proven Fighter"} 
            {currentRank > 10 && currentRank <= 15 && "ELITE TIER - Advanced Guardian"}
            {currentRank > 15 && "LEGENDARY TIER - Ultimate Champion"}
          </div>
        </div>
      </div>



      {/* Main Season Pass Layout - Destiny Style */}
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

          {/* Vertical Divider - Destiny Style (Desktop Only) */}
          <div className="hidden lg:block mx-8 h-96 w-px bg-gradient-to-b from-transparent via-gray-500 to-transparent"></div>

          {/* Right Side - Horizontal Reward Track */}
          <div className="flex-1 w-full overflow-hidden">

          {/* Track Header with Rank Numbers and Progress */}
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
            
            {/* Mini Progress Bars for Next 5 Ranks */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
              {Array.from({length: 5}, (_, i) => {
                const nextRank = currentRank + i + 1;
                if (nextRank > 20) return null; // Don't show ranks beyond 20
                const isUnlocked = nextRank <= currentRank;
                const style = getProgressiveRankStyle(nextRank);
                return (
                  <div key={nextRank} className="text-center">
                    <div className="text-xs text-gray-400 mb-1">Rank {nextRank}</div>
                    <div className="bg-gray-700 rounded-full h-2 relative overflow-hidden">
                      <div 
                        className="h-full transition-all duration-300 rounded-full"
                        style={{
                          width: isUnlocked ? '100%' : (nextRank === currentRank + 1 ? `${xpProgress}%` : '0%'),
                          backgroundColor: style.progressColor
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {getTierForRank(nextRank).name.split(' ')[0]}
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
            
            <div className="hidden lg:flex justify-between text-sm text-gray-500 px-8">
              {visibleRanks.slice(0, 8).map(num => (
                <span key={num} className="w-12 text-center">{num}</span>
              ))}
            </div>
          </div>

          {/* Dual Track System - Responsive Layout */}
          <div className="space-y-6">
            {/* Premium Track */}
            <div className="relative">
              <div className="text-yellow-400 text-sm font-bold uppercase tracking-wider mb-4 text-center lg:text-left">Premium Track</div>
              <div className="flex space-x-4 overflow-x-auto pb-4"
                style={{ maxWidth: '100%', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {visibleRanks.slice(0, 6).map(rank => {
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
                          title={reward.description}
                          style={canClaim ? { borderColor: tier.color, boxShadow: `0 0 20px ${tier.color}40` } : {}}
                        >
                          <reward.icon className={cn(
                            "w-8 h-8 transition-colors",
                            canClaim ? "text-yellow-400" : "text-gray-500"
                          )} style={canClaim ? { color: tier.color } : {}} />
                          
                          {canClaim && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                          )}
                          
                          {/* Hover tooltip */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-xs p-2 rounded whitespace-nowrap z-50">
                            {reward.name}
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
              <div className="flex space-x-4 overflow-x-auto pb-4"
                style={{ maxWidth: '100%', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {visibleRanks.slice(0, 6).map(rank => {
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
                          title={reward.description}
                          style={canClaim ? { borderColor: tier.color, boxShadow: `0 0 20px ${tier.color}40` } : {}}
                        >
                          <reward.icon className={cn(
                            "w-8 h-8 transition-colors",
                            canClaim ? "text-blue-400" : "text-gray-500"
                          )} style={canClaim ? { color: tier.color } : {}} />
                          
                          {canClaim && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                          )}
                          
                          {/* Hover tooltip */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-xs p-2 rounded whitespace-nowrap z-50">
                            {reward.name}
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

          {/* Track Labels - Destiny Style */}
          <div className="mt-8 space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-4 h-4 rounded bg-gradient-to-r from-yellow-400 to-orange-500"></div>
              <span className="text-sm text-gray-400 uppercase tracking-wider">Earn Season Ranks</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-4 h-4 rounded bg-gradient-to-r from-blue-400 to-cyan-500"></div>
              <span className="text-sm text-gray-400 uppercase tracking-wider">Season Pass Bonuses</span>
            </div>
          </div>

          {/* Season Pass Bonus Section */}
          <div className="mt-8 bg-black/60 backdrop-blur border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">Season Pass Bonuses</h3>
            <div className="grid grid-cols-6 gap-4">
              {['+5%', '+10%', '+15%', '+20%', '+25%', '+30%'].map((bonus, index) => (
                <div key={index} className="text-center">
                  <div 
                    className="w-12 h-12 bg-gradient-to-br rounded-lg mx-auto mb-2 flex items-center justify-center border-2"
                    style={{ 
                      background: `linear-gradient(135deg, ${Object.values(DESTINY_RANK_TIERS)[index]?.color || '#4A90E2'}40, ${Object.values(DESTINY_RANK_TIERS)[index]?.color || '#4A90E2'}20)`,
                      borderColor: Object.values(DESTINY_RANK_TIERS)[index]?.color || '#4A90E2'
                    }}
                  >
                    <MdStar className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-xs text-gray-400">XP Bonus</div>
                  <div className="text-sm text-white font-bold">{bonus}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
        </div>

      {/* Season Pass Footer */}
      <div className="relative overflow-hidden border-t border-gray-700 mt-8">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-red-900/20"></div>
        <div className="relative z-10 container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-4 tracking-wider">
              <span className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                SEASON PASS
              </span>
            </h1>
            <div className="mt-4 text-sm text-gray-400">
              Complete goals, Earn Points, Get Rewards!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}