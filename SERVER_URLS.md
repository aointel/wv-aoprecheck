# 🌐 Server URLs Reference

## Production Server
```
https://aoirail-production.up.railway.app
```
- **Branch:** master
- **Purpose:** Live production environment
- **Deploy:** Only after testing in staging
- **Users:** Real agents and clients

---

## Staging Server (Beta)
```
https://aoirail-beta-staging.up.railway.app
```
- **Branch:** staging (to be configured)
- **Purpose:** Testing and development
- **Deploy:** Push to staging branch
- **Users:** Internal testing only

---

## Local Development
```
http://localhost:5000
```
- **Command:** `npm run dev`
- **Purpose:** Local development and testing
- **Database:** Same as production (Supabase)

---

## 🔧 Quick Access Links

### Staging (Test Here First!)
- Login: https://aoirail-beta-staging.up.railway.app/login
- Signup: https://aoirail-beta-staging.up.railway.app/signup
- Dashboard: https://aoirail-beta-staging.up.railway.app/dashboard/aoi

### Production (Live)
- Login: https://aoirail-production.up.railway.app/login
- Signup: https://aoirail-production.up.railway.app/signup
- Dashboard: https://aoirail-production.up.railway.app/dashboard/aoi

---

## 📋 Deployment Flow

```
Local Development (localhost:5000)
    ↓
    Test locally
    ↓
Git push to staging branch
    ↓
Staging Server (aoirail-beta-staging.up.railway.app)
    ↓
    Test thoroughly!
    ↓
Git merge to master
    ↓
Production Server (aoirail-production.up.railway.app)
    ↓
    Live to users ✨
```

---

## 🚀 How to Deploy

### To Staging:
```bash
git checkout staging
git add .
git commit -m "Feature: Description"
git push origin staging
```
**Result:** Auto-deploys to `aoirail-beta-staging.up.railway.app`

### To Production:
```bash
git checkout master
git merge staging
git push origin master
```
**Result:** Auto-deploys to `aoirail-production.up.railway.app`

---

## 🔍 Testing URLs

### Test Staging After Deploy:
```bash
# Check if server is up
curl https://aoirail-beta-staging.up.railway.app/health

# Test signup page
curl https://aoirail-beta-staging.up.railway.app/signup
```

### Test Production:
```bash
# Check if server is up
curl https://aoirail-production.up.railway.app/health

# Test signup page
curl https://aoirail-production.up.railway.app/signup
```

---

## 🎯 Railway Configuration

### Production Service Settings:
- **Name:** production
- **Branch:** master
- **URL:** aoirail-production.up.railway.app
- **Environment:** `NODE_ENV=production`

### Staging Service Settings:
- **Name:** beta-staging
- **Branch:** staging (needs to be configured)
- **URL:** aoirail-beta-staging.up.railway.app
- **Environment:** `NODE_ENV=staging`

---

## ⚙️ Next Step: Configure Railway

Go to Railway dashboard and update the beta-staging service:

1. Click on **beta-staging** service
2. Go to **Settings** → **Service**
3. Find **Branch** setting
4. Change from `master` to `staging`
5. Save changes

Now your staging server will auto-deploy when you push to the `staging` branch!

---

## 📞 Webhook URLs

### Staging Webhooks (for Zapier testing):
```
https://aoirail-beta-staging.up.railway.app/api/webhook/credit-adjustment
https://aoirail-beta-staging.up.railway.app/api/webhook/vdp-events
https://aoirail-beta-staging.up.railway.app/api/webhook/sms-events
```

### Production Webhooks (live):
```
https://aoirail-production.up.railway.app/api/webhook/credit-adjustment
https://aoirail-production.up.railway.app/api/webhook/vdp-events
https://aoirail-production.up.railway.app/api/webhook/sms-events
```

**Note:** Test webhooks in staging first before updating production!

---

## 🛡️ Safety Checklist

Before deploying to production:

- [ ] Tested feature in local development
- [ ] Pushed to staging branch
- [ ] Tested on staging URL: `aoirail-beta-staging.up.railway.app`
- [ ] Verified no console errors
- [ ] Tested login/signup flows
- [ ] Checked Railway logs for errors
- [ ] Got approval from team
- [ ] Merged to master
- [ ] Deployed to production
- [ ] Verified on production URL: `aoirail-production.up.railway.app`

---

**Last Updated:** October 17, 2025

