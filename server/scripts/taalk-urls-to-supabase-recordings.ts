/**
 * Download Taalk recording URLs from twilio_call_logs, upload to Supabase (verify_agent_screenshot/recordings),
 * update rows with the Supabase signed URL. Same flow as verification calls.
 *
 * Run: npx tsx server/scripts/taalk-urls-to-supabase-recordings.ts [limit=500]
 */
import { supabaseAdmin } from '../supabase.js';

const TAALK_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';
const BASIC_AUTH = Buffer.from('michaelmandella@aoglobelife.com:Aoletsgrow24!').toString('base64');
const BUCKET = 'verify_agent_screenshot';
const SIGNED_EXPIRY_SEC = 63072000; // 2 years

function extractTaalkId(url: string): string | null {
  const m = url.match(/api\.taalk\.ai\/api\/calls\/([^/]+)\/recording/);
  return m ? m[1] : null;
}

async function fetchTaalkMp3(taalkUrl: string): Promise<Buffer | null> {
  let res = await fetch(taalkUrl, {
    headers: {
      Authorization: `Bearer ${TAALK_API_KEY}`,
      Accept: 'audio/mpeg, audio/mp3, audio/*, */*',
    },
  });
  if (!res.ok) {
    res = await fetch(taalkUrl, {
      headers: {
        Authorization: `Basic ${BASIC_AUTH}`,
        Accept: 'audio/mpeg',
      },
    });
  }
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > 0 ? buf : null;
}

async function main() {
  const limit = parseInt(process.argv[2] || '500', 10);
  if (!supabaseAdmin) {
    console.error('supabaseAdmin not configured.');
    process.exit(1);
  }

  console.log('\n📥 Fetching twilio_call_logs with api.taalk.ai recording_url (limit', limit, ')...\n');

  const { data: rows, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('id, recording_url')
    .ilike('recording_url', '%api.taalk.ai%')
    .limit(limit * 2);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const list = (rows || []) as { id: number; recording_url: string | null }[];
  const byUrl = new Map<string, number[]>();
  for (const r of list) {
    const url = (r.recording_url || '').trim();
    if (!url) continue;
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url)!.push(r.id);
  }

  const uniqueUrls = Array.from(byUrl.keys());
  console.log('   Unique Taalk URLs:', uniqueUrls.length, '| Rows to update:', list.length, '\n');

  let downloaded = 0;
  let updated = 0;
  let failed = 0;

  for (const taalkUrl of uniqueUrls) {
    const taalkId = extractTaalkId(taalkUrl);
    const idList = byUrl.get(taalkUrl)!;
    if (!taalkId) {
      failed++;
      continue;
    }

    const buffer = await fetchTaalkMp3(taalkUrl);
    if (!buffer) {
      if (failed < 5) console.log('   ❌ Download failed:', taalkId);
      failed++;
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }

    const fileName = `recordings/twilio-taalk-${taalkId}.mp3`;
    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(fileName, buffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    if (upErr) {
      if (failed < 5) console.log('   ❌ Upload failed:', taalkId, upErr.message);
      failed++;
      continue;
    }

    const { data: signedData, error: signErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(fileName, SIGNED_EXPIRY_SEC);
    const signedUrl = signedData?.signedUrl || null;
    if (signErr || !signedUrl) {
      failed++;
      continue;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('twilio_call_logs')
      .update({ recording_url: signedUrl })
      .in('id', idList);

    if (updateErr) {
      if (failed < 5) console.log('   ❌ Update failed:', taalkId, updateErr.message);
      failed++;
      continue;
    }

    downloaded++;
    updated += idList.length;
    if (downloaded <= 25) console.log('   ✅', taalkId, '→ Supabase, rows:', idList.length);

    await new Promise((r) => setTimeout(r, 150));
  }

  console.log('\n✅ Done. Unique URLs downloaded:', downloaded, '| Rows updated:', updated, '| Failed:', failed, '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
