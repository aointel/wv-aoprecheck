import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const openai = new OpenAI({ 
  apiKey: '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'
});

const sessionId = 'session_1761440606476_lsdsbql0l';

console.log(`🤖 Testing AI extraction on: ${sessionId}\n`);

// Get scraped data
const { data: scrapedData } = await supabase
  .from('scraped_presentation_data')
  .select('*')
  .eq('session_id', sessionId)
  .order('timestamp', { ascending: true });

console.log(`📊 Found ${scrapedData?.length} data points\n`);

// Prepare simplified data for AI
const simplifiedData = scrapedData?.slice(0, 10).map((entry, index) => ({
  sequence: index + 1,
  url: entry.scraped_data.url,
  title: entry.scraped_data.title,
  text: entry.scraped_data.textContent?.substring(0, 500),
  forms: entry.scraped_data.forms?.length || 0,
  timestamp: entry.timestamp
}));

const prompt = `Extract client info and outcome from this HPPRO presentation:

DATA:
${JSON.stringify(simplifiedData, null, 2)}

Return JSON:
{
  "clientName": "First Last",
  "phone": "",
  "state": "",
  "alp": "$0.00",
  "currentPhase": "intro|needs_analysis|plan_selection|enrollment",
  "disposition": "SOLD|THINK|NOT_INTERESTED|CANT_AFFORD|INCOMPLETE"
}`;

console.log('📤 Sending to OpenAI...\n');

try {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'Extract sales data from insurance presentation pages.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const result = JSON.parse(completion.choices[0].message.content);
  
  console.log('✅ AI Extraction Result:');
  console.log(JSON.stringify(result, null, 2));
  
} catch (error) {
  console.error('❌ OpenAI Error:', error.message);
}

