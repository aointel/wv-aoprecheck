import { useState } from "react";
import { Search, X, Filter, RefreshCw, SlidersHorizontal, CalendarDays, Check, AlertTriangle, UserCheck, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SearchFilterBarProps {
  filters: {
    search: string;
    status: string;
    dateRange: string;
    agent: string;
    premiumMin?: number;
    premiumMax?: number;
    isFlagged?: boolean;
  };
  onFilterChange: (filters: SearchFilterBarProps['filters']) => void;
}

export default function SearchFilterBar({ filters, onFilterChange }: SearchFilterBarProps) {
  const [tempFilters, setTempFilters] = useState(filters);
  
  // List of active filters for display
  const activeFilters = [];
  if (filters.status) {
    const statusLabels: Record<string, string> = {
      'pending': 'Pending Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'flagged': 'Flagged'
    };
    activeFilters.push({ 
      key: 'status', 
      value: statusLabels[filters.status] || filters.status,
      color: 'bg-blue-100 text-blue-800 border-blue-300'
    });
  }
  
  if (filters.dateRange) {
    const dateRangeLabels: Record<string, string> = {
      'today': 'Today',
      'yesterday': 'Yesterday',
      'thisweek': 'This Week',
      'lastweek': 'Last Week',
      'thismonth': 'This Month'
    };
    activeFilters.push({ 
      key: 'dateRange', 
      value: dateRangeLabels[filters.dateRange] || filters.dateRange,
      color: 'bg-purple-100 text-purple-800 border-purple-300'
    });
  }
  
  if (filters.agent) {
    activeFilters.push({ 
      key: 'agent', 
      value: `Agent: ${filters.agent}`,
      color: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    });
  }
  
  if (filters.isFlagged) {
    activeFilters.push({ 
      key: 'isFlagged', 
      value: 'Flagged Calls Only',
      color: 'bg-red-100 text-red-800 border-red-300'
    });
  }
  
  if (filters.premiumMin && filters.premiumMax) {
    activeFilters.push({ 
      key: 'premium', 
      value: `$${filters.premiumMin}-$${filters.premiumMax}`,
      color: 'bg-amber-100 text-amber-800 border-amber-300'
    });
  } else if (filters.premiumMin) {
    activeFilters.push({ 
      key: 'premiumMin', 
      value: `Min $${filters.premiumMin}`,
      color: 'bg-amber-100 text-amber-800 border-amber-300'
    });
  } else if (filters.premiumMax) {
    activeFilters.push({ 
      key: 'premiumMax', 
      value: `Max $${filters.premiumMax}`,
      color: 'bg-amber-100 text-amber-800 border-amber-300'
    });
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFilters = { ...filters, search: e.target.value };
    onFilterChange(newFilters);
  };

  const handleApplyFilters = () => {
    onFilterChange(tempFilters);
  };

  const handleResetFilters = () => {
    const resetFilters = {
      ...filters,
      search: "",
      status: "",
      dateRange: "",
      agent: "",
      premiumMin: undefined,
      premiumMax: undefined,
      isFlagged: undefined
    };
    setTempFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  const handleRemoveFilter = (key: string) => {
    const newFilters = { ...filters };
    if (key === 'premium') {
      newFilters.premiumMin = undefined;
      newFilters.premiumMax = undefined;
    } else if (key in newFilters) {
      (newFilters as any)[key] = key === 'isFlagged' ? undefined : "";
    }
    onFilterChange(newFilters);
    setTempFilters(newFilters);
  };

  // Calculate the total number of active filters
  const activeFilterCount = activeFilters.length;

  return (
    <div className="mb-6">
      {/* Search and filter controls */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <Input
                type="text"
                placeholder="Search by phone, name, or agent..."
                className="pl-10 border-slate-200 focus-visible:ring-blue-500"
                value={filters.search}
                onChange={handleSearchChange}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Status filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Check className="h-4 w-4 mr-2 text-slate-600" />
                  Status
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Status Filter</h4>
                  <Separator />
                  <div className="space-y-1 pt-1">
                    <Select 
                      value={tempFilters.status}
                      onValueChange={(value) => {
                        setTempFilters({...tempFilters, status: value});
                        onFilterChange({...filters, status: value});
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs border-slate-200">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending Review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="flagged">Flagged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Date filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  <CalendarDays className="h-4 w-4 mr-2 text-slate-600" />
                  Date
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Date Filter</h4>
                  <Separator />
                  <div className="space-y-1 pt-1">
                    <Select 
                      value={tempFilters.dateRange}
                      onValueChange={(value) => {
                        setTempFilters({...tempFilters, dateRange: value});
                        onFilterChange({...filters, dateRange: value});
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs border-slate-200">
                        <SelectValue placeholder="All Dates" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Dates</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="thisweek">This Week</SelectItem>
                        <SelectItem value="lastweek">Last Week</SelectItem>
                        <SelectItem value="thismonth">This Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Agent filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  <UserCheck className="h-4 w-4 mr-2 text-slate-600" />
                  Agent
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Agent Filter</h4>
                  <Separator />
                  <div className="space-y-1 pt-1">
                    <Select 
                      value={tempFilters.agent}
                      onValueChange={(value) => {
                        setTempFilters({...tempFilters, agent: value});
                        onFilterChange({...filters, agent: value});
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs border-slate-200">
                        <SelectValue placeholder="All Agents" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Agents</SelectItem>
                        <SelectItem value="Sarah Johnson">Sarah Johnson</SelectItem>
                        <SelectItem value="David Lee">David Lee</SelectItem>
                        <SelectItem value="Emily Wilson">Emily Wilson</SelectItem>
                        <SelectItem value="Michelle Garcia">Michelle Garcia</SelectItem>
                        <SelectItem value="James Wilson">James Wilson</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Premium filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  <DollarSign className="h-4 w-4 mr-2 text-slate-600" />
                  Premium
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-3" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Premium Range</h4>
                  <Separator />
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-slate-500 mb-1">Min ($)</Label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          className="h-8 text-xs border-slate-200"
                          value={tempFilters.premiumMin || ''} 
                          onChange={(e) => setTempFilters({...tempFilters, premiumMin: e.target.value ? Number(e.target.value) : undefined})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1">Max ($)</Label>
                        <Input 
                          type="number" 
                          placeholder="1000" 
                          className="h-8 text-xs border-slate-200"
                          value={tempFilters.premiumMax || ''} 
                          onChange={(e) => setTempFilters({...tempFilters, premiumMax: e.target.value ? Number(e.target.value) : undefined})}
                        />
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full h-7 text-xs mt-1"
                      onClick={() => {
                        onFilterChange({
                          ...filters, 
                          premiumMin: tempFilters.premiumMin, 
                          premiumMax: tempFilters.premiumMax
                        });
                      }}
                    >
                      Apply Range
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Flagged toggle */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-9 border-slate-200 ${filters.isFlagged ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-slate-700'} hover:bg-slate-50 hover:text-slate-900`}
                >
                  <AlertTriangle className={`h-4 w-4 mr-2 ${filters.isFlagged ? 'text-red-600' : 'text-slate-600'}`} />
                  Flagged
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Flagged Calls</h4>
                  <Separator />
                  <div className="flex items-center justify-between pt-1">
                    <Label htmlFor="flagged-toggle" className="text-sm">Show flagged calls only</Label>
                    <Switch 
                      id="flagged-toggle" 
                      checked={!!tempFilters.isFlagged}
                      onCheckedChange={(checked) => {
                        setTempFilters({...tempFilters, isFlagged: checked});
                        onFilterChange({...filters, isFlagged: checked});
                      }}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            {/* More options */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2 text-slate-600" />
                  <span className="hidden sm:inline">More</span>
                  {activeFilterCount > 0 && (
                    <Badge className="ml-1 h-5 px-1.5 bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-3" align="end">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Active Filters</h4>
                    {activeFilterCount > 0 && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 px-2 text-xs hover:bg-red-50 hover:text-red-600"
                        onClick={handleResetFilters}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Reset All
                      </Button>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-2 pt-1">
                    {activeFilterCount > 0 ? (
                      activeFilters.map((filter) => (
                        <div key={filter.key} className="flex items-center justify-between">
                          <Badge variant="outline" className={`${filter.color} border px-2 py-0.5 text-xs`}>
                            {filter.value}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 hover:bg-slate-100 hover:text-slate-600"
                            onClick={() => handleRemoveFilter(filter.key)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic">No active filters</p>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        
        {/* Active filters display - horizontal badges */}
        {activeFilterCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Active Filters:</span>
            {activeFilters.map((filter) => (
              <Badge
                key={filter.key}
                variant="outline"
                className={`${filter.color} border flex items-center gap-1 px-2 py-0.5 text-xs`}
              >
                <span>{filter.value}</span>
                <button
                  className="ml-1 rounded-full hover:bg-white/20 focus:outline-none"
                  onClick={() => handleRemoveFilter(filter.key)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-slate-600 hover:bg-slate-100"
              onClick={handleResetFilters}
            >
              Clear All
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
