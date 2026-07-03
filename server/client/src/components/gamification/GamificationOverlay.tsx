import React from 'react';
import { MdStars, MdPhone, MdTrendingUp } from 'react-icons/md';
import { FaTrophy } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GamificationOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  userId: string;
}

export function GamificationOverlay({ isVisible, onClose, userId }: GamificationOverlayProps) {
  const { data: gameStats } = useQuery({
    queryKey: ['/api/gamification/stats', userId],
    enabled: !!userId && isVisible,
  });

  const { data: achievements } = useQuery({
    queryKey: ['/api/gamification/achievements', userId],
    enabled: !!userId && isVisible,
  });

  const nextLevelXP = (gameStats?.level || 1) * 1000;
  const currentLevelXP = ((gameStats?.level || 1) - 1) * 1000;
  const progressXP = (gameStats?.xp || 0) - currentLevelXP;
  const neededXP = nextLevelXP - currentLevelXP;
  const progressPercent = (progressXP / neededXP) * 100;

  return (
    <Dialog open={isVisible} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MdStars className="w-5 h-5 text-yellow-500" />
            <span>Gamification Dashboard</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pb-6">
          {/* Level Progress */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold">Level {gameStats?.level || 1}</h3>
                <Badge variant="secondary">
                  {gameStats?.xp?.toLocaleString() || 0} XP
                </Badge>
              </div>
              <Progress value={progressPercent} className="w-full" />
              <p className="text-sm text-muted-foreground">
                {progressXP.toLocaleString()} / {neededXP.toLocaleString()} XP to next level
              </p>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center space-x-2">
                  <MdPhone className="w-4 h-4" />
                  <span>Total Calls</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{gameStats?.totalCalls || 0}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center space-x-2">
                  <MdTrendingUp className="w-4 h-4" />
                  <span>Success Rate</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {gameStats?.totalCalls > 0 
                    ? Math.round(((gameStats?.successfulCalls || 0) / gameStats.totalCalls) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {gameStats?.successfulCalls || 0} successful
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center space-x-2">
                  <FaTrophy className="w-4 h-4" />
                  <span>Current Streak</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{gameStats?.streak || 0}</div>
                <p className="text-xs text-muted-foreground">Consecutive days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center space-x-2">
                  <MdStars className="w-4 h-4" />
                  <span>Achievements</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{achievements?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Unlocked</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Achievements */}
          {achievements && achievements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold">Recent Achievements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {achievements.slice(0, 3).map((achievement: any, index: number) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm">{achievement.name}</span>
                      <Badge variant="outline" className="text-xs">
                        +{achievement.xp} XP
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}