import React, { useState, useEffect } from 'react';

interface MeetingControlsPopupProps {
  currentLead?: any;
  userEmail?: string;
}

export function MeetingControlsPopup({ currentLead, userEmail }: MeetingControlsPopupProps) {
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [wherebyMeeting, setWherebyMeeting] = useState<any>(null);
  const [roomName, setRoomName] = useState('');

  console.log('🎥 MeetingControlsPopup rendering with:', { currentLead, userEmail });

  useEffect(() => {
    console.log('🎥 MeetingControlsPopup useEffect triggered');
    const agentEmail = userEmail;
    const producerRoomName = agentEmail?.split('@')[0] || 'producer';
    setRoomName(producerRoomName);
    
    if (currentLead) {
      setSmsPhone(currentLead.phone || '+1234567890');
      const defaultSmsMessage = `Hi ${currentLead.name}, please join our secure video meeting: https://aoi.whereby.com/${producerRoomName}`;
      setSmsMessage(defaultSmsMessage);
    } else {
      setSmsPhone('+1234567890');
      setSmsMessage(`Hi! Please join our video meeting: https://aoi.whereby.com/${producerRoomName}`);
    }
  }, [currentLead, userEmail]);

  const createMeeting = async () => {
    try {
      // Create actual Whereby meeting using API
      const agentEmail = userEmail;
      const agentName = agentEmail.split('@')[0];
      
      const requestBody = {
        agentEmail: agentEmail,
        leadName: currentLead?.name || 'Lead',
        leadId: currentLead?.id || 'unknown',
        meetingId: `${agentName}-${Date.now()}`
      };

      console.log('🎥 Creating Whereby meeting via API:', requestBody);

      const response = await fetch('/api/whereby/create-meeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const meeting = await response.json();
      
      if (!meeting.success) {
        throw new Error(meeting.error || 'Failed to create meeting');
      }

      console.log('✅ Whereby meeting created:', meeting);
      
      setWherebyMeeting(meeting);

      const updatedSmsMessage = currentLead 
        ? `Hi ${currentLead.name}, please join our video meeting: ${meeting.roomUrl}`
        : `Hi! Please join our video meeting: ${meeting.roomUrl}`;
      
      setSmsMessage(updatedSmsMessage);
      alert("Meeting Room Ready - Real Whereby meeting created with waiting room");
      return meeting;
    } catch (error) {
      console.error('Failed to create meeting:', error);
      alert("Meeting Failed - Could not create meeting room. Please try again.");
      return null;
    }
  };

  const startMeeting = async () => {
    let meeting = wherebyMeeting;
    if (!meeting) {
      meeting = await createMeeting();
      if (!meeting) return;
    }
    // Open meeting in new window/tab instead of redirecting
    const meetingWindow = window.open(meeting.hostRoomUrl, '_blank', 'width=1200,height=800');
    if (meetingWindow) {
      alert("Meeting Started - Video meeting opened in new window");
    } else {
      alert("Popup Blocked - Please allow popups and try again");
    }
  };

  const copyClientLink = () => {
    if (wherebyMeeting?.viewerRoomUrl) {
      navigator.clipboard.writeText(wherebyMeeting.viewerRoomUrl);
      alert("Client Link Copied - Meeting link copied to clipboard");
    } else {
      alert("No Meeting Active - Create a meeting first");
    }
  };

  const sendSMS = async () => {
    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: smsPhone,
          message: smsMessage
        })
      });

      if (response.ok) {
        alert(`SMS Sent Successfully - Message sent to ${smsPhone}`);
      } else {
        throw new Error('Failed to send SMS');
      }
    } catch (error) {
      alert("SMS Failed - Could not send SMS. Please try again.");
    }
  };

  const openHPPro = () => {
    window.open('https://hp.aoglobelife.com/', '_blank');
  };

  const createEAppSale = async () => {
    if (!currentLead) { alert('No lead selected'); return; }
    try {
      const nameParts = (currentLead.name || '').trim().split(' ');
      const payload: any = {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        state: currentLead.state || '',
        training: 'false',
        agentNumber: '',
        contractType: 'SGA',
        situationCode: 'AO',
      };
      if ((currentLead as any).dateOfBirth) {
        const dob = new Date((currentLead as any).dateOfBirth);
        payload.dobMonth = String(dob.getMonth() + 1).padStart(2, '0');
        payload.dobDay   = String(dob.getDate()).padStart(2, '0');
        payload.dobYear  = String(dob.getFullYear());
      }
      if ((currentLead as any).gender) payload.gender = (currentLead as any).gender;
      if ((currentLead as any).maritalStatus) payload.familyStatus = (currentLead as any).maritalStatus;

      const resp = await fetch('http://localhost:7432/create-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        const r = await resp.json();
        alert(`✅ EApp created for ${currentLead.name}!\nID: ${r.saleId?.slice(0,8)}...`);
      } else {
        throw new Error('injector error');
      }
    } catch (e) {
      alert('❌ EApp failed. Is injector running on localhost:7432?');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 50%, #4338ca 100%)',
      padding: '24px',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>Meeting Controls</h1>
          <button 
            onClick={() => window.close()} 
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ✕ Close
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {/* Lead Info */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '24px'
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Current Lead</h2>
            {currentLead ? (
              <div>
                <p style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>{currentLead.name}</p>
                <p style={{ margin: '0 0 4px 0', opacity: 0.8 }}>{currentLead.phone}</p>
                <p style={{ margin: '0 0 8px 0', opacity: 0.8 }}>{currentLead.email}</p>
                <span style={{
                  background: '#2563eb',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}>
                  {currentLead.market || 'Lead'}
                </span>
              </div>
            ) : (
              <p style={{ opacity: 0.6 }}>No lead selected</p>
            )}
          </div>

          {/* Meeting Room */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '24px'
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Meeting Room</h2>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', opacity: 0.8 }}>Room ID</label>
              <input 
                value={roomName} 
                onChange={(e) => setRoomName(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={startMeeting}
                style={{
                  width: '100%',
                  background: '#16a34a',
                  border: 'none',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                🎥 AOI Meet
              </button>
              
              <button 
                onClick={copyClientLink}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                📋 Copy Client Link
              </button>
            </div>
            
            {wherebyMeeting && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '6px'
              }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#86efac' }}>Room Active</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#bbf7d0' }}>Clients will join waiting room and await admission</p>
              </div>
            )}
          </div>

          {/* SMS Invitation */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '24px'
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>SMS Invitation</h2>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', opacity: 0.8 }}>Phone Number</label>
              <input 
                value={smsPhone} 
                onChange={(e) => setSmsPhone(e.target.value)}
                placeholder="+1234567890"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.6 }}>Default: {currentLead?.phone || 'No phone'}</p>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', opacity: 0.8 }}>Message</label>
              <textarea 
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>
            
            <button 
              onClick={sendSMS}
              style={{
                width: '100%',
                background: '#2563eb',
                border: 'none',
                color: 'white',
                padding: '12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              📱 Send SMS Invite
            </button>
          </div>

          {/* HP Pro */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '24px'
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>HP Pro</h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', opacity: 0.8 }}>
              Open HP Pro to access lead management and quoting tools.
            </p>
            
            <button 
              onClick={openHPPro}
              style={{
                width: '100%',
                background: '#ea580c',
                border: 'none',
                color: 'white',
                padding: '12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500',
                marginBottom: '8px'
              }}
            >
              🔗 Open HP Pro
            </button>
            <button
              onClick={createEAppSale}
              style={{
                width: '100%',
                background: '#1d4ed8',
                border: 'none',
                color: 'white',
                padding: '12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              📋 EApp
            </button>
            
            {currentLead && (
              <div style={{ marginTop: '16px', fontSize: '12px', opacity: 0.6 }}>
                <p style={{ margin: '0 0 2px 0' }}>Lead: {currentLead.name}</p>
                <p style={{ margin: '0 0 2px 0' }}>Phone: {currentLead.phone}</p>
                <p style={{ margin: 0 }}>Market: {currentLead.market}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}