import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Phone, Users, UserPlus, Shield, CreditCard, Calendar, Trophy, Star, Target, Award, Zap, Crown,
  Sword, Flame, Gem, Bolt, Rocket, Medal, Sparkles, Crosshair, Radio, Headphones,
  Volume2, Mic, UserCheck, Briefcase, TrendingUp, BarChart3, DollarSign, Gift,
  Handshake, Activity, Gauge, Settings, CheckCircle2, CircleDot
} from 'lucide-react';

// Mock auth state for now
const useAuth = () => ({
  authState: { user: { email: 'cnsysop@aoglobelife.com' } }
});

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  requirements: number;
  xp: number;
  isUnlocked: boolean;
  progress: number;
  maxProgress: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

// Icon mapping for categories and achievements
const ICON_MAP: { [key: string]: any } = {
  // Category icons - more dynamic and game-like
  'calls': Headphones,        // Professional calling headset
  'presentations': Volume2,   // Speaker for presentations
  'sales': DollarSign,       // Money for sales
  'plusLeads': Gift,         // Gift box for referrals/bonuses
  'precheck': CheckCircle2,  // Verification checkmark
  'production': Gauge,       // Performance gauge
  
  // Achievement icons - more exciting and diverse
  'phone': Phone,
  'headphones': Headphones,
  'mic': Mic,
  'radio': Radio,
  'users': Users,
  'user-plus': UserPlus,
  'user-check': UserCheck,
  'trophy': Trophy,
  'medal': Medal,
  'award': Award,
  'crown': Crown,
  'star': Star,
  'sparkles': Sparkles,
  'gem': Gem,
  'target': Target,
  'crosshair': Crosshair,
  'zap': Zap,
  'lightning': Bolt,
  'flame': Flame,
  'sword': Sword,
  'rocket': Rocket,
  'briefcase': Briefcase,
  'trending-up': TrendingUp,
  'bar-chart': BarChart3,
  'dollar-sign': DollarSign,
  'gift': Gift,
  'handshake': Handshake,
  'activity': Activity,
  'gauge': Gauge,
  'settings': Settings,
  'check-circle': CheckCircle2,
  'circle-dot': CircleDot,
  'calendar': Calendar,
  'credit-card': CreditCard,
  'shield': Shield
};

const CATEGORIES: Category[] = [
  { id: 'calls', name: 'Calls', icon: 'calls', color: 'bg-blue-500', description: 'Master the art of communication' },
  { id: 'presentations', name: 'Presentations', icon: 'presentations', color: 'bg-green-500', description: 'Captivate and convince prospects' },
  { id: 'sales', name: 'Sales', icon: 'sales', color: 'bg-yellow-500', description: 'Turn prospects into customers' },
  { id: 'plusLeads', name: 'Plus Leads', icon: 'plusLeads', color: 'bg-purple-500', description: 'Expand your network through referrals' },
  { id: 'precheck', name: 'Precheck', icon: 'precheck', color: 'bg-teal-500', description: 'Perfect your qualification skills' },
  { id: 'production', name: 'Production', icon: 'production', color: 'bg-red-500', description: 'Achieve peak performance levels' }
];

