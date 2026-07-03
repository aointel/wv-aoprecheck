/**
 * Server-side version enforcement
 * Rejects requests from old app versions and forces updates
 */

const MINIMUM_APP_VERSION = '1.0.3'; // Minimum allowed Electron app version
const CURRENT_APP_VERSION = '1.0.3'; // Current recommended version
const DOWNLOAD_URL = 'https://aoirail-production-baa2.up.railway.app/downloads'; // baa2 until go-live

/**
 * Parse version string to comparable number
 */
function parseVersion(version: string): number {
  const parts = version.split('.').map(Number);
  return parts[0] * 10000 + parts[1] * 100 + parts[2];
}

/**
 * Middleware to check app version and force updates
 */
export function enforceAppVersion(req: any, res: any, next: any) {
  const appVersion = req.headers['x-app-version'] as string;
  
  // If no version header, assume browser access - allow it
  if (!appVersion) {
    return next();
  }
  
  // Check if version is too old
  const clientVersion = parseVersion(appVersion);
  const minimumVersion = parseVersion(MINIMUM_APP_VERSION);
  
  if (clientVersion < minimumVersion) {
    console.log(`❌ OLD APP VERSION DETECTED: ${appVersion} (minimum: ${MINIMUM_APP_VERSION})`);
    return res.status(426).json({
      error: 'Update Required',
      message: `Your app version (${appVersion}) is outdated. Please update to version ${CURRENT_APP_VERSION} or higher.`,
      minimumVersion: MINIMUM_APP_VERSION,
      currentVersion: CURRENT_APP_VERSION,
      downloadUrl: DOWNLOAD_URL,
      yourVersion: appVersion
    });
  }
  
  console.log(`✅ App version check passed: ${appVersion}`);
  next();
}

