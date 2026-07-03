import { useState, useRef, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Call } from "@shared/schema";
import CallRow from "@/components/CallRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Filter, Search, SlidersHorizontal, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [sorting, setSorting] = useState<{
    column: string;
    direction: 'asc' | 'desc';
  }>({
    column: 'callDate', // Sort by date by default
    direction: 'desc'   // Most recent first
  });
  
  // Form inputs for search (these don't automatically trigger API calls)
  const [searchInputs, setSearchInputs] = useState({
    search: "",
    phoneSearch: "",
    agentSearch: "",
  });
  
  // Applied filters (these trigger API calls)
  const [filters, setFilters] = useState({
    search: "",
    phoneSearch: "",
    agentSearch: "",
    status: "",
    dateRange: "",
    agent: "",
    premiumMin: undefined,
    premiumMax: undefined,
    isFlagged: undefined,
  });
  
  const [showFilters, setShowFilters] = useState(true);
  const loadMoreRef = useRef(null); // Reference for infinite scroll
  
  // Apply search inputs to filters when search button is clicked
  const handleApplySearch = () => {
    setFilters(prev => ({
      ...prev,
      search: searchInputs.search,
      // Use the same search term for both phone and agent search
      phoneSearch: searchInputs.search,
      agentSearch: searchInputs.search
    }));
  };
  
  // Handle enter key on search inputs
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleApplySearch();
    }
  };
  
  // Use infinite query for pagination
  const { 
    data, 
    isLoading, 
    isError, 
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch
  } = useInfiniteQuery<{
    calls: Call[];
    total: number;
    limit: number;
    offset: number;
  }>({
    queryKey: ["/api/calls", filters, sorting],
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => {
      // Build query string from pagination and filters
      const queryParams = new URLSearchParams({
        limit: "10",
        offset: pageParam.toString(),
        sortBy: sorting.column,
        sortDirection: sorting.direction,
      });
      
      // Add filter parameters if they have values
      if (filters.search) queryParams.append("search", filters.search);
      if (filters.phoneSearch) queryParams.append("phoneSearch", filters.phoneSearch);
      if (filters.agentSearch) queryParams.append("agentSearch", filters.agentSearch);
      if (filters.status) queryParams.append("status", filters.status);
      if (filters.dateRange) queryParams.append("dateRange", filters.dateRange);
      if (filters.agent) queryParams.append("agent", filters.agent);
      if (filters.premiumMin) queryParams.append("premiumMin", filters.premiumMin.toString());
      if (filters.premiumMax) queryParams.append("premiumMax", filters.premiumMax.toString());
      if (filters.isFlagged !== undefined) queryParams.append("isFlagged", filters.isFlagged.toString());
      
      const response = await fetch(`/api/calls?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch calls");
      }
      return response.json();
    },
    getNextPageParam: (lastPage) => {
      const { offset, limit, total } = lastPage;
      return offset + limit < total ? offset + limit : undefined;
    },
    initialPageParam: 0
  });
  
  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 }
    );
    
    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }
    
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [loadMoreRef, hasNextPage, isFetchingNextPage, fetchNextPage]);
  
  const handleFilterChange = (filterName: string, value: any) => {
    // Convert "all" values to empty string for API
    const apiValue = value === "all" ? "" : value;
    setFilters(prev => ({ ...prev, [filterName]: apiValue }));
  };
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    // Update filters based on selected tab
    if (tab === "all") {
      handleFilterChange("status", "");
      handleFilterChange("isFlagged", undefined);
    } else if (tab === "flagged") {
      handleFilterChange("isFlagged", true);
      handleFilterChange("status", "");
    } else if (tab === "pending") {
      handleFilterChange("status", "pending");
      handleFilterChange("isFlagged", undefined);
    } else if (tab === "approved") {
      handleFilterChange("status", "approved");
      handleFilterChange("isFlagged", undefined);
    }
  };
  
  // We're using infinite scroll, so this function is no longer needed
  // but kept as a comment in case we need to revert
  /*
  const handlePageChange = (increment: number) => {
    // Implementation removed as we're using infinite scroll now
  };
  */
  
  const handleClearFilters = () => {
    setSearchInputs({
      search: "" // Only need to clear the single search field
    });
    setFilters({
      search: "",
      phoneSearch: "",
      agentSearch: "",
      status: "",
      dateRange: "",
      agent: "",
      premiumMin: undefined,
      premiumMax: undefined,
      isFlagged: undefined,
    });
    setActiveTab("all");
  };
  
  const handleSortChange = (column: string) => {
    setSorting(prev => {
      if (prev.column === column) {
        // Toggle direction if clicking the same column
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      } else {
        // Default to descending for new column
        return {
          column,
          direction: 'desc'
        };
      }
    });
  };
  
  // Extract the calls data from the flattened pages
  const allCalls = data?.pages.flatMap(page => page.calls) || [];
  
  // Count items for each tab
  const getTabCounts = () => {
    if (!data?.pages[0]) return { all: 0, flagged: 0, pending: 0, approved: 0 };
    
    // Get the total count from the first page of results
    const totalCount = data.pages[0].total;
    const counts = { all: totalCount, flagged: 0, pending: 0, approved: 0 };
    
    allCalls.forEach(call => {
      if (call.isFlagged) counts.flagged++;
      if (call.status === "pending") counts.pending++;
      if (call.status === "approved") counts.approved++;
    });
    
    return counts;
  };
  
  const tabCounts = getTabCounts();
  
  // Calculate information about the loaded data
  const totalItems = data?.pages?.[0]?.total || 0;
  const loadedItems = allCalls.length;
  
  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold gradient-heading">Call Quality Dashboard</h1>
          <p className="text-slate-500 mt-2">Manage and review call recordings</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <Button 
            variant="outline" 
            className="whitespace-nowrap shadow-sm hover:shadow-md transition-all"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            className="whitespace-nowrap shadow-sm hover:shadow-md transition-all"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Filters section */}
      {showFilters && (
        <div className="dashboard-card p-5 mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-medium flex items-center">
              <SlidersHorizontal className="h-4 w-4 mr-2 text-primary/70" />
              Filters
            </h2>
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="hover:bg-slate-100">Clear all</Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-3">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Search</label>
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by phone number or agent name..."
                    className="pl-10 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
                    value={searchInputs.search}
                    onChange={(e) => setSearchInputs(prev => ({ ...prev, search: e.target.value }))}
                    onKeyDown={handleSearchKeyDown}
                  />
                </div>
                <Button 
                  variant="default" 
                  onClick={handleApplySearch}
                  size="icon"
                  className="shrink-0 shadow-sm hover:shadow-md transition-all"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Status</label>
              <Select 
                value={filters.status} 
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger className="shadow-sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Date Range</label>
              <Select 
                value={filters.dateRange} 
                onValueChange={(value) => handleFilterChange("dateRange", value)}
              >
                <SelectTrigger className="shadow-sm">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">Last 7 days</SelectItem>
                  <SelectItem value="month">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
      
      {/* Tabs */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={handleTabChange} className="mb-6">
        <TabsList className="bg-white border rounded-lg p-1.5 w-full grid grid-cols-2 md:grid-cols-4 gap-1 shadow-sm">
          <TabsTrigger value="all" className="rounded py-2">
            All Calls 
            <Badge variant="outline" className="ml-2 bg-white font-medium">
              {tabCounts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="flagged" className="rounded py-2">
            Flagged 
            <Badge variant="outline" className="ml-2 bg-white text-red-600 border-red-200 font-medium">
              {tabCounts.flagged}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" className="rounded py-2">
            Pending 
            <Badge variant="outline" className="ml-2 bg-white text-amber-600 border-amber-200 font-medium">
              {tabCounts.pending}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="approved" className="rounded py-2">
            Approved 
            <Badge variant="outline" className="ml-2 bg-white text-green-600 border-green-200 font-medium">
              {tabCounts.approved}
            </Badge>
          </TabsTrigger>
        </TabsList>
        
        {/* Tab content */}
        <TabsContent value={activeTab} className="mt-6 animate-fade-in">
          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : isError ? (
            <div className="bg-red-50 text-red-600 rounded-lg p-6 mb-6 shadow-sm border border-red-100">
              <h3 className="font-medium text-lg mb-2">Error</h3>
              <p>{error instanceof Error ? error.message : "Failed to fetch calls"}</p>
            </div>
          ) : allCalls.length === 0 ? (
            <div className="bg-slate-50 rounded-lg p-10 text-center shadow-sm border">
              <h3 className="text-xl font-medium text-slate-700 mb-3">No calls found</h3>
              <p className="text-slate-500 mb-5">Try adjusting your filters or search criteria</p>
              <Button variant="outline" onClick={handleClearFilters} className="shadow-sm">Clear all filters</Button>
            </div>
          ) : (
            <>
              {/* Call cards */}
              <div className="space-y-4">
                {allCalls.map((call) => (
                  <CallRow key={call.id} call={call} />
                ))}
              </div>
              
              {/* Load more indicator */}
              {hasNextPage && (
                <div 
                  ref={loadMoreRef} 
                  className="py-6 text-center mt-4"
                >
                  {isFetchingNextPage ? (
                    <div className="flex justify-center items-center py-4">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 bg-white py-3 px-4 rounded-full shadow-sm border inline-block">
                      Scroll to load more ({loadedItems} of {totalItems})
                    </p>
                  )}
                </div>
              )}
              
              {/* Data status */}
              <div className="mt-6 flex justify-center">
                <p className="text-sm text-slate-500 text-center bg-white py-2.5 px-4 rounded-full shadow-sm border inline-block">
                  Showing <span className="font-medium text-primary">{loadedItems}</span> of{" "}
                  <span className="font-medium text-primary">{totalItems}</span> calls
                </p>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}