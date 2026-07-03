// TODO: Replace mock data with real Supabase query when lead/agent data is available
// Query would join masterlead table (grouped by state) with producer_profiles (by licensed states)

export interface MarketStateData {
  state: string;
  stateName: string;
  leads: number;
  agents: number;
  opportunityScore: number;
  rank: number;
}

const MOCK_MARKET_DATA: MarketStateData[] = [
  { state: 'TX', stateName: 'Texas',          leads: 12400, agents: 8,  opportunityScore: 1550, rank: 1  },
  { state: 'FL', stateName: 'Florida',         leads: 9800,  agents: 9,  opportunityScore: 1089, rank: 2  },
  { state: 'GA', stateName: 'Georgia',         leads: 5200,  agents: 4,  opportunityScore: 1300, rank: 3  },
  { state: 'NC', stateName: 'North Carolina',  leads: 4100,  agents: 5,  opportunityScore: 820,  rank: 4  },
  { state: 'OH', stateName: 'Ohio',            leads: 3800,  agents: 6,  opportunityScore: 633,  rank: 5  },
  { state: 'TN', stateName: 'Tennessee',       leads: 3200,  agents: 6,  opportunityScore: 533,  rank: 6  },
  { state: 'AZ', stateName: 'Arizona',         leads: 2900,  agents: 7,  opportunityScore: 414,  rank: 7  },
  { state: 'MI', stateName: 'Michigan',        leads: 2600,  agents: 8,  opportunityScore: 325,  rank: 8  },
  { state: 'IL', stateName: 'Illinois',        leads: 2300,  agents: 9,  opportunityScore: 256,  rank: 9  },
  { state: 'VA', stateName: 'Virginia',        leads: 2100,  agents: 10, opportunityScore: 210,  rank: 10 },
];

export function useMarketStatus() {
  // TODO: Replace with useQuery hitting /api/market-status or direct Supabase
  return {
    data: MOCK_MARKET_DATA,
    isLoading: false,
    isError: false,
  };
}
