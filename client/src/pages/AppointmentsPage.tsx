import React from 'react';
import { AppointmentManager } from '../components/appointments/AppointmentManager';

export default function AppointmentsPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          📅 Appointments & Callbacks
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">
          Manage your scheduled appointments, follow-up calls, and Google Calendar sync status
        </p>
      </div>
      
      <AppointmentManager />
    </div>
  );
}