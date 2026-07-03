const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkStatus() {
  const sessionId = '38ce5ab6-6200-47a9-bb47-aea5ce73eb9f';
  
  const { data: session } = await supabase
    .from('presentation_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();
  
  console.log('\n📊 SLIDE DECK GENERATION STATUS:\n');
  console.log('Session ID:', session.session_id);
  console.log('Total screenshots:', session.screenshot_count || 0);
  console.log('Slides generated:', session.total_slides_shown || 0);
  console.log('Has slide data:', !!session.slides_data);
  
  if (session.slides_data && session.slides_data.slides) {
    const slides = session.slides_data.slides;
    console.log('\n✅ SLIDE DECK READY!');
    console.log('Important slides extracted:', slides.length);
    console.log('\nBreakdown by type:');
    console.log('  Stats/KPIs:', slides.filter(s => s.slideType === 'stats').length);
    console.log('  Needs Analysis:', slides.filter(s => s.slideType === 'needs_analysis').length);
    console.log('  Benefits Presented:', slides.filter(s => s.slideType === 'benefits_presented').length);
    console.log('  Final Summary:', slides.filter(s => s.slideType === 'final_summary').length);
    
    console.log('\nSlide titles:');
    slides.slice(0, 10).forEach(slide => {
      console.log(`  ${slide.slideNumber}. [${slide.slideType}] ${slide.title}`);
    });
    if (slides.length > 10) {
      console.log(`  ... and ${slides.length - 10} more slides`);
    }
  } else {
    console.log('\n⏳ Slide deck not generated yet - run the generation endpoint');
  }
}

checkStatus();

