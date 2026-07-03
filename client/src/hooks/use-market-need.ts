export interface MarketStateData {
  state: string;
  stateName: string;
  leads: number;
  agents: number;
  opportunityScore: number;
  rank: number;
}

const MARKET_NEED_DATA: MarketStateData[] = [
  { state: 'CA', stateName: 'California',     leads: 6565, agents: 126, opportunityScore: 52.10, rank: 1  },
  { state: 'NJ', stateName: 'New Jersey',      leads: 3653, agents: 73,  opportunityScore: 50.04, rank: 2  },
  { state: 'IL', stateName: 'Illinois',        leads: 3284, agents: 84,  opportunityScore: 39.10, rank: 3  },
  { state: 'FL', stateName: 'Florida',         leads: 3908, agents: 128, opportunityScore: 30.53, rank: 4  },
  { state: 'PA', stateName: 'Pennsylvania',    leads: 2174, agents: 99,  opportunityScore: 21.96, rank: 5  },
  { state: 'IN', stateName: 'Indiana',         leads: 1842, agents: 89,  opportunityScore: 20.70, rank: 6  },
  { state: 'NV', stateName: 'Nevada',          leads: 1668, agents: 86,  opportunityScore: 19.40, rank: 7  },
  { state: 'SC', stateName: 'South Carolina',  leads: 2655, agents: 138, opportunityScore: 19.24, rank: 8  },
  { state: 'KY', stateName: 'Kentucky',        leads: 1895, agents: 102, opportunityScore: 18.58, rank: 9  },
  { state: 'MI', stateName: 'Michigan',        leads: 2469, agents: 140, opportunityScore: 17.64, rank: 10 },
  { state: 'TX', stateName: 'Texas',           leads: 3565, agents: 206, opportunityScore: 17.31, rank: 11 },
  { state: 'WI', stateName: 'Wisconsin',       leads: 1486, agents: 88,  opportunityScore: 16.89, rank: 12 },
  { state: 'DC', stateName: 'Washington DC',   leads: 288,  agents: 18,  opportunityScore: 16.00, rank: 13 },
  { state: 'VA', stateName: 'Virginia',        leads: 2709, agents: 187, opportunityScore: 14.49, rank: 14 },
  { state: 'CT', stateName: 'Connecticut',     leads: 718,  agents: 50,  opportunityScore: 14.36, rank: 15 },
];

const CONNECT_MARKET_NEED_STATES = ['IL', 'NJ', 'SC'] as const;

export function useMarketNeed() {
  const stateOrder = new Map<string, number>(
    CONNECT_MARKET_NEED_STATES.map((state, idx) => [state, idx]),
  );
  const data = MARKET_NEED_DATA
    .filter((entry) => stateOrder.has(entry.state))
    .sort((a, b) => (stateOrder.get(a.state) ?? 999) - (stateOrder.get(b.state) ?? 999))
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

  return {
    data,
    isLoading: false,
    isError: false,
  };
}
