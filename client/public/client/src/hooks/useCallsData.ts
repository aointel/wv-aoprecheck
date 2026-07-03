import { useInfiniteQuery } from "@tanstack/react-query";
import { Call } from "@shared/schema";

interface CallsResponse {
  calls: Call[];
  total: number;
  limit: number;
  offset: number;
}

interface CallsFilters {
  search?: string;
  phoneSearch?: string;
  agentSearch?: string;
  status?: string;
  dateRange?: string;
  agent?: string;
  premiumMin?: number;
  premiumMax?: number;
  isFlagged?: boolean;
}

export function useCallsData(filters: CallsFilters) {
  const fetchCalls = async ({ pageParam = 0 }) => {
    // Build query string from filters
    const queryParams = new URLSearchParams();
    queryParams.append('limit', '10');
    queryParams.append('offset', pageParam.toString());
    
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.phoneSearch) queryParams.append('phoneSearch', filters.phoneSearch);
    if (filters.agentSearch) queryParams.append('agentSearch', filters.agentSearch);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.dateRange) queryParams.append('dateRange', filters.dateRange);
    if (filters.agent) queryParams.append('agent', filters.agent);
    if (filters.premiumMin !== undefined) queryParams.append('premiumMin', filters.premiumMin.toString());
    if (filters.premiumMax !== undefined) queryParams.append('premiumMax', filters.premiumMax.toString());
    if (filters.isFlagged !== undefined) queryParams.append('isFlagged', filters.isFlagged.toString());
    
    const response = await fetch(`/api/calls?${queryParams.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch calls');
    }
    return await response.json() as CallsResponse;
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: ['/api/calls', filters],
    queryFn: fetchCalls,
    getNextPageParam: (lastPage) => {
      const { offset, limit, total } = lastPage;
      return offset + limit < total ? offset + limit : undefined;
    },
    initialPageParam: 0
  });

  // Flatten pages of calls into a single array
  const calls = data?.pages.flatMap(page => page.calls) || [];

  return {
    calls,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: status === 'pending',
    isError: status === 'error',
    error,
    refetch
  };
}
