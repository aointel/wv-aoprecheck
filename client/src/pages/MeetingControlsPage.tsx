import React from 'react';
import { MeetingControlsPopup } from '@/components/outbound-dialer/MeetingControlsPopup';

export default function MeetingControlsPage() {
  // Get lead data from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const leadData = urlParams.get('leadData');
  const userEmail = urlParams.get('userEmail');
  
  let currentLead = null;
  if (leadData) {
    try {
      currentLead = JSON.parse(decodeURIComponent(leadData));
      console.log('🎥 Popup: Lead data parsed:', currentLead);
    } catch (error) {
      console.error('Failed to parse lead data:', error);
    }
  }

  console.log('🎥 Popup: Rendering with data:', { currentLead, userEmail });

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 50%, #4338ca 100%)' }}>
      <MeetingControlsPopup currentLead={currentLead} userEmail={userEmail} />
    </div>
  );
}