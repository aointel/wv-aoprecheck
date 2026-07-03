import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Target, 
  Users, 
  PhoneCall,
  Save,
  Power,
  Activity,
  Clock,
  Search,
  AlertTriangle
} from 'lucide-react';

interface TaalkCampaign {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'archived';
  totalAgents: number;
  onlineAgents: number;
  onCallsAgents: number;
  availableAgents: number;
  totalCalls: number;
  activeAgents: number;
  limitPerHour: number;
  dailyStartTime: string;
  dailyEndTime: string;
  contactCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function TaalkCampaignManager() {
  const [editingLimits, setEditingLimits] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch campaigns from Supabase (auto-refreshes every 10 seconds)
  const { data: campaigns = [], isLoading } = useQuery<TaalkCampaign[]>({
    queryKey: ['taalk-campaigns'],
    queryFn: async () => {
      const response = await fetch('/api/taalk/campaigns');
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to fetch campaigns');
      return data.campaigns || [];
    },
    refetchInterval: 10000, // Refresh every 10 seconds for real-time agent status
    staleTime: 5000 // Consider data stale after 5 seconds
  });

  // Update dials per hour
  const updateLimitMutation = useMutation({
    mutationFn: async ({ campaignId, limitPerHour }: { campaignId: string; limitPerHour: number }) => {
      const response = await fetch(`/api/taalk/campaigns/${campaignId}/update-limit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limitPerHour })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.campaign;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['taalk-campaigns'] });
      setEditingLimits(prev => {
        const newState = { ...prev };
        delete newState[variables.campaignId];
        return newState;
      });
      toast({
        title: "Limit Updated",
        description: `Dials per hour set to ${variables.limitPerHour}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Shutdown campaign
  const shutdownMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/taalk/campaigns/${campaignId}/shutdown`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taalk-campaigns'] });
      toast({
        title: "Campaign Shutdown",
        description: "Campaign has been shut down",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Shutdown Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Bulk shutdown by market
  const bulkShutdownMutation = useMutation({
    mutationFn: async (market: string) => {
      const response = await fetch('/api/taalk/campaigns/bulk-shutdown', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['taalk-campaigns'] });
      toast({
        title: "Bulk Shutdown Complete",
        description: `${data.message}. Campaigns: ${data.shutdownNames?.join(', ')}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Shutdown Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Bulk update dials per hour by market
  const bulkUpdateDialsMutation = useMutation({
    mutationFn: async ({ market, limitPerHour }: { market: string; limitPerHour: number }) => {
      const response = await fetch('/api/taalk/campaigns/bulk-update-limit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market, limitPerHour })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['taalk-campaigns'] });
      toast({
        title: "Bulk Update Complete",
        description: `${data.message}. Updated ${data.updatedCount} campaigns to ${data.limitPerHour} dials/hour`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Detect market from campaign name
  const getMarket = (campaignName: string): string => {
    const name = campaignName.toLowerCase();
    
    // Veteran: campaigns that contain "pavet" (with or without dash)
    if (name.includes('pavet')) {
      return 'Veteran';
    } 
    
    // Globe: campaigns that contain "globe" (with or without dash)
    if (name.includes('globe')) {
      return 'Globe';
    }
    
    // AOI Recruit: campaigns that contain "recruit" or "aorecruit"
    if (name.includes('recruit') || name.includes('aorecruit')) {
      return 'AOI Recruit';
    }
    
    return 'Other';
  };

  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Count campaigns by market (ALL campaigns, regardless of status)
  const veteranCount = campaigns.filter(c => getMarket(c.name) === 'Veteran').length;
  const globeCount = campaigns.filter(c => getMarket(c.name) === 'Globe').length;
  const recruitCount = campaigns.filter(c => getMarket(c.name) === 'AOI Recruit').length;
  
  // State for AOI Recruit dial control
  const [recruitDialRate, setRecruitDialRate] = useState<number>(400);

  const handleLimitChange = (campaignId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setEditingLimits(prev => ({ ...prev, [campaignId]: numValue }));
  };

  const handleSaveLimit = (campaign: TaalkCampaign) => {
    const newLimit = editingLimits[campaign.id];
    if (newLimit !== undefined && newLimit !== campaign.limitPerHour) {
      updateLimitMutation.mutate({ campaignId: campaign.id, limitPerHour: newLimit });
    }
  };

  const getCurrentLimit = (campaign: TaalkCampaign) => {
    return editingLimits[campaign.id] !== undefined ? editingLimits[campaign.id] : campaign.limitPerHour;
  };

  const hasUnsavedChanges = (campaign: TaalkCampaign) => {
    return editingLimits[campaign.id] !== undefined && editingLimits[campaign.id] !== campaign.limitPerHour;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">VDP Campaign Control</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage dials per hour and campaign status
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Campaigns</p>
                <p className="text-2xl font-bold">{campaigns.length}</p>
              </div>
              <Target className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {campaigns.filter(c => c.status !== 'archived').length}
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Calls</p>
                <p className="text-2xl font-bold">
                  {campaigns.reduce((sum, c) => sum + (c.contactCount || 0), 0).toLocaleString()}
                </p>
              </div>
              <PhoneCall className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Max Dials/Hour</p>
                <p className="text-2xl font-bold text-orange-600">
                  {Math.max(...campaigns.map(c => c.limitPerHour || 0), 0)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Market Bulk Actions */}
      <Card className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 border-red-200 dark:border-red-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Market Shutdown Controls</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Shut down all campaigns for an entire market instantly
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="destructive"
                size="lg"
                className="gap-2"
                onClick={() => {
                  if (confirm(`Shut down ALL ${veteranCount} Veteran campaigns? This sets dials/hour to 0.`)) {
                    bulkUpdateDialsMutation.mutate({ market: 'Veteran', limitPerHour: 0 });
                  }
                }}
                disabled={bulkUpdateDialsMutation.isPending || veteranCount === 0}
              >
                <Power className="h-4 w-4" />
                Shutdown Veteran ({veteranCount})
              </Button>
              <Button
                variant="destructive"
                size="lg"
                className="gap-2"
                onClick={() => {
                  if (confirm(`Shut down ALL ${globeCount} Globe campaigns? This sets dials/hour to 0.`)) {
                    bulkUpdateDialsMutation.mutate({ market: 'Globe', limitPerHour: 0 });
                  }
                }}
                disabled={bulkUpdateDialsMutation.isPending || globeCount === 0}
              >
                <Power className="h-4 w-4" />
                Shutdown Globe ({globeCount})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AOI Recruit Dial Controls */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">AOI Recruit Controls</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Set dials per hour or shutdown all AOI Recruit campaigns
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Dials/Hour:
                </label>
                <Input
                  type="number"
                  value={recruitDialRate}
                  onChange={(e) => setRecruitDialRate(parseInt(e.target.value) || 0)}
                  className="w-24 h-10"
                  min="0"
                  max="10000"
                />
              </div>
              <Button
                size="lg"
                className="gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  if (confirm(`Set ALL ${recruitCount} AOI Recruit campaigns to ${recruitDialRate} dials per hour?`)) {
                    bulkUpdateDialsMutation.mutate({ market: 'AOI Recruit', limitPerHour: recruitDialRate });
                  }
                }}
                disabled={bulkUpdateDialsMutation.isPending || recruitCount === 0}
              >
                <Clock className="h-4 w-4" />
                Apply ({recruitCount})
              </Button>
              <Button
                variant="destructive"
                size="lg"
                className="gap-2"
                onClick={() => {
                  if (confirm(`Shut down ALL ${recruitCount} AOI Recruit campaigns? This sets dials/hour to 0.`)) {
                    bulkUpdateDialsMutation.mutate({ market: 'AOI Recruit', limitPerHour: 0 });
                  }
                }}
                disabled={bulkUpdateDialsMutation.isPending || recruitCount === 0}
              >
                <Power className="h-4 w-4" />
                Shutdown
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search campaigns by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {filteredCampaigns.length} of {campaigns.length} campaigns
        </span>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-gray-600 dark:text-gray-400">
              Loading campaigns...
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="py-12 text-center">
              <Target className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Campaigns Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm ? 'Try a different search term' : 'No campaigns available'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Campaign Name</TableHead>
                    <TableHead className="w-[90px]">Market</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[80px] text-right">Total</TableHead>
                    <TableHead className="w-[80px] text-right">Online</TableHead>
                    <TableHead className="w-[80px] text-right">On Calls</TableHead>
                    <TableHead className="w-[90px] text-right">Available</TableHead>
                    <TableHead className="w-[100px] text-right">Contacts</TableHead>
                    <TableHead className="w-[140px]">Hours</TableHead>
                    <TableHead className="w-[130px]">Dials/Hour</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.map((campaign) => {
                    const currentLimit = getCurrentLimit(campaign);
                    const unsaved = hasUnsavedChanges(campaign);
                    const market = getMarket(campaign.name);
                    
                    return (
                      <TableRow key={campaign.id} className={unsaved ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="text-sm">{campaign.name}</span>
                            <span className="text-xs text-gray-500 font-mono">{campaign.id}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={
                              market === 'Veteran' ? 'border-blue-500 text-blue-700 dark:text-blue-400' :
                              market === 'Globe' ? 'border-purple-500 text-purple-700 dark:text-purple-400' :
                              market === 'AOI Recruit' ? 'border-green-500 text-green-700 dark:text-green-400' :
                              'border-gray-400 text-gray-600'
                            }
                          >
                            {market}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={campaign.status === 'archived' ? 'secondary' : 'default'}
                            className={campaign.status === 'archived' ? 'bg-gray-500' : 'bg-green-600'}
                          >
                            {campaign.status === 'archived' ? 'Shutdown' : 'Active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold">{campaign.totalAgents || 0}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${campaign.onlineAgents > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {campaign.onlineAgents || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${campaign.onCallsAgents > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                            {campaign.onCallsAgents || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold ${campaign.availableAgents > 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-400'}`}>
                            {campaign.availableAgents || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {(campaign.contactCount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {campaign.dailyStartTime} - {campaign.dailyEndTime}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={currentLimit}
                              onChange={(e) => handleLimitChange(campaign.id, e.target.value)}
                              className="w-20 h-8 text-sm"
                              disabled={campaign.status === 'archived'}
                            />
                            {unsaved && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleSaveLimit(campaign)}
                                disabled={updateLimitMutation.isPending}
                              >
                                <Save className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {campaign.status !== 'archived' ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 gap-1"
                              onClick={() => {
                                if (confirm(`Shutdown "${campaign.name}"? This will stop all calls.`)) {
                                  shutdownMutation.mutate(campaign.id);
                                }
                              }}
                              disabled={shutdownMutation.isPending}
                            >
                              <Power className="h-3 w-3" />
                              Shutdown
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-500">Offline</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
