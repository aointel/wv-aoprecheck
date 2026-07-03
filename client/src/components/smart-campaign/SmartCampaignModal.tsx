import { useState, useEffect, useCallback } from 'react';

// Simple debounce function for performance optimization
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
import { X, Check, Filter, Target, Clock, SortAsc, Type, Users, TrendingUp, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface SmartCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: CampaignFilters) => void;
  userEmail: string;
}

export interface CampaignFilters {
  campaignName: string;
  markets: string[];
  states: string[];
  timeZones: string[];
  orderBy: 'create_date' | 'last_contact';
  leadStatuses: string[];
}

// Markets will be fetched dynamically from API

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const TIME_ZONES = [
  { value: 'EST', label: 'Eastern (EST)' },
  { value: 'CST', label: 'Central (CST)' },
  { value: 'MST', label: 'Mountain (MST)' },
  { value: 'PST', label: 'Pacific (PST)' }
];

const ORDER_OPTIONS = [
  { value: 'create_date', label: 'Create Date' },
  { value: 'last_contact', label: 'Last Contact' }
];

const ALLOWED_LEAD_STATUSES = [
  'pending',
  'no_answer'
];

const STEPS = [
  { id: 1, title: 'Select Markets', icon: Target },
  { id: 2, title: 'Choose States', icon: MapPin },
  { id: 3, title: 'Select Timezones', icon: Clock },
  { id: 4, title: 'Configure Sorting', icon: SortAsc },
  { id: 5, title: 'Name & Review', icon: Type }
];

