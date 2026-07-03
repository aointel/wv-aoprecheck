# Deploy to Railway - DO THIS NOW

You have a Railway account. Here's how to deploy:

## Option 1: Railway Web UI (EASIEST - DO THIS)

### Step 1: Go to Railway Dashboard
1. Open https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"

### Step 2: Connect GitHub (if not already)
1. Click "Configure GitHub App"
2. Select your repository
3. Or if you don't have it on GitHub, select "Empty Project" instead

### Step 3: Deploy from Local Directory (Alternative)

Since you're working locally, use Railway's web interface:

1. Go to https://railway.app/new
2. Click "Empty Project"
3. Click "GitHub Repo" 
4. Or use Railway CLI from PowerShell (not Cursor terminal)

## Option 2: Deploy via PowerShell (WORKS)

Railway CLI needs a real terminal, not Cursor's integrated one.

### Step 1: Open PowerShell
Press `Win + X`, select "Windows PowerShell" or "Terminal"

### Step 2: Navigate to your project
```powershell
cd C:\Users\mmand\OneDrive\Desktop\AOI
```

### Step 3: Login to Railway
```powershell
npx @railway/cli login
```

This opens your browser to authenticate.

### Step 4: Initialize Project
```powershell
npx @railway/cli init
```

- Project name: `aoi-intelligence`

### Step 5: Deploy
```powershell
npx @railway/cli up
```

Watch the build logs. Takes ~2 minutes.

### Step 6: Get Your URL
```powershell
npx @railway/cli domain
```

## Option 3: GitHub + Railway (BEST FOR CONTINUOUS DEPLOYMENT)

### Step 1: Push to GitHub (if not already)

If your code isn't on GitHub yet:

```bash
# In your project directory
git init
git add .
git commit -m "Initial commit for Railway deployment"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2: Deploy from Railway Dashboard

1. Go to https://railway.app/new
2. "Deploy from GitHub repo"
3. Select your repository
4. Railway auto-detects the build settings
5. Click "Deploy"

### Step 3: Add Environment Variables

In Railway dashboard:
1. Click your project
2. Go to "Variables" tab
3. Add these:

```
NODE_ENV=production
PORT=5000
DATABASE_URL=your_postgres_connection_string
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone
SESSION_SECRET=your_random_secret
```

### Step 4: Redeploy

After adding variables:
1. Click "Deploy" tab
2. Click "Redeploy"

## What Railway Does

1. **Detects Node.js** from package.json
2. **Runs build**: `npm run build` (takes ~30 sec)
3. **Starts server**: `npm start`
4. **Assigns URL**: `https://your-app.up.railway.app`

## Troubleshooting

### "Railway not found" in Cursor terminal
- Use PowerShell instead
- Or use Railway web dashboard

### Build fails
- Check Railway logs in dashboard
- Verify package.json scripts are correct
- Ensure all dependencies are listed

### App crashes
- Add environment variables in Railway dashboard
- Check logs: Railway dashboard → Deployments → View logs

## Quick Start (Web UI Method)

**This is the easiest way:**

1. **Go to**: https://railway.app/new
2. **Click**: "Empty Project"
3. **Name it**: `aoi-intelligence`
4. **Click**: The project name
5. **Click**: "New" → "GitHub Repo"
6. **Select**: Your repo (or create one first)
7. **Wait**: Build completes (~2 min)
8. **Add**: Environment variables
9. **Click**: Settings → Generate Domain
10. **Done**: Your app is live!

## Check Deployment

After deployment:

```bash
# Test health check
curl https://your-app.up.railway.app/health

# Should return:
# {"status":"healthy","uptime":123,"timestamp":"..."}
```

## Next Steps

1. **Deploy it** (use web UI, easiest)
2. **Add environment variables** 
3. **Test the app**
4. **Update Twilio webhooks** with new Railway URL

## Files Ready for Deployment

✅ `railway.json` - Configuration
✅ `nixpacks.toml` - Build settings
✅ `.railwayignore` - Deployment exclusions
✅ `package.json` - Build/start scripts
✅ `dist/` - Built files (after running build)

## Environment Variables You Need

Get these from your Replit secrets or .env file:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `DATABASE_URL` (optional, if using PostgreSQL)
- `SESSION_SECRET` (make up a random string)

## My Recommendation

**Use the Web UI method** - it's the simplest:

1. Go to https://railway.app/new
2. Deploy from GitHub repo (or create empty project)
3. Add environment variables
4. Click deploy
5. Done!

No CLI needed, works perfectly.

