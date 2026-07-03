import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import AlexAIActions from '@/components/alex-ai/AlexAIActions';
import { 
  HelpCircle, 
  Send, 
  Loader2, 
  User, 
  Mail, 
  MessageSquare,
  AlertCircle,
  MapPin,
  Globe,
  Wrench,
  Key
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAction?: string | null;
}

export function HelpModal({ isOpen, onClose, initialAction = null }: HelpModalProps) {
  const { toast } = useToast();
  const { authState } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(initialAction);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: authState.user?.email || '',
    subject: '',
    category: '',
    message: '',
    urgency: 'normal'
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/help/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          userproducer: navigator.userproducer,
          timestamp: new Date().toISOString(),
          userId: authState.user?.id || 'anonymous'
        })
      });

      if (response.ok) {
        toast({
          title: "Help Request Sent",
          description: "Your request has been sent to our support team. We'll get back to you soon!",
        });
        
        // Reset form
        setFormData({
          name: '',
          email: authState.user?.email || '',
          subject: '',
          category: '',
          message: '',
          urgency: 'normal'
        });
        
        onClose();
      } else {
        throw new Error('Failed to submit help request');
      }
    } catch (error) {
      console.error('Error submitting help request:', error);
      toast({
        title: "Error",
        description: "Failed to send help request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset selected action when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedAction(initialAction);
    } else if (initialAction && !selectedAction) {
      setSelectedAction(initialAction);
    }
  }, [isOpen, initialAction]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            Get Support
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm h-full flex flex-col">
            <div className="p-0 flex-1 flex flex-col">
              {/* Support Action Buttons - Always visible at top */}
              <div className="p-3 border-b bg-gray-50 space-y-2">
                <Button
                  type="button"
                  onClick={() => setSelectedAction('add_states')}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 w-full justify-start text-left h-auto py-3 ${selectedAction === 'add_states' ? 'ring-2 ring-blue-400' : ''}`}
                >
                  <span className="text-xl mr-2">📍</span>
                  <span className="text-sm font-semibold">Add Licensed States</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => setSelectedAction('change_market')}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 w-full justify-start text-left h-auto py-3 ${selectedAction === 'change_market' ? 'ring-2 ring-blue-400' : ''}`}
                >
                  <span className="text-xl mr-2">🌎</span>
                  <span className="text-sm font-semibold">Change Market</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => setSelectedAction('fix_vdp')}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 w-full justify-start text-left h-auto py-3 ${selectedAction === 'fix_vdp' ? 'ring-2 ring-blue-400' : ''}`}
                >
                  <span className="text-xl mr-2">🔧</span>
                  <span className="text-sm font-semibold">Fix VDP Error</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => setSelectedAction('reset_password')}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 w-full justify-start text-left h-auto py-3 ${selectedAction === 'reset_password' ? 'ring-2 ring-blue-400' : ''}`}
                >
                  <span className="text-xl mr-2">🔑</span>
                  <span className="text-sm font-semibold">Reset Password</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => setSelectedAction('something_else')}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 w-full justify-start text-left h-auto py-3 ${selectedAction === 'something_else' ? 'ring-2 ring-blue-400' : ''}`}
                >
                  <span className="text-xl mr-2">💬</span>
                  <span className="text-sm font-semibold">Something Else</span>
                </Button>
              </div>
              {/* AlexAIActions shown below when an action is selected, OR form for "something_else" */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedAction === 'something_else' ? (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Contact Information */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Your Information
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="name" className="text-base font-medium text-gray-700 mb-2 block">
                            Full Name *
                          </Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            placeholder="Your full name"
                            required
                          />
                        </div>

                        <div>
                          <Label htmlFor="email" className="text-base font-medium text-gray-700 mb-2 block">
                            Email Address *
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            placeholder="your.email@company.com"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Request Details */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Help Request Details
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="category" className="text-base font-medium text-gray-700 mb-2 block">
                            Category
                          </Label>
                          <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="training">Training & Practice</SelectItem>
                              <SelectItem value="technical">Technical Support</SelectItem>
                              <SelectItem value="call-connector">Call Connector Pro</SelectItem>
                              <SelectItem value="verification">AO PreCheck/Verification</SelectItem>
                              <SelectItem value="billing">Billing & Credits</SelectItem>
                              <SelectItem value="account">Account Setup</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="urgency" className="text-base font-medium text-gray-700 mb-2 block">
                            Urgency Level
                          </Label>
                          <Select value={formData.urgency} onValueChange={(value) => handleInputChange('urgency', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select urgency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low - General question</SelectItem>
                              <SelectItem value="normal">Normal - Need assistance</SelectItem>
                              <SelectItem value="high">High - Blocking my work</SelectItem>
                              <SelectItem value="urgent">Urgent - System down</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="subject" className="text-base font-medium text-gray-700 mb-2 block">
                          Subject *
                        </Label>
                        <Input
                          id="subject"
                          value={formData.subject}
                          onChange={(e) => handleInputChange('subject', e.target.value)}
                          placeholder="Brief description of your issue"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="message" className="text-base font-medium text-gray-700 mb-2 block">
                          Description *
                        </Label>
                        <Textarea
                          id="message"
                          value={formData.message}
                          onChange={(e) => handleInputChange('message', e.target.value)}
                          placeholder="Please describe your issue in detail. Include any error messages, steps you took, and what you were trying to accomplish."
                          rows={6}
                          required
                        />
                      </div>
                    </div>

                    {/* Submit Section */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                      <Button
                        type="submit"
                        variant="default"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Help Request
                          </>
                        )}
                      </Button>
                      
                      <Button
                        type="button"
                        onClick={() => setSelectedAction(null)}
                        variant="outline"
                        disabled={loading}
                      >
                        Back
                      </Button>
                    </div>

                    {/* Help Information */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Support Information
                      </h4>
                      <div className="text-blue-700 text-sm space-y-1">
                        <p>• Your request will be sent to our technical support team</p>
                        <p>• Response time: 4-24 hours depending on urgency</p>
                        <p>• For urgent issues, please also call your supervisor</p>
                        <p>• Include screenshots if helpful (attach via email response)</p>
                      </div>
                    </div>
                  </form>
                ) : selectedAction ? (
                  <AlexAIActions initialAction={selectedAction} />
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <HelpCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-sm">Select an option above to get started</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Old form - hidden for now, can be shown if "Something Else" is selected */}
        <form onSubmit={handleSubmit} className="space-y-6 py-4 hidden">
          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <User className="h-5 w-5" />
              Your Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-base font-medium text-gray-700 mb-2 block">
                  Full Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-base font-medium text-gray-700 mb-2 block">
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="your.email@company.com"
                  required
                />
              </div>
            </div>
          </div>

          {/* Request Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Help Request Details
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category" className="text-base font-medium text-gray-700 mb-2 block">
                  Category
                </Label>
                <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="training">Training & Practice</SelectItem>
                    <SelectItem value="technical">Technical Support</SelectItem>
                    <SelectItem value="call-connector">Call Connector Pro</SelectItem>
                    <SelectItem value="verification">AO PreCheck/Verification</SelectItem>
                    <SelectItem value="billing">Billing & Credits</SelectItem>
                    <SelectItem value="account">Account Setup</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="urgency" className="text-base font-medium text-gray-700 mb-2 block">
                  Urgency Level
                </Label>
                <Select value={formData.urgency} onValueChange={(value) => handleInputChange('urgency', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - General question</SelectItem>
                    <SelectItem value="normal">Normal - Need assistance</SelectItem>
                    <SelectItem value="high">High - Blocking my work</SelectItem>
                    <SelectItem value="urgent">Urgent - System down</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="subject" className="text-base font-medium text-gray-700 mb-2 block">
                Subject *
              </Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                placeholder="Brief description of your issue"
                required
              />
            </div>

            <div>
              <Label htmlFor="message" className="text-base font-medium text-gray-700 mb-2 block">
                Description *
              </Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => handleInputChange('message', e.target.value)}
                placeholder="Please describe your issue in detail. Include any error messages, steps you took, and what you were trying to accomplish."
                rows={6}
                required
              />
            </div>
          </div>

          {/* Submit Section */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <Button
              type="submit"
              variant="default"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Help Request
                </>
              )}
            </Button>
            
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              disabled={loading}
            >
              Cancel
            </Button>
          </div>

          {/* Help Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Support Information
            </h4>
            <div className="text-blue-700 text-sm space-y-1">
              <p>• Your request will be sent to our technical support team</p>
              <p>• Response time: 4-24 hours depending on urgency</p>
              <p>• For urgent issues, please also call your supervisor</p>
              <p>• Include screenshots if helpful (attach via email response)</p>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}