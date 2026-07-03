async function checkServerVersion() {
  const response = await fetch('https://aoirail-production.up.railway.app/api/presentations/screenshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: 'test123',
      screenshot_data: 'data:image/png;base64,iVBORw0KGgo='
    })
  });
  
  console.log('Server status:', response.status);
  const text = await response.text();
  console.log('Response:', text.substring(0, 200));
}

checkServerVersion().catch(console.error);

