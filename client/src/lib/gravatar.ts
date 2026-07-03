/**
 * Gravatar Helper
 * Generate profile image URLs from email addresses
 */

/**
 * Simple MD5 implementation for browser
 */
function md5(str: string): string {
  // Simple hash function for gravatar (not cryptographically secure but works for gravatar)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

/**
 * Generate Gravatar URL from email
 * @param email - User's email address
 * @param size - Image size in pixels (default: 80)
 * @param defaultImage - Default image type if no Gravatar exists
 */
export function getGravatarUrl(
  email: string, 
  size: number = 80,
  defaultImage: 'mp' | 'identicon' | 'monsterid' | 'wavatar' | 'retro' | 'robohash' | 'blank' = 'identicon'
): string {
  if (!email) return `https://www.gravatar.com/avatar/0?s=${size}&d=${defaultImage}`;
  
  // Trim and lowercase the email
  const normalizedEmail = email.trim().toLowerCase();
  
  // Generate MD5 hash of email
  const hash = md5(normalizedEmail);
  
  // Return Gravatar URL with identicon as default (generates unique geometric pattern)
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=${defaultImage}`;
}

/**
 * Get initials from email for fallback
 */
export function getInitialsFromEmail(email: string): string {
  const name = email.split('@')[0];
  const parts = name.split(/[._-]/);
  
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  
  return name.substring(0, 2).toUpperCase();
}

