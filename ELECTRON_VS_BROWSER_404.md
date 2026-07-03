# 404 in Electron but not browser – causes

## 1. **Electron loads a different URL than Railway** (most likely)

- **Electron (production)** loads: `https://aointelligence.replit.app`  
  (`electron-main.js` line 81)
- **Browser** when you use Railway: `https://aoirail-production.up.railway.app`

So Electron hits **Replit**; the browser often hits **Railway**. If Replit 404s or is broken and Railway works, you get “404 in app, fine in browser.”

**Fix:** Point Electron at the same app URL as the browser. If Railway is production, load that in Electron (see below).

---

## 2. **Navigation / “allow same host”**

`will-navigate` only allows `aointelligence.replit.app` (or `localhost:5000` in dev).  
Links to `aoirail-production.up.railway.app` are blocked in-app and opened in the system browser. So the app never actually navigates to Railway; it stays on Replit (or previous page). That can look like “app 404 / broken” vs “browser works” when you’re really comparing Replit in-app vs Railway in browser.

---

## 3. **User-Agent / version enforcement**

- Electron sends `User-Agent: AOI-Desktop/1.0`.  
  There is **no** server logic that returns 404 for the initial document based on User-Agent.
- `enforceAppVersion` (426 for old app) is **imported** but the middleware that returns 426 is **commented out** in `routes.ts`. So no 426 (or 404) from version checks for the HTML document.

---

## 4. **Client-side “404”**

The React app can render a “Page not found” **view** for unknown routes. That’s **not** an HTTP 404; it’s the SPA router. Easy to confuse with a real 404. Check DevTools → Network: is the **document** request (first HTML) 200 or 404?

---

## 5. **What to change**

**Use one production URL everywhere (e.g. Railway):**

1. **Electron load URL**  
   In `electron-main.js`, change the production `serverUrl` from  
   `https://aointelligence.replit.app`  
   to  
   `https://aoirail-production.up.railway.app`  
   (and use that same base for `serverDomain` in `will-navigate`).

2. **Auto-updater / downloads**  
   Update `autoUpdater.setFeedURL` and any download/update URLs to use the Railway domain if that’s where you serve installers/updates.

3. **Rebuild Electron**  
   Rebuild the desktop app and retest. App and browser will hit the same backend, so “404 in app but not browser” from different hosts goes away.

---

## Summary

| Cause | App (Electron) | Browser | Fix |
|-------|----------------|---------|-----|
| Different URLs | Replit (404) | Railway (200) | Point Electron at Railway |
| Navigation block | Stays on Replit | Opens Railway externally | Same as above + same `serverDomain` |
| User-Agent / version | No 404 from these | Same | Nothing to change |
| Client-side “404” | SPA 404 page | Same if same route | Check Network for real HTTP 404 |

The practical fix: **use `https://aoirail-production.up.railway.app` as the Electron app URL** (and navigation domain) so app and browser hit the same backend.
