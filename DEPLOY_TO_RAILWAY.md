# Deploy to Railway from Cursor - STEP BY STEP

## Why Railway?
- ✅ Actually works (unlike Replit deployments)
- ✅ Shows real error messages
- ✅ Free $5 credit per month
- ✅ Deploys in 2-3 minutes
- ✅ Professional production hosting

## Files Created for Railway
- ✅ `railway.json` - Railway configuration
- ✅ `nixpacks.toml` - Build configuration  
- ✅ `.railwayignore` - Files to exclude from deployment

## Option 1: Deploy via Railway CLI (FROM CURSOR TERMINAL)

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Login to Railway
```bash
railway login
```
This will open a browser window to authenticate.

### Step 3: Initialize Project
```bash
railway init
```
- Enter project name: `aoi-intelligence`
- Select: Create new project

### Step 4: Link to Railway
```bash
railway link
```

### Step 5: Add Environment Variables
```bash
# Add each variable one at a time
railway variables set NODE_ENV=production
railway variables set PORT=5000

# Database (if you have one)
railway variables set DATABASE_URL="your_postgres_url"

# Supabase
railway variables set SUPABASE_URL="your_supabase_url"
railway variables set SUPABASE_ANON_KEY="your_anon_key"
railway variables set SUPABASE_SERVICE_ROLE_KEY="your_service_key"

# Twilio
railway variables set TWILIO_ACCOUNT_SID="your_sid"
railway variables set TWILIO_AUTH_TOKEN="your_token"
railway variables set TWILIO_PHONE_NUMBER="your_phone"

# Session
railway variables set SESSION_SECRET="$(openssl rand -hex 32)"
```

Or set them all at once via Railway dashboard (easier).

### Step 6: Deploy!
```bash
railway up
```

That's it! Railway will:
- Build your app (runs `npm run build`)
- Show you the build logs in real-time
- Deploy to production
- Give you a URL

### Step 7: Get Your URL
```bash
railway domain
```

Or generate a public URL:
```bash
railway domain create
```

## Option 2: Deploy via Railway Web UI (EASIEST)

### Step 1: Go to Railway.app
1. Visit https://railway.app
2. Sign up/login with GitHub

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your GitHub account
4. Select your repository

### Step 3: Configure Build
Railway auto-detects everything! But you can verify:
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Node Version**: 20.x (from package.json)

### Step 4: Add Environment Variables
In Railway dashboard:
1. Go to "Variables" tab
2. Click "New Variable"
3. Add all your environment variables:

```
NODE_ENV=production
PORT=5000
DATABASE_URL=your_postgres_url
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=your_phone
SESSION_SECRET=random_64_char_string
```

### Step 5: Deploy
1. Click "Deploy"
2. Watch the build logs
3. Get your public URL

## Option 3: Deploy via GitHub Push (AUTOMATED)

### Step 1: Connect GitHub in Railway
1. In Railway dashboard, create project from GitHub repo
2. Railway auto-deploys on every push to main branch

### Step 2: Push Changes
```bash
git add .
git commit -m "Deploy to Railway"
git push origin main
```

Railway automatically deploys!

## Environment Variables You Need

Copy these from your Replit Secrets or .env file:

### Required:
```bash
NODE_ENV=production
PORT=5000
```

### Database:
```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

### Supabase:
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Twilio:
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

### Other:
```bash
SESSION_SECRET=your_random_secret_string
STRIPE_SECRET_KEY=sk_live_xxxxx (if using Stripe)
```

## Quick Commands Reference

```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up

# View logs
railway logs

# Open dashboard
railway open

# Check status
railway status

# Set environment variable
railway variables set KEY=value

# Get domain
railway domain

# Link to existing project
railway link
```

## Troubleshooting

### Build Fails
Check logs:
```bash
railway logs --build
```

Common fixes:
- Verify `package.json` has correct scripts
- Check Node version compatibility
- Ensure all dependencies are in package.json

### App Crashes After Deploy
Check runtime logs:
```bash
railway logs
```

Common issues:
- Missing environment variables
- Database connection failed
- Port binding (use process.env.PORT)

### Can't Access App
1. Generate public domain:
```bash
railway domain create
```

2. Check if app is running:
```bash
railway status
```

## What Happens During Deployment

1. **Build Phase** (~30 seconds):
   - Installs dependencies: `npm ci`
   - Runs build: `npm run build`
   - Creates production bundle

2. **Deploy Phase** (~10 seconds):
   - Starts server: `npm start`
   - Binds to Railway's port
   - Health checks pass

3. **Live**:
   - Your app is accessible at Railway URL
   - Auto-scaling enabled
   - Logs available in dashboard

## Cost

- **Free Tier**: $5 credit/month
- **Typical Usage**: $3-8/month for this app
- **No credit card required** for first $5

## Advantages Over Replit

| Feature | Railway | Replit |
|---------|---------|--------|
| Deployment Success | ✅ Works | ❌ Hangs |
| Error Messages | ✅ Detailed | ❌ None |
| Build Time | ~1 minute | ∞ timeout |
| Auto-scaling | ✅ Yes | ⚠️ Limited |
| Professional | ✅ Yes | ⚠️ Dev-focused |
| Cost | $3-8/mo | Free/paid |

## After Deployment

1. **Get your URL**:
```bash
railway domain
```

2. **Update Twilio webhooks** with new Railway URL

3. **Test the app**:
```bash
curl https://your-app.railway.app/health
```

4. **Monitor logs**:
```bash
railway logs --tail
```

## Deployment Checklist

- [ ] Railway CLI installed: `npm install -g @railway/cli`
- [ ] Logged in: `railway login`
- [ ] Project initialized: `railway init`
- [ ] Environment variables set
- [ ] Deployed: `railway up`
- [ ] Domain created: `railway domain create`
- [ ] Health check passes: `/health` returns 200
- [ ] App accessible at Railway URL
- [ ] Twilio webhooks updated
- [ ] Database connected

## Next Steps

1. **Deploy now**:
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

2. **Or use web UI**:
   - Go to railway.app
   - Connect GitHub
   - Deploy with one click

3. **Stop fighting Replit** - you'll have a working deployment in 5 minutes

## Support

If you need help:
- Railway docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Or just run `railway help`

Railway actually shows you error messages, so debugging is 1000x easier than Replit.

