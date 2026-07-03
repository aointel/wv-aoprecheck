// Phone number formatting utilities for E.164 compliance

/**
 * Converts US phone number to E.164 format (+1XXXXXXXXXX)
 * Handles various input formats: (503) 201-8470, 503-201-8470, 5032018470, etc.
 */
export function formatToE164(phoneNumber: string): string {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Handle US phone numbers
  if (digits.length === 10) {
    // Add US country code (+1)
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // Already has country code
    return `+${digits}`;
  }
  
  // Return as-is if already formatted or international
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }
  
  // Fallback - assume US number if 10 digits
  return `+1${digits}`;
}

/**
 * Validates if a phone number is in proper E.164 format
 */
export function isValidE164(phoneNumber: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * Formats phone number for display (US format)
 */
export function formatForDisplay(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    const phone = digits.slice(1);
    return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
  }
  
  return phoneNumber;
}