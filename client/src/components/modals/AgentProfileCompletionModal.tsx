import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Phone, Mail, Users, AlertCircle, CheckCircle2, Sparkles, Camera, Video } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AgentProfileCompletionModalProps {
  isOpen: boolean;
  missingFields: string[];
  currentProfile: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    mgaTeam?: string;
    rgaTeam?: string;
    zoomId?: string;
    profilePicture?: string;
  };
  onComplete: () => void;
}

export function AgentProfileCompletionModal({
  isOpen,
  missingFields,
  currentProfile,
  onComplete,
}: AgentProfileCompletionModalProps) {
  const { authState, updateProfile } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    firstName: currentProfile.firstName || '',
    lastName: currentProfile.lastName || '',
    phone: currentProfile.phone || '',
    email: currentProfile.email || authState.user?.email || '',
    mgaTeam: currentProfile.mgaTeam || '',
    zoomId: currentProfile.zoomId || '',
    profilePicture: currentProfile.profilePicture || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [completedFields, setCompletedFields] = useState<Set<string>>(new Set());
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);

  // Update form data when profile changes
  useEffect(() => {
    if (currentProfile) {
      setFormData({
        firstName: currentProfile.firstName || '',
        lastName: currentProfile.lastName || '',
        phone: currentProfile.phone || '',
        email: currentProfile.email || authState.user?.email || '',
        mgaTeam: currentProfile.mgaTeam || '',
        zoomId: currentProfile.zoomId || '',
        profilePicture: currentProfile.profilePicture || '',
      });
    }
  }, [currentProfile, authState.user?.email]);

  // Check which fields are now complete
  useEffect(() => {
    const newCompleted = new Set<string>();
    if (formData.firstName?.trim()) newCompleted.add('first_name');
    if (formData.lastName?.trim()) newCompleted.add('last_name');
    if (formData.phone?.trim() && formData.phone.replace(/\D/g, '').length >= 10) newCompleted.add('phone');
    if (formData.zoomId?.trim()) newCompleted.add('zoom_id');
    if (formData.mgaTeam?.trim()) newCompleted.add('mga_team');
    if (formData.profilePicture?.trim()) newCompleted.add('profile_picture');
    setCompletedFields(newCompleted);
  }, [formData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else {
      const phoneClean = formData.phone.replace(/\D/g, '');
      if (phoneClean.length < 10) {
        newErrors.phone = 'Please enter a valid 10-digit phone number';
      }
    }
    if (!formData.zoomId.trim()) {
      newErrors.zoomId = 'Zoom ID is required';
    }
    if (!formData.profilePicture.trim()) {
      newErrors.profilePicture = 'Profile picture is required';
    }
    // MGA is required if not already completed (check if it's in missingFields)
    if (!formData.mgaTeam.trim() && missingFields.includes('mga_team')) {
      newErrors.mgaTeam = 'Executive Producer (MGA) is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields correctly',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Update profile with all required fields
      await updateProfile({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        zoomMeetingId: formData.zoomId.trim(),
        zoomPassword: '1', // Default, not required
        profilePicture: formData.profilePicture.trim(),
      });

      // Update MGA team via direct profile endpoint (required if not completed)
      if (formData.mgaTeam) {
        try {
          const response = await fetch('/api/agent/profile-direct', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userEmail: formData.email.trim(),
              mgaTeam: formData.mgaTeam.trim(),
            }),
          });
          if (!response.ok) {
            console.warn('⚠️ Failed to update MGA team (non-critical)');
          } else {
            console.log('✅ MGA team updated successfully');
          }
        } catch (error) {
          console.warn('⚠️ Error updating MGA team (non-critical):', error);
        }
      }

      toast({
        title: 'Profile Complete!',
        description: 'Your agent profile has been saved successfully.',
      });

      onComplete();
    } catch (error) {
      console.error('❌ Error saving profile:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setFormData(prev => ({ ...prev, phone: formatted }));
  };

  const handlePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid File', description: 'Please select an image file.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File Too Large', description: 'Please select an image smaller than 5MB.', variant: 'destructive' });
      return;
    }

    setIsUploadingPicture(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('profilePicture', file);
      uploadFormData.append('userEmail', formData.email.trim() || authState.user?.email || '');
      const response = await fetch('/api/agent/upload-profile-picture', {
        method: 'POST',
        body: uploadFormData,
      });
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      setFormData((prev) => ({ ...prev, profilePicture: result.profilePictureUrl || '' }));
      toast({ title: 'Picture Uploaded', description: 'Profile picture uploaded successfully.' });
    } catch (error) {
      toast({ title: 'Upload Failed', description: 'Failed to upload profile picture. Please try again.', variant: 'destructive' });
    } finally {
      setIsUploadingPicture(false);
    }
  };

  const getFieldStatus = (fieldName: string): 'complete' | 'missing' | 'optional' => {
    if (completedFields.has(fieldName)) return 'complete';
    if (missingFields.includes(fieldName)) return 'missing';
    return 'optional';
  };

  const getFieldIcon = (fieldName: string) => {
    const status = getFieldStatus(fieldName);
    if (status === 'complete') {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
    if (status === 'missing') {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    return null;
  };

  const isFormReady = (): boolean => {
    const phoneClean = formData.phone.replace(/\D/g, '');
    const needsMga = missingFields.includes('mga_team');
    return (
      !!formData.firstName.trim() &&
      !!formData.lastName.trim() &&
      phoneClean.length >= 10 &&
      !!formData.zoomId.trim() &&
      !!formData.profilePicture.trim() &&
      (!needsMga || !!formData.mgaTeam.trim())
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col z-[99999] [&>button]:hidden" modal={true}>
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 relative flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-white">
                Complete Your Agent Profile
              </DialogTitle>
              <DialogDescription className="text-blue-100 mt-1">
                Let's get you set up! Complete your profile to start using AO Intelligence.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-5">
            {/* Profile Picture */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="profilePicture" className="text-sm font-semibold">
                  Profile Picture <span className="text-red-500">*</span>
                </Label>
                {getFieldIcon('profile_picture')}
              </div>
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 overflow-hidden rounded-full border border-gray-300 bg-gray-100">
                  {formData.profilePicture ? (
                    <img src={formData.profilePicture} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-500">
                      <Camera className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <Input id="profilePicture" type="file" accept="image/*" onChange={handlePictureUpload} disabled={isUploadingPicture} />
                  {isUploadingPicture && <p className="mt-1 text-xs text-gray-500">Uploading...</p>}
                </div>
              </div>
              {errors.profilePicture && <p className="text-sm text-red-500">{errors.profilePicture}</p>}
            </div>

            {/* First Name */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="firstName" className="text-sm font-semibold">
                  First Name <span className="text-red-500">*</span>
                </Label>
                {getFieldIcon('first_name')}
              </div>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                placeholder="Enter your first name"
                className={cn(
                  errors.firstName && 'border-red-500',
                  completedFields.has('first_name') && 'border-green-500'
                )}
                required
              />
              {errors.firstName && (
                <p className="text-sm text-red-500">{errors.firstName}</p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="lastName" className="text-sm font-semibold">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                {getFieldIcon('last_name')}
              </div>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Enter your last name"
                className={cn(
                  errors.lastName && 'border-red-500',
                  completedFields.has('last_name') && 'border-green-500'
                )}
                required
              />
              {errors.lastName && (
                <p className="text-sm text-red-500">{errors.lastName}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="phone" className="text-sm font-semibold flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                {getFieldIcon('phone')}
              </div>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="(555) 123-4567"
                className={cn(
                  errors.phone && 'border-red-500',
                  completedFields.has('phone') && 'border-green-500'
                )}
                required
              />
              {errors.phone && (
                <p className="text-sm text-red-500">{errors.phone}</p>
              )}
              <p className="text-xs text-muted-foreground">
                This phone number will be used for password resets and important notifications.
              </p>
            </div>

            {/* Zoom ID */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="zoomId" className="text-sm font-semibold flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Zoom ID <span className="text-red-500">*</span>
                </Label>
                {getFieldIcon('zoom_id')}
              </div>
              <Input
                id="zoomId"
                value={formData.zoomId}
                onChange={(e) => setFormData(prev => ({ ...prev, zoomId: e.target.value }))}
                placeholder="Enter your Zoom Room ID"
                className={cn(
                  errors.zoomId && 'border-red-500',
                  completedFields.has('zoom_id') && 'border-green-500'
                )}
                required
              />
              {errors.zoomId && (
                <p className="text-sm text-red-500">{errors.zoomId}</p>
              )}
            </div>

            {/* MGA Team (Required if not completed) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="mgaTeam" className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Executive Producer (MGA) {missingFields.includes('mga_team') && <span className="text-red-500">*</span>}
                </Label>
                {getFieldIcon('mga_team')}
              </div>
              <Input
                id="mgaTeam"
                value={formData.mgaTeam}
                onChange={(e) => setFormData(prev => ({ ...prev, mgaTeam: e.target.value }))}
                placeholder={missingFields.includes('mga_team') ? "Enter your MGA name (required)" : "Enter your MGA name"}
                className={cn(
                  errors.mgaTeam && 'border-red-500',
                  completedFields.has('mga_team') && 'border-green-500'
                )}
                required={missingFields.includes('mga_team')}
              />
              {errors.mgaTeam && (
                <p className="text-sm text-red-500">{errors.mgaTeam}</p>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Why is this required?
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Your agent profile information is essential for connecting with clients, receiving important notifications, and accessing all AO Intelligence features. This information is kept secure and private.
                </p>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <DialogFooter className="border-t p-6 flex-shrink-0">
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSaving || !isFormReady()}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white flex items-center gap-2 px-8"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Complete Profile & Continue
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
