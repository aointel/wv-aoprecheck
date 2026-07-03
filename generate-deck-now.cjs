async function generateDeck() {
  const sessionId = '38ce5ab6-6200-47a9-bb47-aea5ce73eb9f';
  
  console.log('🎨 Generating AI slide deck...');
  console.log('Session:', sessionId);
  console.log('This will analyze 106 screenshots and extract only:');
  console.log('  1. Stats/KPIs');
  console.log('  2. Needs Analysis');
  console.log('  3. Benefits Presented');
  console.log('  4. Final Summary');
  console.log('');
  
  try {
    const response = await fetch(`http://localhost:5000/api/presentations/${sessionId}/generate-slide-deck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('\n✅ SLIDE DECK GENERATED!');
      console.log('Important slides extracted:', data.count, 'out of 106 screenshots');
      console.log('\nSlide breakdown:');
      
      const byType = {};
      data.slides.forEach(slide => {
        byType[slide.slideType] = (byType[slide.slideType] || 0) + 1;
      });
      
      console.log('  Stats/KPIs:', byType.stats || 0);
      console.log('  Needs Analysis:', byType.needs_analysis || 0);
      console.log('  Benefits Presented:', byType.benefits_presented || 0);
      console.log('  Final Summary:', byType.final_summary || 0);
      
      console.log('\nSample slides:');
      data.slides.slice(0, 5).forEach(slide => {
        console.log(`  ${slide.slideNumber}. [${slide.slideType}] ${slide.title}`);
        if (slide.content && slide.content.length > 0) {
          console.log(`     - ${slide.content[0]}`);
        }
      });
    } else {
      console.error('❌ Failed:', data.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

generateDeck();

