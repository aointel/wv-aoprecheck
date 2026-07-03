/**
 * Upload full call transcript to Supabase Storage.
 * Path: call-analysis/transcripts/{billing_transaction_id}.txt
 */

import { supabaseAdmin } from './supabase';

const BUCKET = 'verify_agent_screenshot';
const TRANSCRIPTS_PREFIX = 'call-analysis/transcripts';

/**
 * Upload transcript text to Supabase Storage.
 * @param billingTransactionId - e.g. twilio-CAxxx or taalk-{sessionId}
 * @param transcript - Full transcript text (must not be empty)
 * @returns Public path or null on failure (logs error, does not throw)
 */
export async function uploadTranscriptToSupabase(
  billingTransactionId: string,
  transcript: string
): Promise<string | null> {
  if (!transcript || !transcript.trim()) {
    console.warn(`⚠️ Skipping transcript upload - empty transcript for ${billingTransactionId}`);
    return null;
  }

  const safeId = billingTransactionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${TRANSCRIPTS_PREFIX}/${safeId}.txt`;

  try {
    const buffer = Buffer.from(transcript, 'utf-8');
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: 'text/plain; charset=utf-8',
        upsert: true
      });

    if (uploadError) {
      console.error(`❌ Transcript upload failed for ${billingTransactionId}:`, uploadError);
      return null;
    }

    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(fileName, 63072000); // 2 years

    if (urlError || !urlData?.signedUrl) {
      console.warn(`⚠️ Transcript uploaded but signed URL failed for ${billingTransactionId}:`, urlError);
      return fileName; // Path is still usable
    }

    console.log(`✅ Uploaded full transcript to Supabase: ${fileName}`);
    return urlData.signedUrl;
  } catch (e: any) {
    console.error(`❌ Transcript upload error for ${billingTransactionId}:`, e?.message);
    return null;
  }
}
