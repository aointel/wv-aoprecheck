import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FiTarget, FiPlus } from 'react-icons/fi';

interface CampaignDisplayProps {
  agentEmail?: string;
}

export function CampaignDisplay({ agentEmail }: CampaignDisplayProps) {
  // Query campaigns from API
  const { data: campaignsData, isLoading, error } = useQuery({
    queryKey: ['/api/campaigns', agentEmail],
    queryFn: async () => {
      if (!agentEmail) return null;
      
      const response = await fetch(`/api/campaigns?agentEmail=${encodeURIComponent(agentEmail)}`);
      
      if (!response.ok) {
        console.log('Campaigns API error, returning empty campaigns');
        return {
          success: true,
          campaigns: []
        };
      }
      
      return response.json();
    },
    enabled: !!agentEmail
  });



  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FiTarget className="w-4 h-4" />
            Campaign
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">Loading campaigns...</div>
        </CardContent>
      </Card>
    );
  }

  const campaigns = campaignsData?.campaigns || [];
  const activeCampaigns = campaigns.filter((campaign: any) => campaign.isActive);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FiTarget className="w-4 h-4" />
          Campaign
          {activeCampaigns.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {activeCampaigns.length} Active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeCampaigns.length === 0 ? (
          <div className="text-center py-4">
            <div className="text-sm text-gray-500 mb-3">No active campaign</div>
            <Button size="sm" variant="outline" className="w-full">
              <FiPlus className="w-4 h-4 mr-2" />
              Please Create a Campaign
            </Button>
          </div>
        ) : (
          activeCampaigns.map((campaign: any) => (
            <div key={campaign.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{campaign.campaignName}</span>
                  <Badge variant={campaign.isActive ? "default" : "secondary"} className="text-xs">
                    {campaign.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <Badge variant="outline" className="text-xs">
                  {campaign.leadCount || 0} leads
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="capitalize">{campaign.campaignType}</span>
                {campaign.filters?.market && campaign.filters.market !== 'all' && (
                  <>
                    <span>•</span>
                    <span>{campaign.filters.market}</span>
                  </>
                )}
              </div>


            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}