const OpenAI = require('openai');

const openai = new OpenAI({ 
  apiKey: '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'
});

async function testOpenAI() {
  try {
    console.log('🧪 Testing OpenAI API...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is 2+2?' }
          ]
        }
      ],
      max_tokens: 10
    });
    
    console.log('✅ OpenAI API working:', response.choices[0]?.message?.content);
  } catch (error) {
    console.error('❌ OpenAI API error:', error.message);
  }
}

testOpenAI();
