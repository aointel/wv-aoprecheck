import React from 'react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface Appointment {
  id: string;
  title: string;
  leadName: string;
  leadPhone: string;
  leadEmail?: string;
  startTime: string;
  endTime: string;
  duration: number;
  appointmentType: string;
  status: string;
  meetingPlatform: string;
  notes?: string;
}

export default function EditAppointment() {
  const { id } = useParams();
  const [, navigate] = useLocation();

  const { data: appointment, isLoading, error } = useQuery<Appointment>({
    queryKey: ['/api/appointments', id],
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading appointment...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-red-600 mb-4">Appointment not found</p>
              <Button onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-slate-800">Edit Appointment</h1>
        </div>

        {/* Appointment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Appointment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Client Information</h3>
                <div className="space-y-2">
                  <p><span className="font-medium">Name:</span> {appointment.leadName}</p>
                  <p><span className="font-medium">Phone:</span> {appointment.leadPhone}</p>
                  {appointment.leadEmail && (
                    <p><span className="font-medium">Email:</span> {appointment.leadEmail}</p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Meeting Information</h3>
                <div className="space-y-2">
                  <p><span className="font-medium">Title:</span> {appointment.title}</p>
                  <p><span className="font-medium">Platform:</span> {appointment.meetingPlatform}</p>
                  <p><span className="font-medium">Duration:</span> {appointment.duration} minutes</p>
                  <p><span className="font-medium">Status:</span> {appointment.status}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Schedule
              </h3>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800">
                  <span className="font-medium">Start:</span> {formatDateTime(appointment.startTime)}
                </p>
                <p className="text-blue-800">
                  <span className="font-medium">End:</span> {formatDateTime(appointment.endTime)}
                </p>
              </div>
            </div>

            {appointment.notes && (
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Notes</h3>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-slate-700">{appointment.notes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reschedule Notice */}
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Reschedule Appointment</h3>
            <p className="text-yellow-700 mb-4">
              To reschedule this appointment, please contact the client directly at {appointment.leadPhone} 
              to arrange a new time, then update the appointment details in your calendar system.
            </p>
            <div className="flex gap-2">
              <Button 
                onClick={() => window.open(`tel:${appointment.leadPhone}`, '_self')}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                Call Client
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/dashboard')}
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}