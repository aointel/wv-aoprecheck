import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Upload } from 'lucide-react';
import { HelpModal } from '@/components/training/HelpModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ALL_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

interface AlexAIActionsProps {
  initialAction?: string | null;
}

export default function AlexAIActions({ initialAction = null }: AlexAIActionsProps = {}) {
  const { authState } = useAuth();
  const { toast } = useToast();
  const currentUserEmail = (authState?.user?.email || '').toLowerCase();
  const isSysopUser = [
    'cnsysop@aoglobelife.com',
    'nateschoot@aoglobelife.com',
    'chrislafond@aoglobelife.com',
    'michaelmandella@aoglobelife.com',
    'mmandella@ailpdx.com',
  ].includes(currentUserEmail);
  
  const [selectedAction, setSelectedAction] = useState<string | null>(initialAction);
  const [agentEmail, setAgentEmail] = useState('');
  const [currentStates, setCurrentStates] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [currentMarket, setCurrentMarket] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [result, setResult] = useState('');
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [eappFile, setEappFile] = useState<File | null>(null);
  const [eappAccepted, setEappAccepted] = useState(false);
  const [eappError, setEappError] = useState<string | null>(null);
  const [eappResult, setEappResult] = useState<{ agentNumber?: string; detectedStates: string[]; added: string[]; previous: string[] } | null>(null);
  const [eappUploading, setEappUploading] = useState(false);
  const eappInputRef = useRef<HTMLInputElement>(null);
  // Compliance: must read notice (15s timer), agree checkbox, and initials before submit
  const COMPLIANCE_READ_SECONDS = 15;
  const [eappComplianceSeconds, setEappComplianceSeconds] = useState(0);
  const [eappComplianceAgreed, setEappComplianceAgreed] = useState(false);
  const [eappComplianceInitials, setEappComplianceInitials] = useState('');

  const actions = [
    { id: 'add_states', label: 'Add Licensed States', icon: '📍' },
    { id: 'change_market', label: 'Change Market', icon: '🌎' },
    { id: 'fix_vdp', label: 'Fix VDP Error', icon: '🔧' },
    { id: 'reset_password', label: 'Reset Password', icon: '🔑' },
    { id: 'something_else', label: 'Something Else', icon: '💬' }
  ];

  const getApiBase = () => (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : '');
  
  // Always default agent email to current user
  useEffect(() => {
    if (authState?.user?.email && !agentEmail) {
      setAgentEmail(authState.user.email);
    }
  }, [authState?.user?.email, agentEmail]);

  // Compliance read timer: when on eapp step (VDP submit), require 15s before agreement is allowed
  const onEappStep = selectedAction === 'fix_vdp' && !eappAccepted;
  useEffect(() => {
    if (!onEappStep) {
      setEappComplianceSeconds(0);
      setEappComplianceAgreed(false);
      setEappComplianceInitials('');
      return;
    }
    const t = setInterval(() => {
      setEappComplianceSeconds((s) => Math.min(s + 1, COMPLIANCE_READ_SECONDS));
    }, 1000);
    return () => clearInterval(t);
  }, [onEappStep]);

  const loadAgentData = async (email: string) => {
    setIsLoadingData(true);
    try {
      const response = await fetch('/api/vdp/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      });

      if (response.ok) {
        const data = await response.json();
        const states = Array.isArray(data.states) ? data.states : [];
        let market = Array.isArray(data.market) ? data.market[0] : (data.market || '');
        
        // Normalize market to match dropdown values
        if (market.toLowerCase().includes('recruit') || market.toLowerCase() === 'aorecruit') {
          market = 'AO Recruit'; // Match the SelectItem value
        } else if (market.toLowerCase().includes('globe')) {
          market = 'Globe'; // Match the SelectItem value
        } else if (market.toLowerCase().includes('vet')) {
          market = 'Veteran'; // Match the SelectItem value
        }
        
        console.log('🔍 LOADING agent data:', { states, market });
        
        // Only set states if we don't already have them loaded
        if (currentStates.length === 0) {
          setCurrentStates(states);
          setSelectedStates(states);
        }
        
        // Only set market if we don't already have it loaded
        if (!currentMarket) {
          setCurrentMarket(market);
          setSelectedMarket(market);
        }
        
        console.log('✅ Agent data loaded - currentMarket:', market, 'selectedMarket:', market);
      } else {
        throw new Error('Agent not found');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load agent data",
        variant: "destructive"
      });
      setCurrentStates([]);
      setSelectedStates([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleActionSelect = (actionId: string) => {
    if (actionId === 'something_else') {
      setHelpModalOpen(true);
      return;
    }
    
    setSelectedAction(actionId);
    const userEmail = authState?.user?.email || '';
    setAgentEmail(userEmail);
    setResult('');
    setCurrentStates([]);
    setSelectedStates([]);
    setCurrentMarket('');
    setSelectedMarket('');
    setEappFile(null);
    setEappAccepted(false);
    setEappError(null);
    setEappResult(null);
    
    if (userEmail && (actionId === 'change_market' || actionId === 'add_states')) {
      loadAgentData(userEmail);
    }
  };

  // Handle initial action prop - set it when component mounts or prop changes
  useEffect(() => {
    if (initialAction && initialAction !== selectedAction) {
      handleActionSelect(initialAction);
    }
  }, [initialAction]);

  const handleLoadAgent = () => {
    if (!agentEmail) {
      toast({ title: "Error", description: "Enter agent email", variant: "destructive" });
      return;
    }
    loadAgentData(agentEmail);
  };

  const toggleState = (state: string) => {
    setSelectedStates(prev =>
      prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
    );
  };

  const handleEappSubmit = async () => {
    if (!eappFile || !authState?.user?.email) {
      toast({ title: 'Error', description: 'Select a screenshot and ensure you are logged in.', variant: 'destructive' });
      return;
    }
    setEappUploading(true);
    setEappError(null);
    try {
      const form = new FormData();
      form.append('screenshot', eappFile);
      form.append('email', authState.user.email);
      form.append('actionType', 'fix_vdp');
      const res = await fetch(`${getApiBase()}/api/support/eapp-screenshot`, {
        method: 'POST',
        headers: { 'x-user-email': authState.user.email },
        body: form,
        credentials: 'include',
      });
      const data = await res.json();
      if (data.accepted) {
        setEappAccepted(true);
        const prev = data.previous || [];
        const add = data.added || [];
        setEappResult({ agentNumber: data.agentNumber, detectedStates: data.detectedStates || [], added: add, previous: prev });
        setCurrentStates(prev);
        setSelectedStates([...prev, ...add]);
        setEappFile(null);
        if (eappInputRef.current) eappInputRef.current.value = '';
        if (selectedAction === 'fix_vdp') {
          await loadAgentData(authState.user.email);
          setCurrentStates(prev);
          setSelectedStates([...prev, ...add]);
        }
        toast({ title: 'Screenshot accepted', description: data.added?.length ? `Added ${data.added.join(', ')}` : 'States are up to date.' });
      } else {
        setEappError(data.error || "We couldn't read the image. Please submit a clearer screenshot.");
        toast({ title: 'Screenshot not accepted', description: data.error, variant: 'destructive' });
      }
    } catch (e: any) {
      setEappError(e?.message || 'Upload failed.');
      toast({ title: 'Error', description: e?.message || 'Upload failed.', variant: 'destructive' });
    } finally {
      setEappUploading(false);
    }
  };

  const handleExecute = async () => {
    setIsLoading(true);
    setResult('');
    
    try {
      let action = '';
      let parameters: any = {};
      
      switch (selectedAction) {
        case 'add_states':
          action = 'add_licensed_states';
          if (selectedStates.length === 0) {
            throw new Error('Select at least one licensed state');
          }
          parameters = {
            agentEmail: agentEmail,
            states: [...new Set(selectedStates.map((s) => s.toUpperCase()))].sort()
          };
          break;

        case 'change_market':
          action = 'change_market';
          parameters = {
            agentEmail: agentEmail,
            market: selectedMarket
          };
          break;

        case 'fix_vdp':
          action = 'fix_vdp_profile';
          parameters = {
            agentEmail: agentEmail,
            states: selectedStates,
            market: selectedMarket
          };
          break;

        case 'reset_password':
          action = 'reset_agent_password';
          parameters = { agentEmail: agentEmail };
          break;
      }
      
      const response = await fetch('/api/alex-ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: authState?.user?.email,
          action: action,
          parameters: parameters
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setResult(data.result?.message || '✅ Action completed successfully!');
        toast({
          title: "Success!",
          description: "Action completed",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Action failed');
      }
    } catch (error: any) {
      console.error('Error:', error);
      setResult(`❌ Error: ${error.message}`);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderEappStep = () => {
    const canAgree = eappComplianceSeconds >= COMPLIANCE_READ_SECONDS;
    const canSubmit = canAgree && eappComplianceAgreed && eappComplianceInitials.trim().length >= 2;
    return (
      <div className="space-y-4">
        {/* Compliance notice for VDP / eApp screenshot submissions */}
        <div className="rounded-lg border-2 border-red-600 bg-red-50 p-4">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">
            Applies to VDP / profile submissions
          </p>
          <p className="text-base font-bold text-red-800 leading-snug">
            Submitting false information — including screenshots, AI-generated images, manager information, false information, or attempts to subvert the system — will result in suspension, removal, and/or termination.
          </p>
        </div>
        {!canAgree ? (
          <p className="text-sm font-medium text-muted-foreground">
            Please read the notice above. You may agree in <strong>{COMPLIANCE_READ_SECONDS - eappComplianceSeconds}</strong> second{COMPLIANCE_READ_SECONDS - eappComplianceSeconds !== 1 ? 's' : ''}.
          </p>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <Checkbox
                id="eapp-compliance-agree"
                checked={eappComplianceAgreed}
                onCheckedChange={(v) => setEappComplianceAgreed(v === true)}
              />
              <label htmlFor="eapp-compliance-agree" className="text-sm font-medium leading-tight cursor-pointer">
                I have read and agree to the above. I confirm the information I submit is accurate and not false, altered, or intended to subvert the system.
              </label>
            </div>
            {eappComplianceAgreed && (
              <div>
                <Label htmlFor="eapp-compliance-initials">Enter your initials to confirm</Label>
                <Input
                  id="eapp-compliance-initials"
                  placeholder="e.g. JD"
                  value={eappComplianceInitials}
                  onChange={(e) => setEappComplianceInitials((e.target.value || '').toUpperCase().slice(0, 6))}
                  className="mt-1 max-w-[120px] font-mono"
                  maxLength={6}
                />
              </div>
            )}
          </>
        )}

        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Example of what we need:</p>
          <img src={`${getApiBase()}/api/support/eapp-example`} alt="Eapp example: Agent field + State dropdown open" className="max-w-full max-h-48 object-contain rounded border" />
        </div>
        <p className="text-sm text-muted-foreground">
          Upload a screenshot of your <strong>Eapp</strong> form with (1) the <strong>Agent</strong> field visible (e.g. ANF85-00) and (2) the <strong>State</strong> dropdown <strong>open</strong> showing your licensed states. We&apos;ll read the agent number and state abbreviations, then add any missing states to your profile.
        </p>
        <div>
          <Label>Eapp dropdown screenshot</Label>
          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <input
              ref={eappInputRef}
              type="file"
              accept="image/*"
              className="text-sm file:mr-2 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700"
              onChange={(e) => { setEappFile(e.target.files?.[0] || null); setEappError(null); }}
            />
            {eappFile && (
              <Button
                type="button"
                onClick={handleEappSubmit}
                disabled={eappUploading || !canSubmit}
                className="bg-green-600 hover:bg-green-700"
              >
                {eappUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                {eappUploading ? 'Analyzing…' : 'Submit'}
              </Button>
            )}
          </div>
          {eappFile && !canSubmit && (
            <p className="text-xs text-amber-700 mt-1">
              Complete the compliance steps above (read notice, agree, and enter initials) to submit.
            </p>
          )}
        </div>
        {eappError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {eappError}
            <p className="mt-2 font-medium">Please resubmit a screenshot with both Agent and State dropdown visible (like the example) until it&apos;s accepted.</p>
          </div>
        )}
      </div>
    );
  };

  const renderForm = () => {
    if (selectedAction === 'fix_vdp' && !eappAccepted) {
      return renderEappStep();
    }
    switch (selectedAction) {
      case 'add_states':
        return (
          <div className="space-y-4">
            <div>
              <Label>Agent Email</Label>
              <div className="flex gap-2">
                <Input
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  placeholder={authState?.user?.email || "your@aoglobelife.com"}
                  className="flex-1"
                  disabled={isLoadingData}
                />
                <Button onClick={handleLoadAgent} disabled={isLoadingData || !agentEmail}>
                  {isLoadingData ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load'}
                </Button>
              </div>
              {agentEmail === authState?.user?.email && (
                <p className="text-xs text-gray-500 mt-1">✓ Using your email ({agentEmail})</p>
              )}
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p>Current licensed states: <strong>{currentStates.length}</strong></p>
              <p className="text-xs text-muted-foreground mt-1">
                Check the states this agent should keep. Unchecked states will be removed from the customer states array.
              </p>
            </div>
            <div>
              <Label>Select Licensed States (2-letter abbreviations)</Label>
              <div className="grid grid-cols-5 gap-2 mt-2 max-h-64 overflow-y-auto border p-3 rounded">
                {ALL_STATES.map((state) => (
                  <div key={state} className="flex items-center space-x-2">
                    <Checkbox
                      id={`state-${state}`}
                      checked={selectedStates.includes(state)}
                      onCheckedChange={() => toggleState(state)}
                    />
                    <label htmlFor={`state-${state}`} className="text-sm cursor-pointer">
                      {state}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'change_market':
        return (
          <div className="space-y-4">
            {isSysopUser ? (
              <div>
                <Label>Agent Email</Label>
                <div className="flex gap-2">
                  <Input
                    value={agentEmail}
                    onChange={(e) => setAgentEmail(e.target.value)}
                    placeholder={authState?.user?.email || "your@aoglobelife.com"}
                    className="flex-1"
                    disabled={isLoadingData}
                  />
                  <Button onClick={handleLoadAgent} disabled={isLoadingData || !agentEmail}>
                    {isLoadingData ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load'}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Label>Agent Email</Label>
                <Input value={agentEmail} disabled className="bg-muted" />
                <p className="text-xs text-gray-500 mt-1">Your market updates will apply to this account.</p>
              </div>
            )}

            {currentMarket && selectedAction === 'change_market' && (
              <>
                <div>
                  <Label>Current Market: <span className="font-bold">{currentMarket === 'Globe' ? 'Globe Market' : currentMarket}</span></Label>
                </div>
                <div>
                  <Label>Select Market</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                    {[
                      { value: 'Veteran', label: 'Veteran' },
                      { value: 'Globe', label: 'Globe Market' },
                      { value: 'AO Recruit', label: 'AO Recruit' },
                    ].map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={selectedMarket === opt.value ? 'default' : 'outline'}
                        onClick={() => setSelectedMarket(opt.value)}
                        className="w-full justify-center"
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {selectedMarket || 'None'}
                    {selectedMarket === currentMarket ? ' (no change)' : ''}
                  </p>
                </div>
              </>
            )}
          </div>
        );

      case 'fix_vdp':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Having a VDP error? Use{' '}
              <button type="button" onClick={() => setHelpModalOpen(true)} className="text-blue-600 underline hover:text-blue-800 font-medium">
                Get Support
              </button>
              .
            </p>
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Example we use:</p>
              <img src={`${getApiBase()}/api/support/eapp-example`} alt="Eapp example" className="max-w-full max-h-40 object-contain rounded border" />
            </div>
            <div>
              <Label>Agent Email</Label>
              <Input
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
                placeholder={authState?.user?.email || "your@aoglobelife.com"}
                disabled={isLoadingData}
              />
              {agentEmail === authState?.user?.email && (
                <p className="text-xs text-gray-500 mt-1">✓ Using your email ({agentEmail})</p>
              )}
            </div>
            {eappResult?.detectedStates && eappResult.detectedStates.length > 0 && (
              <div>
                <Label>States from your screenshot (grey = already on file; check only detected ones to add):</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="grid grid-cols-5 gap-2 mt-2 max-h-48 overflow-y-auto border p-3 rounded cursor-help">
                        {[...eappResult.detectedStates].sort().map(state => {
                          const isExisting = eappResult.previous.includes(state);
                          return (
                            <div key={state} className="flex items-center space-x-2">
                              <Checkbox
                                checked={selectedStates.includes(state)}
                                disabled={isExisting}
                                onCheckedChange={() => toggleState(state)}
                                id={`vdp-${state}`}
                              />
                              <label
                                htmlFor={`vdp-${state}`}
                                className={`text-sm ${isExisting ? 'text-gray-400 cursor-default' : 'cursor-pointer'}`}
                              >
                                {state}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="mb-1">Need to add more states?</p>
                      <button type="button" onClick={() => setHelpModalOpen(true)} className="text-blue-600 underline hover:text-blue-800 font-medium text-left">
                        Click Here to add more states
                      </button>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className="text-xs text-muted-foreground mt-1">Grey = already on file · Only detected states are shown. Need to add more states? <button type="button" onClick={() => setHelpModalOpen(true)} className="text-blue-600 underline hover:text-blue-800 font-medium">Click Here to add more states</button>.</p>
              </div>
            )}
            <div>
              <Label>Market</Label>
              <Select 
                key={`vdp-market-select-${selectedAction}`}
                value={selectedMarket || undefined} 
                onValueChange={(value) => setSelectedMarket(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select market" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Veteran">Veteran</SelectItem>
                  <SelectItem value="Globe">Globe Market</SelectItem>
                  <SelectItem value="AO Recruit">AO Recruit</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Selected: {selectedMarket || 'None'}</p>
            </div>
          </div>
        );

      case 'reset_password':
        return (
          <div className="space-y-4">
            <div>
              <Label>Agent Email</Label>
              <Input
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
                placeholder={authState?.user?.email || "your@aoglobelife.com"}
                disabled={isLoadingData}
              />
              {agentEmail === authState?.user?.email && (
                <p className="text-xs text-gray-500 mt-1">✓ Using your email ({agentEmail})</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Password will be reset to: <strong>aointel2025</strong></p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };



  return (
    <Card className="h-full flex flex-col">
      <CardContent className="p-0 flex-1 flex flex-col">
        {/* Action Buttons */}
        {!selectedAction && (
          <div className="p-3 border-b bg-gray-50 space-y-2">
            {actions.map(action => (
              <Button
                key={action.id}
                onClick={() => handleActionSelect(action.id)}
                className="w-full justify-start text-left h-auto py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
              >
                <span className="text-xl mr-2">{action.icon}</span>
                <span className="text-sm font-semibold">{action.label}</span>
              </Button>
            ))}
          </div>
        )}

        {/* Form or Result */}
        <div className="flex-1 overflow-y-auto p-4">
          {result ? (
            <div className="space-y-4">
              <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-500">
                <div className="whitespace-pre-wrap text-green-800 dark:text-green-200">
                  {result}
                </div>
              </div>
              <Button
                onClick={() => {
                  setResult('');
                  setSelectedAction(null);
                  setAgentEmail(authState?.user?.email || '');
                  setCurrentStates([]);
                  setSelectedStates([]);
                  setCurrentMarket('');
                  setSelectedMarket('');
                  setEappFile(null);
                  setEappAccepted(false);
                  setEappError(null);
                  setEappResult(null);
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Done - Back to Actions
              </Button>
            </div>
          ) : selectedAction ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {actions.find(a => a.id === selectedAction)?.icon} {actions.find(a => a.id === selectedAction)?.label}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedAction(null);
                    setAgentEmail(authState?.user?.email || '');
                    setResult('');
                    setCurrentStates([]);
                    setSelectedStates([]);
                    setCurrentMarket('');
                    setSelectedMarket('');
                    setEappFile(null);
                    setEappAccepted(false);
                    setEappError(null);
                    setEappResult(null);
                  }}
                >
                  ← Back
                </Button>
              </div>
              
              {renderForm()}
              
              {((selectedAction === 'add_states' && agentEmail && selectedStates.length > 0) ||
                (selectedAction === 'change_market' && selectedMarket && selectedMarket !== currentMarket) ||
                (selectedAction === 'fix_vdp' && selectedStates.length > 0 && selectedMarket && agentEmail) ||
                (selectedAction === 'reset_password' && agentEmail)) && (
                <Button
                  onClick={handleExecute}
                  disabled={isLoading || isLoadingData}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-3 mt-4"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    'Apply Changes'
                  )}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </CardContent>
      
      {/* Help Modal for "Something Else" */}
      <HelpModal 
        isOpen={helpModalOpen} 
        onClose={() => setHelpModalOpen(false)}
      />
    </Card>
  );
}
