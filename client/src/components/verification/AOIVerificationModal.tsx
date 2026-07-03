import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Phone, Video, CheckCircle, XCircle, Loader2, User, DollarSign, MapPin, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface AOIVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadName?: string;
  leadPhone?: string;
  leadCity?: string;
  leadState?: string;
  roomName?: string;
  conferenceName?: string;
  sessionType?: 'video' | 'voice';
}

interface VerificationStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

export function AOIVerificationModal({
  isOpen,
  onClose,
  leadName = '',
  leadPhone = '',
  leadCity = '',
  leadState = '',
  roomName = '',
  conferenceName = '',
  sessionType = 'video'
}: AOIVerificationModalProps) {
  const { authState } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [botAdded, setBotAdded] = useState(false);
  
  // Form data
  const [premium, setPremium] = useState('');
  const [verificationSteps, setVerificationSteps] = useState<VerificationStep[]>([
    { id: 1, title: 'Client Information Verified', description: 'Name, phone, and location confirmed', completed: false },
    { id: 2, title: 'Premium Amount Confirmed', description: 'Sale amount verified with client', completed: false },
    { id: 3, title: 'Verification Bot Added', description: 'AI monitoring activated for compliance', completed: false },
    { id: 4, title: 'Final Verification Complete', description: 'All steps completed successfully', completed: false }
  ]);

  // Pre-filled data from current call context
  const clientInfo = {
    name: leadName || 'Current Lead',
    phone: leadPhone || '+15551234567',
    city: leadCity || 'Unknown City',
    state: leadState || 'Unknown State',
    producer: authState.user?.email || 'producer@example.com'
  };

  const completeStep = (stepId: number) => {
    setVerificationSteps(prev => 
      prev.map(step => 
        step.id === stepId ? { ...step, completed: true } : step
      )
    );
    
    if (stepId < 4) {
      setCurrentStep(stepId + 1);
    }
  };

  const addVerificationBot = async () => {
    setLoading(true);
    
    try {
      const endpoint = sessionType === 'video' 
        ? '/api/twilio/add-video-verification-bot'
        : '/api/twilio/add-verification-bot';
        
      const payload = sessionType === 'video' 
        ? { 
            roomName: roomName || `meeting-${Date.now()}`, 
            leadPhone: clientInfo.phone, 
            agentEmail: clientInfo.producer,
            verificationType: 'compliance',
            botType: 'voice-only'
          }
        : { 
            conferenceName: conferenceName || `aoi-conference-${Date.now()}`, 
            leadPhone: clientInfo.phone, 
            agentEmail: clientInfo.producer,
            verificationType: 'compliance'
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setBotAdded(true);
        completeStep(3);
        toast({
          title: "Verification Bot Added",
          description: "AI compliance monitoring is now active for this call",
        });
      } else {
        toast({
          title: "Failed to Add Bot",
          description: data.error || 'Could not add verification bot',
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Connection Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const completeVerification = () => {
    completeStep(4);
    toast({
      title: "Verification Complete",
      description: `Sale verified: ${clientInfo.name} - $${premium} premium`,
    });
    
    // Auto-close after 2 seconds
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AOI Connect Verification
            <Badge variant="outline" className="ml-auto">
              Step {currentStep} of 4
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Complete verification steps for your current {sessionType} call
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Steps */}
          <div className="space-y-2">
            {verificationSteps.map((step) => (
              <div key={step.id} className={`flex items-center gap-3 p-2 rounded-lg border ${
                step.completed ? 'bg-green-50 border-green-200' : 
                step.id === currentStep ? 'bg-blue-50 border-blue-200' : 
                'bg-gray-50 border-gray-200'
              }`}>
                {step.completed ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : step.id === currentStep ? (
                  <div className="h-4 w-4 rounded-full bg-blue-500" />
                ) : (
                  <div className="h-4 w-4 rounded-full bg-gray-300" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${step.completed ? 'text-green-700' : 'text-gray-700'}`}>
                    {step.title}
                  </p>
                  <p className={`text-xs ${step.completed ? 'text-green-600' : 'text-gray-500'}`}>
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Step Content */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Step 1: Verify Client Information
                </CardTitle>
                <CardDescription>
                  Confirm the following details with your client
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Client Name</Label>
                    <p className="font-medium">{clientInfo.name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone Number</Label>
                    <p className="font-medium">{clientInfo.phone}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">City</Label>
                    <p className="font-medium">{clientInfo.city}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">State</Label>
                    <p className="font-medium">{clientInfo.state}</p>
                  </div>
                </div>
                <Button onClick={() => completeStep(1)} className="w-full">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Information is Correct
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Step 2: Enter Premium Amount
                </CardTitle>
                <CardDescription>
                  Enter the premium amount you sold to the client
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="premium">Monthly Premium Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="premium"
                      type="number"
                      placeholder="150"
                      value={premium}
                      onChange={(e) => setPremium(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button 
                  onClick={() => completeStep(2)} 
                  disabled={!premium}
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Premium: ${premium}
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Step 3: Add Verification Bot
                </CardTitle>
                <CardDescription>
                  Add AI verification bot to monitor this call for compliance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>What this does:</strong> Adds an AI bot to your {sessionType} call that will:
                  </p>
                  <ul className="text-xs text-blue-700 mt-2 space-y-1">
                    <li>• Announce itself as "AO verification assistant"</li>
                    <li>• Monitor for compliance purposes</li>
                    <li>• Record the conversation if needed</li>
                    <li>• Remain muted unless verification is required</li>
                  </ul>
                </div>
                <Button 
                  onClick={addVerificationBot} 
                  disabled={loading || botAdded}
                  className="w-full"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : botAdded ? (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  ) : sessionType === 'video' ? (
                    <Video className="h-4 w-4 mr-2" />
                  ) : (
                    <Phone className="h-4 w-4 mr-2" />
                  )}
                  {botAdded ? 'Bot Added Successfully' : 'Add Verification Bot'}
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Step 4: Verification Complete
                </CardTitle>
                <CardDescription>
                  All verification steps completed successfully
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-2">Verification Summary</h4>
                  <div className="text-sm text-green-700 space-y-1">
                    <p><strong>Client:</strong> {clientInfo.name}</p>
                    <p><strong>Location:</strong> {clientInfo.city}, {clientInfo.state}</p>
                    <p><strong>Premium:</strong> ${premium}/month</p>
                    <p><strong>producer:</strong> {clientInfo.producer}</p>
                    <p><strong>Verification Bot:</strong> {botAdded ? 'Active' : 'Not Added'}</p>
                  </div>
                </div>
                <Button 
                  onClick={completeVerification}
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Verification
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}