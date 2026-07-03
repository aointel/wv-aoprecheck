import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Target,
  Play,
  Pause,
  Clock,
  Zap,
  Trash2,
  Users,
  Radio,
  ChevronRight,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { SmartCampaignModal } from '@/components/smart-campaign/SmartCampaignModal';
import { Label } from '@/components/ui/label';

interface Campaign {
  id: number;
  campaignName: string;
  campaignType: 'smart' | 'custom';
  leadCount: number;
  filters?: any;
  isActive: boolean;
  agentEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface CampaignManagerProps {
  userEmail: string;
  onCampaignSelect?: (campaign: Campaign | null) => void;
  showAsCampaignDropdown?: boolean;
  currentActiveCampaign?: Campaign | null;
}

export default function CampaignManager({
  userEmail,
  onCampaignSelect,
  showAsCampaignDropdown = false,
  currentActiveCampaign,
}: CampaignManagerProps) {
  const [isSmartCampaignModalOpen, setIsSmartCampaignModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch campaigns
  const { data: campaigns = [], isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery({
    queryKey: ['/api/campaigns', userEmail],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/campaigns?agentEmail=${encodeURIComponent(userEmail)}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Failed to fetch campaigns');
        return Array.isArray(data.campaigns) ? data.campaigns : [];
      } catch (error) {
        console.error('Error fetching campaigns:', error);
        return [];
      }
    },
  });

  // Activate campaign mutation
  const activateCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const response = await fetch(`/api/campaigns/${campaignId}/activate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentEmail: userEmail }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.campaign;
    },
    onSuccess: (activatedCampaign) => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', userEmail] });
      onCampaignSelect?.(activatedCampaign);
      toast({ title: 'Campaign Activated', description: `${activatedCampaign.campaignName} is now active`, duration: 3000 });
    },
    onError: (error) => {
      toast({ title: 'Activation Failed', description: error.message || 'Failed to activate campaign', variant: 'destructive', duration: 3000 });
    },
  });

  // Deactivate campaign mutation
  const deactivateCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const response = await fetch(`/api/campaigns/${campaignId}/deactivate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentEmail: userEmail }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.campaign;
    },
    onSuccess: (deactivatedCampaign) => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', userEmail] });
      onCampaignSelect?.(null);
      toast({ title: 'Campaign Paused', description: `${deactivatedCampaign.campaignName} is now inactive`, duration: 3000 });
    },
    onError: (error) => {
      toast({ title: 'Deactivation Failed', description: error.message || 'Failed to deactivate campaign', variant: 'destructive', duration: 3000 });
    },
  });

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const response = await fetch(`/api/campaigns/${campaignId}?agentEmail=${encodeURIComponent(userEmail)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.campaign;
    },
    onSuccess: (deletedCampaign) => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', userEmail] });
      toast({ title: 'Campaign Deleted', description: `${deletedCampaign.campaignName} has been removed`, duration: 3000 });
    },
    onError: (error) => {
      toast({ title: 'Deletion Failed', description: error.message || 'Failed to delete campaign', variant: 'destructive', duration: 3000 });
    },
  });

  // Set initial active campaign
  useEffect(() => {
    if (Array.isArray(campaigns)) {
      const active = campaigns.find((c: Campaign) => c.isActive);
      if (active && (!currentActiveCampaign || currentActiveCampaign.id !== active.id)) {
        onCampaignSelect?.(active);
      }
    }
  }, [campaigns, currentActiveCampaign, onCampaignSelect]);

  const handleCreateCampaign = (filters: any) => {
    const campaignData = {
      campaignName: filters.campaignName,
      campaignType: 'smart' as const,
      filters: {
        markets: filters.markets,
        states: filters.states,
        timeZones: filters.timeZones,
        orderBy: filters.orderBy,
        leadStatuses: filters.leadStatuses,
      },
    };
    fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...campaignData, agentEmail: userEmail }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setIsSmartCampaignModalOpen(false);
          refetchCampaigns();
          toast({ title: 'Smart Campaign Created', description: `"${filters.campaignName}" created successfully!`, duration: 3000 });
        } else {
          throw new Error(data.error || 'Failed to create campaign');
        }
      })
      .catch((error) => {
        toast({ title: 'Campaign Creation Failed', description: error.message || 'An error occurred.', variant: 'destructive', duration: 3000 });
      });
  };

  // ── Dropdown mode (embedded in dialer) ────────────────────────────────────
  if (showAsCampaignDropdown) {
    return (
      <div className="mb-4">
        <Label className="text-sm font-medium text-gray-700 mb-2 block">Active Campaign</Label>
        <Select
          value={currentActiveCampaign?.id.toString() || ''}
          onValueChange={(value) => {
            if (value === 'new') {
              setIsSmartCampaignModalOpen(true);
            } else if (value) {
              const selected = campaigns.find((c: Campaign) => c.id.toString() === value);
              if (selected) onCampaignSelect?.(selected);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select or create a campaign" />
          </SelectTrigger>
          <SelectContent>
            {Array.isArray(campaigns) &&
              campaigns.map((campaign: Campaign) => (
                <SelectItem key={campaign.id} value={campaign.id.toString()}>
                  <div className="flex items-center gap-2">
                    {campaign.campaignType === 'smart' ? <Target className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                    <span>{campaign.campaignName}</span>
                    <Badge variant="secondary" className="ml-auto">{campaign.leadCount}</Badge>
                  </div>
                </SelectItem>
              ))}
            <Separator />
            <SelectItem value="new">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create New Campaign
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <SmartCampaignModal
          isOpen={isSmartCampaignModalOpen}
          onClose={() => setIsSmartCampaignModalOpen(false)}
          userEmail={userEmail}
          onApplyFilters={handleCreateCampaign}
        />
      </div>
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const activeCampaign = Array.isArray(campaigns) ? campaigns.find((c: Campaign) => c.isActive) : null;
  const inactiveCampaigns = Array.isArray(campaigns) ? campaigns.filter((c: Campaign) => !c.isActive) : [];

  const filterSummary = (filters: any): string => {
    if (!filters) return '';
    const parts: string[] = [];
    if (filters.markets?.length) parts.push(filters.markets.join(' · '));
    if (filters.timeZones?.length) parts.push(filters.timeZones.join(' · '));
    if (filters.states?.length) parts.push(`${filters.states.length} states`);
    return parts.join(' — ');
  };

  // ── Main control room view ─────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-zinc-950 text-white">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-zinc-900/60">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full bg-gradient-to-b from-cyan-400 to-blue-600" />
          <div>
            <h1 className="text-lg font-black tracking-tight text-white leading-none">Campaign Manager</h1>
            <p className="text-[11px] text-white/40 mt-0.5 font-medium uppercase tracking-wider">Phone Room Control</p>
          </div>
        </div>
        <button
          onClick={() => setIsSmartCampaignModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Campaign
        </button>
      </div>

      <div className="px-6 py-5 space-y-6">

        {/* ── LIVE campaign block ── */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span className="text-[10px] font-black tracking-widest uppercase text-emerald-400">Live Campaign</span>
          </div>

          {activeCampaign ? (
            <div className="relative rounded-lg border border-emerald-500/40 bg-emerald-950/30 overflow-hidden">
              {/* Green left accent bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-cyan-500 rounded-l-lg" />

              <div className="pl-5 pr-4 py-4 flex items-center gap-4">
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-emerald-900/60 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  {activeCampaign.campaignType === 'smart'
                    ? <Target className="w-4 h-4 text-emerald-400" />
                    : <Users className="w-4 h-4 text-emerald-400" />}
                </div>

                {/* Name + filters */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white text-sm truncate">{activeCampaign.campaignName}</span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-1.5 py-0.5 rounded uppercase tracking-wider">LIVE</span>
                  </div>
                  {activeCampaign.campaignType === 'smart' && activeCampaign.filters && (
                    <p className="text-[11px] text-white/40 mt-0.5 truncate">{filterSummary(activeCampaign.filters) || 'Smart Campaign'}</p>
                  )}
                </div>

                {/* Stats */}
                <div className="text-right shrink-0">
                  <div className="text-xl font-black text-white tabular-nums">{activeCampaign.leadCount.toLocaleString()}</div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">Leads</div>
                </div>

                {/* Pause button */}
                <button
                  onClick={() => deactivateCampaignMutation.mutate(activeCampaign.id)}
                  disabled={deactivateCampaignMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white/70 hover:text-white text-xs font-bold transition-colors shrink-0 disabled:opacity-50"
                >
                  <Pause className="w-3 h-3" />
                  Pause
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-white/8 bg-zinc-900/40 px-4 py-5 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <span className="text-sm text-white/30 italic">No active campaign — select one below or create new</span>
            </div>
          )}
        </section>

        {/* ── Campaign list ── */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black tracking-widest uppercase text-white/40">
              All Campaigns
              {campaigns.length > 0 && <span className="ml-1.5 text-white/20">({campaigns.length})</span>}
            </span>
          </div>

          {campaignsLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 bg-zinc-900/30 flex flex-col items-center justify-center py-12 text-center">
              <Zap className="w-8 h-8 text-white/15 mb-3" />
              <p className="text-sm font-bold text-white/30">No campaigns yet</p>
              <p className="text-xs text-white/20 mt-1">Create a smart campaign to start dialing</p>
              <button
                onClick={() => setIsSmartCampaignModalOpen(true)}
                className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white/60 hover:text-white text-xs font-bold transition-colors"
              >
                <Plus className="w-3 h-3" />
                Create First Campaign
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-white/8 overflow-hidden divide-y divide-white/6">
              {Array.isArray(campaigns) && campaigns.map((campaign: Campaign, idx: number) => {
                const isLive = campaign.isActive;
                return (
                  <div
                    key={campaign.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 group transition-colors',
                      isLive ? 'bg-emerald-950/20' : 'bg-zinc-900/50 hover:bg-zinc-800/50',
                    )}
                  >
                    {/* Live indicator dot */}
                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', isLive ? 'bg-emerald-400 animate-pulse' : 'bg-white/15')} />

                    {/* Type icon */}
                    <div className={cn(
                      'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                      isLive ? 'bg-emerald-900/50 border border-emerald-500/30' : 'bg-zinc-800 border border-white/8',
                    )}>
                      {campaign.campaignType === 'smart'
                        ? <Target className={cn('w-3.5 h-3.5', isLive ? 'text-emerald-400' : 'text-white/40')} />
                        : <Users className={cn('w-3.5 h-3.5', isLive ? 'text-emerald-400' : 'text-white/40')} />}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-bold truncate', isLive ? 'text-white' : 'text-white/70')}>{campaign.campaignName}</span>
                        <span className={cn('text-[9px] font-black uppercase tracking-wider px-1 py-0.5 rounded border shrink-0',
                          campaign.campaignType === 'smart'
                            ? 'text-blue-400 border-blue-500/30 bg-blue-950/40'
                            : 'text-zinc-400 border-zinc-600/40 bg-zinc-800/40'
                        )}>
                          {campaign.campaignType === 'smart' ? 'Smart' : 'Custom'}
                        </span>
                      </div>
                      {campaign.campaignType === 'smart' && campaign.filters && filterSummary(campaign.filters) && (
                        <p className="text-[10px] text-white/30 mt-0.5 truncate">{filterSummary(campaign.filters)}</p>
                      )}
                    </div>

                    {/* Lead count */}
                    <div className="text-right shrink-0">
                      <span className={cn('text-sm font-black tabular-nums', isLive ? 'text-emerald-300' : 'text-white/50')}>{campaign.leadCount.toLocaleString()}</span>
                      <span className="text-[9px] text-white/25 ml-1">leads</span>
                    </div>

                    {/* Date */}
                    <div className="text-[10px] text-white/25 tabular-nums shrink-0 w-16 text-right">
                      {new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isLive ? (
                        <button
                          onClick={() => deactivateCampaignMutation.mutate(campaign.id)}
                          disabled={deactivateCampaignMutation.isPending}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-amber-400 hover:bg-amber-950/40 border border-amber-500/20 transition-colors disabled:opacity-50"
                        >
                          <Pause className="w-2.5 h-2.5" />
                          Pause
                        </button>
                      ) : (
                        <button
                          onClick={() => activateCampaignMutation.mutate(campaign.id)}
                          disabled={activateCampaignMutation.isPending}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/40 border border-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          <Play className="w-2.5 h-2.5" />
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${campaign.campaignName}"?`)) {
                            deleteCampaignMutation.mutate(campaign.id);
                          }
                        }}
                        disabled={deleteCampaignMutation.isPending}
                        className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>

      {/* Smart Campaign Modal */}
      <SmartCampaignModal
        isOpen={isSmartCampaignModalOpen}
        onClose={() => setIsSmartCampaignModalOpen(false)}
        userEmail={userEmail}
        onApplyFilters={handleCreateCampaign}
      />
    </div>
  );
}
