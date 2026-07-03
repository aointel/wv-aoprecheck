import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sessionId = 'session_1761450648520_v9c799qvv';

const { data: records } = await supabase
  .from('scraped_presentation_data')
  .select('*')
  .eq('session_id', sessionId)
  .eq('scraped_data->>url', 'https://hppro.planetaltig.com/#/StartPresentation')
  .limit(1);

const record = records[0];

console.log('📋 FULL SCRAPED DATA RECORD:\n');
console.log(JSON.stringify(record.scraped_data, null, 2));

