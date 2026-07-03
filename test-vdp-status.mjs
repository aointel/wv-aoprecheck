/**
 * Test script to debug VDP status synchronization
 * Run this in browser console or as a Node script
 */

// Test VDP status synchronization
console.log('🧪 VDP Status Test Script');
console.log('==========================');

// Check if TaalkVDP is loaded
console.log('\n1. Checking TaalkVDP availability:');
console.log('   window.TaalkVDP exists:', typeof window !== 'undefined' ? !!window.TaalkVDP : 'N/A (Node.js)');
console.log('   window.TaalkVDPSettings exists:', typeof window !== 'undefined' ? !!window.TaalkVDPSettings : 'N/A (Node.js)');

// Monitor VDP status events
if (typeof window !== 'undefined') {
  console.log('\n2. Setting up event listeners:');
  
  // Listen to taalk-vdp-status events
  window.addEventListener('taalk-vdp-status', (event) => {
    console.log('   📡 taalk-vdp-status event received:', event.detail);
  });
  
  // Monitor TaalkVDP calls
  if (window.TaalkVDP) {
    const originalOpen = window.TaalkVDP.open;
    const originalClose = window.TaalkVDP.close;
    
    window.TaalkVDP.open = function(...args) {
      console.log('   🚀 TaalkVDP.open() called with:', args);
      const result = originalOpen.apply(this, args);
      console.log('   ✅ TaalkVDP.open() completed');
      
      // Check status after a delay
      setTimeout(() => {
        console.log('   🔍 Checking VDP status 500ms after open...');
        // Try to get current status if available
        if (window.TaalkVDP && window.TaalkVDP.getStatus) {
          console.log('   📊 Current VDP status:', window.TaalkVDP.getStatus());
        }
      }, 500);
      
      return result;
    };
    
    window.TaalkVDP.close = function(...args) {
      console.log('   🔌 TaalkVDP.close() called');
      const result = originalClose.apply(this, args);
      console.log('   ✅ TaalkVDP.close() completed');
      return result;
    };
    
    console.log('   ✅ Wrapped TaalkVDP.open() and .close() methods');
  }
  
  // Monitor custom events being dispatched
  const originalDispatchEvent = window.dispatchEvent;
  window.dispatchEvent = function(event) {
    if (event.type === 'taalk-vdp-status') {
      console.log('   📤 Custom event dispatched: taalk-vdp-status', event.detail);
    }
    return originalDispatchEvent.call(this, event);
  };
  
  console.log('   ✅ Wrapped window.dispatchEvent()');
}

// Test function to check VDP state
function checkVDPState() {
  console.log('\n3. Current VDP State:');
  if (typeof window === 'undefined') {
    console.log('   ⚠️ Running in Node.js - cannot check browser state');
    return;
  }
  
  console.log('   window.TaalkVDP exists:', !!window.TaalkVDP);
  console.log('   window.TaalkVDPSettings exists:', !!window.TaalkVDPSettings);
  
  // Check if VDP container exists
  const container = document.getElementById('mount-vdp-selector');
  console.log('   VDP container exists:', !!container);
  if (container) {
    console.log('   VDP container has children:', container.children.length);
    console.log('   VDP container innerHTML length:', container.innerHTML.length);
  }
  
  // Check for VDP iframe
  const iframe = container?.querySelector('iframe');
  console.log('   VDP iframe exists:', !!iframe);
  if (iframe) {
    console.log('   VDP iframe src:', iframe.src);
    console.log('   VDP iframe visible:', iframe.offsetWidth > 0 && iframe.offsetHeight > 0);
  }
}

// Run check immediately
checkVDPState();

// Set up periodic checks
if (typeof window !== 'undefined') {
  console.log('\n4. Setting up periodic status checks (every 2 seconds):');
  let checkCount = 0;
  const intervalId = setInterval(() => {
    checkCount++;
    console.log(`\n   [Check ${checkCount}]`);
    checkVDPState();
    
    // Stop after 10 checks (20 seconds)
    if (checkCount >= 10) {
      clearInterval(intervalId);
      console.log('\n   ✅ Monitoring complete');
    }
  }, 2000);
  
  console.log('   ✅ Monitoring started - will check every 2 seconds for 20 seconds');
  console.log('   💡 Power on Call Connector Pro now to see what happens!');
}

console.log('\n==========================');
console.log('✅ Test script loaded');
console.log('💡 Instructions:');
console.log('   1. Power on Call Connector Pro');
console.log('   2. Watch the console for VDP.open() calls and status events');
console.log('   3. Check if VDPStatus component updates correctly');