const ACHIEVEMENTS: Achievement[] = [
  // Calls Category - More exciting titles and icons
  { id: 'first-call', title: 'First Contact', description: 'Break the ice with your first call', icon: 'headphones', category: 'calls', tier: 'bronze', requirements: 1, xp: 10, isUnlocked: false, progress: 0, maxProgress: 1 },
  { id: 'dial-rookie', title: 'Voice Rookie', description: 'Master 10 successful calls', icon: 'mic', category: 'calls', tier: 'bronze', requirements: 10, xp: 50, isUnlocked: false, progress: 0, maxProgress: 10 },
  { id: 'call-warrior', title: 'Communication Warrior', description: 'Dominate 50 call battles', icon: 'sword', category: 'calls', tier: 'silver', requirements: 50, xp: 200, isUnlocked: false, progress: 0, maxProgress: 50 },
  { id: 'phone-champion', title: 'Voice Champion', description: 'Conquer 100 conversations', icon: 'crown', category: 'calls', tier: 'gold', requirements: 100, xp: 500, isUnlocked: false, progress: 0, maxProgress: 100 },
  { id: 'call-legend', title: 'Sound Legend', description: 'Reach 500 call victories', icon: 'lightning', category: 'calls', tier: 'platinum', requirements: 500, xp: 2500, isUnlocked: false, progress: 0, maxProgress: 500 },
  { id: 'dial-master', title: 'Dial Overlord', description: 'Achieve 1000 epic calls', icon: 'flame', category: 'calls', tier: 'diamond', requirements: 1000, xp: 5000, isUnlocked: false, progress: 0, maxProgress: 1000 },

  // Presentations Category - More engaging icons and titles
  { id: 'first-presentation', title: 'Stage Debut', description: 'Command the stage for the first time', icon: 'sparkles', category: 'presentations', tier: 'bronze', requirements: 1, xp: 25, isUnlocked: false, progress: 0, maxProgress: 1 },
  { id: 'presenter', title: 'Persuader', description: 'Captivate 10 audiences', icon: 'volume2', category: 'presentations', tier: 'silver', requirements: 10, xp: 100, isUnlocked: false, progress: 0, maxProgress: 10 },
  { id: 'pitch-master', title: 'Presentation Gladiator', description: 'Dominate 50 presentations', icon: 'sword', category: 'presentations', tier: 'gold', requirements: 50, xp: 500, isUnlocked: false, progress: 0, maxProgress: 50 },
  { id: 'presentation-guru', title: 'Oratory Legend', description: 'Master 100 epic presentations', icon: 'gem', category: 'presentations', tier: 'platinum', requirements: 100, xp: 1000, isUnlocked: false, progress: 0, maxProgress: 100 },

  // Sales Category - More dynamic and rewarding
  { id: 'first-sale', title: 'Deal Breaker', description: 'Strike your first successful deal', icon: 'handshake', category: 'sales', tier: 'bronze', requirements: 1, xp: 50, isUnlocked: false, progress: 0, maxProgress: 1 },
  { id: 'sales-starter', title: 'Revenue Rookie', description: 'Close 5 profitable deals', icon: 'trending-up', category: 'sales', tier: 'silver', requirements: 5, xp: 250, isUnlocked: false, progress: 0, maxProgress: 5 },
  { id: 'deal-closer', title: 'Deal Assassin', description: 'Eliminate 20 deal objections', icon: 'crosshair', category: 'sales', tier: 'gold', requirements: 20, xp: 1000, isUnlocked: false, progress: 0, maxProgress: 20 },
  { id: 'sales-machine', title: 'Revenue Engine', description: 'Power through 50 deals', icon: 'rocket', category: 'sales', tier: 'platinum', requirements: 50, xp: 2500, isUnlocked: false, progress: 0, maxProgress: 50 },
  { id: 'revenue-king', title: 'Sales Overlord', description: 'Rule over 100 conquered deals', icon: 'crown', category: 'sales', tier: 'diamond', requirements: 100, xp: 5000, isUnlocked: false, progress: 0, maxProgress: 100 },

  // Plus Leads Category - Network building focus
  { id: 'first-referral', title: 'Network Spark', description: 'Ignite your referral network', icon: 'user-plus', category: 'plusLeads', tier: 'bronze', requirements: 1, xp: 30, isUnlocked: false, progress: 0, maxProgress: 1 },
  { id: 'referral-rookie', title: 'Connection Creator', description: 'Build 5 valuable connections', icon: 'sparkles', category: 'plusLeads', tier: 'silver', requirements: 5, xp: 150, isUnlocked: false, progress: 0, maxProgress: 5 },
  { id: 'network-builder', title: 'Network Architect', description: 'Engineer 25 referral pathways', icon: 'activity', category: 'plusLeads', tier: 'gold', requirements: 25, xp: 750, isUnlocked: false, progress: 0, maxProgress: 25 },
  { id: 'referral-master', title: 'Influence Overlord', description: 'Command 50 referral champions', icon: 'gem', category: 'plusLeads', tier: 'platinum', requirements: 50, xp: 1500, isUnlocked: false, progress: 0, maxProgress: 50 },

  // Precheck Category - Qualification mastery
  { id: 'first-precheck', title: 'Gatekeeper', description: 'Guard the qualification gates', icon: 'check-circle', category: 'precheck', tier: 'bronze', requirements: 1, xp: 20, isUnlocked: false, progress: 0, maxProgress: 1 },
  { id: 'qualifier', title: 'Quality Controller', description: 'Perfect 10 qualification processes', icon: 'settings', category: 'precheck', tier: 'silver', requirements: 10, xp: 100, isUnlocked: false, progress: 0, maxProgress: 10 },
  { id: 'screening-expert', title: 'Screening Specialist', description: 'Master 50 qualification battles', icon: 'shield', category: 'precheck', tier: 'gold', requirements: 50, xp: 500, isUnlocked: false, progress: 0, maxProgress: 50 },

  // Production Category - Performance milestones
  { id: 'rising-star', title: 'Rising Star', description: 'Shine with 1000 total XP', icon: 'star', category: 'production', tier: 'bronze', requirements: 1000, xp: 100, isUnlocked: false, progress: 0, maxProgress: 1000 },
  { id: 'top-performer', title: 'Elite Performer', description: 'Excel with 5000 total XP', icon: 'medal', category: 'production', tier: 'silver', requirements: 5000, xp: 500, isUnlocked: false, progress: 0, maxProgress: 5000 },
  { id: 'elite-producer', title: 'Legendary producer', description: 'Ascend with 10000 total XP', icon: 'gem', category: 'production', tier: 'gold', requirements: 10000, xp: 1000, isUnlocked: false, progress: 0, maxProgress: 10000 },
  { id: 'legendary-producer', title: 'Mythic Producer', description: 'Transcend with 25000 total XP', icon: 'crown', category: 'production', tier: 'platinum', requirements: 25000, xp: 2500, isUnlocked: false, progress: 0, maxProgress: 25000 },
];

