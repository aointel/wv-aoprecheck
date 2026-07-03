import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Phone, 
  Calendar, 
  Target, 
  Gift, 
  Trophy, 
  Zap, 
  Star,
  Users,
  DollarSign,
  Play,
  CheckCircle,
  Lock,
  Unlock,
  Megaphone,
  TrendingUp,
  Award
} from 'lucide-react';

interface DailyObjective {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  reward: string;
  completed: boolean;
  icon: any;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface LootBox {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  available: boolean;
  requiresObjective?: string;
  contents: string[];
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'update' | 'achievement' | 'challenge' | 'news';
  priority: 'low' | 'medium' | 'high';
  timestamp: Date;
}

export default function StartPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [selectedObjective, setSelectedObjective] = useState<string | null>(null);
  const [openingLootBox, setOpeningLootBox] = useState<string | null>(null);
  const [showRewards, setShowRewards] = useState(false);

  // Sample daily objectives based on ConnectNow features
  const [dailyObjectives, setDailyObjectives] = useState<DailyObjective[]>([
    {
      id: 'calls',
      title: 'Daily Dialer',
      description: 'Make 25 outbound calls using Call Connector Pro',
      progress: 12,
      target: 25,
      reward: '50 XP + Common Loot Box',
      completed: false,
      icon: Phone,
      difficulty: 'easy'
    },
    {
      id: 'appointments',
      title: 'Schedule Master',
      description: 'Book 3 new appointments today',
      progress: 1,
      target: 3,
      reward: '100 XP + Rare Loot Box',
      completed: false,
      icon: Calendar,
      difficulty: 'medium'
    },
    {
      id: 'sales',
      title: 'Closer',
      description: 'Complete 1 successful sale',
      progress: 0,
      target: 1,
      reward: '250 XP + Epic Loot Box',
      completed: false,
      icon: DollarSign,
      difficulty: 'hard'
    }
  ]);

  const [lootBoxes, setLootBoxes] = useState<LootBox[]>([
    {
      id: 'daily',
      name: 'Daily Starter',
      rarity: 'common',
      available: true,
      contents: ['10 Call Credits', 'Motivational Quote', 'Lead Insight']
    },
    {
      id: 'weekly',
      name: 'Weekly Achiever',
      rarity: 'rare',
      available: false,
      requiresObjective: 'calls',
      contents: ['25 Call Credits', 'Performance Boost', 'Premium Lead List']
    },
    {
      id: 'elite',
      name: 'Elite Performer',
      rarity: 'epic',
      available: false,
      requiresObjective: 'sales',
      contents: ['100 Call Credits', 'Elite Badge', 'VIP Features Access']
    }
  ]);

  const [announcements] = useState<Announcement[]>([
    {
      id: '1',
      title: 'New WebRTC Features Live!',
      message: 'Enhanced call quality and video integration now available in Call Connector Pro.',
      type: 'update',
      priority: 'high',
      timestamp: new Date()
    },
    {
      id: '2',
      title: 'Weekly Leaderboard',
      message: 'Martin Toma leads this week with 847 calls! Can you beat the record?',
      type: 'achievement',
      priority: 'medium',
      timestamp: new Date(Date.now() - 3600000)
    },
    {
      id: '3',
      title: 'Monthly Challenge',
      message: 'Double XP weekend starts Friday! Complete objectives for bonus rewards.',
      type: 'challenge',
      priority: 'medium',
      timestamp: new Date(Date.now() - 7200000)
    }
  ]);

