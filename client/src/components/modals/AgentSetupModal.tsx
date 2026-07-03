import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Settings, User, Phone, Video, Lock, Loader2, Users, Building, Camera, Upload, X } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";

interface producerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProducerSetupModal({ isOpen, onClose }: producerSetupModalProps) {
  const { toast } = useToast();
  const { authState } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // producer information state - now managed in database
  const [producerFirstName, setproducerFirstName] = useState('');
  const [producerLastName, setproducerLastName] = useState('');
  const [producerPhone, setproducerPhone] = useState('');
  const [producerZoomRoomId, setproducerZoomRoomId] = useState('');
  const [producerZoomPassword, setproducerZoomPassword] = useState('1');
  const [mgaTeam, setMgaTeam] = useState('');
  const [rgaTeam, setRgaTeam] = useState('');
  const [profilePicture, setProfilePicture] = useState<string>('');
  
  // MGA/RGA options
  const [mgaOptions, setMgaOptions] = useState<string[]>([]);
  const [rgaOptions, setRgaOptions] = useState<string[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Load Producer Profile and team options from database
  useEffect(() => {
    if (isOpen && authState.user?.id) {
      loadproducerProfile();
      loadTeamOptions();
    }
  }, [isOpen, authState.user?.id]);

  const loadproducerProfile = async () => {
    setLoadingProfile(true);
    try {
      const response = await fetch(`/api/agent/profile-direct?userEmail=${encodeURIComponent(authState.user?.email || 'cnsysop@aoglobelife.com')}`);
      if (response.ok) {
        const profile = await response.json();
        if (profile) {
          setproducerFirstName(profile.firstName || '');
          setproducerLastName(profile.lastName || '');
          setproducerPhone(profile.phone || '');
          setproducerZoomRoomId(profile.zoomId || '');
          setproducerZoomPassword(profile.zoomPassword || '1');
          setMgaTeam(profile.mgaTeam || '');
          setRgaTeam(profile.rgaTeam || '');
          setProfilePicture(profile.profilePicture || '');
        }
      }
    } catch (error) {
      console.error('Failed to load Producer Profile:', error);
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

        // Auto-sync with agent_hierarchy defaults when profile doesn't have values yet
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

  // Save functions - now save to database AND localStorage for backward compatibility
  const saveField = async (field: string, value: string, displayName: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/agent/profile-direct', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          [field]: value,
          userEmail: authState.user?.email || 'cnsysop@aoglobelife.com'
        }),
      });
      
