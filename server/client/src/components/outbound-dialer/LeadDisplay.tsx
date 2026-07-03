import { MdPerson } from 'react-icons/md';
import { DialerState } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface LeadDisplayProps {
  state: DialerState;
}

export default function LeadDisplay({ state }: LeadDisplayProps) {
  const { availableLeads, currentLeadIndex, dialingStatus } = state;
  const currentLead = availableLeads[currentLeadIndex];

  console.log('🔍 LeadDisplay Debug:', {
    availableLeadsCount: availableLeads.length,
    currentLeadIndex,
    hasCurrentLead: !!currentLead,
    firstLead: availableLeads[0]?.name
  });

  if (!currentLead) {
    return (
      <Card className="h-full">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <MdPerson className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No lead selected</p>
            <p className="text-xs text-muted-foreground mt-1">
              {availableLeads.length > 0 
                ? `${availableLeads.length} leads loaded - select one to start calling`
                : 'Ready to start calling'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm flex items-center gap-2">
          <MdPerson className="w-4 h-4" />
          Current Lead
          <Badge variant="outline" className="text-xs">
            {currentLeadIndex + 1} of {availableLeads.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-2 p-3">
        {/* Lead Card - Compact design with reduced spacing */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
          {/* Header - compact style with reduced padding */}
          <div className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                    {currentLead.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-base bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                    {currentLead.name}
                  </h4>
                  <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                    <span className="font-mono">{currentLead.phone}</span>
                    <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">
                      ID: {currentLead.leadId}
                    </span>
                    {currentLead.groupCode && (
                      <span className="font-mono bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-1 py-0.5 rounded text-xs">
                        {currentLead.groupCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              


            </div>
            
            {/* Market and Location - compact display */}
            <div className="mt-2 flex items-center space-x-3 text-xs">
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {currentLead.market}
              </span>
              <span className="text-green-600 dark:text-green-400 font-medium">
                {currentLead.city ? `${currentLead.city}, ${currentLead.state}` : currentLead.state}
              </span>
            </div>
          </div>
          
          {/* Expanded Details - Ultra compact version */}
          <div className="p-2 bg-white dark:bg-gray-800 border-t">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              {/* Contact & Lead Info */}
              <div className="space-y-2">
                <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded-lg">
                  <label className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1 block">Contact Information</label>
                  <div className="space-y-1">
                    <div>
                      <span className="text-xs text-muted-foreground">Name:</span>
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">{currentLead.name}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Phone:</span>
                      <p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">{currentLead.phone}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Lead ID:</span>
                      <p className="text-sm font-mono bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded font-bold">
                        {currentLead.leadId}
                      </p>
                    </div>
                    {currentLead.email && (
                      <div>
                        <span className="text-xs text-muted-foreground">Email:</span>
                        <p className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border text-blue-600 dark:text-blue-400">
                          {currentLead.email}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Relationship Section */}
              <div className="space-y-2">
                <div className="bg-purple-50 dark:bg-purple-950/30 p-2 rounded-lg">
                  <label className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide mb-1 block">Relationship</label>
                  <div className="space-y-1">
                    <div>
                      <span className="text-xs text-muted-foreground">Beneficiary:</span>
                      <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">{currentLead.beneficiary || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Relationship:</span>
                      <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">{currentLead.relationship || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Referred By:</span>
                      <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">{currentLead.referredBy || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Sponsor Org:</span>
                      <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">{currentLead.sponsorOrg || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Market & Location Info */}
              <div className="space-y-2">
                <div className="bg-green-50 dark:bg-green-950/30 p-2 rounded-lg">
                  <label className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide mb-1 block">Market & Location</label>
                  <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-muted-foreground">Market:</span>
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200">{currentLead.market}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Group Code:</span>
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200">{currentLead.groupCode || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-muted-foreground">City:</span>
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200">{currentLead.city || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">State:</span>
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200">{currentLead.state}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            {/* Notes Section - Compact */}
            {currentLead.notes && (
              <div className="mt-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 border">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-xs text-gray-700 dark:text-gray-300">{currentLead.notes}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}