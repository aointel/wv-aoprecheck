const OpenAI = require('openai');
const fs = require('fs');

const openai = new OpenAI({ 
  apiKey: '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'
});

async function testAIAnalysis() {
  try {
    console.log('🧪 Testing AI analysis on real screenshot...');
    
    // Read a real screenshot from the recordings
    const screenshotPath = 'recordings\\screenshots\\38ce5ab6-6200-47a9-bb47-aea5ce73eb9f\\screenshot-0050.png';
    const fileBuffer = fs.readFileSync(screenshotPath);
    const base64 = fileBuffer.toString('base64');
    const screenshotData = `data:image/png;base64,${base64}`;
    
    console.log('📸 Screenshot loaded:', screenshotPath);
    console.log('📊 Size:', (fileBuffer.length / 1024).toFixed(2), 'KB');
    
    const prompt = `You are analyzing a screenshot from an HPPRO insurance presentation system. 
      
IDENTIFY which milestone/screen this is:
- "lead_selection": Lead/client information entry screen
- "price_quotes": Showing insurance quotes with prices
- "product_comparison": Comparing different insurance products
- "enrollment": Application/enrollment form
- "analytics_summary": Final analytics/summary screen showing presentation KPIs
- "other": None of the above

EXTRACT all visible data:
1. If lead selection: Extract firstName, lastName, full client name, phone number, city, age, state, zip, tobacco status, lead type (Medicare, ACA, Life Insurance, etc)
2. If quotes: Extract carrier, product name, coverage amount, monthly/annual premium for ALL visible quotes
3. If products: List all insurance products being discussed (product type, carrier, name)
4. If enrollment: Identify which steps are visible/completed
5. If analytics: Extract ALL KPIs shown (duration, leads, quotes, applications, sales, premiums, products, carriers)

Respond in JSON format:
{
  "milestone": "lead_selection|price_quotes|product_comparison|enrollment|analytics_summary|other",
  "milestoneName": "descriptive name",
  "confidence": 0.0-1.0,
  "leadData": {...},
  "quoteData": [{...}],
  "productData": [{...}],
  "enrollmentData": {...},
  "analyticsData": {...}
}

Be thorough - extract EVERY piece of visible data!`;

    console.log('\n🤖 Calling OpenAI Vision API...\n');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: screenshotData,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content;
    console.log('✅ AI Response:\n');
    console.log(content);
    
    // Try to parse JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      console.log('\n📊 PARSED ANALYSIS:');
      console.log('Milestone:', analysis.milestone);
      console.log('Name:', analysis.milestoneName);
      console.log('Confidence:', analysis.confidence);
      if (analysis.leadData) {
        console.log('Lead Data:', analysis.leadData);
      }
      if (analysis.quoteData) {
        console.log('Quote Data:', analysis.quoteData);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testAIAnalysis();

