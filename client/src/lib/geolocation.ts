/**
 * Geolocation utility for forcing device location collection
 * This is required for both clients and agents to ensure accurate location tracking
 */

export interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

/**
 * Request device geolocation with retries and timeout
 * This will prompt the user for location permission if not already granted
 */
export async function getDeviceGeolocation(
  options: {
    timeout?: number;
    maximumAge?: number;
    enableHighAccuracy?: boolean;
    retries?: number;
  } = {}
): Promise<GeolocationData> {
  const {
    timeout = 10000, // 10 seconds default
    maximumAge = 0, // Always get fresh location
    enableHighAccuracy = true, // Use GPS when available
    retries = 3,
  } = options;

  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by this browser');
  }

  let lastError: GeolocationError | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject({
            code: 3, // TIMEOUT
            message: 'Geolocation request timed out',
          });
        }, timeout);

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            resolve(position);
          },
          (error) => {
            clearTimeout(timeoutId);
            reject({
              code: error.code,
              message: error.message,
            });
          },
          {
            enableHighAccuracy,
            timeout,
            maximumAge,
          }
        );
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on permission denied
      if (error.code === 1) {
        throw new Error('Location permission denied. Please enable location access in your browser settings.');
      }
      
      // Don't retry on timeout if it's the last attempt
      if (attempt === retries) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  // If we get here, all retries failed
  const errorMessages: Record<number, string> = {
    1: 'Location permission denied. Please enable location access.',
    2: 'Location unavailable. Please check your device settings.',
    3: 'Location request timed out. Please try again.',
  };

  throw new Error(
    errorMessages[lastError?.code || 3] || 
    `Failed to get location: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Check if geolocation is available and permission status
 */
export async function checkGeolocationSupport(): Promise<{
  supported: boolean;
  permission: PermissionState | null;
}> {
  const supported = 'geolocation' in navigator;
  
  let permission: PermissionState | null = null;
  if ('permissions' in navigator) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      permission = result.state;
    } catch (e) {
      // Permissions API might not be fully supported
    }
  }
  
  return { supported, permission };
}

/**
 * Reverse geocode coordinates to get human-readable location
 * Uses OpenStreetMap Nominatim API (free, no key required)
 */
export interface ReverseGeocodeResult {
  city?: string;
  state?: string;
  country?: string;
  fullLocation?: string;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  try {
    // Use OpenStreetMap Nominatim API (free, no key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'AOIrail/1.0' // Required by Nominatim
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();
    const address = data.address || {};

    const city = address.city || address.town || address.village || address.municipality || '';
    const state = address.state || address.region || '';
    const country = address.country || '';

    // Build full location string
    const parts: string[] = [];
    if (city) parts.push(city);
    if (state && state !== country) parts.push(state);
    if (country) parts.push(country);
    const fullLocation = parts.length > 0 ? parts.join(', ') : undefined;

    return {
      city: city || undefined,
      state: state || undefined,
      country: country || undefined,
      fullLocation
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return {};
  }
}

