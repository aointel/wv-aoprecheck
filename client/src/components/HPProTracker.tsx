import { useEffect, useRef } from 'react';

/**
 * HP Pro Tracker - Inject tracking code into HP Pro popups
 * This component injects JavaScript into HP Pro windows to track page content
 * WITHOUT modifying any Electron code
 */
export function HPProTracker() {
  const sessionIdRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const scannedSrcRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Emergency safety: disable tracker injection globally.
    // The polling/injection loop can destabilize the HPPRO iframe startup.
    const trackerEnabled = false;
    if (!trackerEnabled) {
      console.log('🔍 HP Pro Tracker disabled (startup safety mode)');
      return;
    }

    console.log('🔍 HP Pro Tracker initialized');

    // Listen for HP Pro window opens
    const handleWindowOpen = () => {
      console.log('🪟 Detected window.open - checking if it\'s HP Pro...');
      
      // Small delay to let the window load
      setTimeout(() => {
        checkForHPProWindows();
      }, 1000);
    };

    // Override window.open to detect HP Pro
    const originalOpen = window.open;
    window.open = function(...args) {
      const newWindow = originalOpen.apply(this, args);
      handleWindowOpen();
      return newWindow;
    };

    // Also check periodically for HP Pro iframes
    intervalRef.current = setInterval(() => {
      checkForHPProIframes();
    }, 8000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Restore original window.open
      window.open = originalOpen;
    };
  }, []);

  const checkForHPProWindows = () => {
    // Try to access opened windows (same-origin only)
    try {
      // This only works for same-origin windows
      // For cross-origin HP Pro, we'll need to inject via iframe
      console.log('🔍 Checking for HP Pro windows...');
    } catch (error) {
      console.log('⚠️ Cannot access popup (cross-origin)');
    }
  };

  const checkForHPProIframes = () => {
    // Find HP Pro iframes
    const iframes = document.querySelectorAll('iframe');
    
    iframes.forEach((iframe) => {
      try {
        const src = iframe.src || '';
        
        const isHPPro = src.includes('hppro') || src.includes('hp-pro') || src.includes('/api/hppro/');
        const isLoginSurface = src.includes('/Account/Login') || src.includes('/Account/Logout');
        if (!isHPPro || isLoginSurface) return;

        const scanKey = `${src}|${iframe.id || 'no-id'}`;
        if (scannedSrcRef.current.has(scanKey)) return;
        scannedSrcRef.current.add(scanKey);

        console.log('🎯 Found HP Pro iframe:', src);
        injectTrackingCode(iframe);
        if (scannedSrcRef.current.size > 200) {
          scannedSrcRef.current.clear();
        }
      } catch (error) {
        // Cross-origin iframe - can't access
      }
    });
  };

  const injectTrackingCode = (iframe: HTMLIFrameElement) => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (!iframeDoc) {
        console.log('⚠️ Cannot access iframe document (cross-origin)');
        return;
      }

      // Check if already injected
      if (iframeDoc.getElementById('hppro-tracker')) {
        return;
      }

      console.log('💉 Injecting tracking code into HP Pro iframe...');

      // Create session ID if not exists
      if (!sessionIdRef.current) {
        sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        console.log('📝 Created session ID:', sessionIdRef.current);
        
        // Start presentation session
        startPresentationSession(sessionIdRef.current);
      }

      // Inject tracking script
      const script = iframeDoc.createElement('script');
      script.id = 'hppro-tracker';
      script.textContent = `
        (function() {
          console.log('🎯 HP Pro Tracker active');
          
          const sessionId = '${sessionIdRef.current}';
          const serverUrl = '${window.location.origin}';
          
          function scrapePageData() {
            try {
              // Extract all visible text
              const textContent = document.body.innerText || document.body.textContent || '';
              
              // Extract all visible elements
              const visibleTexts = [];
              const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                  acceptNode: function(node) {
                    const parent = node.parentElement;
                    if (parent && parent.offsetParent !== null) {
                      const style = window.getComputedStyle(parent);
                      if (style.display !== 'none' && style.visibility !== 'hidden') {
                        return NodeFilter.FILTER_ACCEPT;
                      }
                    }
                    return NodeFilter.FILTER_REJECT;
                  }
                }
              );
              
              let node;
              while (node = walker.nextNode()) {
                const text = node.textContent.trim();
                if (text && text.length > 2) {
                  visibleTexts.push(text);
                }
              }
              
              // Extract links
              const links = Array.from(document.querySelectorAll('a')).map(link => ({
                text: link.textContent.trim(),
                href: link.href,
                title: link.title
              })).filter(link => link.text && link.href);
              
              // Extract images
              const images = Array.from(document.querySelectorAll('img')).map(img => ({
                src: img.src,
                alt: img.alt,
                title: img.title
              }));
              
              // Package the data
              const scrapedData = {
                metadata: {
                  title: document.title,
                  url: window.location.href,
                  timestamp: new Date().toISOString()
                },
                textContent: textContent.substring(0, 5000),
                visibleTexts: visibleTexts.slice(0, 100),
                links: links.slice(0, 50),
                images: images.slice(0, 20),
                timestamp: new Date().toISOString()
              };
              
              // Send to server
              sendToServer(scrapedData);
              
            } catch (error) {
              console.error('❌ Scraping error:', error);
            }
          }
          
          function sendToServer(data) {
            fetch(serverUrl + '/api/presentations/scrape-data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                sessionId: sessionId,
                scrapedData: data,
                timestamp: new Date().toISOString()
              })
            })
            .then(response => response.json())
            .then(result => {
              console.log('✅ Data sent to server:', result);
            })
            .catch(error => {
              console.error('❌ Failed to send data:', error);
            });
          }
          
          // Scrape immediately
          scrapePageData();
          
          // Then scrape every 10 seconds
          setInterval(scrapePageData, 10000);
          
          console.log('✅ HP Pro tracking active - scraping every 10 seconds');
        })();
      `;
      
      iframeDoc.head.appendChild(script);
      console.log('✅ Tracking code injected successfully');
      
    } catch (error) {
      console.error('❌ Failed to inject tracking code:', error);
    }
  };

  const startPresentationSession = async (sessionId: string) => {
    try {
      const userEmail = localStorage.getItem('userEmail') || 'unknown@example.com';
      
      const response = await fetch('/api/presentations/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agent_email: userEmail,
          agent_name: userEmail.split('@')[0],
          presentation_url: 'HP Pro',
          presentation_type: 'hppro',
          window_title: 'HP Pro Presentation'
        })
      });
      
      const result = await response.json();
      console.log('✅ Presentation session started:', result);
      
    } catch (error) {
      console.error('❌ Failed to start presentation session:', error);
    }
  };

  return null; // This component doesn't render anything
}

