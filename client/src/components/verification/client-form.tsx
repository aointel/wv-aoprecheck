import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Calendar, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useDemo } from "@/contexts/DemoContext";
import type { ClientInfo, VerificationSession } from "@shared/schema";
import { getDeviceGeolocation, type GeolocationData } from "@/lib/geolocation";

interface ClientFormProps {
  onSubmit: (session: VerificationSession) => void;
  hideZoomSelection?: boolean;
  selectedTrack?: 'zoom' | 'conference' | 'aoi-meet' | null;
  sessionType?: 'demo' | 'live';
  prefilledData?: any; // Client data from appointment
  defaultMethod?: 'zoom' | 'phone' | 'whatsapp' | 'facetime';
  regionTrack?: 'us' | 'canada' | 'new-york'; // Region track for persona selection
  /** Flat layout inside AO Precheck workflow panel — no full-page chrome, wider 2-col grid */
  embedded?: boolean;
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

const CANADIAN_PROVINCES = [
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "British Columbia" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland and Labrador" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
  { value: "ON", label: "Ontario" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "QC", label: "Quebec" },
  { value: "SK", label: "Saskatchewan" },
  { value: "YT", label: "Yukon" },
];

export function ClientForm({ onSubmit, hideZoomSelection = false, selectedTrack = null, sessionType = 'live', prefilledData = null, defaultMethod, embedded = false }: ClientFormProps) {
  // 🎭 DEMO MODE: Check if prefilledData has is_demo flag or if we're in demo mode from context
  const { isDemoMode, demoProduct } = useDemo();
  const isPrecheckDemo = isDemoMode && demoProduct === 'precheck';
  const isDemoFromProps = prefilledData?.is_demo === true || prefilledData?.is_demo === 'true' || isPrecheckDemo;
  
  // Set demo mode in sessionStorage so mutation can access it
  useEffect(() => {
    if (isDemoFromProps) {
      sessionStorage.setItem('demo_mode', 'true');
    } else {
      sessionStorage.removeItem('demo_mode');
    }
  }, [isDemoFromProps]);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'es'>('en');
  const { authState } = useAuth();
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const submitInFlightRef = useRef(false);
  
  // Agent geolocation state - REQUIRED
  const [agentGeolocation, setAgentGeolocation] = useState<GeolocationData | null>(null);
  const [geolocationLoading, setGeolocationLoading] = useState(false);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const [geolocationDenied, setGeolocationDenied] = useState(false);
  
  // producer information now comes from Supabase via auth context
  // Keep localStorage as fallback for backward compatibility during transition  
  const [producerPhone, setproducerPhone] = useState(() => {
    return authState.profile?.phone || localStorage.getItem('agent_phone') || "";
  });
  const [producerFirstName, setproducerFirstName] = useState(() => {
    return authState.profile?.firstName || localStorage.getItem('agent_first_name') || "";
  });
  const [producerLastName, setproducerLastName] = useState(() => {
    return authState.profile?.lastName || localStorage.getItem('agent_last_name') || "";
  });
  const [producerZoomRoomId, setproducerZoomRoomId] = useState(() => {
    return authState.profile?.zoomId || localStorage.getItem('agent_zoom_room_id') || "";
  });
  const [producerZoomPassword, setproducerZoomPassword] = useState(() => {
    return authState.profile?.zoomPassword || localStorage.getItem('agent_zoom_password') || "";
  });

  // Update local state when auth profile changes (from Supabase)
  useEffect(() => {
    if (authState.profile) {
      console.log('🔄 Updating local state from auth profile:', authState.profile);
      setproducerPhone(authState.profile.phone || "");
      setproducerFirstName(authState.profile.firstName || "");
      setproducerLastName(authState.profile.lastName || "");
      setproducerZoomRoomId(authState.profile.zoomId || "");
      setproducerZoomPassword(authState.profile.zoomPassword || "");
      setIsLoadingProfile(false);
    }
  }, [authState.profile]);

  // Load Producer Profile from API on component mount (fallback if auth doesn't have profile)
  useEffect(() => {
    const loadproducerProfile = async () => {
      const userEmail = authState.user?.email;

      // Only load from API if auth state has the required profile data
      if (authState.profile?.phone && authState.profile?.firstName && authState.profile?.lastName) {
        console.log('✅ Using auth state profile, skipping API call');
        setIsLoadingProfile(false);
        return;
      }
      if (!userEmail) {
        setIsLoadingProfile(false);
        return;
      }
      
      try {
        console.log('🔄 Loading Producer Profile from API...');
        const response = await fetch(`/api/agent/profile-direct?userEmail=${encodeURIComponent(userEmail)}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (response.ok) {
          const profile = await response.json();
          if (profile) {
            console.log('✅ Producer Profile loaded:', profile);
            // Update state with loaded profile data
            setproducerPhone(profile.phone || "");
            setproducerFirstName(profile.firstName || "");
            setproducerLastName(profile.lastName || "");
            setproducerZoomRoomId(profile.zoomId || profile.zoomMeetingId || "");
            setproducerZoomPassword(profile.zoomPassword || "");
          }
        } else {
          console.log('⚠️ No profile found, using defaults');
        }
      } catch (error) {
        console.error('❌ Failed to load Producer Profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadproducerProfile();
  }, [authState.profile?.phone, authState.profile?.firstName, authState.profile?.lastName, authState.user?.email]);

  // Update verification method when selectedTrack changes or defaultMethod is provided
  useEffect(() => {
    const method = defaultMethod || (selectedTrack === 'conference' ? 'phone' : 'zoom');
    setFormData(prev => ({
      ...prev,
      verificationMethod: method
    }));
  }, [selectedTrack, defaultMethod]);
  
  const [formData, setFormData] = useState<ClientInfo>({
    firstName: prefilledData?.firstName || "",
    lastName: prefilledData?.lastName || "",
    spouseName: "",
    phone: prefilledData?.phone || "",
    city: prefilledData?.city || "",
    state: prefilledData?.state || "",
    country: prefilledData?.country || "USA", // Default to USA
    premium: "", // NEVER prefill premium - agent must enter manually
    achDrawDate: "",
    achDrawDateShort: "",
    verificationMethod: defaultMethod || (selectedTrack === 'conference' ? 'phone' : 'zoom'),
    zoomRoomId: producerZoomRoomId,
    zoomPassword: producerZoomPassword,
    language: "en",
    producerFirstName: producerFirstName,
    producerLastName: producerLastName,
    producerPhone: producerPhone
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [embeddedAchIso, setEmbeddedAchIso] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
  });
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Pre-fill producer phone from user profile
  useEffect(() => {
    // Skip user profile pre-fill for now as we have persistent defaults
    // if (authState.user?.phone && !producerPhone) {
    //   setproducerPhone(authState.user.phone);
    // }
  }, [authState.user, producerPhone]);

  // Individual save functions for producer information
  const saveproducerFirstName = () => {
    localStorage.setItem('agent_first_name', producerFirstName);
    toast({
      title: "Saved",
      description: "producer first name saved successfully",
    });
  };

  const saveproducerLastName = () => {
    localStorage.setItem('agent_last_name', producerLastName);
    toast({
      title: "Saved", 
      description: "producer last name saved successfully",
    });
  };

  const saveproducerPhone = () => {
    localStorage.setItem('agent_phone', producerPhone);
    toast({
      title: "Saved",
      description: "producer phone number saved successfully", 
    });
  };

  const saveproducerZoomRoomId = () => {
    localStorage.setItem('agent_zoom_room_id', producerZoomRoomId);
    toast({
      title: "Saved",
      description: "Zoom room ID saved successfully",
    });
  };

  const saveproducerZoomPassword = () => {
    localStorage.setItem('agent_zoom_password', producerZoomPassword || "1");
    toast({
      title: "Saved", 
      description: "Zoom password saved successfully",
    });
  };

  // Save all producer information at once
  const saveAllproducerInfo = () => {
    localStorage.setItem('agent_first_name', producerFirstName);
    localStorage.setItem('agent_last_name', producerLastName);
    localStorage.setItem('agent_phone', producerPhone);
    localStorage.setItem('agent_zoom_room_id', producerZoomRoomId);
    localStorage.setItem('agent_zoom_password', producerZoomPassword || "1");
    toast({
      title: "All Saved",
      description: "All producer information saved successfully",
    });
  };

  const createSessionMutation = useMutation({
    mutationFn: async (clientInfo: ClientInfo & { agentGeolocation?: GeolocationData; agentGeolocationDenied?: boolean }) => {
      // Geolocation is NOT required here - it's only collected when agent/client opens SMS link
      // No validation needed - geolocation will be collected later via SMS link
      
      console.log('Creating verification session with:', clientInfo);
      
      // Get public IP
      let publicIp = null;
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json', {
          signal: AbortSignal.timeout(5000)
        });
        if (ipResponse.ok) {
          const ipData = await ipResponse.json();
          publicIp = ipData.ip;
        }
      } catch (ipError) {
        console.warn('Could not detect public IP:', ipError);
      }
      
      // 🎭 DEMO MODE: Check if in demo mode from context or props
      // Use the isPrecheckDemo value from component level (already defined above)
      const isDemo = isPrecheckDemo || (clientInfo as any).is_demo === true || (clientInfo as any).is_demo === 'true' || sessionStorage.getItem('demo_mode') === 'true';
      
      // Include geolocation in the request (if available)
      const sessionPayload = {
        ...clientInfo,
        agentLatitude: clientInfo.agentGeolocation?.latitude || null,
        agentLongitude: clientInfo.agentGeolocation?.longitude || null,
        agentAccuracy: clientInfo.agentGeolocation?.accuracy || null,
        agentPublicIp: publicIp,
        agentTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        is_demo: isDemo || false // 🎭 DEMO MODE: Pass demo flag
      };
      
      const response = await apiRequest("POST", "/api/verification/session", sessionPayload);
      const session = await response.json() as VerificationSession;
      console.log('Session created successfully:', session);
      return session;
    },
    onSuccess: (session) => {
      submitInFlightRef.current = false;
      console.log('Mutation success, calling onSubmit with:', session);
      onSubmit(session);
      toast({
        title: "Session created",
        description: `Ready for verification - Session ${session.sessionId}`,
      });
    },
    onError: (error: any) => {
      submitInFlightRef.current = false;
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

    // Get the latest values from Supabase profile first, then localStorage fallback
    const currentproducerPhone = authState.profile?.phone || localStorage.getItem('agent_phone') || producerPhone;
    const currentproducerFirstName = authState.profile?.firstName || localStorage.getItem('agent_first_name') || producerFirstName;
    const currentproducerLastName = authState.profile?.lastName || localStorage.getItem('agent_last_name') || producerLastName;
    const currentZoomRoomId = authState.profile?.zoomId || localStorage.getItem('agent_zoom_room_id') || producerZoomRoomId;

    if (!currentproducerPhone?.trim()) {
      newErrors.producerPhone = "producer phone number is required";
    }
    if (!currentproducerFirstName?.trim()) {
      newErrors.producerFirstName = "producer first name is required";
    }
    if (!currentproducerLastName?.trim()) {
      newErrors.producerLastName = "producer last name is required";
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
    // Zoom validation - optional since we auto-default it in handleSubmit
    // Validation removed to allow form submission even if zoom room ID is missing
    // The handleSubmit will auto-default it to "83639466679" if not provided

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitInFlightRef.current || createSessionMutation.isPending) {
      console.warn('AO Precheck submit ignored: session creation already in progress');
      return;
    }
    console.log('🔥 FORM SUBMIT CLICKED!');
    
    // Get the latest values from Supabase profile first, then localStorage fallback
    const currentproducerPhone = authState.profile?.phone || localStorage.getItem('agent_phone') || producerPhone;
    const currentproducerFirstName = authState.profile?.firstName || localStorage.getItem('agent_first_name') || producerFirstName;
    const currentproducerLastName = authState.profile?.lastName || localStorage.getItem('agent_last_name') || producerLastName;
    const currentZoomRoomId = authState.profile?.zoomId || localStorage.getItem('agent_zoom_room_id') || producerZoomRoomId;
    const currentZoomPassword = authState.profile?.zoomPassword || localStorage.getItem('agent_zoom_password') || producerZoomPassword || "1";
    
    console.log('🔍 Producer Info Check:', {
      currentproducerPhone,
      currentproducerFirstName, 
      currentproducerLastName,
      currentZoomRoomId,
      formData
    });
    
    // Validate producer phone number is provided
    if (!currentproducerPhone || currentproducerPhone.trim() === '') {
      toast({
        title: "producer Phone Required",
        description: "Please enter your phone number in the producer information section before starting verification.",
        variant: "destructive"
      });
      return;
    }
    
    // Auto-default Zoom Room ID if missing
    let finalZoomRoomId = currentZoomRoomId;
    if (!finalZoomRoomId || finalZoomRoomId.trim() === '') {
      finalZoomRoomId = "83639466679"; // Default Zoom room ID
      console.log('🔧 Auto-defaulting Zoom Room ID to:', finalZoomRoomId);
    }
    
    if (validateForm()) {
      submitInFlightRef.current = true;
      // DO NOT collect geolocation here - it should ONLY be collected when agent/client opens SMS link
      // Geolocation is collected in agent-verification.tsx and client-verification.tsx when they open the text link
      
      // Include language, producer information, and session type in the form data
      const sessionData = { 
        ...formData, 
        language: selectedLanguage,
        sessionType: sessionType, // "demo" or "live"
        producerPhone: currentproducerPhone,
        producerFirstName: currentproducerFirstName,
        producerLastName: currentproducerLastName,
        // NO geolocation here - only collected via SMS link
        agentGeolocation: null,
        agentGeolocationDenied: false,
        agentGeolocationError: null,
        // Use the persistent zoom fields
        zoomRoomId: finalZoomRoomId,
        zoomPassword: currentZoomPassword
      };
      console.log('Submitting session with Producer Info:', { 
        producerFirstName: currentproducerFirstName, 
        producerLastName: currentproducerLastName, 
        producerPhone: currentproducerPhone, 
        zoomRoomId: currentZoomRoomId,
        language: selectedLanguage 
      });
      createSessionMutation.mutate(sessionData);
    }
  };

  const formatACHDrawDate = (dateString: string) => {
    if (!dateString) return { achDrawDate: "", achDrawDateShort: "" };
    
    // Parse date in local timezone to avoid timezone offset issues
    const date = new Date(dateString + 'T12:00:00');
    if (isNaN(date.getTime())) return { achDrawDate: "", achDrawDateShort: "" };
    
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    
    const day = date.getDate();
    const month = months[date.getMonth()];
    
    // Add ordinal suffix (st, nd, rd, th)
    const getOrdinalSuffix = (num: number) => {
      const j = num % 10;
      const k = num % 100;
      if (j === 1 && k !== 11) return "st";
      if (j === 2 && k !== 12) return "nd";
      if (j === 3 && k !== 13) return "rd";
      return "th";
    };
    
    const dayWithSuffix = day + getOrdinalSuffix(day);
    
    return {
      achDrawDate: `${month} ${dayWithSuffix}`, // e.g., "September 8th"
      achDrawDateShort: dayWithSuffix // e.g., "8th"
    };
  };

  const handleCurrencyChange = (value: string) => {
    // Only allow digits and one decimal point
    const cleanValue = value.replace(/[^\d.]/g, '');
    
    // Prevent multiple decimal points
    const parts = cleanValue.split('.');
    let formatted = parts[0];
    if (parts.length > 1) {
      // Only allow 2 decimal places
      formatted = parts[0] + '.' + parts[1].slice(0, 2);
    }
    
    setFormData(prev => ({ ...prev, premium: formatted }));
    // Clear error when user starts typing
    if (errors.premium) {
      setErrors(prev => ({ ...prev, premium: "" }));
    }
  };

  const handleInputChange = (field: keyof ClientInfo, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  // Check if date is within 14-day home office window (30 days from today + 14 day window)
  const checkHomeOfficeWindow = (dateString: string) => {
    if (!dateString) return { isWithin14Days: false };
    
    const selectedDate = new Date(dateString);
    if (isNaN(selectedDate.getTime())) return { isWithin14Days: false };
    
    const today = new Date();
    
    // 14-day window starts 30 days from today
    const windowStart = new Date(today);
    windowStart.setDate(today.getDate() + 30);
    
    // 14-day window ends 44 days from today (30 + 14)
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + 44);
    
    const isWithin14Days = selectedDate >= windowStart && selectedDate <= windowEnd;
    
    return { isWithin14Days, windowStart, windowEnd };
  };


  const handleDateChange = (dateString: string) => {
    // Always proceed - just update form data immediately
    const { achDrawDate, achDrawDateShort } = formatACHDrawDate(dateString);
    setFormData(prev => ({ 
      ...prev, 
      achDrawDate, 
      achDrawDateShort 
    }));
  };


  if (isLoadingProfile) {
    if (embedded) {
      return (
        <div className="flex items-center justify-center gap-2 py-10 text-[#8b94a7] text-sm">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-violet-600 border-t-transparent" />
          Loading profile…
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="mx-auto max-w-5xl">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Producer Profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "precheck-client-form w-full" : "min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4"}>
      <div className={embedded ? "w-full" : "mx-auto max-w-5xl"}>
        {!embedded && (
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

        </div>
        )}

        {embedded ? (
        <div className="w-full">
            {/* Language Selection */}
            <div className="mb-5">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 block">
                Select Language
              </Label>
              <div className="flex gap-3">
                <Button type="button" variant={selectedLanguage === 'en' ? 'default' : 'outline'} onClick={() => setSelectedLanguage('en')} size="sm">English</Button>
                <Button type="button" variant={selectedLanguage === 'es' ? 'default' : 'outline'} onClick={() => setSelectedLanguage('es')} size="sm">Español</Button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium text-slate-700 dark:text-slate-300">First Name *</Label>
                      <Input id="firstName" value={formData.firstName} onChange={(e) => handleInputChange("firstName", e.target.value)} placeholder="Enter first name" className={errors.firstName ? "border-red-500" : ""} />
                      {errors.firstName && <p className="text-sm text-red-500">{errors.firstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium text-slate-700 dark:text-slate-300">Last Name *</Label>
                      <Input id="lastName" value={formData.lastName} onChange={(e) => handleInputChange("lastName", e.target.value)} placeholder="Enter last name" className={errors.lastName ? "border-red-500" : ""} />
                      {errors.lastName && <p className="text-sm text-red-500">{errors.lastName}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spouseName" className="text-sm font-medium text-slate-700 dark:text-slate-300">Spouse Name</Label>
                    <Input id="spouseName" value={formData.spouseName || ""} onChange={(e) => handleInputChange("spouseName", e.target.value)} placeholder="Enter spouse name (if applicable)" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number *</Label>
                    <Input id="phone" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} placeholder="(555) 123-4567" className={errors.phone ? "border-red-500" : ""} />
                    {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
                  </div>
                </div>
                <div className="space-y-4">
                  {/* Premium, location, zoom — right column keeps form short */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="premium-emb" className="text-sm font-medium text-slate-700 dark:text-slate-300">Premium Amount (USD) *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-semibold">$</span>
                        <Input id="premium-emb" value={formData.premium} onChange={(e) => handleCurrencyChange(e.target.value)} placeholder="100.00" className={`pl-8 ${errors.premium ? "border-red-500" : ""}`} type="text" inputMode="decimal" />
                      </div>
                      {errors.premium && <p className="text-sm text-red-500">{errors.premium}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ach-emb" className="text-sm font-medium text-slate-700 dark:text-slate-300">ACH Draw Date</Label>
                      <Input id="ach-emb" type="date" value={embeddedAchIso} onChange={(e) => { setEmbeddedAchIso(e.target.value); if (e.target.value) handleDateChange(e.target.value); }} className="w-full" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country-emb" className="text-sm font-medium text-slate-700 dark:text-slate-300">Country *</Label>
                    <Select value={formData.country || "USA"} onValueChange={(value) => handleInputChange("country", value)}>
                      <SelectTrigger className={errors.country ? "border-red-500" : ""}><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USA">United States</SelectItem>
                        <SelectItem value="Canada">Canada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city-emb" className="text-sm font-medium text-slate-700 dark:text-slate-300">City *</Label>
                      <Input id="city-emb" value={formData.city} onChange={(e) => handleInputChange("city", e.target.value)} placeholder="Enter city" className={errors.city ? "border-red-500" : ""} />
                      {errors.city && <p className="text-sm text-red-500">{errors.city}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state-emb" className="text-sm font-medium text-slate-700 dark:text-slate-300">{formData.country === "Canada" ? "Province *" : "State *"}</Label>
                      <Select value={formData.state} onValueChange={(value) => handleInputChange("state", value)}>
                        <SelectTrigger className={errors.state ? "border-red-500" : ""}><SelectValue placeholder={formData.country === "Canada" ? "Select province" : "Select state"} /></SelectTrigger>
                        <SelectContent>
                          {(formData.country === "Canada" ? CANADIAN_PROVINCES : US_STATES).map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.state && <p className="text-sm text-red-500">{errors.state}</p>}
                    </div>
                  </div>
                  {!hideZoomSelection && (
                    <div className="p-3 bg-[#f4eafe] rounded-lg border border-[#e7eaf0]">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 bg-violet-600 rounded-full" />
                        <Label className="text-sm font-medium text-[#0f1729]">Verification Method: Zoom Meeting</Label>
                      </div>
                      <p className="text-xs text-[#56607a]">All verifications are conducted via Zoom using your configured meeting room.</p>
                    </div>
                  )}
                </div>
              </div>
              <Button type="submit" className="w-full py-2.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-500 hover:brightness-105 text-white" disabled={createSessionMutation.isPending}>
                {createSessionMutation.isPending ? "Processing..." : (<><span>Start Verification Process</span><ArrowRight className="ml-2 h-4 w-4" /></>)}
              </Button>
            </form>
        </div>
        ) : (
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
                  English
                </Button>
                <Button
                  type="button"
                  variant={selectedLanguage === 'es' ? 'default' : 'outline'}
                  onClick={() => setSelectedLanguage('es')}
                  className="flex items-center gap-2"
                >
                  Español
                </Button>
              </div>
            </div>



            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Main Form Layout - Two Columns */}
              <div className={`grid gap-8 ${hideZoomSelection ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
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

                  {/* Premium and Draft Date Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="premium" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Premium Amount (USD) *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 font-semibold text-lg">$</span>
                        <Input
                          id="premium"
                          value={formData.premium}
                          onChange={(e) => handleCurrencyChange(e.target.value)}
                          placeholder="100.00"
                          className={`pl-10 text-lg font-semibold h-12 ${errors.premium ? "border-red-500" : "border-2 border-slate-300 focus:border-blue-500"}`}
                          type="text"
                          inputMode="decimal"
                        />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Enter premium amount (e.g., 150.00, 275.50, 400.25)
                      </div>
                      {errors.premium && (
                        <p className="text-sm text-red-500">{errors.premium}</p>
                      )}
                    </div>

                    <div className="space-y-2 relative">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        ACH Draw Date
                      </Label>
                      
                      {showCalendar && (
                          <div className="fixed z-50 top-20 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-4 w-80">
                            {/* Calendar Header */}
                            <div className="flex items-center justify-between mb-4">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newMonth = new Date(calendarMonth);
                                  newMonth.setMonth(calendarMonth.getMonth() - 1);
                                  setCalendarMonth(newMonth);
                                }}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <div className="font-semibold">
                                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newMonth = new Date(calendarMonth);
                                  newMonth.setMonth(calendarMonth.getMonth() + 1);
                                  setCalendarMonth(newMonth);
                                }}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            {/* Days of week header */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="text-center text-xs font-medium text-slate-500 p-2">
                                  {day}
                                </div>
                              ))}
                            </div>
                            
                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-2">
                              {(() => {
                                const today = new Date();
                                const days = [];
                                
                                // Create proper calendar grid for the selected month
                                const firstDayOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
                                const lastDayOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
                                const firstDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
                                
                                // Add empty spaces for days before the first day of the month
                                for (let i = 0; i < firstDayOfWeek; i++) {
                                  days.push(<div key={`empty-${i}`} className="h-10 w-10"></div>);
                                }
                                
                                // Add all days of the month
                                for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
                                  const dayDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                                  const isToday = dayDate.toDateString() === today.toDateString();
                                  const isCurrentMonth = dayDate.getMonth() === calendarMonth.getMonth();
                                  
                                  // For ACH draw dates, all dates in next month are selectable
                                  const isSelectable = isCurrentMonth;
                                  
                                  // Check if this date is within the 14-day home office window (30-44 days from today)
                                  const dateString = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
                                  const { isWithin14Days } = checkHomeOfficeWindow(dateString);
                                  
                                  days.push(
                                    <Button
                                      key={`date-${day}`}
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className={`
                                        h-10 w-10 p-0 font-normal
                                        ${!isSelectable ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-blue-100'}
                                        ${isToday ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                                        ${isWithin14Days && isSelectable && !isToday ? 'bg-blue-200 text-blue-800 font-semibold border-2 border-blue-400 hover:bg-blue-300' : ''}
                                        ${isSelectable && !isToday && !isWithin14Days ? 'bg-slate-50 hover:bg-blue-50 border border-slate-200' : ''}
                                      `}
                                      disabled={!isSelectable}
                                      onClick={() => {
                                        if (!isSelectable) return;
                                        
                                        // Create date string in local timezone to avoid timezone shift
                                        const year = dayDate.getFullYear();
                                        const month = String(dayDate.getMonth() + 1).padStart(2, '0');
                                        const dayStr = String(dayDate.getDate()).padStart(2, '0');
                                        const dateString = `${year}-${month}-${dayStr}`;
                                        handleDateChange(dateString);
                                        setShowCalendar(false);
                                      }}
                                    >
                                      {day}
                                    </Button>
                                  );
                                }
                                
                                return days;
                              })()
                              }
                            </div>
                            
