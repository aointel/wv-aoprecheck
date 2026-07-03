import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, Video, Save, X, LogOut, Mail, Camera, Upload } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface producerProfile {
  id?: number;
  firstName: string;
  lastName: string;
  phone: string;
  zoomId: string;
  zoomPassword: string;
  email: string;
  profilePicture?: string;
  mgaTeam?: string;
  rgaTeam?: string;
}

interface producerProfileProps {
  onClose: () => void;
}

export function producerProfile({ onClose }: producerProfileProps) {
  console.log('🔵 producerProfile component is rendering!');
  const { authState, updateProfile, logout } = useAuth();
  const [formData, setFormData] = useState<producerProfile>({
    firstName: "",
    lastName: "",
    phone: "",
    zoomId: "",
    zoomPassword: "1", // Default to "1" as specified
    email: "",
    profilePicture: "",
    mgaTeam: "",
    rgaTeam: "",
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();

  // Individual save functions for localStorage (Producer Setup data)
  const saveFirstNameToStorage = () => {
    localStorage.setItem('agent_first_name', formData.firstName);
    toast({
      title: "Saved",
      description: "First name saved for verification calls",
    });
  };

  const saveLastNameToStorage = () => {
    localStorage.setItem('agent_last_name', formData.lastName);
    toast({
      title: "Saved",
      description: "Last name saved for verification calls",
    });
  };

  const savePhoneToStorage = () => {
    localStorage.setItem('agent_phone', formData.phone);
    toast({
      title: "Saved",
      description: "Phone number saved for verification calls",
    });
  };

  const saveZoomIdToStorage = () => {
    localStorage.setItem('agent_zoom_room_id', formData.zoomId);
    toast({
      title: "Saved",
      description: "Zoom room ID saved for verification calls",
    });
  };

  const saveZoomPasswordToStorage = () => {
    localStorage.setItem('agent_zoom_password', formData.zoomPassword || "1");
    toast({
      title: "Saved",
      description: "Zoom password saved for verification calls",
    });
  };

  // Update form data when profile loads
  useEffect(() => {
    if (authState.profile) {
      setFormData({
        firstName: authState.profile.firstName || "",
        lastName: authState.profile.lastName || "",
        phone: authState.profile.phone || "",
        zoomId: authState.profile.zoomMeetingId || "",
        zoomPassword: authState.profile.zoomPassword || "1",
        email: authState.profile.email || "",
        profilePicture: authState.profile.profilePicture || "",
        mgaTeam: (authState.profile as any).mgaTeam || "",
        rgaTeam: (authState.profile as any).rgaTeam || "",
      });
    }
  }, [authState.profile]);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully.",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    // Optional: Validate MGA/RGA if provided (no longer required, but validate format if entered)
    if (formData.mgaTeam && formData.mgaTeam.trim() === '-') {
      newErrors.mgaTeam = "MGA Team cannot be just a dash";
    }
    if (formData.rgaTeam && formData.rgaTeam.trim() === '-') {
      newErrors.rgaTeam = "RGA Team cannot be just a dash";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setIsUpdating(true);
      try {
        const updateData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          email: formData.email,
          zoomMeetingId: formData.zoomId,
          zoomPassword: formData.zoomPassword,
          profilePicture: formData.profilePicture,
          mgaTeam: formData.mgaTeam?.trim() || null,
          rgaTeam: formData.rgaTeam?.trim() || null,
        };
        await updateProfile(updateData);
        toast({
          title: "Profile Updated",
          description: "Your Producer Profile has been saved successfully.",
        });
        onClose();
      } catch (error) {
        console.error('❌ Profile save error details:', error);
        toast({
          title: "Update Failed", 
          description: error instanceof Error ? error.message : "Failed to update profile. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return value;
  };

  const validateAndUploadFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPicture(true);
    
    try {
      // Create FormData for file upload
      const uploadFormData = new FormData();
      uploadFormData.append('profilePicture', file);
      uploadFormData.append('userEmail', formData.email.trim() || authState.user?.email || '');
      
      // Upload to server
      const response = await fetch('/api/agent/upload-profile-picture', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      // Update form data with new profile picture URL
      setFormData(prev => ({
        ...prev,
        profilePicture: result.profilePictureUrl
      }));

      toast({
        title: "Picture Uploaded",
        description: "Profile picture uploaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload profile picture. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPicture(false);
    }
  };

  const handlePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await validateAndUploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await validateAndUploadFile(files[0]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-4">
                <User className="text-white w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Producer Profile Center</h2>
                <p className="text-blue-100 font-medium">Configure your professional Producer Settings</p>
              </div>
            </div>
            <Button variant="ghost" onClick={onClose} className="p-2 text-white hover:bg-white hover:bg-opacity-20">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        <CardContent className="p-6">
          {/* Profile Picture Section - Enhanced */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Camera className="text-purple-600 w-5 h-5 mr-2" />
                <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200">Professional Profile Picture</h3>
              </div>
              
              <div className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-8">
                {/* Profile Picture Preview with Drag & Drop */}
                <div 
                  className={`relative transition-all duration-200 ${isDragOver ? 'scale-105' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className={`w-32 h-32 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-full flex items-center justify-center overflow-hidden border-4 shadow-lg transition-all duration-200 ${
                    isDragOver 
                      ? 'border-purple-400 dark:border-purple-500 shadow-purple-200 dark:shadow-purple-800' 
                      : 'border-white dark:border-gray-600'
                  }`}>
                    {formData.profilePicture ? (
                      <img 
                        src={formData.profilePicture} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="text-gray-400 w-12 h-12" />
                    )}
                    
                    {/* Drag overlay */}
                    {isDragOver && (
                      <div className="absolute inset-0 bg-purple-500 bg-opacity-20 rounded-full flex items-center justify-center">
                        <Upload className="text-purple-600 w-8 h-8" />
                      </div>
                    )}
                  </div>
                  
                  {/* Upload Button Overlay */}
                  <label 
                    htmlFor="profile-picture-upload"
                    className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 group"
                  >
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload className="text-white w-8 h-8" />
                    </div>
                  </label>
                  
                  <input
                    id="profile-picture-upload"
                    type="file"
                    accept="image/*"
                    onChange={handlePictureUpload}
                    className="hidden"
                    disabled={isUploadingPicture}
                  />
                </div>

                {/* Upload Instructions */}
                <div className="flex-1 text-center lg:text-left">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Upload Guidelines</h4>
                    
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded text-center">
                        <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">5MB</div>
                        <div className="text-xs text-purple-600 dark:text-purple-400">Max Size</div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-center">
                        <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">400×400</div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">Recommended</div>
                      </div>
                    </div>
                    
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-4">
                      <li>• Drag & drop or click to upload</li>
                      <li>• Formats: JPG, PNG, GIF</li>
                      <li>• Square aspect ratio preferred</li>
                    </ul>
                    
                    {isUploadingPicture && (
                      <div className="flex items-center justify-center lg:justify-start">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent mr-2"></div>
                        <span className="text-sm text-purple-600 font-medium">Uploading...</span>
                      </div>
                    )}
                    
                    {!isUploadingPicture && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-400 dark:hover:bg-purple-900/20"
                          onClick={() => document.getElementById('profile-picture-upload')?.click()}
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Choose File
                        </Button>
                        {formData.profilePicture && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                            onClick={() => setFormData(prev => ({ ...prev, profilePicture: '' }))}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Remove
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Producer Setup Instructions */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
            <div className="flex items-center mb-2">
              <Phone className="text-blue-600 w-5 h-5 mr-2" />
              <span className="text-blue-800 dark:text-blue-200 font-medium">Producer Setup for Verification Calls</span>
            </div>
            <p className="text-blue-700 dark:text-blue-300 text-sm mb-2">
              Use the individual Save buttons next to each field to store your producer information for verification calls. This data is used when making Taalk verification calls to clients.
            </p>
            <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
              <Save className="w-4 h-4 mr-1" />
              <span>Click Save next to each field to store data for verification sessions</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Information Section */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <User className="text-green-600 w-5 h-5 mr-2" />
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">Personal Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div>
                  <Label htmlFor="firstName" className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className={`mt-1 flex-1 ${errors.firstName ? "border-red-500" : "border-gray-300 dark:border-gray-600"} focus:ring-green-500 focus:border-green-500`}
                      placeholder="producer first name"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={saveFirstNameToStorage}
                      className="mt-1 px-3 border-green-300 text-green-600 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900/20"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                  {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
                </div>

                <div>
                  <Label htmlFor="lastName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className={`mt-1 flex-1 ${errors.lastName ? "border-red-500" : "border-gray-300 dark:border-gray-600"} focus:ring-green-500 focus:border-green-500`}
                      placeholder="producer last name"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={saveLastNameToStorage}
                      className="mt-1 px-3 border-green-300 text-green-600 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900/20"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                  {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className={`mt-1 ${errors.email ? "border-red-500" : "border-gray-300 dark:border-gray-600"} focus:ring-green-500 focus:border-green-500`}
                    placeholder="producer@company.com"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>
              </div>
            </div>

            {/* Communication Settings Section */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Phone className="text-blue-600 w-5 h-5 mr-2" />
                <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">Communication Settings</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="phone"
                      type="tel"
                      value={formatPhone(formData.phone)}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, '');
                        setFormData({...formData, phone: cleaned});
                      }}
                      className={`mt-1 flex-1 ${errors.phone ? "border-red-500" : "border-gray-300 dark:border-gray-600"} focus:ring-blue-500 focus:border-blue-500`}
                      placeholder="(555) 123-4567"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={savePhoneToStorage}
                      className="mt-1 px-3 border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                  {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Used for producer verification calls</p>
                </div>

                <div>
                  <Label htmlFor="zoomId" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                    <Video className="w-4 h-4 mr-1 text-blue-600" />
                    Meeting Room ID
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="zoomId"
                      value={formData.zoomId}
                      onChange={(e) => setFormData({...formData, zoomId: e.target.value})}
                      className="mt-1 flex-1 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="aointel/meet/cnsysop"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={saveZoomIdToStorage}
                      className="mt-1 px-3 border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Your ConnectNow meeting room</p>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="zoomPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">Meeting Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="zoomPassword"
                      value={formData.zoomPassword}
                      onChange={(e) => setFormData({...formData, zoomPassword: e.target.value || "1"})}
                      className="mt-1 flex-1 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Meeting password (default: 1)"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={saveZoomPasswordToStorage}
                      className="mt-1 px-3 border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Leave blank to use default "1"</p>
                </div>
              </div>
            </div>

            {/* Hierarchy Information Section */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <User className="text-purple-600 w-5 h-5 mr-2" />
                <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200">Hierarchy Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="mgaTeam" className="text-sm font-medium text-gray-700 dark:text-gray-300">MGA Team</Label>
                  <Input
                    id="mgaTeam"
                    value={formData.mgaTeam || ""}
                    onChange={(e) => setFormData({...formData, mgaTeam: e.target.value})}
                    className={`mt-1 ${errors.mgaTeam ? "border-red-500" : "border-gray-300 dark:border-gray-600"} focus:ring-purple-500 focus:border-purple-500`}
                    placeholder="Enter your MGA Team name"
                  />
                  {errors.mgaTeam && <p className="text-red-500 text-sm mt-1">{errors.mgaTeam}</p>}
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Your Managing General Agent team</p>
                </div>

                <div>
                  <Label htmlFor="rgaTeam" className="text-sm font-medium text-gray-700 dark:text-gray-300">RGA Team</Label>
                  <Input
                    id="rgaTeam"
                    value={formData.rgaTeam || ""}
                    onChange={(e) => setFormData({...formData, rgaTeam: e.target.value})}
                    className={`mt-1 ${errors.rgaTeam ? "border-red-500" : "border-gray-300 dark:border-gray-600"} focus:ring-purple-500 focus:border-purple-500`}
                    placeholder="Enter your RGA Team name"
                  />
                  {errors.rgaTeam && <p className="text-red-500 text-sm mt-1">{errors.rgaTeam}</p>}
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Your Regional General Agent team</p>
                </div>
              </div>
            </div>

            {/* Meeting Room Information */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Video className="text-blue-600 w-5 h-5 mr-2" />
                <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">Meeting Room Settings</h3>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Meeting Room URL:</span>
                    <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-blue-600 dark:text-blue-400">
                      aointel/meet/cnsysop
                    </code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Default Password:</span>
                    <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-green-600 dark:text-green-400">
                      {formData.zoomPassword || "1"}
                    </code>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Your personal ConnectNow meeting room for client consultations
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 sm:space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full sm:w-auto border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
                
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="px-6 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isUpdating}
                    className="px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0"
                  >
                    {isUpdating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Profile
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}