export function SmartCampaignModal({ isOpen, onClose, onApplyFilters, userEmail }: SmartCampaignModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [campaignName, setCampaignName] = useState<string>('');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>(US_STATES); // Default to all states
  const [selectedTimeZones, setSelectedTimeZones] = useState<string[]>(['EST', 'CST', 'MST', 'PST']); // Default to all timezones
  const [orderBy, setOrderBy] = useState<'create_date' | 'last_contact'>('create_date');
  const [leadCounts, setLeadCounts] = useState({
    total: 0,
    withMarket: 0,
    withTimezone: 0,
    final: 0
  });
  const [stateCounts, setStateCounts] = useState<Record<string, number>>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [availableMarkets, setAvailableMarkets] = useState<string[]>([]);

  // Debounced lead count fetching to reduce API calls
  const fetchLeadCounts = useCallback(
    debounce(async () => {
      if (!userEmail) return;
      
      try {
        setIsLoadingCounts(true);
        
        const params = new URLSearchParams({
          agentEmail: userEmail,
          pageSize: '1', // Minimal data fetch
          countsOnly: 'true', // Signal backend for counts-only optimization
        });

        if (selectedMarkets.length > 0) {
          params.set('market', selectedMarkets.join(','));
        }
        if (selectedStates.length > 0) {
          params.set('states', selectedStates.join(','));
        }
        if (selectedTimeZones.length > 0) {
          params.set('timezone', selectedTimeZones.join(','));
        }

        const response = await fetch(`/api/campaigns/available-leads?${params}`);
        const data = await response.json();
        
        if (data.success) {
          setLeadCounts(data.counts || {
            total: data.count || 0,
            withMarket: data.count || 0,
            withTimezone: data.count || 0,
            final: data.count || 0
          });
          setStateCounts(data.stateCounts || {});
        }
      } catch (error) {
        console.error('Error fetching lead counts:', error);
        setLeadCounts({ total: 0, withMarket: 0, withTimezone: 0, final: 0 });
      } finally {
        setIsLoadingCounts(false);
      }
    }, 500), // 500ms debounce - wait for user to finish selecting
    [userEmail, selectedMarkets, selectedStates, selectedTimeZones]
  );

  // Fetch available markets when modal opens
  useEffect(() => {
    if (isOpen && userEmail) {
      const fetchAvailableMarkets = async () => {
        try {
          const response = await fetch(`/api/campaigns/available-markets?agentEmail=${userEmail}`);
          const data = await response.json();
          if (data.success) {
            setAvailableMarkets(data.markets || []);
          }
        } catch (error) {
          console.error('Error fetching available markets:', error);
        }
      };
      
      fetchAvailableMarkets();
    }
  }, [isOpen, userEmail]);

  // Fetch counts when filters change
  useEffect(() => {
    if (isOpen) {
      fetchLeadCounts();
    }
  }, [isOpen, selectedMarkets, selectedStates, selectedTimeZones]);

  const handleMarketToggle = (market: string) => {
    setSelectedMarkets(prev => 
      prev.includes(market) 
        ? prev.filter(m => m !== market)
        : [...prev, market]
    );
  };

  const handleStateToggle = (state: string) => {
    setSelectedStates(prev => 
      prev.includes(state) 
        ? prev.filter(s => s !== state)
        : [...prev, state]
    );
  };

  const handleSelectAllStates = () => {
    const allSelected = selectedStates.length === US_STATES.length;
    setSelectedStates(allSelected ? [] : US_STATES);
  };

  const handleTimeZoneToggle = (timezone: string) => {
    setSelectedTimeZones(prev => 
      prev.includes(timezone) 
        ? prev.filter(tz => tz !== timezone)
        : [...prev, timezone]
    );
  };

  const nextStep = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleApply = () => {
    if (!campaignName.trim()) {
      alert('Please enter a campaign name');
      return;
    }

    onApplyFilters({
      campaignName: campaignName.trim(),
      markets: selectedMarkets,
      states: selectedStates,
      timeZones: selectedTimeZones,
      orderBy,
      leadStatuses: ALLOWED_LEAD_STATUSES // Only pending and no_answer
    });
    onClose();
  };

  const handleReset = () => {
    setCurrentStep(1);
    setCampaignName('');
    setSelectedMarkets([]);
    setSelectedStates(US_STATES); // Reset to all states
    setSelectedTimeZones([]);
    setOrderBy('create_date');
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedMarkets.length > 0;
      case 2: return selectedStates.length > 0;
      case 3: return true; // Timezones are optional - allow proceeding without selection
      case 4: return true; // Always can proceed from sorting
      case 5: return campaignName.trim().length > 0;
      default: return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Select Target Markets
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Choose which markets you want to focus on for your campaign
              </p>
            </div>
            
                            <div className="grid grid-cols-2 gap-4">
                  {availableMarkets.map((market) => (
                    <div key={market} 
                         className="group flex items-center space-x-3 p-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                         onClick={() => handleMarketToggle(market)}>
                      <Checkbox
                        id={`market-${market}`}
                        checked={selectedMarkets.includes(market)}
                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <Label 
                        htmlFor={`market-${market}`} 
                        className="text-sm font-medium cursor-pointer text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100"
                      >
                        {market}
                      </Label>
                    </div>
                  ))}
                </div>
            
            {selectedMarkets.length > 0 && (
              <div className="text-center">
                <div className="inline-flex flex-wrap gap-2">
                  {selectedMarkets.map((market) => (
                    <Badge key={market} variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                      {market}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  {selectedMarkets.length} market{selectedMarkets.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Choose Your States
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Select which US states to include in your campaign
              </p>
            </div>

            {/* Select All Toggle */}
            <div className="flex items-center justify-center mb-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAllStates}
                className="flex items-center gap-2 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-600 dark:hover:bg-green-900/20"
              >
                <Checkbox
                  checked={selectedStates.length === US_STATES.length}
                  className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                />
                {selectedStates.length === US_STATES.length ? 'Unselect All States' : 'Select All States'}
                <span className="text-xs text-slate-500">({selectedStates.length}/{US_STATES.length})</span>
              </Button>
            </div>
            
            <div className="grid grid-cols-5 gap-3">
              {US_STATES.map((state) => (
                <div key={state} 
                     className="group flex items-center space-x-2 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                     onClick={() => handleStateToggle(state)}>
                  <Checkbox
                    id={`state-${state}`}
                    checked={selectedStates.includes(state)}
                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  />
                  <Label 
                    htmlFor={`state-${state}`} 
                    className="text-xs font-medium cursor-pointer text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 flex-1"
                  >
                    {state}
                  </Label>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-auto">
                    {isLoadingCounts ? '...' : (stateCounts[state] || 0)}
                  </span>
                </div>
              ))}
            </div>
            
            {selectedStates.length > 0 && (
              <div className="text-center">
                <div className="inline-flex flex-wrap gap-2">
                  {selectedStates.map((state) => (
                    <Badge key={state} variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200">
                      {state}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  {selectedStates.length} state{selectedStates.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Select Time Zones (Optional)
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Choose specific time zones for additional filtering. All timezones are selected by default. This step is optional.
              </p>
            </div>
            
                            <div className="grid grid-cols-2 gap-4">
                  {TIME_ZONES.map((tz) => (
                    <div key={tz.value} 
                         className="group flex items-center space-x-3 p-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                         onClick={() => handleTimeZoneToggle(tz.value)}>
                      <Checkbox
                        id={`timezone-${tz.value}`}
                        checked={selectedTimeZones.includes(tz.value)}
                        className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                      />
                      <Label 
                        htmlFor={`timezone-${tz.value}`} 
                        className="text-sm font-medium cursor-pointer text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100"
                      >
                        {tz.label}
                      </Label>
                    </div>
                  ))}
                </div>
            
            {selectedTimeZones.length > 0 && (
              <div className="text-center">
                <div className="inline-flex flex-wrap gap-2">
                  {selectedTimeZones.map((tz) => (
                    <Badge key={tz} variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-200">
                      {tz}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  {selectedTimeZones.length} timezone{selectedTimeZones.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Configure Lead Sorting
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                How should leads be prioritized in your campaign?
              </p>
            </div>
            
            <RadioGroup 
              value={orderBy} 
              onValueChange={(value: 'create_date' | 'last_contact') => setOrderBy(value)}
              className="space-y-4"
            >
              {ORDER_OPTIONS.map((option) => (
                <div key={option.value} className="group flex items-center space-x-3 p-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border border-slate-200 dark:border-slate-700">
                  <RadioGroupItem 
                    value={option.value} 
                    id={`order-${option.value}`}
                    className="border-2 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                  />
                  <Label 
                    htmlFor={`order-${option.value}`} 
                    className="text-sm font-medium cursor-pointer text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            
            <div className="text-center">
              <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
                {ORDER_OPTIONS.find(opt => opt.value === orderBy)?.label}
              </Badge>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Name Your Campaign
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Give your campaign a unique name and review the final configuration
              </p>
            </div>
            
            <div className="space-y-4">
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Enter campaign name (e.g., 'Veterans West Coast - January 2025')"
                className="w-full bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-purple-500 focus:ring-purple-500"
              />
              
              {campaignName && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    <span className="font-medium">Campaign:</span> {campaignName}
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    ⚠️ Only leads you own with 'pending' or 'no answer' status will be modified
                  </p>
                </div>
              )}
            </div>
            
            {/* Final Summary */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Campaign Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Markets:</span>
                  <span className="font-medium">{selectedMarkets.join(', ') || 'None selected'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">States:</span>
                  <span className="font-medium">{selectedStates.join(', ') || 'None selected'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Timezones:</span>
                  <span className="font-medium">{selectedTimeZones.join(', ') || 'None selected'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Sort Order:</span>
                  <span className="font-medium">{ORDER_OPTIONS.find(opt => opt.value === orderBy)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Final Lead Count:</span>
                  <span className="font-medium text-green-600">{leadCounts.final}</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-blue-900/20">
        <DialogHeader className="border-b border-slate-200/60 dark:border-slate-700/60 pb-6">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Filter className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            Smart Campaign Builder
          </DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400 mt-2">
            Build your targeted campaign step by step
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar with Lead Counts - ALWAYS VISIBLE */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-slate-200/60 dark:border-slate-700/60 mb-6">
          {/* Step Progress */}
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  currentStep >= step.id 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400'
                }`}>
                  {currentStep > step.id ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    currentStep > step.id ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`} />
                )}
              </div>
            ))}
          </div>
          
          {/* Lead Counts */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {isLoadingCounts ? '...' : (leadCounts.total || 0)}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">Total Available</div>
            </div>
            
            <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {isLoadingCounts ? '...' : (leadCounts.withMarket || 0)}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400">With Markets</div>
            </div>
            
            <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                {isLoadingCounts ? '...' : (leadCounts.withTimezone || 0)}
              </div>
              <div className="text-xs text-orange-600 dark:text-orange-400">With Timezones</div>
            </div>
            
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {isLoadingCounts ? '...' : (leadCounts.final || 0)}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400">Final Count</div>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="overflow-y-auto max-h-[40vh] px-1">
          {renderStepContent()}
        </div>

        {/* Navigation Footer */}
        <div className="flex justify-between items-center pt-6 border-t border-slate-200/60 dark:border-slate-700/60">
          <Button 
            variant="ghost" 
            onClick={handleReset}
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
          >
            Reset All
          </Button>
          
          <div className="flex space-x-3">
            {currentStep > 1 && (
              <Button 
                variant="outline" 
                onClick={prevStep}
                className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            
            {currentStep < 5 ? (
              <Button 
                onClick={nextStep}
                disabled={!canProceed()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleApply}
                disabled={!canProceed()}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4 mr-2" />
                Apply Campaign
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}