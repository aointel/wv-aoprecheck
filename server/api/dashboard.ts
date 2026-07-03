import { Router } from 'express';

const router = Router();

// Dashboard statistics endpoint
router.get('/stats', async (req, res) => {
  try {
    // Mock statistics for now - can be replaced with real data
    const stats = {
      todayCalls: Math.floor(Math.random() * 50) + 10,
      weekCalls: Math.floor(Math.random() * 300) + 100, 
      monthCalls: Math.floor(Math.random() * 1200) + 500,
      totalCalls: Math.floor(Math.random() * 5000) + 2000,
      successRate: Math.floor(Math.random() * 30) + 60, // 60-90%
      avgCallTime: `${Math.floor(Math.random() * 5) + 3}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      activeAgents: Math.floor(Math.random() * 15) + 5,
      revenue: Math.floor(Math.random() * 50000) + 10000,
      conversions: Math.floor(Math.random() * 100) + 50
    };

    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Performance data endpoint  
router.get('/performance', async (req, res) => {
  try {
    // Mock performance data for charts
    const performanceData = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      calls: Math.floor(Math.random() * 100) + 20,
      conversions: Math.floor(Math.random() * 30) + 5,
      revenue: Math.floor(Math.random() * 5000) + 1000
    }));

    res.json(performanceData);
  } catch (error) {
    console.error('Dashboard performance error:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

export default router;