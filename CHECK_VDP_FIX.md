# Check VDP Fix in Dev Console

## 1. Check if data attribute is set:
```javascript
document.querySelector('#mount-vdp-selector').getAttribute('data-taalk-vdp')
// Should return: "mount"
```

## 2. Check if TaalkVDPSettings is configured:
```javascript
window.TaalkVDPSettings
// Should show: { APIKey: "...", container: "#mount-vdp-selector", onLoad: function, onStatusChange: function }
```

## 3. Check if onStatusChange is set:
```javascript
typeof window.TaalkVDPSettings.onStatusChange
// Should return: "function"
```

## 4. Check if the iframe exists and has the right parent:
```javascript
const container = document.querySelector('[data-taalk-vdp="mount"]');
const iframe = container?.querySelector('iframe');
console.log('Container:', container);
console.log('Iframe:', iframe);
console.log('Iframe src:', iframe?.src);
```

## 5. Test connect() manually:
```javascript
window.TaalkVDP.connect()
// Should not throw "Cannot read properties of null" error
```

## 6. Test disconnect() manually:
```javascript
window.TaalkVDP.disconnect()
// Should not throw error
```

## 7. Check if SDK can find the iframe (what connect() does internally):
```javascript
const iframe = document.querySelector('[data-taalk-vdp="mount"] > iframe');
console.log('SDK can find iframe:', !!iframe);
```

## 8. Monitor onStatusChange calls:
```javascript
// Override to see when it's called
const original = window.TaalkVDPSettings.onStatusChange;
window.TaalkVDPSettings.onStatusChange = function(online) {
  console.log('🔔 onStatusChange called with:', online);
  original(online);
};
```

## 9. Check current VDP state:
```javascript
console.log('TaalkVDP exists:', !!window.TaalkVDP);
console.log('connect exists:', typeof window.TaalkVDP?.connect);
console.log('disconnect exists:', typeof window.TaalkVDP?.disconnect);
```

## 10. Full diagnostic:
```javascript
const check = {
  dataAttribute: document.querySelector('#mount-vdp-selector')?.getAttribute('data-taalk-vdp'),
  settingsExist: !!window.TaalkVDPSettings,
  onStatusChangeSet: typeof window.TaalkVDPSettings?.onStatusChange === 'function',
  containerSet: window.TaalkVDPSettings?.container,
  iframeExists: !!document.querySelector('[data-taalk-vdp="mount"] > iframe'),
  taalkVDPExists: !!window.TaalkVDP,
  connectExists: typeof window.TaalkVDP?.connect === 'function',
  disconnectExists: typeof window.TaalkVDP?.disconnect === 'function'
};
console.table(check);
```
