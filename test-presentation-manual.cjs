const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function testPresentationSession() {
  console.log('🧪 Testing presentation session creation...');
  
  try {
    // Create a test session
    const { data, error } = await supabase
      .from('presentation_sessions')
      .insert({
        agent_email: 'cnsysop@aoglobelife.com',
        agent_name: 'Test User',
        presentation_url: 'https://test-hppro.com',
        presentation_type: 'hppro',
        window_title: 'Test HPPRO Presentation',
        status: 'active'
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating session:', error);
      return;
    }
    
    console.log('✅ Test session created:', data.session_id);
    
    // Test AI analysis with a dummy screenshot
    const testScreenshot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const response = await fetch('http://localhost:5000/api/presentations/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: data.session_id,
        screenshot_data: testScreenshot
      })
    });
    
    if (response.ok) {
      console.log('✅ Screenshot uploaded successfully');
      
      // Check if data was extracted
      const { data: updatedSession } = await supabase
        .from('presentation_sessions')
        .select('*')
        .eq('session_id', data.session_id)
        .single();
      
      console.log('📊 Session data after AI analysis:');
      console.log('  Current phase:', updatedSession.current_phase);
      console.log('  Client name:', updatedSession.client_full_name);
      console.log('  Screenshot count:', updatedSession.screenshot_count);
    } else {
      console.error('❌ Failed to upload screenshot:', response.statusText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPresentationSession();
