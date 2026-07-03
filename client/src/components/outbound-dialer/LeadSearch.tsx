import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ExternalLink, ChevronDown } from 'lucide-react';

interface LeadSearchProps {
  state: any;
  onViewInPlanet?: (leadId: string) => void;
  onSelectLead?: (lead: any, index: number) => void;
}

export default function LeadSearch({ state, onViewInPlanet, onSelectLead }: LeadSearchProps) {
  const { availableLeads, currentLeadIndex } = state;
  
  // State for search and infinite scroll
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  
  // Check if lead is a hot lead
  const isHotLead = (lead: any) => {
    return lead?.taalk_market === 'Hot Lead Campaign' || 
           lead?.market === 'Hot Lead' || 
           lead?.campaign_type === 'Hot Lead' || 
           lead?.isHotLead ||
           lead?.source_table === 'hotleads';
  };

  // Filter leads based on search term
  const filteredLeads = useMemo(() => {
    if (!searchTerm.trim()) {
      return availableLeads; // Show all leads when no search term
    }
    
    return availableLeads.filter((lead: any, index: number) => {
      const matchesSearch = 
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone?.includes(searchTerm) ||
        lead.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.market?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [availableLeads, searchTerm]);

  // Handle lead selection
  const handleLeadSelect = (lead: any) => {
    if (onSelectLead) {
      // Find the original index in availableLeads
      const leadIndex = availableLeads.findIndex((l: any) => l.id === lead.id || 
        (l.name === lead.name && l.phone === lead.phone));
      if (leadIndex !== -1) {
        onSelectLead(lead, leadIndex);
      }
    }
  };

  // Load more leads
  const loadMore = () => {
    setVisibleCount(prev => Math.min(prev + 50, filteredLeads.length));
  };

  const visibleLeads = filteredLeads.slice(0, visibleCount);
  const hasMore = visibleCount < filteredLeads.length;

  return (
    <div className="space-y-3">
      {/* Search Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between mb-3">
            <span>Lead Search</span>
            <Badge variant="outline" className="text-xs">
              {filteredLeads.length} {searchTerm ? 'found' : 'total'}
            </Badge>
          </CardTitle>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by name, phone, city, state, or market..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>
          {searchTerm && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSearchTerm('')}
              className="text-xs w-fit"
            >
              Clear search
            </Button>
          )}
        </CardHeader>
      </Card>

      {/* Search Results */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {visibleLeads.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-muted-foreground">
              {searchTerm ? (
                <p className="text-sm">No leads found matching "{searchTerm}"</p>
              ) : (
                <p className="text-sm">No leads available</p>
              )}
            </CardContent>
          </Card>
        ) : (
          visibleLeads.map((lead: any, index: number) => {
            // Find original index for all leads
            const originalIndex = availableLeads.findIndex((l: any) => l.id === lead.id || (l.name === lead.name && l.phone === lead.phone));
            const isCompleted = originalIndex <= currentLeadIndex;
            const isCurrent = originalIndex === currentLeadIndex;
            const isNext = originalIndex === currentLeadIndex + 1;
            
            return (
              <Card 
                key={lead.id || index}
                className={`cursor-pointer transition-all duration-200 hover:shadow-sm ${
                  isHotLead(lead) ? 'border-orange-300 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20' : ''
                } ${isCurrent ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20' : ''}`}
                onClick={() => handleLeadSelect(lead)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isHotLead(lead) && (
                        <span className="text-orange-600 text-sm">🔥</span>
                      )}
                      <div>
                        <h4 className="font-medium text-sm">{lead.name || 'Unknown'}</h4>
                        <p className="text-xs text-muted-foreground">
                          {lead.state || 'Unknown State'} • {lead.market || 'Standard'}
                          {lead.city && ` • ${lead.city}`}
                        </p>
                        {lead.phone && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {lead.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {isCurrent && (
                        <Badge variant="default" className="text-xs">Current</Badge>
                      )}
                      {isNext && (
                        <Badge variant="secondary" className="text-xs">Next</Badge>
                      )}
                      {isCompleted && !isCurrent && (
                        <Badge variant="outline" className="text-xs">Completed</Badge>
                      )}
                      {onViewInPlanet && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewInPlanet(lead.leadId || lead.id);
                          }}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground">
                        #{originalIndex + 1}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="text-center pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadMore}
            className="text-xs"
          >
            <ChevronDown className="w-3 h-3 mr-1" />
            Load More ({filteredLeads.length - visibleCount} remaining)
          </Button>
        </div>
      )}

      {/* Search Stats */}
      <div className="text-center text-xs text-muted-foreground pt-2">
        {searchTerm ? (
          <p>Showing {visibleLeads.length} of {filteredLeads.length} results</p>
        ) : (
          <p>Showing {visibleLeads.length} of {availableLeads.length} total leads</p>
        )}
      </div>
    </div>
  );
}