  const openLootBox = (boxId: string) => {
    setOpeningLootBox(boxId);
    setTimeout(() => {
      setShowRewards(true);
      setTimeout(() => {
        setOpeningLootBox(null);
        setShowRewards(false);
        // Mark loot box as used
        setLootBoxes(prev => prev.map(box => 
          box.id === boxId ? { ...box, available: false } : box
        ));
      }, 3000);
    }, 2000);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-500';
      case 'rare': return 'bg-blue-500';
      case 'epic': return 'bg-purple-500';
      case 'legendary': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'hard': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">
            Welcome Back, {user?.email?.split('@')[0] || 'producer'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">Ready to dominate your sales goals today?</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Daily Objectives */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl text-gray-900 dark:text-white">
                  <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  Daily Objectives
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dailyObjectives.map((objective) => {
                  const IconComponent = objective.icon;
                  const progressPercent = (objective.progress / objective.target) * 100;
                  
                  return (
                    <motion.div
                      key={objective.id}
                      whileHover={{ scale: 1.02 }}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      onClick={() => setSelectedObjective(selectedObjective === objective.id ? null : objective.id)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <IconComponent className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{objective.title}</h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">{objective.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={getDifficultyColor(objective.difficulty)}>
                            {objective.difficulty.toUpperCase()}
                          </Badge>
                          <div className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                            {objective.progress}/{objective.target}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Progress value={progressPercent} className="h-2" />
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Progress: {Math.round(progressPercent)}%</span>
                          <span className="text-yellow-600 dark:text-yellow-400">Reward: {objective.reward}</span>
                        </div>
                      </div>

                      {objective.completed && (
                        <div className="flex items-center gap-2 mt-2 text-green-400">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-semibold">Completed!</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Loot Boxes */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Gift className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Reward Crates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lootBoxes.map((box) => (
                    <motion.div
                      key={box.id}
                      whileHover={box.available ? { scale: 1.05 } : {}}
                      className={`relative p-4 rounded-lg border-2 transition-all ${
                        box.available 
                          ? `${getRarityColor(box.rarity)} border-current cursor-pointer shadow-lg text-white`
                          : 'bg-gray-200 dark:bg-gray-600/30 border-gray-300 dark:border-gray-600 opacity-50'
                      }`}
                      onClick={() => box.available && openLootBox(box.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">{box.name}</h4>
                          <p className="text-sm capitalize text-gray-600 dark:text-gray-400">{box.rarity} Crate</p>
                        </div>
                        {box.available ? (
                          <Unlock className="w-6 h-6" />
                        ) : (
                          <Lock className="w-6 h-6 opacity-50" />
                        )}
                      </div>
                      
                      {!box.available && box.requiresObjective && (
                        <p className="text-xs mt-2 text-gray-500 dark:text-gray-400">
                          Complete "{dailyObjectives.find(obj => obj.id === box.requiresObjective)?.title}" to unlock
                        </p>
                      )}
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* Announcements */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Megaphone className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    Announcements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {announcements.slice(0, 3).map((announcement) => (
                    <div key={announcement.id} className="border-l-4 border-blue-600 dark:border-blue-400 pl-3 py-2">
                      <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{announcement.title}</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{announcement.message}</p>
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        {announcement.timestamp.toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-8"
        >
          <div className="flex flex-wrap gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg"
              onClick={() => setLocation('/dashboard')}
            >
              <Play className="w-5 h-5 mr-2" />
              Start Working
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-purple-500 text-purple-400 hover:bg-purple-500/10 px-8 py-6 text-lg"
              onClick={() => setLocation('/dashboard/connect')}
            >
              <Phone className="w-5 h-5 mr-2" />
              Call Connector Pro
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-green-500 text-green-400 hover:bg-green-500/10 px-8 py-6 text-lg"
              onClick={() => setLocation('/dashboard/appointments')}
            >
              <Calendar className="w-5 h-5 mr-2" />
              Schedule
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Loot Box Opening Animation */}
      <AnimatePresence>
        {openingLootBox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0, rotate: 0 }}
              animate={{ 
                scale: showRewards ? 1.2 : 1, 
                rotate: showRewards ? 0 : 360 
              }}
              transition={{ duration: 2 }}
              className="text-center"
            >
              {!showRewards ? (
                <div className="text-6xl">🎁</div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center space-y-4"
                >
                  <h2 className="text-3xl font-bold text-yellow-400">Rewards Unlocked!</h2>
                  <div className="space-y-2">
                    {lootBoxes.find(box => box.id === openingLootBox)?.contents.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.2 }}
                        className="text-lg text-white bg-yellow-500/20 rounded-lg px-4 py-2"
                      >
                        ✨ {item}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}