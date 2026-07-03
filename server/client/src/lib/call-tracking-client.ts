// Client-side call tracking service
export interface OutboundCallData {
  twilioCallSid: string;
  agentEmail: string;
  agentPhone?: string;
  agentName?: string;
  leadName: string;
  leadPhone: string;
  leadId?: string;
  leadMarket?: string;
  leadState?: string;
  leadCity?: string;
  localPresenceNumber?: string;
}

export interface CallDisposition {
  twilioCallSid: string;
  disposition: string;
  notes?: string;
  appointmentDate?: string;
}

export const callTrackingClient = {
  // Create a new outbound call record
  async createCall(callData: OutboundCallData) {
    console.log('📞 Creating call record:', callData.twilioCallSid);
    
    const response = await fetch('/api/call-tracking/outbound-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create call record');
    }
    
    return response.json();
  },

  // Set call disposition
  async setDisposition(dispositionData: CallDisposition) {
    console.log('📋 Setting call disposition:', dispositionData.disposition);
    
    const response = await fetch('/api/call-tracking/disposition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dispositionData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to set call disposition');
    }
    
    return response.json();
  },

  // Get dashboard stats
  async getDashboardStats(agentEmail?: string, dateFrom?: Date, dateTo?: Date) {
    const params = new URLSearchParams();
    if (agentEmail) params.append('agentEmail', agentEmail);
    if (dateFrom) params.append('dateFrom', dateFrom.toISOString());
    if (dateTo) params.append('dateTo', dateTo.toISOString());
    
    const response = await fetch(`/api/call-tracking/dashboard?${params}`);
    if (!response.ok) {
      throw new Error('Failed to get dashboard stats');
    }
    
    return response.json();
  },

  // Get call history
  async getCallHistory(
    agentEmail?: string, 
    limit = 50, 
    offset = 0, 
    dateFrom?: Date, 
    dateTo?: Date
  ) {
    const params = new URLSearchParams();
    if (agentEmail) params.append('agentEmail', agentEmail);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (dateFrom) params.append('dateFrom', dateFrom.toISOString());
    if (dateTo) params.append('dateTo', dateTo.toISOString());
    
    const response = await fetch(`/api/call-tracking/history?${params}`);
    if (!response.ok) {
      throw new Error('Failed to get call history');
    }
    
    return response.json();
  },

  // Get active calls for agent
  async getActiveCalls(agentEmail: string) {
    const response = await fetch(`/api/call-tracking/active/${encodeURIComponent(agentEmail)}`);
    if (!response.ok) {
      throw new Error('Failed to get active calls');
    }
    
    return response.json();
  },

  // Get call center overview
  async getOverview() {
    const response = await fetch('/api/call-tracking/overview');
    if (!response.ok) {
      throw new Error('Failed to get call center overview');
    }
    
    return response.json();
  },

  // Get agent performance metrics
  async getAgentMetrics(agentEmail: string, dateFrom: Date, dateTo: Date) {
    const params = new URLSearchParams();
    params.append('dateFrom', dateFrom.toISOString());
    params.append('dateTo', dateTo.toISOString());
    
    const response = await fetch(`/api/call-tracking/metrics/${encodeURIComponent(agentEmail)}?${params}`);
    if (!response.ok) {
      throw new Error('Failed to get agent metrics');
    }
    
    return response.json();
  },
};