      if (response.ok) {
        // Also save to localStorage for backward compatibility
        const localKey = field === 'firstName' ? 'agent_first_name' : 
                        field === 'lastName' ? 'agent_last_name' :
                        field === 'phone' ? 'agent_phone' :
                        field === 'zoomId' ? 'agent_zoom_room_id' :
                        field === 'zoomPassword' ? 'agent_zoom_password' : field;
        localStorage.setItem(localKey, value);
        
        toast({ title: "Saved", description: `${displayName} saved successfully!` });
      } else {
        toast({ title: "Error", description: `Failed to save ${displayName.toLowerCase()}`, variant: "destructive" });
      }
    } catch (error) {
      console.error(`Failed to save ${field}:`, error);
      toast({ title: "Error", description: `Failed to save ${displayName.toLowerCase()}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveproducerFirstName = () => saveField('firstName', producerFirstName, 'producer first name');
  const saveproducerLastName = () => saveField('lastName', producerLastName, 'producer last name');
  const saveproducerPhone = () => saveField('phone', producerPhone, 'producer phone number');
  const saveproducerZoomRoomId = () => saveField('zoomId', producerZoomRoomId, 'Zoom room ID');
  const saveproducerZoomPassword = () => saveField('zoomPassword', producerZoomPassword || '1', 'Zoom password');
  const saveMgaTeam = () => saveField('mgaTeam', mgaTeam, 'MGA Team');
  const saveRgaTeam = () => saveField('rgaTeam', rgaTeam, 'RGA Team');

  const saveAllproducerInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/agent/profile-direct', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: producerFirstName,
          lastName: producerLastName,
          phone: producerPhone,
          zoomId: producerZoomRoomId,
          zoomPassword: producerZoomPassword || '1',
          mgaTeam: mgaTeam,
          rgaTeam: rgaTeam,
          profilePicture: profilePicture,
          userEmail: authState.user?.email || 'cnsysop@aoglobelife.com'
        }),
      });
      
      if (response.ok) {
        // Also save to localStorage for backward compatibility
        localStorage.setItem('agent_first_name', producerFirstName);
        localStorage.setItem('agent_last_name', producerLastName);
        localStorage.setItem('agent_phone', producerPhone);
        localStorage.setItem('agent_zoom_room_id', producerZoomRoomId);
        localStorage.setItem('agent_zoom_password', producerZoomPassword || '1');
        
        toast({ title: "All Saved", description: "All producer information saved successfully!" });
      } else {
        toast({ title: "Error", description: "Failed to save producer information", variant: "destructive" });
      }
    } catch (error) {
      console.error('Failed to save Producer Info:', error);
      toast({ title: "Error", description: "Failed to save producer information", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:hidden"
        onInteractOutside={(e) => {
          e.preventDefault(); // Prevent closing when clicking outside
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault(); // Prevent closing on Escape key
        }}
      >
        <DialogHeader>
          <div className="flex items-start justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Settings className="h-6 w-6 text-blue-600" />
              Producer Setup
            </DialogTitle>
            <DialogClose asChild>
              <button
                onClick={onClose}
                className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm hover:shadow-md hover:scale-110"
                aria-label="Close"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Producer Name Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              <User className="h-5 w-5" />
              producer Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="producerFirstName" className="text-base font-semibold text-slate-700 mb-2 block">
                  First Name *
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="producerFirstName"
                    value={producerFirstName}
                    onChange={(e) => setproducerFirstName(e.target.value)}
                    placeholder="Alex"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={saveproducerFirstName}
                    size="sm"
                    variant="outline"
                    className="px-3"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="producerLastName" className="text-base font-semibold text-slate-700 mb-2 block">
                  Last Name *
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="producerLastName"
                    value={producerLastName}
                    onChange={(e) => setproducerLastName(e.target.value)}
                    placeholder="Swift"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={saveproducerLastName}
                    size="sm"
                    variant="outline"
                    className="px-3"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Picture Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Profile Picture
            </h3>
            
            <div className="flex items-center space-x-4">
              {/* Profile Picture Preview */}
              <div className="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-300 flex items-center justify-center overflow-hidden">
                {profilePicture ? (
                  <img 
                    src={profilePicture} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-gray-400" />
                )}
              </div>
              
              {/* Upload Button */}
              <div className="flex-1">
                <Label htmlFor="profilePicture" className="text-base font-semibold text-slate-700 mb-2 block">
                  Upload Profile Picture
                </Label>
                <input
                  id="profilePicture"
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        setProfilePicture(e.target?.result as string);
                        toast({
                          title: "Photo Selected",
                          description: "Profile picture updated successfully!",
                        });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
                <div className="space-y-2">
                  <Button
                    type="button"
                    onClick={() => document.getElementById('profilePicture')?.click()}
                    variant="outline"
                    className="w-full flex items-center gap-2 py-3"
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo / Choose From Gallery
                  </Button>
                  {profilePicture && (
                    <Button
                      type="button"
                      onClick={() => setProfilePicture('')}
                      variant="ghost"
                      className="w-full text-red-600 hover:text-red-700"
                    >
                      Remove Photo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </h3>
            
            <div>
              <Label htmlFor="producerPhone" className="text-base font-semibold text-slate-700 mb-2 block">
                Phone Number *
              </Label>
              <div className="flex gap-2 max-w-md">
                <Input
                  id="producerPhone"
                  value={producerPhone}
                  onChange={(e) => setproducerPhone(e.target.value)}
                  placeholder="Enter your phone number"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={saveproducerPhone}
                  size="sm"
                  variant="outline"
                  className="px-3"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>
          </div>

          {/* Team Assignment Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              <Building className="h-5 w-5" />
              Team Assignment
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mgaTeam" className="text-base font-semibold text-slate-700 mb-2 block">
                  MGA Team *
                </Label>
                <div className="flex gap-2">
                  <Select value={mgaTeam} onValueChange={setMgaTeam}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={loadingTeams ? "Loading..." : "Select your MGA"} />
                    </SelectTrigger>
                    <SelectContent>
                      {mgaOptions.map((mga) => (
                        <SelectItem key={mga} value={mga}>
                          {mga}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={saveMgaTeam}
                    size="sm"
                    variant="outline"
                    className="px-3"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="rgaTeam" className="text-base font-semibold text-slate-700 mb-2 block">
                  RGA Team *
                </Label>
                <div className="flex gap-2">
                  <Select value={rgaTeam} onValueChange={setRgaTeam}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={loadingTeams ? "Loading..." : "Select your RGA"} />
                    </SelectTrigger>
                    <SelectContent>
                      {rgaOptions.map((rga) => (
                        <SelectItem key={rga} value={rga}>
                          {rga}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={saveRgaTeam}
                    size="sm"
                    variant="outline"
                    className="px-3"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Zoom Meeting Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              <Video className="h-5 w-5" />
              Zoom Meeting Setup
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="producerZoomRoomId" className="text-base font-semibold text-slate-700 mb-2 block">
                  Zoom Room ID *
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="producerZoomRoomId"
                    value={producerZoomRoomId}
                    onChange={(e) => setproducerZoomRoomId(e.target.value)}
                    placeholder="6179755704"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={saveproducerZoomRoomId}
                    size="sm"
                    variant="outline"
                    className="px-3"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="producerZoomPassword" className="text-base font-semibold text-slate-700 mb-2 block">
                  <Lock className="h-4 w-4 inline mr-1" />
                  Zoom Password
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="producerZoomPassword"
                    value={producerZoomPassword}
                    onChange={(e) => setproducerZoomPassword(e.target.value)}
                    placeholder="1 (default)"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={saveproducerZoomPassword}
                    size="sm"
                    variant="outline"
                    className="px-3"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Leave blank to default to "1"</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <Button
              type="button"
              onClick={saveAllproducerInfo}
              variant="default"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6"
              disabled={loading || loadingProfile}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : 'Save All Information'}
            </Button>
            
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
            >
              Close
            </Button>
          </div>

          {/* Information Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Producer Setup Information</h4>
            <p className="text-blue-700 text-sm mb-2">
              This information is used for verification calls and Taalk API integration.
            </p>
            <div className="text-xs text-blue-600">
              <strong>Note:</strong> All data is permanently saved to your profile and syncs across all devices.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}