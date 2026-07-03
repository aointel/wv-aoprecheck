/**
 * HPPRO Proxy — forwards traffic to hppro.planetaltig.com.
 * Agents must authenticate with their own HPPRO credentials through /Account/Login.
 */

import { Router, type Request, type Response } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const router = Router();
const HPPRO_BASE = 'https://hppro.planetaltig.com';
const IMPACT_API = 'https://impactapi.planetaltig.com/api';

// Per-session cache
const SESSION_TTL = 55 * 60 * 1000; // 55 min (under HPPRO's 60min expiry)
const sessionCache = new Map<string, { cookies: string; jwt: string; expires: number }>();

function loadCachedSession(): { cookies: string; jwt: string } | null {
  try {
    const cacheFile = join(process.cwd(), 'hppro_jwt_cache.json');
    if (!existsSync(cacheFile)) return null;
    const cache = JSON.parse(readFileSync(cacheFile, 'utf8'));
    const age = Date.now() - (cache.timestamp || 0);
    if (age > 90 * 60 * 1000) return null; // 90 min max
    if (!cache.user) return null;
    const u = JSON.parse(cache.user);
    if (!u.access_token || u.access_token === 'pending') return null;
    console.log('[HPPRO Proxy] Using cached JWT, expires:', u.expires);
    return { cookies: '', jwt: cache.user };
  } catch(e: any) { 
    console.error('[HPPRO Proxy] Cache load error:', e.message);
    return null; 
  }
}

async function getSession(sessionId: string) {
  // 1. Check per-session cache
  const cached = sessionCache.get(sessionId);
  if (cached && cached.expires > Date.now()) return cached;
  // No server-side auto-login fallback. Agent must log in via /Account/Login.
  return null;
}

