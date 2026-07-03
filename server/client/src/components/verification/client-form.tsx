import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { ClientInfo, VerificationSession } from "@shared/schema";

interface ClientFormProps {
  onSubmit: (session: VerificationSession) => void;
}

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

export function ClientForm({ onSubmit }: ClientFormProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'es'>('en');
  const [agentPhone, setAgentPhone] = useState("");
  const [formData, setFormData] = useState<ClientInfo>({
    firstName: "",
    lastName: "",
    spouseName: "",
    phone: "",
    city: "",
    state: "",
    premium: "",
    verificationMethod: "zoom",
    zoomRoomId: "",
    zoomPassword: "",
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { profile } = useAuth();

  // Pre-fill agent phone from user profile
  useEffect(() => {
    if (profile?.phone && !agentPhone) {
      setAgentPhone(profile.phone);
    }
  }, [profile, agentPhone]);

  const createSessionMutation = useMutation({
    mutationFn: async (clientInfo: ClientInfo) => {
      console.log('Creating verification session with:', clientInfo);
      const response = await apiRequest("POST", "/api/verification/session", clientInfo);
      const session = await response.json() as VerificationSession;
      console.log('Session created successfully:', session);
      return session;
    },
    onSuccess: (session) => {
      console.log('Mutation success, calling onSubmit with:', session);
      onSubmit(session);
      toast({
        title: "Session created",
        description: `Ready for verification - Session ${session.sessionId}`,
      });
    },
    onError: (error: any) => {
      console.error('Mutation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create verification session",
        variant: "destructive",
      });
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!agentPhone.trim()) {
      newErrors.agentPhone = "Agent phone number is required";
    }
    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }
    if (!formData.state.trim()) {
      newErrors.state = "State is required";
    }
    if (!formData.premium.trim()) {
      newErrors.premium = "Premium amount is required";
    }
    if (!formData.verificationMethod) {
      newErrors.verificationMethod = "Verification method is required";
    }
    
    // Zoom-specific validation
    if (formData.verificationMethod === "zoom") {
      if (!formData.zoomRoomId?.trim()) {
        newErrors.zoomRoomId = "Zoom Room ID is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Include language and agent phone information in the form data
      const sessionData = { 
        ...formData, 
        language: selectedLanguage,
        agentPhone: agentPhone
      };
      console.log('Submitting session with language and agent phone:', { language: selectedLanguage, agentPhone });
      createSessionMutation.mutate(sessionData);
    }
  };

  const handleInputChange = (field: keyof ClientInfo, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent" style={{ 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent', 
              backgroundClip: 'text',
              display: 'inline-block',
              lineHeight: '1.2'
            }}>
              AO Precheck
            </span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Professional Insurance Verification System
          </p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardContent className="p-8">
            {/* Language Selection */}
            <div className="mb-8">
              <Label className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-4 block">
                Select Language
              </Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={selectedLanguage === 'en' ? 'default' : 'outline'}
                  onClick={() => setSelectedLanguage('en')}
                  className="flex items-center gap-2"
                >
                  <span className="text-xl">🇺🇸</span>
                  English
                </Button>
                <Button
                  type="button"
                  variant={selectedLanguage === 'es' ? 'default' : 'outline'}
                  onClick={() => setSelectedLanguage('es')}
                  className="flex items-center gap-2"
                >
                  <span className="text-xl">🇪🇸</span>
                  Español
                </Button>
              </div>
            </div>

            {/* Agent Phone Number */}
            <div className="mb-8">
              <Label htmlFor="agentPhone" className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                Agent Phone Number *
              </Label>
              <Input
                id="agentPhone"
                value={agentPhone}
                onChange={(e) => {
                  setAgentPhone(e.target.value);
                  if (errors.agentPhone) {
                    setErrors(prev => ({ ...prev, agentPhone: "" }));
                  }
                }}
                placeholder="+1-555-123-4567"
                className={`max-w-md ${errors.agentPhone ? "border-red-500" : ""}`}
              />
              {errors.agentPhone && (
                <p className="text-sm text-red-500 mt-1">{errors.agentPhone}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Required for Taalk integration and call routing
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Main Form Layout - Two Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Basic Information */}
                <div className="space-y-6">
                  {/* Client Name Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        First Name *
                      </Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange("firstName", e.target.value)}
                        placeholder="Enter first name"
                        className={errors.firstName ? "border-red-500" : ""}
                      />
                      {errors.firstName && (
                        <p className="text-sm text-red-500">{errors.firstName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Last Name *
                      </Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange("lastName", e.target.value)}
                        placeholder="Enter last name"
                        className={errors.lastName ? "border-red-500" : ""}
                      />
                      {errors.lastName && (
                        <p className="text-sm text-red-500">{errors.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="spouseName" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Spouse Name
                    </Label>
                    <Input
                      id="spouseName"
                      value={formData.spouseName || ""}
                      onChange={(e) => handleInputChange("spouseName", e.target.value)}
                      placeholder="Enter spouse name (if applicable)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Phone Number *
                    </Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="(555) 123-4567"
                      className={errors.phone ? "border-red-500" : ""}
                    />
                    {errors.phone && (
                      <p className="text-sm text-red-500">{errors.phone}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="premium" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Premium Amount *
                    </Label>
                    <Input
                      id="premium"
                      value={formData.premium}
                      onChange={(e) => handleInputChange("premium", e.target.value)}
                      placeholder="$0.00"
                      className={errors.premium ? "border-red-500" : ""}
                    />
                    {errors.premium && (
                      <p className="text-sm text-red-500">{errors.premium}</p>
                    )}
                  </div>

                  {/* Location Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        City *
                      </Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => handleInputChange("city", e.target.value)}
                        placeholder="Enter city"
                        className={errors.city ? "border-red-500" : ""}
                      />
                      {errors.city && (
                        <p className="text-sm text-red-500">{errors.city}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        State *
                      </Label>
                      <Select value={formData.state} onValueChange={(value) => handleInputChange("state", value)}>
                        <SelectTrigger className={errors.state ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.state && (
                        <p className="text-sm text-red-500">{errors.state}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Verification Method & Security Info */}
                <div className="space-y-6">
                  {/* Verification Method */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Verification Method *
                    </Label>
                    <Select 
                      value={formData.verificationMethod} 
                      onValueChange={(value) => handleInputChange("verificationMethod", value)}
                    >
                      <SelectTrigger className={errors.verificationMethod ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select verification method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zoom">Zoom Meeting</SelectItem>
                        <SelectItem value="phone">Phone Call</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp Video</SelectItem>
                        <SelectItem value="facetime">FaceTime</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.verificationMethod && (
                      <p className="text-sm text-red-500">{errors.verificationMethod}</p>
                    )}
                  </div>

                  {/* Zoom Details */}
                  {formData.verificationMethod === "zoom" && (
                    <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">Zoom Meeting Details</h4>
                      
                      <div className="space-y-2">
                        <Label htmlFor="zoomRoomId" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Zoom Room ID *
                        </Label>
                        <Input
                          id="zoomRoomId"
                          value={formData.zoomRoomId}
                          onChange={(e) => handleInputChange("zoomRoomId", e.target.value)}
                          placeholder="123-456-789"
                          className={errors.zoomRoomId ? "border-red-500" : ""}
                        />
                        {errors.zoomRoomId && (
                          <p className="text-sm text-red-500">{errors.zoomRoomId}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="zoomPassword" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Zoom Password
                        </Label>
                        <Input
                          id="zoomPassword"
                          value={formData.zoomPassword}
                          onChange={(e) => handleInputChange("zoomPassword", e.target.value)}
                          placeholder="(Optional)"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button - Full Width Below Both Columns */}
              <Button
                type="submit"
                className="w-full py-3 text-base font-medium"
                disabled={createSessionMutation.isPending}
              >
                {createSessionMutation.isPending ? (
                  "Processing..."
                ) : (
                  <>
                    Start Verification Process
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}