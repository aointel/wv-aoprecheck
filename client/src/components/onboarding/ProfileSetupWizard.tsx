import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, Video, Lock, Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";

type ProfileStep = 'firstName' | 'lastName' | 'phone' | 'mgaTeam' | 'rgaTeam' | 'zoomId' | 'zoomPassword';

interface ProfileSetupWizardProps {
  onComplete: () => void;
}

export function ProfileSetupWizard({ onComplete }: ProfileSetupWizardProps) {
  const { toast } = useToast();
  const { authState, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [currentStep, setCurrentStep] = useState<ProfileStep>('firstName');
  
  // Profile data state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [zoomId, setZoomId] = useState('');
  const [zoomPassword, setZoomPassword] = useState('1');
  const [mgaTeam, setMgaTeam] = useState('');
  const [rgaTeam, setRgaTeam] = useState('');
  
  // Team options
  const [mgaOptions, setMgaOptions] = useState<string[]>([]);
  const [rgaOptions, setRgaOptions] = useState<string[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  const steps: ProfileStep[] = ['firstName', 'lastName', 'phone', 'mgaTeam', 'rgaTeam', 'zoomId', 'zoomPassword'];
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Load profile and team options
  useEffect(() => {
    if (authState.user?.id) {
      loadProfile();
      loadTeamOptions();
    }
  }, [authState.user?.id]);

  const loadProfile = async () => {
    console.log('🔄 Loading profile from Supabase database...');
    setLoadingProfile(true);
    try {
      const userEmail = authState.user?.email || '';
      console.log('🔄 Fetching profile from API for email:', userEmail);
      const response = await fetch(`/api/agent/profile-direct?userEmail=${encodeURIComponent(userEmail)}`, {
        cache: 'no-store', // Force fresh data from database
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (response.ok) {
        const profile = await response.json();
        console.log('✅ Profile loaded from Supabase database:', profile);
        if (profile) {
          setFirstName(profile.firstName || '');
          setLastName(profile.lastName || '');
          setPhone(profile.phone || '');
          setZoomId(profile.zoomId || '');
          setZoomPassword(profile.zoomPassword || '1');
          setMgaTeam(profile.mgaTeam || '');
          setRgaTeam(profile.rgaTeam || '');
          console.log('✅ Profile state updated from database');
        } else {
          console.warn('⚠️ Profile response was empty');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to load profile:', response.status, errorText);
      }
    } catch (error) {
      console.error('❌ Failed to load profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadTeamOptions = async () => {
    setLoadingTeams(true);
    try {
      const params = new URLSearchParams();
      const email = authState.user?.email;
      if (email) {
        params.set('userEmail', email);
      }
      const response = await fetch(`/api/agent/team-options${params.toString() ? `?${params.toString()}` : ''}`);
      if (response.ok) {
        const options = await response.json();
        setMgaOptions(options.mgaOptions || []);
        setRgaOptions(options.rgaOptions || []);

        // Auto-sync defaults when profile doesn't have values yet
        if (!mgaTeam && options.defaultMgaTeam) {
          setMgaTeam(options.defaultMgaTeam);
        }
        if (!rgaTeam && options.defaultRgaTeam) {
          setRgaTeam(options.defaultRgaTeam);
        }
      }
    } catch (error) {
      console.error('Failed to load team options:', error);
    } finally {
      setLoadingTeams(false);
    }
  };

  const saveField = async (field: string, value: string, displayName: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/agent/profile-direct', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          [field]: value,
          userEmail: authState.user?.email || ''
        }),
      });
      
      if (response.ok) {
        const updatedProfile = await response.json();
        console.log('✅ Profile saved to Supabase:', updatedProfile);
        
        // Update local state to reflect saved value
        if (field === 'firstName') setFirstName(value);
        else if (field === 'lastName') setLastName(value);
        else if (field === 'phone') setPhone(value);
        else if (field === 'zoomId') setZoomId(value);
        else if (field === 'zoomPassword') setZoomPassword(value);
        else if (field === 'mgaTeam') setMgaTeam(value);
        else if (field === 'rgaTeam') setRgaTeam(value);
        
        // Reload profile from database to ensure we have latest data
        console.log('🔄 Reloading profile from database after save...');
        await loadProfile();
        
        // Update authState profile via updateProfile hook to refresh UI
        if (updatedProfile) {
          try {
            await updateProfile({
              phone: updatedProfile.phone || '',
              firstName: updatedProfile.firstName || '',
              lastName: updatedProfile.lastName || '',
              zoomId: updatedProfile.zoomId || '',
              zoomPassword: updatedProfile.zoomPassword || '1'
            });
            console.log('✅ Updated authState profile after Supabase save');
          } catch (e) {
            console.warn('Failed to update authState profile:', e);
            // Don't fail the save if authState update fails - Supabase save succeeded
          }
        }
        
        toast({ title: "Saved", description: `${displayName} saved successfully to database!` });
        return true;
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`Failed to save ${field}:`, errorData);
        toast({ title: "Error", description: `Failed to save ${displayName.toLowerCase()}: ${errorData.error || errorData.message || 'Unknown error'}`, variant: "destructive" });
        return false;
      }
    } catch (error) {
      console.error(`Failed to save ${field}:`, error);
      toast({ title: "Error", description: `Failed to save ${displayName.toLowerCase()}`, variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    // Validate current step before proceeding
    let isValid = true;
    let fieldToSave = '';
    let valueToSave = '';
    let displayName = '';

    switch (currentStep) {
      case 'firstName':
        if (!firstName.trim()) {
          toast({ title: "Required", description: "First name is required", variant: "destructive" });
          return;
        }
        fieldToSave = 'firstName';
        valueToSave = firstName;
        displayName = 'First name';
        break;
      case 'lastName':
        if (!lastName.trim()) {
          toast({ title: "Required", description: "Last name is required", variant: "destructive" });
          return;
        }
        fieldToSave = 'lastName';
        valueToSave = lastName;
        displayName = 'Last name';
        break;
      case 'phone':
        if (!phone.trim()) {
          toast({ title: "Required", description: "Phone number is required", variant: "destructive" });
          return;
        }
        fieldToSave = 'phone';
        valueToSave = phone;
        displayName = 'Phone number';
        break;
      case 'mgaTeam':
        if (!mgaTeam) {
          toast({ title: "Required", description: "Executive Producer (MGA) is required", variant: "destructive" });
          return;
        }
        fieldToSave = 'mgaTeam';
        valueToSave = mgaTeam;
        displayName = 'Executive Producer (MGA)';
        break;
      case 'rgaTeam':
        if (!rgaTeam) {
          toast({ title: "Required", description: "Chief Executive Producer (RGA) is required", variant: "destructive" });
          return;
        }
        fieldToSave = 'rgaTeam';
        valueToSave = rgaTeam;
        displayName = 'Chief Executive Producer (RGA)';
        break;
      case 'zoomId':
        if (!zoomId.trim()) {
          toast({ title: "Required", description: "Zoom Room ID is required", variant: "destructive" });
          return;
        }
        fieldToSave = 'zoomId';
        valueToSave = zoomId;
        displayName = 'Zoom Room ID';
        break;
      case 'zoomPassword':
        // Zoom password must be numbers only or "1" if empty
        const trimmedPassword = zoomPassword.trim();
        const finalPassword = trimmedPassword || '1';
        
        // Validate: must be numbers only
        if (finalPassword !== '1' && !/^\d+$/.test(finalPassword)) {
          toast({ 
            title: "Invalid Password", 
            description: "Zoom password must be '1' or numbers only", 
            variant: "destructive" 
          });
          return;
        }
        
        fieldToSave = 'zoomPassword';
        valueToSave = finalPassword;
        displayName = 'Zoom password';
        break;
    }

    // Save the field if needed
    if (fieldToSave && valueToSave) {
      const saved = await saveField(fieldToSave, valueToSave, displayName);
      if (!saved) return;
    }

    // Move to next step
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    } else {
      // All steps complete
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1]);
    }
  };


  const getStepTitle = () => {
    switch (currentStep) {
      case 'firstName':
        return 'What\'s your first name?';
      case 'lastName':
        return 'What\'s your last name?';
      case 'phone':
        return 'What\'s your phone number?';
      case 'mgaTeam':
        return 'Select your Executive Producer (MGA)';
      case 'rgaTeam':
        return 'Select your Chief Executive Producer (RGA)';
      case 'zoomId':
        return 'What\'s your Zoom Room ID?';
      case 'zoomPassword':
        return 'Set your Zoom password';
      default:
        return '';
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'firstName':
        return (
          <div className="space-y-4 w-full max-w-md mx-auto">
            <Label htmlFor="firstName" className="text-base font-semibold text-gray-700 mb-2 block">
              First Name *
            </Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              className="text-lg h-12"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
            />
          </div>
        );
      
      case 'lastName':
        return (
          <div className="space-y-4 w-full max-w-md mx-auto">
            <Label htmlFor="lastName" className="text-base font-semibold text-gray-700 mb-2 block">
              Last Name *
            </Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter your last name"
              className="text-lg h-12"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
            />
          </div>
        );
      
      case 'phone':
        return (
          <div className="space-y-4 w-full max-w-md mx-auto">
            <Label htmlFor="phone" className="text-base font-semibold text-gray-700 mb-2 block">
              Phone Number *
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number"
              className="text-lg h-12"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
            />
          </div>
        );
      
      case 'mgaTeam':
        return (
          <div className="space-y-4 w-full max-w-md mx-auto">
            <Label className="text-base font-semibold text-gray-700 mb-2 block">
              Executive Producer (MGA) *
            </Label>
            <Select value={mgaTeam} onValueChange={setMgaTeam}>
              <SelectTrigger className="w-full h-12 text-lg py-3 px-4">
                <SelectValue placeholder={loadingTeams ? "Loading..." : "Select your Executive Producer (MGA)"} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {mgaOptions.map((mga) => (
                  <SelectItem key={mga} value={mga} className="py-2 text-base">
                    {mga}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      
      case 'rgaTeam':
        return (
          <div className="space-y-4 w-full max-w-md mx-auto">
            <Label className="text-base font-semibold text-gray-700 mb-2 block">
              Chief Executive Producer (RGA) *
            </Label>
            <Select value={rgaTeam} onValueChange={setRgaTeam}>
              <SelectTrigger className="w-full h-12 text-lg py-3 px-4">
                <SelectValue placeholder={loadingTeams ? "Loading..." : "Select your Chief Executive Producer (RGA)"} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {rgaOptions.map((rga) => (
                  <SelectItem key={rga} value={rga} className="py-2 text-base">
                    {rga}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      
      case 'zoomId':
        return (
          <div className="space-y-4 w-full max-w-md mx-auto">
            <Label htmlFor="zoomId" className="text-base font-semibold text-gray-700 mb-2 block">
              Zoom Room ID *
            </Label>
            <Input
              id="zoomId"
              value={zoomId}
              onChange={(e) => setZoomId(e.target.value)}
              placeholder="Enter your Zoom Room ID"
              className="text-lg h-12"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
            />
          </div>
        );
      
      case 'zoomPassword':
        return (
          <div className="space-y-4 w-full max-w-md mx-auto">
            <Label htmlFor="zoomPassword" className="text-base font-semibold text-gray-700 mb-2 block">
              Zoom Password *
            </Label>
            <Input
              id="zoomPassword"
              value={zoomPassword}
              onChange={(e) => {
                // Only allow numbers
                const value = e.target.value;
                if (value === '' || /^\d+$/.test(value)) {
                  setZoomPassword(value);
                }
              }}
              placeholder="1 (default)"
              className="text-lg h-12"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              maxLength={20}
            />
            <p className="text-sm text-gray-500 text-center">
              Must be "1" or numbers only. Leave blank to default to "1"
            </p>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Step {currentStepIndex + 1} of {steps.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg border-2 border-gray-200 p-8 shadow-lg min-h-[400px] flex flex-col justify-center">
        <h2 className="text-3xl font-bold text-center mb-8">{getStepTitle()}</h2>
        <div className="flex-1 flex items-center justify-center">
          {renderStepContent()}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          onClick={handleBack}
          variant="outline"
          disabled={currentStepIndex === 0}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={loading || loadingProfile}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : currentStepIndex === steps.length - 1 ? (
            <>
              Complete
              <CheckCircle2 className="w-4 h-4" />
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-700 text-sm text-center">
          <strong>Note:</strong> All data is permanently saved to your profile and syncs across all devices.
        </p>
      </div>
    </div>
  );
}
