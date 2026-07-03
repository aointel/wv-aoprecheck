import React, { useState } from 'react';
import { Calendar, Clock, Video, User, Phone, MapPin, MessageSquare, Edit2, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { Appointment } from '@shared/schema';

interface AppointmentDetailsProps {
  appointment: Appointment;
  onClose: () => void;
  onUpdate: (updates: Partial<Appointment>) => void;
  onJoinMeeting: () => void;
}

const APPOINTMENT_TYPE_COLORS = {
  'consultation': 'bg-blue-500',
  'follow-up': 'bg-green-500', 
  'presentation': 'bg-purple-500',
  'closing': 'bg-orange-500',
};

const APPOINTMENT_TYPE_LABELS = {
  'consultation': 'Initial Consultation',
  'follow-up': 'Follow-up Call',
  'presentation': 'Product Presentation',
  'closing': 'Closing Meeting',
};

const STATUS_COLORS = {
  'scheduled': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  'confirmed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'rescheduled': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'completed': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'no-show': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function AppointmentDetails({ appointment, onClose, onUpdate, onJoinMeeting }: AppointmentDetailsProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedAppointment, setEditedAppointment] = useState(appointment);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const copyMeetingLink = () => {
    let meetingLink = '';
    
    if (appointment.meetingPlatform === 'zoom' && appointment.zoomJoinUrl) {
      meetingLink = appointment.zoomJoinUrl;
    } else if (appointment.meetingPlatform === 'twilio' && appointment.twilioRoomName) {
      meetingLink = `https://aoirail-production.up.railway.app/twilio-client?room=${appointment.twilioRoomName}&leadName=${encodeURIComponent(appointment.leadName)}`;
    } else if (appointment.meetingPlatform === 'whereby' && appointment.wherebyRoomUrl) {
      meetingLink = appointment.wherebyRoomUrl;
    }

    if (meetingLink) {
      navigator.clipboard.writeText(meetingLink);
      toast({
        title: "Link Copied",
        description: "Meeting link copied to clipboard",
      });
    } else {
      toast({
        title: "No Meeting Link",
        description: "No meeting link available for this appointment",
        variant: "destructive",
      });
    }
  };

  const sendClientInvite = async () => {
    try {
      const phoneNumber = appointment.leadPhone;
      const clientName = appointment.leadName;
      const agentName = appointment.agentName || 'producer';
      
      // Determine the correct meeting link based on platform
      let meetingLink = '';
      if (appointment.meetingPlatform === 'zoom' && appointment.zoomJoinUrl) {
        meetingLink = appointment.zoomJoinUrl;
      } else if (appointment.meetingPlatform === 'whereby' && appointment.wherebyRoomUrl) {
        meetingLink = appointment.wherebyRoomUrl; // Direct client access to AOI Meet room
      } else {
        // Fallback to Twilio video room
        meetingLink = `${window.location.origin}/twilio-video?room=${encodeURIComponent(`lead-${appointment.leadId}`)}&agentName=Client&leadName=${encodeURIComponent(appointment.leadName)}`;
      }

      // Use direct SMS service instead of Zapier webhook
      const response = await fetch('/api/sms/appointment-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneNumber,
          clientName,
          agentName,
          meetingLink,
          appointmentTime: appointment.startTime,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Appointment Invite Sent",
          description: `SMS invite sent to ${appointment.leadName} at ${phoneNumber}`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invite');
      }
    } catch (error) {
      console.error('Send invite error:', error);
      toast({
        title: "Failed to Send Invite",
        description: "Could not send meeting invite. Please try again.",
        variant: "destructive",
      });
    }
  };

  const saveChanges = () => {
    onUpdate(editedAppointment);
    setIsEditing(false);
    toast({
      title: "Appointment Updated",
      description: "Changes have been saved successfully",
    });
  };

  const getTimeUntilMeeting = () => {
    const now = new Date();
    const meetingTime = new Date(appointment.startTime);
    const diffMs = meetingTime.getTime() - now.getTime();
    
    if (diffMs < 0) return "Meeting time has passed";
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `In ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `In ${diffHours}h ${diffMinutes}m`;
    } else {
      return `In ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    }
  };

  if (isEditing) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-purple-500" />
            Edit Appointment
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editedAppointment.title}
                onChange={(e) => setEditedAppointment(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select 
                value={editedAppointment.status} 
                onValueChange={(value) => setEditedAppointment(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="rescheduled">Rescheduled</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="no-show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={editedAppointment.notes || ''}
              onChange={(e) => setEditedAppointment(prev => ({ ...prev, notes: e.target.value }))}
              className="min-h-[100px]"
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={saveChanges} className="flex-1">
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${APPOINTMENT_TYPE_COLORS[appointment.appointmentType as keyof typeof APPOINTMENT_TYPE_COLORS] || 'bg-gray-400'}`} />
              {appointment.title}
            </CardTitle>
            <CardDescription>
              {APPOINTMENT_TYPE_LABELS[appointment.appointmentType as keyof typeof APPOINTMENT_TYPE_LABELS]} • {appointment.duration} minutes
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS[appointment.status as keyof typeof STATUS_COLORS]}>
              {appointment.status}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Time Information */}
        <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Clock className="h-5 w-5 text-blue-600" />
          <div>
            <div className="font-semibold">{formatDateTime(new Date(appointment.startTime).toISOString())}</div>
            <div className="text-sm text-blue-600">{getTimeUntilMeeting()}</div>
          </div>
        </div>

        {/* Client Information */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <User className="h-4 w-4" />
            Client Information
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{appointment.leadName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              {appointment.leadPhone}
            </div>
            {appointment.leadEmail && (
              <div className="flex items-center gap-2">
                <span>@</span>
                {appointment.leadEmail}
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Meeting Information */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Video className="h-4 w-4" />
            Meeting Details
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <div className="font-medium">
                  {appointment.meetingPlatform === 'zoom' ? 'Zoom Meeting' : 
                   appointment.meetingPlatform === 'whereby' ? 'AOI Meet Video Meeting' : 
                   'AO Intelligence Video Room'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {appointment.meetingPlatform === 'zoom' 
                    ? `Room: ${appointment.zoomMeetingId}` 
                    : appointment.meetingPlatform === 'whereby' 
                      ? `Room ID: ${appointment.wherebyMeetingId}`
                      : `Room: ${appointment.twilioRoomName}`
                  }
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyMeetingLink}>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy Link
                </Button>
                <Button size="sm" onClick={onJoinMeeting}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Join
                </Button>
              </div>
            </div>

            {appointment.meetingPlatform === 'zoom' && appointment.zoomPassword && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Meeting Password: <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{appointment.zoomPassword}</span>
              </div>
            )}

            {appointment.meetingPlatform === 'whereby' && appointment.wherebyRoomUrl && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>producer Room (Host Access):</strong> 
                  <a href={appointment.wherebyHostRoomUrl || ''} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline">
                    {appointment.wherebyHostRoomUrl}
                  </a>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Client Room:</strong> 
                  <a href={appointment.wherebyRoomUrl || ''} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline">
                    {appointment.wherebyRoomUrl}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {appointment.notes && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Meeting Notes
              </h3>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                {appointment.notes}
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button onClick={onJoinMeeting} className="flex-1">
            <Video className="h-4 w-4 mr-2" />
            Join Meeting
          </Button>
          
          <Button variant="outline" onClick={sendClientInvite} className="flex-1">
            <Phone className="h-4 w-4 mr-2" />
            Send Invite
          </Button>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => onUpdate({ status: 'confirmed' })}
            disabled={appointment.status === 'confirmed'}
            className="flex-1"
          >
            Confirm
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => onUpdate({ status: 'completed' })}
            disabled={appointment.status === 'completed'}
            className="flex-1"
          >
            Mark Complete
          </Button>
          
          <Button 
            variant="destructive" 
            onClick={() => onUpdate({ status: 'cancelled' })}
            disabled={appointment.status === 'cancelled'}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
