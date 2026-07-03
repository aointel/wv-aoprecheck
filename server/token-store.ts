import { db } from './db';
import { agentProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface GoogleTokens {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

// Store Google Calendar tokens for a user
export async function upsertUserTokens(userId: string, tokens: GoogleTokens): Promise<void> {
  try {
    console.log('🗓️ Storing Google Calendar tokens for user:', userId.slice(0, 8) + '...');
    
    // Store tokens as JSON in the agent_profiles table google_tokens column
    // Try to update by email first, then by supabaseUserId
    const result = await db.update(agentProfiles)
      .set({ 
        googleTokens: JSON.stringify(tokens),
        updatedAt: new Date()
      })
      .where(eq(agentProfiles.email, userId));
      
    // If no rows updated, also try by supabaseUserId as fallback
    if (!result) {
      await db.update(agentProfiles)
        .set({ 
          googleTokens: JSON.stringify(tokens),
          updatedAt: new Date()
        })
        .where(eq(agentProfiles.supabaseUserId, userId));
    }
      
    console.log('✅ Google Calendar tokens stored successfully');
  } catch (error) {
    console.error('❌ Error storing Google Calendar tokens:', error);
    throw error;
  }
}

// Get Google Calendar tokens for a user
export async function getUserTokens(userId: string): Promise<GoogleTokens | null> {
  try {
    // Try to get tokens by email first, then by supabaseUserId
    let result = await db.select({ googleTokens: agentProfiles.googleTokens })
      .from(agentProfiles)
      .where(eq(agentProfiles.email, userId))
      .limit(1);
      
    // If no result, try by supabaseUserId as fallback
    if (!result[0]?.googleTokens) {
      result = await db.select({ googleTokens: agentProfiles.googleTokens })
        .from(agentProfiles)
        .where(eq(agentProfiles.supabaseUserId, userId))
        .limit(1);
    }
      
    if (!result[0]?.googleTokens) {
      console.log('🗓️ No Google Calendar tokens found for user:', userId.slice(0, 8) + '...');
      return null;
    }
    
    const tokens = JSON.parse(result[0].googleTokens);
    console.log('✅ Google Calendar tokens retrieved for user:', userId.slice(0, 8) + '...');
    return tokens;
  } catch (error) {
    console.error('❌ Error retrieving Google Calendar tokens:', error);
    return null;
  }
}

// Remove Google Calendar tokens for a user
export async function removeUserTokens(userId: string): Promise<void> {
  try {
    await db.update(agentProfiles)
      .set({ 
        googleTokens: null,
        updatedAt: new Date()
      })
      .where(eq(agentProfiles.supabaseUserId, userId));
      
    console.log('🗓️ Google Calendar tokens removed for user:', userId.slice(0, 8) + '...');
  } catch (error) {
    console.error('❌ Error removing Google Calendar tokens:', error);
    throw error;
  }
}