                            {/* Legend */}
                            <div className="mt-4 text-xs space-y-1">
                              <div className="flex items-center mb-1">
                                <div className="w-3 h-3 bg-blue-200 border-2 border-blue-400 rounded mr-2"></div>
                                <span className="text-blue-800 font-semibold">14-day home office window (recommended)</span>
                              </div>
                              <div className="flex items-center">
                                <div className="w-3 h-3 bg-slate-50 border border-slate-200 rounded mr-2"></div>
                                <span className="text-slate-600 dark:text-slate-400">Other available dates</span>
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 mt-2">
                                Blue dates = 30-44 days from today (home office window)
                              </div>
                            </div>
                          </div>
                        )}
                      
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between text-left font-normal"
                        onClick={() => setShowCalendar(!showCalendar)}
                      >
                        <div className="flex items-center">
                          <Calendar className="mr-2 h-4 w-4" />
                          {formData.achDrawDate ? formData.achDrawDate : "Select date"}
                        </div>
                      </Button>
                      {formData.achDrawDate && (
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          Selected: {formData.achDrawDate}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Country Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="country" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Country *
                    </Label>
                    <Select value={formData.country || "USA"} onValueChange={(value) => handleInputChange("country", value)}>
                      <SelectTrigger className={errors.country ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USA">United States</SelectItem>
                        <SelectItem value="Canada">Canada</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.country && (
                      <p className="text-sm text-red-500">{errors.country}</p>
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
                        {formData.country === "Canada" ? "Province *" : "State *"}
                      </Label>
                      <Select value={formData.state} onValueChange={(value) => handleInputChange("state", value)}>
                        <SelectTrigger className={errors.state ? "border-red-500" : ""}>
                          <SelectValue placeholder={formData.country === "Canada" ? "Select province" : "Select state"} />
                        </SelectTrigger>
                        <SelectContent>
                          {(formData.country === "Canada" ? CANADIAN_PROVINCES : US_STATES).map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
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

                {/* Right Column - Additional Client Information */}
                {!hideZoomSelection && (
                  <div className="space-y-6">
                    {/* Verification Method is fixed to Zoom */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Verification Method: Zoom Meeting
                        </Label>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        All verifications are conducted via Zoom using your configured meeting room.
                      </p>
                    </div>

                    {/* Additional Information */}
                    <div className="space-y-4">
                      {/* Verification Notes section removed - information was incorrect */}
                    </div>
                  </div>
                )}
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
        )}

      </div>
    </div>
  );
}