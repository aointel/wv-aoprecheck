/**
 * Test OpenAI API connection.
 * Run: npx tsx scripts/test-openai-connection.ts
 */
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../server/hardcoded-config';

async function test() {
  const key = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
  if (!key) {
    console.error('❌ No OPENAI_API_KEY found (env or hardcoded-config)');
    process.exit(1);
  }
  console.log('🔑 Using API key:', key.substring(0, 12) + '...');
  const openai = new OpenAI({ apiKey: key });
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 10,
    });
    const text = completion.choices?.[0]?.message?.content?.trim() ?? '';
    console.log('✅ OpenAI connection OK. Response:', text || '(empty)');
  } catch (err: any) {
    console.error('❌ OpenAI connection failed:', err?.message ?? err);
    if (err?.status) console.error('   Status:', err.status);
    process.exit(1);
  }
}

test();
