/**
 * Browser Console Test Script for VDP Status
 * Copy and paste this into browser console on /connect page
 */

(function() {
  console.log('🧪 VDP Status Browser Console Test');
  console.log('===================================');
  
  // 1. Check initial state
  console.log('\n📊 Initial State Check:');
  console.log('   window.TaalkVDP:', typeof window.TaalkVDP);
  console.log('   window.TaalkVDPSettings:', typeof window.TaalkVDPSettings);
  
  const container = document.getElementById('mount-vdp-selector');
  console.log('   VDP Container:', container ? 'Found' : 'NOT FOUND');
  if (container) {
    const iframe = container.querySelector('iframe');
    console.log('   VDP Iframe:', iframe ? 'Found' : 'NOT FOUND');
    if (iframe) {
      console.log('   Iframe src:', iframe.src);
      console.log('   Iframe visible:', iframe.offsetWidth > 0 && iframe.offsetHeight > 0);
    }
  }
  
  // 2. Monitor all VDP-related events
  console.log('\n📡 Setting up event monitoring...');
  
  let eventCount = 0;
  const eventLog = [];
  
  window.addEventListener('taalk-vdp-status', (event) => {
    eventCount++;
    const logEntry = {
      time: new Date().toISOString(),
      type: 'taalk-vdp-status',
      detail: event.detail,
      stack: new Error().stack
    };
    eventLog.push(logEntry);
    console.log(`   [Event ${eventCount}] taalk-vdp-status:`, event.detail);
  });
  
  // 3. Wrap TaalkVDP methods
  if (window.TaalkVDP) {
    console.log('\n🔧 Wrapping TaalkVDP methods...');
    
    const originalOpen = window.TaalkVDP.open;
    const originalClose = window.TaalkVDP.close;
    const originalDisconnect = window.TaalkVDP.disconnect;
    
    let openCount = 0;
    let closeCount = 0;
    
    window.TaalkVDP.open = function(...args) {
      openCount++;
      console.log(`\n🚀 [OPEN #${openCount}] TaalkVDP.open() called:`, {
        agentId: args[0],
        params: args[1],
        timestamp: new Date().toISOString(),
        stack: new Error().stack.split('\n').slice(0, 5).join('\n')
      });
      
      const result = originalOpen.apply(this, args);
      
      // Check state after open
      setTimeout(() => {
        console.log(`   ✅ [OPEN #${openCount}] Completed - checking state...`);
        const container = document.getElementById('mount-vdp-selector');
        const iframe = container?.querySelector('iframe');
        console.log('      Container exists:', !!container);
        console.log('      Iframe exists:', !!iframe);
        console.log('      Iframe visible:', iframe ? (iframe.offsetWidth > 0 && iframe.offsetHeight > 0) : false);
        
        // Check if event was dispatched
        const lastEvent = eventLog[eventLog.length - 1];
        if (lastEvent && lastEvent.detail?.online === true) {
          console.log('      ✅ Status event dispatched: ONLINE');
        } else {
          console.log('      ⚠️ NO status event dispatched or event says offline!');
        }
      }, 1000);
      
      return result;
    };
    
    window.TaalkVDP.close = function(...args) {
      closeCount++;
      console.log(`\n🔌 [CLOSE #${closeCount}] TaalkVDP.close() called:`, {
        timestamp: new Date().toISOString(),
        stack: new Error().stack.split('\n').slice(0, 5).join('\n')
      });
      
      const result = originalClose.apply(this, args);
      
      setTimeout(() => {
        console.log(`   ✅ [CLOSE #${closeCount}] Completed`);
      }, 100);
      
      return result;
    };
    
    if (originalDisconnect) {
      window.TaalkVDP.disconnect = function(...args) {
        console.log(`\n🔌 [DISCONNECT] TaalkVDP.disconnect() called:`, {
          timestamp: new Date().toISOString(),
          stack: new Error().stack.split('\n').slice(0, 5).join('\n')
        });
        return originalDisconnect.apply(this, args);
      };
    }
    
    console.log('   ✅ Methods wrapped');
  } else {
    console.log('   ⚠️ window.TaalkVDP not available yet');
  }
  
  // 4. Monitor dispatchEvent calls
  const originalDispatchEvent = window.dispatchEvent;
  window.dispatchEvent = function(event) {
    if (event.type === 'taalk-vdp-status') {
      console.log(`\n📤 [DISPATCH] taalk-vdp-status event:`, {
        detail: event.detail,
        timestamp: new Date().toISOString(),
        stack: new Error().stack.split('\n').slice(0, 5).join('\n')
      });
    }
    return originalDispatchEvent.call(this, event);
  };
  
  // 5. Periodic state checker
  console.log('\n⏱️ Starting periodic state checks (every 1 second)...');
  let checkCount = 0;
  const stateHistory = [];
  
  const checkInterval = setInterval(() => {
    checkCount++;
    const state = {
      time: new Date().toISOString(),
      taalkVDPExists: !!window.TaalkVDP,
      container: !!document.getElementById('mount-vdp-selector'),
      iframe: !!document.getElementById('mount-vdp-selector')?.querySelector('iframe'),
      iframeVisible: (() => {
        const iframe = document.getElementById('mount-vdp-selector')?.querySelector('iframe');
        return iframe ? (iframe.offsetWidth > 0 && iframe.offsetHeight > 0) : false;
      })(),
      lastEvent: eventLog[eventLog.length - 1]?.detail
    };
    
    stateHistory.push(state);
    
    if (checkCount % 5 === 0) {
      console.log(`\n📊 [State Check #${checkCount}]:`, state);
    }
    
    // Stop after 30 seconds
    if (checkCount >= 30) {
      clearInterval(checkInterval);
      console.log('\n📋 Final Report:');
      console.log('   Total events:', eventLog.length);
      console.log('   Event log:', eventLog);
      console.log('   State history:', stateHistory);
      console.log('\n💡 To see full logs, check: window.__vdpTestLog');
    }
  }, 1000);
  
  // Store in window for access
  window.__vdpTestLog = {
    events: eventLog,
    stateHistory: stateHistory,
    getReport: () => {
      console.log('\n📋 VDP Test Report:');
      console.log('   Events:', eventLog);
      console.log('   State History:', stateHistory);
      return { events: eventLog, stateHistory: stateHistory };
    }
  };
  
  console.log('\n✅ Test monitoring active!');
  console.log('💡 Now power on Call Connector Pro and watch the console');
  console.log('💡 Access full report with: window.__vdpTestLog.getReport()');
  console.log('===================================');
})();
