import { useState, useEffect } from 'react';
import { achievementTracker } from '@/services/achievementTracker';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

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

interface ProgressUpdate {
  achievementId: string;
  category: string;
  newProgress: number;
  justUnlocked: boolean;
}

export function ProgressOverlay() {
  const [trackedAchievements, setTrackedAchievements] = useState<Achievement[]>([]);
  const [recentUpdate, setRecentUpdate] = useState<ProgressUpdate | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    try {
      // Subscribe to progress updates
      const unsubscribe = achievementTracker.onProgressUpdate((update: ProgressUpdate) => {
        setRecentUpdate(update);
        setShowNotification(true);
        
        // Hide notification after 5 seconds
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
      });

      // Update tracked achievements every second
      const interval = setInterval(() => {
        try {
          setTrackedAchievements(achievementTracker.getTrackedProgress());
        } catch (error) {
          console.error('Error getting tracked progress:', error);
        }
      }, 1000);

      return () => {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing from progress updates:', error);
        }
        clearInterval(interval);
      };
    } catch (error) {
      console.error('Error setting up progress overlay:', error);
    }
  }, []);

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'bg-orange-600 text-white';
      case 'silver': return 'bg-gray-500 text-white';
      case 'gold': return 'bg-yellow-500 text-black';
      case 'platinum': return 'bg-blue-600 text-white';
      case 'diamond': return 'bg-purple-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  if (!achievementTracker.hasTrackedAchievements()) {
    return null;
  }

  return (
    <>
      {/* Main Progress Overlay - Top Right */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {trackedAchievements.map((achievement) => (
          <Card key={achievement.id} className="bg-black/80 backdrop-blur-sm border-gray-700 p-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-white font-bold text-sm">{achievement.title}</h4>
                <Badge className={`${getTierBadgeColor(achievement.tier)} text-xs`}>
                  {achievement.tier.toUpperCase()}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300">Progress</span>
                <span className="text-white font-medium">
                  {achievement.progress}/{achievement.maxProgress}
                </span>
              </div>
              
              <Progress 
                value={(achievement.progress / achievement.maxProgress) * 100} 
                className="h-2 bg-gray-800"
              />
              
              {achievement.isUnlocked && (
                <div className="text-green-400 text-xs font-medium">
                  ✓ COMPLETED - {achievement.xp} XP Earned!
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Progress Update Notification */}
      {showNotification && recentUpdate && (
        <div className="fixed top-20 right-4 z-50 max-w-sm">
          <Card className={`${recentUpdate.justUnlocked ? 'bg-green-600' : 'bg-blue-600'} border-none p-4 shadow-2xl animate-in slide-in-from-right`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-white font-bold mb-1">
                  {recentUpdate.justUnlocked ? '🎉 ACHIEVEMENT UNLOCKED!' : '📈 Progress Update'}
                </div>
                <div className="text-white/90 text-sm">
                  {recentUpdate.justUnlocked 
                    ? `Congratulations! You've unlocked a new achievement!`
                    : `Made progress in ${recentUpdate.category}`
                  }
                </div>
              </div>
              <button 
                onClick={() => setShowNotification(false)}
                className="text-white/70 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}