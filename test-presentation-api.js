// Test if the presentation API endpoint works
fetch('http://localhost:5000/api/presentations/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent_email: 'cnsysop@aoglobelife.com',
    agent_name: 'Test User',
    presentation_url: 'https://hppro.planetaltig.com/#/',
    presentation_type: 'hppro',
    window_title: 'Test'
  })
})
  .then(res => res.json())
  .then(data => console.log('✅ SUCCESS:', data))
  .catch(err => console.error('❌ ERROR:', err));