export default function Achievements() {
  const { authState } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>(ACHIEVEMENTS);
  const [selectedCategory, setSelectedCategory] = useState<string>('calls');

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'bg-orange-600 text-white';
      case 'silver': return 'bg-gray-400 text-black';
      case 'gold': return 'bg-yellow-500 text-black';
      case 'platinum': return 'bg-purple-600 text-white';
      case 'diamond': return 'bg-blue-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  // Mock achievement tracking data based on user performance
  useEffect(() => {
    const updatedAchievements = achievements.map(achievement => {
      // Simple mock data - in real app this would come from API
      return {
        ...achievement,
        // Simulate some progress and unlocked achievements
        progress: Math.min(achievement.maxProgress, Math.floor(Math.random() * achievement.maxProgress * 0.8)),
        isUnlocked: Math.random() > 0.7 // 30% chance of being unlocked
      };
    });

    setAchievements(updatedAchievements);
  }, [authState?.user?.email]);

  const filteredAchievements = achievements.filter(
    achievement => achievement.category === selectedCategory
  );

  const categoryProgress = CATEGORIES.map(category => {
    const categoryAchievements = achievements.filter(a => a.category === category.id);
    const unlockedCount = categoryAchievements.filter(a => a.isUnlocked).length;
    return {
      ...category,
      progress: categoryAchievements.length > 0 ? (unlockedCount / categoryAchievements.length) * 100 : 0,
      unlocked: unlockedCount,
      total: categoryAchievements.length
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/30 to-gray-900 overflow-hidden">
      {/* Radial background rays */}
      <div className="absolute inset-0 bg-gradient-conic from-blue-500/10 via-transparent via-transparent via-transparent to-purple-500/10"></div>
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(circle at center, transparent 20%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.7) 100%)'
      }}></div>
      
      {/* Subtle animated rays */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 w-1 bg-gradient-to-r from-transparent via-blue-400/50 to-transparent origin-bottom"
            style={{
              height: '50vh',
              transform: `translate(-50%, -100%) rotate(${i * 30}deg)`,
              animation: `pulse 3s ease-in-out infinite ${i * 0.2}s`
            }}
          ></div>
        ))}
      </div>

      <div className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header with Enhanced Destiny-style Dark Theme */}
          <div className="mb-8 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/30 to-yellow-500/20 rounded-2xl blur-xl"></div>
            <div className="relative bg-gray-800/40 backdrop-blur-sm rounded-2xl p-8 text-center border border-purple-400/30 shadow-2xl">
              <h1 className="text-5xl font-bold mb-3 text-white">
                TRIUMPHS
              </h1>
              <p className="text-lg text-gray-300 font-medium mb-6">
                Complete goals, Earn Points, Get Rewards!
              </p>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="text-sm text-gray-400 uppercase tracking-wide">Total Score</div>
                  <div className="text-4xl font-black text-purple-400">
                    {achievements.reduce((total, a) => total + (a.isUnlocked ? a.xp : 0), 0)}
                  </div>
                </div>
                <div className="w-px h-12 bg-gray-600"></div>
                <div className="text-center">
                  <div className="text-sm text-gray-400 uppercase tracking-wide">Completed</div>
                  <div className="text-4xl font-black text-yellow-400">
                    {achievements.filter(a => a.isUnlocked).length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-8">
            {/* Categories Sidebar - Circular Icons */}
            <div className="w-[28rem]">
              {/* Circular Category Icons Grid */}
              <div className="grid grid-cols-3 gap-24 mb-16 place-items-center px-12">
                {categoryProgress.map((category, index) => {
                  // Define tier colors based on category
                  const getTierColor = (categoryId: string) => {
                    switch (categoryId) {
                      case 'calls': return 'from-blue-400 to-cyan-500';
                      case 'presentations': return 'from-green-400 to-emerald-500';
                      case 'sales': return 'from-yellow-400 to-orange-500';
                      case 'plusLeads': return 'from-purple-400 to-pink-500';
                      case 'precheck': return 'from-teal-400 to-blue-500';
                      case 'production': return 'from-red-400 to-pink-500';
                      default: return 'from-gray-400 to-gray-500';
                    }
                  };

                  return (
                    <TooltipProvider key={category.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`relative cursor-pointer transition-all duration-500 hover:scale-110 ${
                              selectedCategory === category.id ? 'scale-110' : 'hover:scale-105'
                            } group`}
                            onClick={() => setSelectedCategory(category.id)}
                          >
                            {/* Outer glow ring */}
                            <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${getTierColor(category.id)} ${
                              selectedCategory === category.id ? 'opacity-40' : 'opacity-0 group-hover:opacity-40'
                            } transition-all duration-500 blur-xl scale-150`}></div>
                            
                            {/* Main circular container - Destiny style */}
                            <div className={`relative w-32 h-32 rounded-full transition-all duration-500 ${
                              selectedCategory === category.id ? 'scale-105' : 'group-hover:scale-105'
                            }`}>
                              
                              {/* Outer metallic ring */}
                              <div className={`absolute inset-0 rounded-full border-2 ${
                                selectedCategory === category.id 
                                  ? 'border-yellow-400/80' 
                                  : 'border-gray-500/60 group-hover:border-gray-400'
                              } bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 shadow-2xl`}></div>
                              
                              {/* Progress ring - Conic gradient */}
                              <div 
                                className="absolute inset-1 rounded-full"
                                style={{
                                  background: `conic-gradient(from 0deg, ${category.progress > 0 ? `var(--${category.id}-start)` : 'transparent'} 0%, ${category.progress > 0 ? `var(--${category.id}-end)` : 'transparent'} ${category.progress}%, transparent ${category.progress}%, transparent 100%)`,
                                  '--calls-start': '#3b82f6',
                                  '--calls-end': '#06b6d4',
                                  '--presentations-start': '#10b981',
                                  '--presentations-end': '#059669',
                                  '--sales-start': '#f59e0b',
                                  '--sales-end': '#ea580c',
                                  '--plusLeads-start': '#a855f7',
                                  '--plusLeads-end': '#ec4899',
                                  '--precheck-start': '#14b8a6',
                                  '--precheck-end': '#3b82f6',
                                  '--production-start': '#ef4444',
                                  '--production-end': '#ec4899',
                                } as React.CSSProperties}
                              ></div>
                              
                              {/* Inner dark circle with gradient */}
                              <div className={`absolute inset-2 rounded-full bg-gradient-to-br from-gray-800 via-gray-900 to-black border ${
                                selectedCategory === category.id 
                                  ? 'border-yellow-400/30' 
                                  : 'border-gray-600/30'
                              } shadow-inner`}></div>
                              
                              {/* Center shield/emblem background */}
                              <div className={`absolute inset-3 rounded-full bg-gradient-to-br ${getTierColor(category.id)} opacity-20 group-hover:opacity-30 transition-opacity duration-300`}></div>
                              
                              {/* Icon container with depth */}
                              <div className="absolute inset-3 rounded-full bg-gradient-to-br from-gray-700/50 to-gray-900/50 backdrop-blur-sm flex items-center justify-center border border-gray-600/20">
                                {(() => {
                                  const IconComponent = ICON_MAP[category.icon];
                                  return IconComponent ? (
                                    <IconComponent 
                                      size={36} 
                                      className={`transition-all duration-300 drop-shadow-lg ${
                                        selectedCategory === category.id 
                                          ? 'text-white' 
                                          : 'text-gray-300 group-hover:text-white'
                                      }`}
                                    />
                                  ) : null;
                                })()}
                              </div>

                              {/* Small completion badge */}
                              {category.unlocked > 0 && (
                                <div className="absolute -top-1 -right-1 w-7 h-7 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xl border-2 border-gray-900">
                                  {category.unlocked}
                                </div>
                              )}
                              
                              {/* Selected indicator */}
                              {selectedCategory === category.id && (
                                <div className="absolute -inset-1 rounded-full border-2 border-yellow-400/60 animate-pulse"></div>
                              )}
                            </div>

                            {/* Category label below */}
                            <div className="text-center mt-6">
                              <div className="text-xs font-bold text-white transition-colors duration-300">
                                {category.name.toUpperCase()}
                              </div>
                              <div className="text-xs text-gray-400 mt-2">
                                {category.unlocked}/{category.total}
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="bg-black/90 backdrop-blur-sm border border-gray-800 shadow-2xl">
                          <div className="text-center max-w-48">
                            <div className="font-bold text-white mb-1">{category.name}</div>
                            <div className="text-sm text-gray-300 mb-2">{category.description}</div>
                            <div className="text-sm text-purple-400">{category.unlocked}/{category.total} completed</div>
                            <div className="text-xs text-gray-500 mt-1">{Math.round(category.progress)}% progress</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>


            </div>

            {/* Visual Divider */}
            <div className="flex flex-col items-center justify-center px-8">
              <div className="h-32 w-px bg-gradient-to-b from-transparent via-purple-500/50 to-transparent"></div>
              <div className="w-3 h-3 bg-purple-500/60 rounded-full my-2 animate-pulse"></div>
              <div className="h-32 w-px bg-gradient-to-b from-transparent via-blue-500/50 to-transparent"></div>
            </div>

            {/* Achievements List - Destiny Style with Transparency */}
            <div className="flex-1">
              
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                {filteredAchievements.map((achievement) => (
                  <TooltipProvider key={achievement.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`p-3 rounded-lg transition-all duration-300 cursor-pointer relative overflow-hidden min-h-[95px] ${
                            achievement.isUnlocked
                              ? 'bg-gradient-to-br from-gray-700 to-gray-800 border border-yellow-500/50 hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-500/20'
                              : 'bg-gradient-to-br from-gray-700 to-gray-800 border border-gray-500 hover:border-blue-400 hover:shadow-md hover:shadow-blue-400/20'
                          } hover:scale-[1.02] group`}
                        >
                          {/* AOI Blue/Purple Haze from Bottom */}
                          <div className="absolute inset-x-0 bottom-0 h-0 bg-gradient-to-t from-blue-500/50 via-purple-500/30 to-transparent transition-all duration-500 group-hover:h-full"></div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-4">
                              {/* White Bordered Square for Icon */}
                              <div className="w-16 h-16 border-2 border-white rounded-md bg-white/10 flex items-center justify-center flex-shrink-0 ml-2">
                                {(() => {
                                  const IconComponent = ICON_MAP[achievement.icon];
                                  return IconComponent ? (
                                    <IconComponent 
                                      size={32} 
                                      className="text-white"
                                    />
                                  ) : null;
                                })()}
                              </div>
                              <div className="flex-1">
                                <h3 className={`text-base font-bold mb-1 ${
                                  achievement.isUnlocked ? 'text-white' : 'text-gray-300'
                                }`}>
                                  {achievement.title}
                                </h3>
                                <p className={`text-xs mb-1 ${
                                  achievement.isUnlocked ? 'text-gray-200' : 'text-gray-400'
                                }`}>
                                  {achievement.description}
                                </p>
                                <p className={`text-xs italic mb-1 ${
                                  achievement.isUnlocked ? 'text-gray-300' : 'text-gray-500'
                                }`}>
                                  Requirement: {achievement.requirements} completed
                                </p>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge className={`${getTierBadgeColor(achievement.tier)} text-xs`}>
                                      {achievement.tier.toUpperCase()}
                                    </Badge>
                                    <span className={`text-xs font-medium ${
                                      achievement.isUnlocked ? 'text-white' : 'text-gray-400'
                                    }`}>
                                      {achievement.xp} XP
                                    </span>
                                  </div>
                                  {!achievement.isUnlocked && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        console.log('Tracking achievement:', achievement.id);
                                      }}
                                      className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors"
                                    >
                                      Track
                                    </button>
                                  )}
                                </div>
                              </div>
                              {achievement.isUnlocked && (
                                <div className="text-xl text-green-500 opacity-80">
                                  ✓
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-black/90 backdrop-blur-sm border border-gray-800 shadow-2xl max-w-md p-0 rounded-lg overflow-hidden">
                        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-black p-6">
                          {/* Destiny-style background pattern */}
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-transparent"></div>
                          
                          <div className="relative z-10">
                            {/* Large Title */}
                            <h2 className="text-2xl font-bold text-white mb-3 tracking-wide">
                              {achievement.title.toUpperCase()}
                            </h2>
                            
                            {/* Tier Badge */}
                            <Badge className={`${getTierBadgeColor(achievement.tier)} text-xs mb-4`}>
                              {achievement.tier.toUpperCase()}
                            </Badge>
                            
                            {/* Inspirational Quote */}
                            <div className="text-blue-300 font-medium mb-4 text-center italic border-l-4 border-blue-500 pl-4">
                              "{achievement.description}"
                            </div>
                            
                            {/* Requirements in Italics */}
                            <div className="text-gray-300 italic mb-4 text-sm">
                              Requirements: Complete {achievement.requirements} {achievement.category}
                            </div>
                            
                            {/* Progress Tracker with Score */}
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-sm">PROGRESS</span>
                                <span className="text-white font-bold">{achievement.progress}/{achievement.maxProgress}</span>
                              </div>
                              <Progress 
                                value={(achievement.progress / achievement.maxProgress) * 100} 
                                className="h-3 bg-gray-800"
                              />
                              
                              {/* XP Reward */}
                              <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                                <span className="text-gray-400 text-sm">XP REWARD</span>
                                <span className="text-yellow-400 font-bold text-lg">+{achievement.xp}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}