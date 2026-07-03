/**
 * Reset cn_email and cnresolution to null for masterlead rows that match:
 * - Resolution: pending, callback, no answer vm, no_answer_vm, called, or null
 * - OR assigned to brysonbrown (cn_email)
 * - Only Veteran and Globe market leads.
 *
 * Batched for 100k+ rows: paginated select, chunked updates.
 *
 * Usage: npx tsx server/reset-cn-resolution-email-veteran-globe.ts [--dry-run]
 */

import { supabaseAdmin } from './supabase.js';
import { masterleadClient } from './local-masterlead-client.js';

const DRY_RUN = process.argv.includes('--dry-run');
const SELECT_PAGE = 1000; // Supabase default max rows per query
const UPDATE_CHUNK = 500;

const RESOLUTIONS = [
  'pending',
  'callback',
  'call_back',
  'no_answer_vm',
  'no_answer_voicemail',
  'called',
];

async function main() {
  if (!supabaseAdmin) throw new Error('Supabase admin not available');

  console.log('Reset cn_email + cnresolution → null (Veteran & Globe only)');
  console.log('Match: pending | callback | no answer vm | called | null resolution | brysonbrown-assigned');
  console.log('Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE');
  console.log('');

  // .or(): (cnresolution in set) OR cnresolution is null OR cn_email ilike brysonbrown
  const inList = RESOLUTIONS.join(',');
  const resolutionOrTerms = `cnresolution.in.(${inList}),cnresolution.is.null,cn_email.ilike.%brysonbrown%`;

  let totalUpdated = 0;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: page, error } = await masterleadClient.from('masterlead')
      .select('id')
      .or('taalk_market.ilike.%Veteran%,taalk_market.ilike.%Globe%')
      .or(resolutionOrTerms)
      .or('cn_email.not.is.null,cnresolution.not.is.null')
      .range(from, from + SELECT_PAGE - 1);

    if (error) {
      console.error('Select error:', error.message);
      throw error;
    }
    if (!page?.length) break;

    const ids = page.map((r: { id: number }) => r.id);
    from += page.length;
    hasMore = page.length === SELECT_PAGE;

    if (DRY_RUN) {
      totalUpdated += ids.length;
      if (totalUpdated === ids.length) {
        console.log(`  [dry-run] sample ids: ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''}`);
      }
      continue;
    }

    for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
      const chunk = ids.slice(i, i + UPDATE_CHUNK);
      const { error: updateErr } = await masterleadClient.from('masterlead')
        .update({ cn_email: null, cnresolution: null })
        .in('id', chunk);

      if (updateErr) {
        console.error('Update error for chunk:', updateErr.message);
        throw updateErr;
      }
      totalUpdated += chunk.length;
    }

    process.stdout.write(`\r  Updated ${totalUpdated} rows...`);
  }

  console.log(DRY_RUN ? `\n[dry-run] Total that would be updated: ${totalUpdated}` : `\nDone. Updated ${totalUpdated} rows.`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
