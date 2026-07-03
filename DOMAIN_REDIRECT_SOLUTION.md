# Redirect Replit Domain to New Domain

## The Goal
When users visit `aointelligence.replit.app`, automatically redirect them to your new Railway domain.

## Solution 1: Keep Replit Running with Redirect (EASIEST)

Add this to the **TOP** of `server/index.ts` (before any routes):

```typescript
// DOMAIN REDIRECT: Forward all traffic to new domain
const NEW_DOMAIN = process.env.NEW_DOMAIN || 'https://your-app.up.railway.app';

app.use((req, res, next) => {
  const host = req.get('host');
  
  // If this is the old Replit domain, redirect to new domain
  if (host && host.includes('replit.app')) {
    const newUrl = `${NEW_DOMAIN}${req.originalUrl}`;
    console.log(`🔄 Redirecting from Replit to: ${newUrl}`);
    return res.redirect(301, newUrl); // 301 = permanent redirect
  }
  
  // Otherwise, continue to normal app
  next();
});
```

### How to implement:

1. Deploy your app to Railway (get the new URL)
2. Update the code above with your Railway URL
3. Deploy this change to Replit
4. Now Replit automatically redirects to Railway

## Solution 2: Custom Domain (PROFESSIONAL)

Instead of `*.up.railway.app`, use your own domain:

### Step 1: Buy a domain
- Go to Namecheap, GoDaddy, or Cloudflare
- Buy something like `aointelligence.com`

### Step 2: Configure Railway
1. Go to Railway dashboard
2. Settings → Domains
3. Click "Custom Domain"
4. Enter your domain: `aointelligence.com`
5. Railway gives you DNS records

### Step 3: Update DNS
1. Go to your domain registrar
2. Add the CNAME/A records Railway provided
3. Wait 5-10 minutes

### Step 4: Done!
- Users visit `aointelligence.com`
- Replit redirects old users automatically

## Solution 3: Simple Replit App.yaml Redirect

If you want to keep Replit ONLY as a redirect (not running full app):

Create a simple redirect server in Replit:

```javascript
// redirect-server.js
const express = require('express');
const app = express();

const NEW_URL = 'https://your-railway-app.up.railway.app';

// Redirect ALL requests
app.use('*', (req, res) => {
  const newUrl = `${NEW_URL}${req.originalUrl}`;
  res.redirect(301, newUrl);
});

app.listen(5000, () => {
  console.log('Redirect server running on port 5000');
});
```

Then in Replit's `.replit`:
```toml
run = "node redirect-server.js"
```

## Solution 4: Nginx Redirect (Advanced)

If you have control over server config:

```nginx
server {
    listen 80;
    server_name aointelligence.replit.app;
    return 301 https://your-new-domain.com$request_uri;
}
```

## Recommended Approach

### For Now (Quick Fix):
Use **Solution 1** - Add redirect middleware to your Replit deployment

### For Production (Best):
Use **Solution 2** - Get a custom domain

## Implementation Steps (Solution 1)

I'll add the redirect code for you:

1. Add redirect middleware to `server/index.ts`
2. Set `NEW_DOMAIN` environment variable on Replit
3. Deploy to both Replit and Railway
4. Replit auto-redirects to Railway

Want me to implement this now?

## Environment Variables Needed

### On Replit:
```
NEW_DOMAIN=https://your-railway-app.up.railway.app
```

### On Railway:
```
APP_URL=https://your-railway-app.up.railway.app
```

## Testing the Redirect

After implementing:

```bash
curl -I https://aointelligence.replit.app
```

Should return:
```
HTTP/1.1 301 Moved Permanently
Location: https://your-new-domain.com/
```

## SEO Considerations

- Use **301 redirect** (permanent) not 302 (temporary)
- Update all external links to new domain
- Update Twilio webhooks to new domain
- Update Google OAuth redirect URLs to new domain

## What Happens to Old Links?

With 301 redirect:
- ✅ Bookmarks work (auto-redirect)
- ✅ Email links work (auto-redirect)
- ✅ Search engines update to new domain
- ✅ No broken links

## Cost

- **Replit redirect server**: Free (minimal resources)
- **Custom domain**: $10-15/year
- **Railway hosting**: $5-8/month

Total: ~$10-15/year for domain

