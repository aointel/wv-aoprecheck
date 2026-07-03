import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient('https://ycztjetxwpfgtrzeyytt.supabase.co', 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd');
const ids = JSON.parse(readFileSync('C:/dev/skip_ticket_ids.json'));

// Also hard-delete obvious noise from remaining list
const extraNoise = ['+13214232456','+19793833830','+16062731765','+19108520723','+15055299412'];

console.log('Deleting', ids.length, 'noise tickets...');
for (let i = 0; i < ids.length; i += 50) {
  const batch = ids.slice(i, i+50).filter(Boolean);
  if (!batch.length) continue;
  const list = batch.map(id => `"${id}"`).join(',');
  const r = await supabase.from('support_messages').delete().in('ticket_id', batch);
  const r2 = await supabase.from('support_tickets').delete().in('id', batch);
  process.stdout.write('.');
}
console.log('\nDone deleting noise tickets.');
