import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

const supabase = createClient(
  'https://ycztjetxwpfgtrzeytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const { data, error, count } = await supabase
  .from('masterlead')
  .select('id, first_name, last_name, state, taalk_market', { count: 'exact' })
  .is('cn_email', null)
  .eq('state', 'FL')
  .eq('taalk_market', 'Globe Market')
  .eq('dnc', false)
  .limit(50);

if (error) {
  console.error('error', error);
} else {
  console.log(`count: ${count}`);
  console.log('sample:', data?.slice(0, 10));
}

