import React, { useState } from 'react';
import { MdLeaderboard, MdCardMembership, MdSportsEsports, MdEmojiEvents } from 'react-icons/md';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import Achievements from './Achievements';
import SeasonPass from './SeasonPass';
import Triumphs from './Triumphs';
import Clash from './Clash';

interface AchieveCategory {
  id: 'leaderboard' | 'season-pass' | 'clash' | 'triumphs';
  name: string;
  description: string;
  icon: string;
}

const ACHIEVE_CATEGORIES: AchieveCategory[] = [
  {
    id: 'leaderboard',
    name: 'Leaderboard',
    description: 'View rankings and compete with other producers',
    icon: 'leaderboard'
  },
  {
    id: 'season-pass',
    name: 'Season Pass',
    description: 'Track progress towards seasonal milestones',
    icon: 'card-membership'
  },
  {
    id: 'clash',
    name: 'Clash',
    description: 'Challenge other producers to competitive battles',
    icon: 'sports-esports'
  },
  {
    id: 'triumphs',
    name: 'Triumphs',
    description: 'Achievement system and progress tracking',
    icon: 'emoji-events'
  }
];

const ICON_MAP = {
  'leaderboard': MdLeaderboard,
  'card-membership': MdCardMembership,
  'sports-esports': MdSportsEsports,
  'emoji-events': MdEmojiEvents
};

const getTierColor = (categoryId: string) => {
  const colors = {
    'leaderboard': 'from-yellow-400 to-orange-500',
    'season-pass': 'from-blue-400 to-purple-500',
    'clash': 'from-red-400 to-pink-500',
    'triumphs': 'from-green-400 to-teal-500'
  };
  return colors[categoryId as keyof typeof colors] || 'from-gray-400 to-gray-500';
};

export default function AOIAchieve() {
  const [selectedCategory, setSelectedCategory] = useState<AchieveCategory['id']>('leaderboard');

  const renderContent = () => {
    switch (selectedCategory) {
      case 'leaderboard':
        return (
          <div className="space-y-4">
            <div className="text-center text-white text-lg">
              Leaderboard content coming soon...
            </div>
          </div>
        );
      case 'season-pass':
        return <SeasonPass />;
      case 'clash':
        return <Clash />;
      case 'triumphs':
        return <Triumphs />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Dynamic Animated Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800"></div>
        
        {/* Animated radial gradients */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-radial from-blue-500/20 via-purple-500/10 to-transparent rounded-full animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-radial from-orange-500/20 via-red-500/10 to-transparent rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-radial from-green-500/20 via-teal-500/10 to-transparent rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
        
        {/* Overlay for readability */}
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 via-purple-500 to-orange-400 bg-clip-text text-transparent">
              AOI ACHIEVE
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Complete goals, Earn Points, Get Rewards!
            </p>
          </div>

          <div className="flex gap-12">
            {/* Left Sidebar - Category Panels */}
            <div className="w-80">
              <div className="grid grid-cols-2 gap-6">
                {ACHIEVE_CATEGORIES.map((category) => (
                  <TooltipProvider key={category.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`relative cursor-pointer transition-all duration-500 ${
                            selectedCategory === category.id ? 'scale-105' : 'hover:scale-102'
                          } group`}
                          onClick={() => setSelectedCategory(category.id)}
                        >
                          {/* Outer glow effect */}
                          <div className={`absolute -inset-1 rounded-xl bg-gradient-to-br ${getTierColor(category.id)} ${
                            selectedCategory === category.id ? 'opacity-60' : 'opacity-0 group-hover:opacity-40'
                          } transition-all duration-500 blur-lg`}></div>
                          
                          {/* Main square panel */}
                          <div className={`relative w-32 h-32 rounded-xl transition-all duration-500 ${
                            selectedCategory === category.id ? 'scale-105' : 'group-hover:scale-102'
                          }`}>
                            
                            {/* Outer metallic border */}
                            <div className={`absolute inset-0 rounded-xl border-2 ${
                              selectedCategory === category.id 
                                ? 'border-yellow-400/60' 
                                : 'border-gray-500/30 group-hover:border-gray-400/50'
                            } transition-colors duration-300`}></div>
                            
                            {/* Inner dark panel with gradient */}
                            <div className={`absolute inset-1 rounded-lg bg-gradient-to-br from-gray-800 via-gray-900 to-black border ${
                              selectedCategory === category.id 
                                ? 'border-yellow-400/30' 
                                : 'border-gray-600/30'
                            } shadow-inner`}></div>
                            
                            {/* Center background with category color */}
                            <div className={`absolute inset-2 rounded-lg bg-gradient-to-br ${getTierColor(category.id)} opacity-20 group-hover:opacity-30 transition-opacity duration-300`}></div>
                            
                            {/* Icon container */}
                            <div className="absolute inset-2 rounded-lg bg-gradient-to-br from-gray-700/50 to-gray-900/50 backdrop-blur-sm flex items-center justify-center border border-gray-600/20">
                              {(() => {
                                const IconComponent = ICON_MAP[category.icon as keyof typeof ICON_MAP];
                                return IconComponent ? (
                                  <IconComponent 
                                    size={32} 
                                    className={`transition-all duration-300 drop-shadow-lg ${
                                      selectedCategory === category.id 
                                        ? 'text-white' 
                                        : 'text-gray-300 group-hover:text-white'
                                    }`}
                                  />
                                ) : null;
                              })()}
                            </div>

                            {/* Selected indicator */}
                            {selectedCategory === category.id && (
                              <div className="absolute -inset-1 rounded-xl border-2 border-yellow-400/60 animate-pulse"></div>
                            )}
                          </div>

                          {/* Category label below */}
                          <div className="text-center mt-4">
                            <div className="text-sm font-bold text-white transition-colors duration-300">
                              {category.name.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-black/90 backdrop-blur-sm border border-gray-800 shadow-2xl">
                        <div className="text-center max-w-48">
                          <div className="font-bold text-white mb-1">{category.name}</div>
                          <div className="text-sm text-gray-300">{category.description}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>

            {/* Visual Divider */}
            <div className="flex flex-col items-center justify-center px-8">
              <div className="h-32 w-px bg-gradient-to-b from-transparent via-purple-500/50 to-transparent"></div>
              <div className="w-3 h-3 bg-purple-500/60 rounded-full my-2 animate-pulse"></div>
              <div className="h-32 w-px bg-gradient-to-b from-transparent via-blue-500/50 to-transparent"></div>
            </div>

            {/* Right Content Area */}
            <div className="flex-1">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}