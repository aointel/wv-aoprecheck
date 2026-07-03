// Authentic Badge Asset Management System for Season Pass  
// Based on analysis of 595 authentic Destiny-style badge assets from 1254MB archive
// Ranking system: 100 (most powerful) to 1 (weakest/lamest)

import { BADGE_RANKINGS, BADGE_TIERS, type BadgeRank } from '@/data/badgeRankings';

export interface BadgeAsset {
  id: number;
  rank: number;
  tier: 'Novice' | 'Adept' | 'Expert' | 'Master' | 'Legend';
  imagePath: string;
  name: string;
  theme: string;
  powerLevel: number;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Exotic';
  description: string;
  fallback: string;
}

// Create authentic badge mapping based on analyzed asset collection
export const createBadgeMapping = (): BadgeAsset[] => {
  return BADGE_RANKINGS.map((badgeRank, index) => ({
    id: index + 1,
    rank: badgeRank.rank,
    tier: badgeRank.tier,
    imagePath: `/badges/${badgeRank.filename}`,
    name: badgeRank.theme,
    theme: badgeRank.theme,
    powerLevel: badgeRank.powerLevel,
    rarity: badgeRank.rarity,
    description: badgeRank.description,
    fallback: getFallbackBadgeIcon(badgeRank.tier)
  }));
};

// Get badge for a specific rank (1 badge per rank in authentic system)
export const getBadgeForRank = (rank: number): BadgeAsset | undefined => {
  const allBadges = createBadgeMapping();
  return allBadges.find(badge => badge.rank === rank);
};

// Get primary badge for a rank (same as getBadgeForRank in authentic system)
export const getPrimaryBadgeForRank = (rank: number): BadgeAsset | undefined => {
  return getBadgeForRank(rank);
};

// Get badges by tier
export const getBadgesByTier = (tier: BadgeAsset['tier']): BadgeAsset[] => {
  const allBadges = createBadgeMapping();
  return allBadges.filter(badge => badge.tier === tier);
};

// Get badges by rarity
export const getBadgesByRarity = (rarity: BadgeAsset['rarity']): BadgeAsset[] => {
  const allBadges = createBadgeMapping();
  return allBadges.filter(badge => badge.rarity === rarity);
};

// Check if badge assets are available
export const checkBadgeAvailability = async (): Promise<boolean> => {
  try {
    // Check if badge directory exists by trying to fetch a test image
    const response = await fetch('/src/assets/badges/shields/badge_001.png');
    return response.ok;
  } catch {
    return false;
  }
};

// Get fallback icon for missing badges (authentic Destiny theming)
export const getFallbackBadgeIcon = (tier: BadgeAsset['tier']) => {
  const fallbackIcons = {
    Novice: '🔸',      // New Light - simple geometric 
    Adept: '🔶',       // Growing skill - orange diamond
    Expert: '🔷',      // Advanced - blue diamond  
    Master: '👑',      // Elite - crown
    Legend: '⭐'       // Ultimate - star
  };
  return fallbackIcons[tier];
};

// Get badge tier color for styling
export const getBadgeTierColor = (rank: number): string => {
  for (const [, config] of Object.entries(BADGE_TIERS)) {
    if (rank >= config.min && rank <= config.max) {
      return config.color;
    }
  }
  return BADGE_TIERS.NOVICE.color;
};

// Get badge rarity glow effect
export const getBadgeRarityGlow = (rarity: BadgeAsset['rarity']): string => {
  const rarityGlows = {
    Common: 'shadow-sm',
    Uncommon: 'shadow-md shadow-green-500/20',
    Rare: 'shadow-lg shadow-blue-500/30',
    Epic: 'shadow-xl shadow-purple-500/40',
    Exotic: 'shadow-2xl shadow-yellow-500/50 animate-pulse'
  };
  return rarityGlows[rarity];
};

// Get all badges in power level order (100 to 1)
export const getBadgesByPowerLevel = (): BadgeAsset[] => {
  return createBadgeMapping().sort((a, b) => b.powerLevel - a.powerLevel);
};

// Get most powerful badge (Rank 100)
export const getMostPowerfulBadge = (): BadgeAsset | undefined => {
  return getBadgeForRank(100);
};

// Get weakest/lamest badge (Rank 1)  
export const getWeakestBadge = (): BadgeAsset | undefined => {
  return getBadgeForRank(1);
};