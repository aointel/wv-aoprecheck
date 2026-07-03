import WebSocket from 'ws';

console.log('🧪 Testing WebSocket connection...');

const ws = new WebSocket('ws://localhost:5000/ws');

ws.on('open', function open() {
  console.log('✅ WebSocket connection opened successfully');
  
  // Test sending a message
  const testMessage = {
    type: 'join-room',
    roomId: 'test-room',
    participantName: 'Test User',
    participantType: 'test'
  };
  
  console.log('📤 Sending test message:', testMessage);
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', function message(data) {
  console.log('📡 Received message:', JSON.parse(data.toString()));
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close(code, reason) {
  console.log('🔌 WebSocket closed:', code, reason.toString());
  process.exit(0);
});

// Auto-close after 5 seconds
setTimeout(() => {
  console.log('⏰ Test timeout, closing connection');
  ws.close();
}, 5000);