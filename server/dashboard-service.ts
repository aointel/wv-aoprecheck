import { DatabaseStorage } from './storage';

export interface DashboardStats {
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
  totalTalkTime: number;
  activeAgents: number;
  availableCredits: number;
  vdpStatus: 'online' | 'offline' | 'maintenance';
  completionRate: number;
  averageCallDuration: number;
}

export class DashboardService {
  constructor(private storage: DatabaseStorage) {}

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // For now, return mock data that simulates a real call center
      // In production, these would be calculated from actual call data
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Simulate realistic call center stats
      const callsToday = Math.floor(Math.random() * 50) + 20; // 20-70 calls
      const callsThisWeek = callsToday + Math.floor(Math.random() * 200) + 100; // More cumulative
      const callsThisMonth = callsThisWeek + Math.floor(Math.random() * 500) + 300;
      
      const averageCallDuration = 180 + Math.floor(Math.random() * 120); // 3-5 minutes
      const totalTalkTime = callsToday * averageCallDuration;
      
      const completionRate = 75 + Math.floor(Math.random() * 20); // 75-95%
      const activeAgents = Math.floor(Math.random() * 15) + 5; // 5-20 agents
      const availableCredits = Math.floor(Math.random() * 1000) + 500; // 500-1500 credits

      // VDP status - mostly online, occasionally maintenance
      const statusRand = Math.random();
      let vdpStatus: 'online' | 'offline' | 'maintenance' = 'online';
      if (statusRand < 0.05) vdpStatus = 'offline';
      else if (statusRand < 0.15) vdpStatus = 'maintenance';

      return {
        callsToday,
        callsThisWeek,
        callsThisMonth,
        totalTalkTime,
        activeAgents,
        availableCredits,
        vdpStatus,
        completionRate,
        averageCallDuration
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      
      // Return default stats on error
      return {
        callsToday: 0,
        callsThisWeek: 0,
        callsThisMonth: 0,
        totalTalkTime: 0,
        activeAgents: 0,
        availableCredits: 0,
        vdpStatus: 'offline',
        completionRate: 0,
        averageCallDuration: 0
      };
    }
  }

  async getCallHistory(agentId?: string, limit: number = 50) {
    try {
      // Mock call history data
      const calls = [];
      for (let i = 0; i < limit; i++) {
        const callTime = new Date(Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000));
        calls.push({
          id: `call-${i + 1}`,
          agentId: agentId || `agent-${Math.floor(Math.random() * 10) + 1}`,
          clientPhone: `+1555${Math.floor(Math.random() * 9000000) + 1000000}`,
          clientName: `Client ${i + 1}`,
          startTime: callTime,
          endTime: new Date(callTime.getTime() + (Math.random() * 600 + 60) * 1000), // 1-10 minutes
          status: ['completed', 'no-answer', 'busy', 'failed'][Math.floor(Math.random() * 4)],
          disposition: ['qualified', 'not_interested', 'callback', 'dnc'][Math.floor(Math.random() * 4)]
        });
      }
      return calls.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    } catch (error) {
      console.error('Error getting call history:', error);
      return [];
    }
  }

  async getPerformanceMetrics(agentId?: string, timeframe: 'day' | 'week' | 'month' = 'day') {
    try {
      // Mock performance metrics
      const baseMetrics = {
        callsAttempted: Math.floor(Math.random() * 100) + 50,
        callsConnected: 0,
        callsCompleted: 0,
        totalTalkTime: 0,
        averageCallDuration: 0,
        conversionRate: 0,
        hourlyBreakdown: [] as Array<{ hour: number; calls: number; success: number }>
      };

      baseMetrics.callsConnected = Math.floor(baseMetrics.callsAttempted * (0.6 + Math.random() * 0.3));
      baseMetrics.callsCompleted = Math.floor(baseMetrics.callsConnected * (0.7 + Math.random() * 0.25));
      baseMetrics.averageCallDuration = 120 + Math.floor(Math.random() * 180); // 2-5 minutes
      baseMetrics.totalTalkTime = baseMetrics.callsConnected * baseMetrics.averageCallDuration;
      baseMetrics.conversionRate = Math.floor((baseMetrics.callsCompleted / baseMetrics.callsAttempted) * 100);

      // Hourly breakdown for charts
      for (let hour = 9; hour <= 17; hour++) {
        const calls = Math.floor(Math.random() * 15) + 5;
        const success = Math.floor(calls * (0.6 + Math.random() * 0.3));
        baseMetrics.hourlyBreakdown.push({ hour, calls, success });
      }

      return baseMetrics;
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return null;
    }
  }
}