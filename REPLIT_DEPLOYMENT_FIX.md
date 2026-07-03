# Replit Deployment Fix - Server Hanging at Provision

## Problem
Replit deployment hangs at the "provision" stage and never completes. The server takes too long to respond to health checks during initialization, causing the provisioning timeout.

## Root Cause
The server's `initializeServerAsync()` function performs heavy initialization immediately on startup:
- Database connections and queries
- Multiple service imports (WebRTC, LocalPresence, routes)
- Background schedulers (hotlead monitoring, billing recap)
- Immediate database operations

This prevents the server from responding to health checks quickly enough for Replit's provisioning system.

## Solution Applied

### 1. Deferred Initialization (2-second delay)
The main async initialization is now delayed by 2 seconds to allow health checks to pass first:

```typescript
// In server/index.ts around line 213
const server = app.listen(port, "0.0.0.0", () => {
  log(`serving on port ${port}`);
  console.log(`✅ Server ready for health checks at http://0.0.0.0:${port}/health`);
  
  // CRITICAL FOR REPLIT DEPLOYMENT: Defer initialization
  setTimeout(() => {
    console.log('⏱️ Starting deferred initialization after health check window...');
    initializeServerAsync().catch((error) => {
      console.error('❌ Failed to initialize server components:', error);
      if (NODE_ENV !== 'production') {
        process.exit(1);
      }
    });
  }, 2000); // 2 second delay to ensure health checks pass first
});
```

### 2. Lazy Background Services (5-second delay)
Non-critical background services are further delayed by an additional 5 seconds:

```typescript
// In server/index.ts around line 372
setTimeout(() => {
  console.log('🔥 Starting deferred background services...');
  
  // Enable hotlead monitoring service
  import('./hotlead-scheduler').then(({ hotleadScheduler }) => {
    hotleadScheduler.startScheduler();
    console.log('✅ Hotlead monitoring service started');
  }).catch(err => console.warn('⚠️ Hotlead scheduler failed (non-critical):', err));
  
  // Start daily billing recap scheduler
  import('./daily-billing-recap-service').then(({ DailyBillingRecapService }) => {
    DailyBillingRecapService.setupDailyRecapScheduler();
    console.log('✅ Daily billing recap scheduler started');
  }).catch(err => console.warn('⚠️ Billing recap failed (non-critical):', err));
  
  // Start no_answer reset service
  setInterval(async () => {
    // ... reset logic ...
  }, 60000);
  
  console.log('✅ Background services initialization complete');
}, 5000); // Wait 5 seconds after routes are ready
```

## Key Changes Summary

1. **Health Check Priority**: Server responds to `/health` endpoint immediately (lines 50-62 in server/index.ts)
2. **Deferred Init**: Main initialization delayed 2 seconds after server starts listening
3. **Lazy Services**: Background services delayed 5 seconds total (2s + 3s additional)
4. **Non-blocking Imports**: Background services use dynamic imports with `.catch()` handlers
5. **Production Safety**: Errors in non-critical services don't crash the server

## Deployment Configuration (Already Correct)

The `.replit` file is properly configured:

```toml
[deployment]
deploymentTarget = "autoscale"
run = ["npm", "run", "start"]
build = ["sh", "-c", "npm run build"]

[[ports]]
localPort = 5000
externalPort = 80

[env]
PORT = "5000"
```

## Health Check Endpoints

The server responds to health checks on multiple endpoints:
- `HEAD /` - Fast response for probes
- `GET /` - Returns JSON status for non-browser requests
- `GET /health` - Dedicated health check endpoint

```typescript
// Lines 16-47 in server/index.ts
app.head('/', (req, res) => {
  res.status(200).end();
});

app.get('/', (req, res, next) => {
  const userAgent = req.get('user-agent') || '';
  const isHealthCheckProbe = !userAgent || 
                             userAgent.includes('curl') || 
                             userAgent.includes('wget') ||
                             userAgent.includes('GoogleHC') ||
                             userAgent.includes('kube-probe');
  
  if (isHealthCheckProbe) {
    return res.status(200).json({ 
      status: 'ok',
      message: 'Server is healthy',
      timestamp: new Date().toISOString()
    });
  }
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});
```

## Expected Startup Timeline

```
0ms   - Server starts listening on port 5000
0ms   - Health check endpoints immediately available
2000ms - Main initialization begins (routes, vite, services)
5000ms - Background services start (schedulers, intervals)
7000ms - All systems operational
```

## Testing the Fix Locally

```bash
# Kill any running processes
taskkill /F /IM node.exe

# Rebuild with fixes
npm run build

# Start production server
npm start

# Test health check (should respond within 1 second)
curl http://localhost:5000/health
```

## Deployment Steps for Replit

1. Commit the changes to `server/index.ts`
2. Push to your Git repository (if using Git)
3. In Replit, click "Deploy" button
4. The provisioning should now complete successfully
5. Health checks will pass immediately, allowing deployment to finish

## Additional Optimizations

### If Still Timing Out, Further Reduce Initialization:

1. **Increase health check delay to 3 seconds**:
   ```typescript
   setTimeout(() => { ... }, 3000); // Instead of 2000
   ```

2. **Move routes registration to lazy load**:
   ```typescript
   setTimeout(() => {
     registerRoutes(app).then(() => {
       console.log('✅ Routes registered');
     });
   }, 1000);
   ```

3. **Disable background services temporarily**:
   Comment out the background services setTimeout block entirely for initial deployment

## Verification

After deployment succeeds, check the logs for:
```
✅ Server ready for health checks at http://0.0.0.0:5000/health
⏱️ Starting deferred initialization after health check window...
✅ Routes registered successfully
✅ Server initialization complete
🔥 Starting deferred background services...
✅ Hotlead monitoring service started
✅ Daily billing recap scheduler started
✅ Background services initialization complete
```

## Files Modified

- `server/index.ts` (lines 213-228, lines 370-414)

## Rollback Instructions

If you need to rollback, revert these changes:
1. Remove `setTimeout()` wrapper around `initializeServerAsync()` call
2. Remove `setTimeout()` wrapper around background services
3. Restore direct `await` calls for service initialization

## Support Information

- **Node Version**: 20
- **Port**: 5000 (Cloud Run compatible)
- **Database**: PostgreSQL + Supabase
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Health Check Path**: `/health` or `/`

## Contact

If this doesn't resolve the issue, the problem may be:
- Database connection timeout (check Supabase credentials)
- Memory limits during build (increase deployment resources)
- External service dependencies (Twilio, Stripe, etc.)

