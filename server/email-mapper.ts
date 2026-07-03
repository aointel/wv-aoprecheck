/**
 * Email Mapper Utility
 * Maps numeric emails (e.g., 103021@aoglobelife.com) to real emails from customers table
 */

import { supabaseAdmin } from './supabase';

/**
 * Maps a numeric email to a real email from the customers table
 * @param email - The email to map (may be numeric or real)
 * @returns The real email, or the original email if no mapping found
 */
export async function mapEmailToRealEmail(email: string): Promise<string> {
  if (!email) return email;
  
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check if it's a numeric email (e.g., 103021@aoglobelife.com)
  const emailPrefix = normalizedEmail.split('@')[0];
  if (!/^\d+$/.test(emailPrefix) || parseInt(emailPrefix) <= 0) {
    return normalizedEmail; // Not a numeric email, return normalized version
  }

  const associateId = parseInt(emailPrefix);
  
  try {
    // Look up real email from customers table
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('company_email, personal_email')
      .eq('associate_id', associateId)
      .maybeSingle();

    if (customer?.company_email) {
      const realEmail = customer.company_email.toLowerCase().trim();
      if (realEmail && realEmail !== normalizedEmail) {
        return realEmail;
      }
    }

    if (customer?.personal_email) {
      const realEmail = customer.personal_email.toLowerCase().trim();
      if (realEmail && realEmail !== normalizedEmail) {
        return realEmail;
      }
    }
  } catch (error) {
    console.error(`❌ Error looking up email for associate_id ${associateId}:`, error);
  }

  return normalizedEmail; // Return normalized original if no mapping found
}

/**
 * Ensures weekly_usage_stats uses real email instead of numeric email
 * Checks if a record with real email exists, and updates/merges accordingly
 * @param numericEmail - The numeric email from the data
 * @param weekStartDate - The week start date
 * @param updateData - Data to update/upsert
 * @returns The real email that was used
 */
export async function ensureRealEmailInWeeklyStats(
  numericEmail: string,
  weekStartDate: string,
  updateData: {
    agent_name?: string | null;
    [key: string]: any;
  }
): Promise<string> {
  const realEmail = await mapEmailToRealEmail(numericEmail);
  
  // If email was mapped, check if record with real email exists
  if (realEmail !== numericEmail.toLowerCase().trim()) {
    const { data: existingReal } = await supabaseAdmin
      .from('weekly_usage_stats')
      .select('id')
      .eq('agent_email', realEmail)
      .eq('week_start_date', weekStartDate)
      .maybeSingle();

    if (existingReal) {
      // Record with real email exists - delete numeric email record if it exists
      await supabaseAdmin
        .from('weekly_usage_stats')
        .delete()
        .eq('agent_email', numericEmail.toLowerCase().trim())
        .eq('week_start_date', weekStartDate);
    }
  }

  return realEmail;
}