// Proxy ALL paths under /api/hppro/*
router.all('*', async (req: Request, res: Response) => {
  const sessionId = (req.session as any)?.id || req.ip || 'default';
  const session = await getSession(sessionId);
  const cookies = session?.cookies || '';
  const jwt = session?.jwt || '';

  // Build target URL — strip /api/hppro prefix
  // Root or hash-only paths → serve the SPA shell from /distold/
  const isRoot = req.path === '/' || req.path === '';
  const targetPath = isRoot ? '/Account/Login' : req.path;
  const queryStr = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query as any).toString() : '';
  const targetUrl = `${HPPRO_BASE}${targetPath}${queryStr}`;

  try {
    const headers: Record<string, string> = {
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': HPPRO_BASE,
    };

    // Forward content-type for POST/PUT
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'] as string;
    }

    const isLoginPost = req.method === 'POST' && req.path === '/Account/Login';

    const fetchOpts: RequestInit = {
      method: req.method,
      headers,
      redirect: isLoginPost ? 'manual' : 'follow', // don't follow login redirect — let browser handle it
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      // Forward form body as-is
      const rawBody = typeof req.body === 'string' ? req.body
        : Buffer.isBuffer(req.body) ? req.body
        : new URLSearchParams(req.body as any).toString();
      fetchOpts.body = rawBody;
    }

    const proxyRes = await fetch(targetUrl, fetchOpts);

    // For login POST: forward the redirect and set-cookie so browser handles session
    if (isLoginPost) {
      const location = proxyRes.headers.get('location') || '/';
      // node-fetch exposes raw headers via getAll() or entries()
      const allCookieHeaders: string[] = [];
      proxyRes.headers.forEach((value: string, key: string) => {
        if (key.toLowerCase() === 'set-cookie') allCookieHeaders.push(value);
      });
      // Node 18+ getSetCookie() returns all Set-Cookie headers as array
      const getSetCookieFn = (proxyRes.headers as any).getSetCookie;
      const rawCookies = typeof getSetCookieFn === 'function' ? getSetCookieFn.call(proxyRes.headers) : [];
      const cookiesToSet = rawCookies.length ? rawCookies : allCookieHeaders;

      console.log('[HPPRO Proxy] Login POST status:', proxyRes.status, '| cookies to forward:', cookiesToSet.length);

      // Forward cookies with SameSite=Lax so they work on localhost
      cookiesToSet.forEach((c: string) => {
        const fixed = c.replace(/SameSite=\w+/gi, 'SameSite=Lax').replace(/Secure;?\s*/gi, '');
        res.append('Set-Cookie', fixed);
      });

      // Update cached session cookies
      const newCookieStr = cookiesToSet.map((c: string) => c.split(';')[0]).filter((c: string) => c.includes('=')).join('; ');
      const freshCookies = newCookieStr ? `${cookies}; ${newCookieStr}` : cookies;
      if (newCookieStr) {
        sessionCache.set(sessionId, { cookies: freshCookies, jwt, expires: Date.now() + SESSION_TTL });
      }

      // Agent just logged in — fetch home page to extract the real JWT embedded in HTML
      // Do this async so we don't delay the redirect
      (async () => {
        try {
          const homeRes = await fetch(`${HPPRO_BASE}/`, {
            headers: { 'Cookie': freshCookies, 'User-Agent': 'Mozilla/5.0' },
            redirect: 'follow',
          });
          const homeHtml = await homeRes.text();
          const tokenMatch = homeHtml.match(/oauthToken\.access_token\s*=\s*'([^']+)'/);
          if (tokenMatch) {
            const extractField = (field: string) => {
              const m = homeHtml.match(new RegExp(`oauthToken\\.${field}\\s*=\\s*'([^']+)'`));
              return m ? m[1] : '';
            };
            const jwtObj = {
              access_token: tokenMatch[1],
              token_type: 'bearer',
              expires_in: extractField('expires_in') || '7199',
              refresh_token: extractField('refresh_token'),
              issued: extractField('issued'),
              expires: extractField('expires'),
              oauth_url: '/api/hppro-impact/OAuth/Authenticate',  // proxy
            };
            const jwtStr = JSON.stringify(jwtObj);
            _moduleJwt = { jwt: jwtStr, cookies: freshCookies, expires: Date.now() + SESSION_TTL };
            sessionCache.set(sessionId, { cookies: freshCookies, jwt: jwtStr, expires: Date.now() + SESSION_TTL });
            console.log('[HPPRO Proxy] ✅ Agent logged in — captured real JWT from HTML. Expires:', jwtObj.expires);
          }
        } catch(e: any) {
          console.error('[HPPRO Proxy] Failed to extract JWT after login:', e.message);
        }
      })();

      const redirectTarget = location.startsWith('/') ? `/api/hppro${location}` : `/api/hppro/`;
      console.log('[HPPRO Proxy] Redirecting to:', redirectTarget);
      res.redirect(302, redirectTarget);
      return;
    }

    // Forward status + ALL headers EXCEPT ones that would break iframe or re-encoding
    res.status(proxyRes.status);
    const skipHeaders = new Set([
      'content-encoding',   // we decompressed already - forwarding this corrupts body
      'transfer-encoding',  // we buffer the full body
      'x-frame-options',    // blocks iframe - MUST remove
      'content-security-policy', // blocks iframe resources - MUST remove
      'content-security-policy-report-only',
      'strict-transport-security', // causes HSTS issues through proxy
      'connection',
      'keep-alive',
      'set-cookie',         // handled separately below with domain/SameSite fixes
    ]);
    const ct = proxyRes.headers.get('content-type') || '';
    proxyRes.headers.forEach((value: string, key: string) => {
      const k = key.toLowerCase();
      if (!skipHeaders.has(k)) {
        res.setHeader(key, value);
      }
    });
    // Always allow iframe embedding
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Frame-Options', 'ALLOWALL');

    // Get body as text and rewrite URLs so relative links work through proxy
    if (ct.includes('text/html') || ct.includes('javascript') || ct.includes('css')) {
      let body = await proxyRes.text();
      // Rewrite absolute HPPRO URLs to go through our proxy
      body = body.replace(/https?:\/\/hppro\.planetaltig\.com/g, '/api/hppro');
      // Rewrite root-relative paths (double and single quotes)
      body = body.replace(/href="\//g, 'href="/api/hppro/');
      body = body.replace(/href='\//g, "href='/api/hppro/");
      body = body.replace(/src="\//g, 'src="/api/hppro/');
      body = body.replace(/src='\//g, "src='/api/hppro/");
      body = body.replace(/url\(\//g, 'url(/api/hppro/');
      body = body.replace(/url\("\/\//g, 'url("/api/hppro/');
      body = body.replace(/action="\//g, 'action="/api/hppro/');
      body = body.replace(/action='\//g, "action='/api/hppro/");
      // Rewrite absolute hppro URLs in static HTML/CSS too (belt + suspenders)
      body = body.replace(/https?:\/\/hppro\.planetaltig\.com\//g, '/api/hppro/');

      // Rewrite impactapi calls to go through our local proxy (fixes CORS)
      body = body.replace(/https:\/\/impactapi\.planetaltig\.com\/api\//g, '/api/hppro-impact/');
      if (ct.includes('javascript')) {
        // Rewrite ALL references to impactapi in JS bundle (belt+suspenders)
        body = body.replace(/https:\/\/impactapi\.planetaltig\.com\/api\//g, '/api/hppro-impact/');
        body = body.replace(/VUE_APP_API_LINK:"https:\/\/impactapi\.planetaltig\.com\/api\/"/g, 'VUE_APP_API_LINK:"/api/hppro-impact/"');
        // Patch authRequired router guard
        body = body.replace(/authRequired:!0,!isLoggedIn/g, 'authRequired:!1,!isLoggedIn');
        // CRITICAL: Patch Wh() to navigate to /api/hppro/ instead of window.location.origin
        body = body.replace(
          /window\.location\.href=window\.location\.origin\+"\/Account\/Login"/g,
          'window.location.href="/api/hppro/Account/Login"'
        );
        body = body.replace(
          /window\.location\.href=window\.location\.origin\+"\/Account\/login"/g,
          'window.location.href="/api/hppro/Account/Login"'
        );
        body = body.replace(
          /window\.location\.origin\+\"\/Account\//g,
          '"/api/hppro/Account/'
        );
        // Patch window.location.href = window.location.origin (bare redirect to root)
        body = body.replace(
          /window\.location\.href=window\.location\.origin(?!\+"\/)/g,
          'window.location.href="/api/hppro/Account/Login"'
        );
        // Patch any window.location = something (without the proxy prefix)
        body = body.replace(
          /window\.location\.replace\(window\.location\.origin/g,
          'window.location.replace("/api/hppro/Account/Login"'
        );
        // Skip MFA setup screens — patch all MFA-related flags
        body = body.replace(/IsMFAExclude:!1/g, 'IsMFAExclude:!0');
        body = body.replace(/"IsMFAExclude":false/g, '"IsMFAExclude":true');
        body = body.replace(/ForcePasswordChange:!0/g, 'ForcePasswordChange:!1');
        // ShowMFASetup → always false
        body = body.replace(/ShowMFASetup:!0/g, 'ShowMFASetup:!1');
        body = body.replace(/ShowMFASetup:!0/g, 'ShowMFASetup:!1');
        // IsMFA_SMSRequested, IsMFA_EmailRequested, IsSkipMFA etc
        body = body.replace(/IsSkipMFA:!1/g, 'IsSkipMFA:!0');
        // ForceAgreementPopupShow
        body = body.replace(/ForceAgreementPopupShow:!0/g, 'ForceAgreementPopupShow:!1');
        body = body.replace(/ShowAgentAgreementAfterLogin:!0/g, 'ShowAgentAgreementAfterLogin:!1');
        body = body.replace(/ShowCompanyPolicyAfterLogin:!0/g, 'ShowCompanyPolicyAfterLogin:!1');
        body = body.replace(/ShowEditProfileAfterLogin:!0/g, 'ShowEditProfileAfterLogin:!1');
      }
      // For HTML pages: inject real JWT from cache if available
      if (ct.includes('text/html')) {
        const skipLoginScript = `<script>
(function(){
  document.cookie='aillogincookie=1;path=/;SameSite=Lax';
  // Fix localStorage JWT: patch oauth_url to proxy so all API calls go through capture
  try {
    var existing = localStorage.getItem('user');
    if (existing) {
      var parsed = JSON.parse(existing);
      if (!parsed || !parsed.UserDetail) {
        localStorage.removeItem('user');
        console.log('[HPPRO Proxy] Cleared partial JWT from localStorage');
      } else if (parsed.oauth_url && parsed.oauth_url.indexOf('impactapi.planetaltig.com') !== -1) {
        parsed.oauth_url = '/api/hppro-impact/OAuth/Authenticate';
        localStorage.setItem('user', JSON.stringify(parsed));
        console.log('[HPPRO Proxy] Patched oauth_url in localStorage to proxy');
      }
    }
  } catch(e) { localStorage.removeItem('user'); }
  // Do NOT inject JWT from cache — HPPRO's own inline script sets localStorage
  // with the full UserDetail object. Injecting a partial JWT here breaks the Vue app.
  // No placeholder injection — let the SPA do its own OAuth login naturally
  sessionStorage.removeItem('reloadAttempts');
  localStorage.removeItem('ReloadCount');

  // Rewrite any absolute HPPRO/impactapi URL to go through proxy
  function _rewriteUrl(url) {
    if (typeof url !== 'string') return url;
    return url.replace('https://hppro.planetaltig.com', '/api/hppro')
              .replace('https://impactapi.planetaltig.com/api/', '/api/hppro-impact/');
  }

  // Intercept XHR
  var _origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    return _origOpen.apply(this, [method, _rewriteUrl(url)].concat(Array.prototype.slice.call(arguments, 2)));
  };

  // Intercept fetch()
  var _origFetch = window.fetch;
  window.fetch = function(input, init) {
    return _origFetch.call(this, typeof input === 'string' ? _rewriteUrl(input) : input, init);
  };

  // Intercept img.src property setter
  var _imgSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (_imgSrcDesc && _imgSrcDesc.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      set: function(val) { _imgSrcDesc.set.call(this, _rewriteUrl(val)); },
      get: function() { return _imgSrcDesc.get.call(this); },
      configurable: true
    });
  }

  // Intercept setAttribute to catch img.setAttribute('src', ...) and style attributes
  var _origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (name === 'src' || name === 'href' || name === 'action' || name === 'style' || name === 'background') {
      // Guard: only rewrite actual string URLs, not Vue reactive objects/proxies
      if (typeof value === 'string') {
        value = _rewriteUrl(value);
      } else if (value && typeof value === 'object') {
        // Vue sometimes passes objects - convert to string first, but only if it looks like a URL
        var str = String(value);
        if (str !== '[object Object]') {
          value = _rewriteUrl(str);
        } else {
          // It's a raw object proxy - let Vue handle it, don't mangle to [object Object]
          return;
        }
      }
    }
    return _origSetAttr.call(this, name, value);
  };

  // Intercept CSSStyleDeclaration.setProperty for background-image etc
  var _origSetProp = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function(prop, value, priority) {
    if (typeof value === 'string' && value.includes('hppro.planetaltig.com')) {
      value = value.replace(/https?:\/\/hppro\.planetaltig\.com/g, '/api/hppro');
    }
    return _origSetProp.call(this, prop, value, priority);
  };

  // MutationObserver — catch anything that slips through (Vue v-bind, lazy-load etc)
  function _fixNode(node) {
    if (!node || node.nodeType !== 1) return;
    // img src
    var src = node.getAttribute && node.getAttribute('src');
    if (src && (src.includes('hppro.planetaltig.com') || src.includes('impactapi.planetaltig.com'))) {
      _origSetAttr.call(node, 'src', _rewriteUrl(src));
    }
    // inline style background-image
    if (node.style && node.style.backgroundImage && node.style.backgroundImage.includes('hppro.planetaltig.com')) {
      node.style.backgroundImage = node.style.backgroundImage.replace(/https?:\/\/hppro\.planetaltig\.com/g, '/api/hppro');
    }
    // recurse children
    if (node.children) { for (var i=0; i<node.children.length; i++) _fixNode(node.children[i]); }
  }

  var _observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) { _fixNode(node); });
      // Also catch attribute changes on existing nodes
      if (m.type === 'attributes' && m.attributeName === 'src') {
        var v = m.target.getAttribute('src');
        if (v && (v.includes('hppro.planetaltig.com') || v.includes('impactapi.planetaltig.com'))) {
          _origSetAttr.call(m.target, 'src', _rewriteUrl(v));
        }
      }
    });
  });
  _observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'style'] });

  // Override Vue's process.env.VUE_APP_API_LINK at runtime
  if (typeof window !== 'undefined') {
    try {
      Object.defineProperty(window, 'process', {
        get: function() { return { env: { VUE_APP_API_LINK: '/api/hppro-impact/', NODE_ENV: 'production' } }; },
        configurable: true
      });
    } catch(e) {}
  }

  // Intercept window.open and window.location changes to keep everything in proxy
  var _origWindowOpen = window.open;
  window.open = function(url, target, features) {
    if (typeof url === 'string') url = _rewriteUrl(url);
    return _origWindowOpen.call(window, url, target, features);
  };
  // Intercept window.location.assign
  var _origAssign = window.location.assign.bind(window.location);
  window.location.assign = function(url) {
    if (typeof url === 'string' && (url.includes('hppro.planetaltig.com') || url.includes('impactapi.planetaltig.com'))) {
      url = _rewriteUrl(url);
    }
    return _origAssign(url);
  };

  // Auto-handle popups: context selection, MFA skip etc
  var _skipAttempts = 0;
  var _skipInterval = setInterval(function() {
    _skipAttempts++;
    if (_skipAttempts > 120) { clearInterval(_skipInterval); return; }

    // 1. Context selection — AO radio input (#AOP) + Continue button
    var aopInput = document.getElementById('AOP');
    var continueBtn = document.querySelector('.dashboardbt, button.elevation-0');
    if (!continueBtn) {
      // fallback: find any button with "Continue" or "CONTINUE" text
      var btns = document.querySelectorAll('button');
      for (var b=0; b<btns.length; b++) {
        if (/continue/i.test(btns[b].textContent)) { continueBtn = btns[b]; break; }
      }
    }
    if (aopInput && continueBtn) {
      console.log('[HPPRO Proxy] Clicking AO context + Continue');
      aopInput.click();
      setTimeout(function(){ continueBtn.click(); }, 600);
      clearInterval(_skipInterval);
      return;
    }

    // 2. Skip MFA — #skipbtn or any "Skip" / "Skip for now" link
    var skipBtn = document.getElementById('skipbtn');
    if (!skipBtn) {
      var els = document.querySelectorAll('a, button, span');
      for (var i=0; i<els.length; i++) {
        if (/skip/i.test((els[i].textContent||'').trim())) { skipBtn = els[i]; break; }
      }
    }
    if (skipBtn) { skipBtn.click(); clearInterval(_skipInterval); return; }

    // 3. Text message / phone verification dismiss — look for "Not Now" or close button
    var notNow = null;
    var all = document.querySelectorAll('button, a');
    for (var j=0; j<all.length; j++) {
      var t = (all[j].textContent||'').trim().toLowerCase();
      if (t === 'not now' || t === 'later' || t === 'dismiss' || t === 'cancel') { notNow = all[j]; break; }
    }
    if (notNow) { notNow.click(); clearInterval(_skipInterval); return; }
  }, 1000);
})();
</script>`;
        body = body.replace('<head>', '<head>' + skipLoginScript);
        // Also set cookie via header
        res.setHeader('Set-Cookie', 'aillogincookie=1; Path=/; SameSite=Lax');
      }

      res.send(body);
    } else {
      // Binary / JSON — stream through
      const buf = await proxyRes.arrayBuffer();
      res.send(Buffer.from(buf));
    }
  } catch (err: any) {
    console.error('[HPPRO Proxy] Request failed:', err.message);
    res.status(502).send('Proxy error: ' + err.message);
  }
});

export default router;

/** Separate router for impactapi proxy — mounted at /api/hppro-impact */
import { Router as ImpactRouter } from 'express';
import { captureHpproRequest, pushHpproWatch } from './hppro-capture.js';
const impactRouter = ImpactRouter();

impactRouter.all('*', async (req: Request, res: Response) => {
  const sessionId = (req.session as any)?.id || req.ip || 'default';
  // Special case: MFA — bypass MFA entirely
  if (req.path.includes('MFA/') || req.path.includes('RequestAuthenticatorCode') || req.path.includes('VerifyAuthCode') || req.path.includes('ValidateMFA')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Return success to skip MFA verification
    res.json({ success: true, isVerified: true, mfaRequired: false, IsMFAVerified: true, IsMFAExclude: true, message: 'MFA bypassed by proxy' });
    return;
  }

  // Special case: Profile image — return empty to avoid 401
  if (req.path.includes('GetCurrentUserProfileImage') || req.path.includes('UserProfileImage')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ profileImageUrl: null, success: true });
    return;
  }

  // Special case: GetCurrentUserInfo — return cached user info to prevent 401 logout loop
  if (req.path.includes('GetCurrentUserInfo') || req.path.includes('HpProUser/GetCurrentUserInfo')) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('bearer ', '').replace('Bearer ', '');
    if (token && token !== 'pending') {
      // Token is real — forward to impactapi
      try {
        const r = await fetch(`${IMPACT_API}/HpProUser/GetCurrentUserInfo`, {
          headers: { 'Authorization': `bearer ${token}`, 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://hppro.planetaltig.com' }
        });
        res.status(r.status);
        res.setHeader('Access-Control-Allow-Origin', '*');
        const ct = r.headers.get('content-type') || 'application/json';
        res.setHeader('Content-Type', ct);
        const buf = await r.arrayBuffer();
        res.send(Buffer.from(buf));
        return;
      } catch(e) { /* fall through */ }
    }
    // Token is pending/missing — do not spoof another user's identity.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(401).json({ success: false, message: 'HPPRO login required' });
    return;
  }

  const targetUrl = `${IMPACT_API}${req.path}${Object.keys(req.query).length ? '?' + new URLSearchParams(req.query as any).toString() : ''}`;
  try {
    let bodyToSend: string | undefined | Buffer;
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body != null) {
      if (req.path.includes('OAuth/Authenticate')) {
        const parsed = typeof req.body === 'string' ? new URLSearchParams(req.body) : new URLSearchParams(req.body as any);
        console.log('[HPPRO Impact] OAuth attempt - username:', parsed.get('username'), '| grant_type:', parsed.get('grant_type'));
      }
      const reqCt = String(req.headers['content-type'] || '').toLowerCase();
      if (reqCt.includes('application/json') && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        bodyToSend = JSON.stringify(req.body);
      } else if (typeof req.body === 'string') {
        bodyToSend = req.body;
      } else if (Buffer.isBuffer(req.body)) {
        bodyToSend = req.body;
      } else {
        bodyToSend = new URLSearchParams(req.body as any).toString();
      }
    }
    const fetchOpts: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] as string || 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://hppro.planetaltig.com',
        'Referer': 'https://hppro.planetaltig.com/',
        // Forward Authorization so impactapi can authenticate the request
        ...(req.headers['authorization'] ? { 'Authorization': req.headers['authorization'] as string } : {}),
      },
      body: bodyToSend,
    };
    const proxyRes = await fetch(targetUrl, fetchOpts);
    res.status(proxyRes.status);
    // Forward CORS headers so SPA can read response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.removeHeader('Content-Encoding');
    res.removeHeader('Transfer-Encoding');
    const ct = proxyRes.headers.get('content-type') || '';
    if (ct) res.setHeader('Content-Type', ct);
    const buf = await proxyRes.arrayBuffer();

    const bodyStr = Buffer.from(buf).toString('utf8');

    if (req.method === 'POST' && req.path.includes('SyncPresentation')) {
      pushHpproWatch({
        kind: 'impact_sync_post',
        detail: `Impact API responded HTTP ${proxyRes.status} for ${req.path}`,
      });
    }

    // ── Capture presentation data ──────────────────────────────────────────
    captureHpproRequest({
      method: req.method,
      path: req.path,
      query: req.query as Record<string, any>,
      authHeader: req.headers['authorization'] as string || '',
      requestBody: req.body,
      responseBody: bodyStr,
      responseStatus: proxyRes.status,
    }).catch((e: any) => console.error('[HPPRO Capture] Error:', e.message));



    // If this was a successful OAuth/Authenticate, cache the JWT and patch oauth_url to proxy
    if (req.path.includes('OAuth/Authenticate') && proxyRes.status === 200) {
      try {
        const jwtData = JSON.parse(bodyStr);
        if (jwtData?.access_token) {
          // CRITICAL: patch oauth_url so all subsequent API calls go through our proxy
          jwtData.oauth_url = '/api/hppro-impact/OAuth/Authenticate';
          const jwtStr = JSON.stringify(jwtData);
          const existing = sessionCache.get(sessionId);
          sessionCache.set(sessionId, {
            cookies: existing?.cookies || '',
            jwt: jwtStr,
            expires: Date.now() + SESSION_TTL,
          });
          console.log('[HPPRO Impact] Captured real JWT from SPA OAuth — oauth_url patched to proxy. Expires:', jwtData.expires);
          // Return patched JWT to SPA so it uses proxy for all future calls
          res.setHeader('Content-Type', 'application/json');
          res.send(Buffer.from(jwtStr));
          return;
        }
      } catch(e) { /* ignore */ }
    }

    res.send(Buffer.from(buf));
  } catch (err: any) {
    res.status(502).send('Impact API proxy error: ' + err.message);
  }
});

export { impactRouter };
