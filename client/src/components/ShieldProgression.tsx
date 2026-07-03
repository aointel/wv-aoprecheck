import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { SHIELD_RANKINGS, getShieldByRank, getTierProgress } from '@/data/shieldRankings';

interface ShieldProgressionProps {
  initialRank?: number;
}

export const ShieldProgression: React.FC<ShieldProgressionProps> = ({ initialRank = 1 }) => {
  const [currentRank, setCurrentRank] = useState(initialRank);
  const currentShield = getShieldByRank(currentRank);
  const tierProgress = getTierProgress(currentRank);

  if (!currentShield) return null;

  const handleRankChange = (value: number[]) => {
    setCurrentRank(value[0]);
  };

  const getTierGradient = (tier: string) => {
    switch (tier) {
      case 'BRONZE':
        return 'from-amber-600 to-amber-800';
      case 'SILVER':
        return 'from-slate-400 to-slate-600';
      case 'GOLD':
        return 'from-yellow-400 to-yellow-600';
      case 'PLATINUM':
        return 'from-slate-300 to-slate-500';
      default:
        return 'from-gray-400 to-gray-600';
    }
  };

  const getGlowColor = (tier: string) => {
    switch (tier) {
      case 'BRONZE':
        return 'shadow-amber-500/50';
      case 'SILVER':
        return 'shadow-slate-400/50';
      case 'GOLD':
        return 'shadow-yellow-400/50';
      case 'PLATINUM':
        return 'shadow-slate-300/50';
      default:
        return 'shadow-gray-400/50';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Shield Progression System</h2>
        <p className="text-gray-300">Use the slider to preview different ranks and their badges</p>
      </div>

      {/* Rank Slider */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-medium text-gray-300">Rank: {currentRank}</span>
          <Badge 
            variant="outline" 
            className={`bg-gradient-to-r ${getTierGradient(currentShield.tier)} text-white border-0 px-4 py-2`}
          >
            {currentShield.tier} TIER
          </Badge>
        </div>
        
        <Slider
          value={[currentRank]}
          onValueChange={handleRankChange}
          max={20}
          min={1}
          step={1}
          className="w-full"
        />
        
        <div className="flex justify-between text-sm text-gray-400 mt-2">
          <span>Rank 1</span>
          <span>Rank 20</span>
        </div>
      </div>

      {/* Main Badge Display */}
      <div className="relative mb-8">
        <div className="flex justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentRank}
              initial={{ scale: 0.8, opacity: 0, rotateY: -180 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              exit={{ scale: 0.8, opacity: 0, rotateY: 180 }}
              transition={{ 
                duration: 0.6, 
                type: "spring", 
                stiffness: 100,
                damping: 15 
              }}
              className="relative"
            >
              {/* Badge Container with Glow Effect */}
              <div 
                className={`relative w-64 h-64 rounded-full p-4 bg-gradient-to-br ${getTierGradient(currentShield.tier)} shadow-2xl ${getGlowColor(currentShield.tier)}`}
                style={{
                  filter: `drop-shadow(0 0 20px ${currentShield.glowColor}40)`,
                }}
              >
                {/* Inner Badge Display */}
                <div className="w-full h-full bg-black/20 rounded-full flex items-center justify-center overflow-hidden">
                  {currentShield.badgeFile.startsWith('00') ? (
                    // Real badge image
                    <div className="text-8xl">🛡️</div>
                  ) : (
                    // Placeholder for missing badges
                    <div className="text-6xl">
                      {currentShield.tier === 'BRONZE' && '🥉'}
                      {currentShield.tier === 'SILVER' && '🥈'}
                      {currentShield.tier === 'GOLD' && '🥇'}
                      {currentShield.tier === 'PLATINUM' && '💎'}
                    </div>
                  )}
                </div>

                {/* Rank Number Overlay */}
                <motion.div 
                  className="absolute -top-2 -right-2 w-12 h-12 bg-white rounded-full flex items-center justify-center font-bold text-black text-lg shadow-lg"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  {currentRank}
                </motion.div>

                {/* Power Level Badge */}
                <motion.div 
                  className="absolute -bottom-4 left-1/2 transform -translate-x-1/2"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Badge className="bg-black/80 text-white border border-gray-600">
                    {currentShield.powerLevel}
                  </Badge>
                </motion.div>
              </div>

              {/* Animated Ring Effects */}
              <motion.div 
                className="absolute inset-0 rounded-full border-2 border-white/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
              <motion.div 
                className="absolute inset-2 rounded-full border border-white/10"
                animate={{ rotate: -360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Shield Information */}
      <motion.div 
        key={`info-${currentRank}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-8"
      >
        <h3 className="text-2xl font-bold text-white mb-2">{currentShield.name}</h3>
        <p className="text-gray-300 text-lg max-w-2xl mx-auto">{currentShield.description}</p>
      </motion.div>

      {/* Tier Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">
            {currentShield.tier} Tier Progress
          </span>
          <span className="text-sm text-gray-300">
            {tierProgress.current}/{tierProgress.total}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <motion.div
            className={`h-3 rounded-full bg-gradient-to-r ${getTierGradient(currentShield.tier)}`}
            initial={{ width: 0 }}
            animate={{ width: `${tierProgress.percentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Requirements */}
      <motion.div 
        key={`req-${currentRank}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-800/50 rounded-lg p-6"
      >
        <h4 className="text-lg font-semibold text-white mb-4">Requirements to Unlock</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(currentShield.requirements).map(([key, value]) => (
            <div key={key} className="text-center">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-sm text-gray-400 capitalize">{key}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* All Ranks Preview */}
      <div className="mt-12">
        <h4 className="text-xl font-semibold text-white mb-6 text-center">All Shield Ranks</h4>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-4">
          {SHIELD_RANKINGS.map((shield) => (
            <motion.button
              key={shield.rank}
              onClick={() => setCurrentRank(shield.rank)}
              className={`relative w-16 h-16 rounded-lg flex items-center justify-center transition-all duration-300 ${
                currentRank === shield.rank 
                  ? `bg-gradient-to-br ${getTierGradient(shield.tier)} ring-2 ring-white` 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-2xl">
                {shield.tier === 'BRONZE' && '🥉'}
                {shield.tier === 'SILVER' && '🥈'}
                {shield.tier === 'GOLD' && '🥇'}
                {shield.tier === 'PLATINUM' && '💎'}
              </span>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center text-xs text-white font-bold">
                {shield.rank}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};