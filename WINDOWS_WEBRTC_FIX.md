# Windows WebRTC Issues - Why Mac Works But Windows Doesn't

## The Problem

**Mac works fine, Windows doesn't** = This is NOT CSP (CSP would affect both)

## Windows-Specific Issues

### 1. **Windows Firewall** 🔥
Windows Firewall can block WebSocket connections
- **Fix:** Add browser to Windows Firewall exceptions
- Or temporarily disable firewall to test

### 2. **Windows Defender / Antivirus** 🛡️
Windows Defender or other antivirus can block WebRTC
- **Fix:** Add browser to antivirus exceptions
- Or temporarily disable to test

### 3. **Windows Privacy Settings** 🔒
Windows 10/11 has privacy settings that block microphone/audio
- **Fix:** Settings → Privacy → Microphone → Allow apps to access microphone

### 4. **Different Browser on Windows** 🌐
If Mac uses Safari/Chrome but Windows uses Edge/Firefox
- **Fix:** Try same browser on both (Chrome recommended)

### 5. **Windows Network Settings** 📡
Windows might have different network proxy/VPN settings
- **Fix:** Check network settings, disable VPN if active

### 6. **Browser Extensions on Windows** 🚫
Windows browser might have different extensions (ad blockers, VPN extensions)
- **Fix:** Try Incognito mode or disable extensions

## Quick Test

On Windows, open browser console and run:
```javascript
// Test WebSocket connectivity
const ws = new WebSocket('wss://voice-js.us1.twilio.com/signal');
ws.onopen = () => console.log('✅ WebSocket works');
ws.onerror = (e) => console.error('❌ WebSocket blocked:', e);

// Test microphone
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(() => console.log('✅ Microphone works'))
  .catch(e => console.error('❌ Microphone blocked:', e));
```

## Most Likely Cause

**Windows Firewall or Antivirus blocking WebSocket connections to Twilio**
