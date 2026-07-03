// Debug script to test disposition validation logic
// This tests the logic locally without needing the server

console.log('🧪 Testing Disposition Validation Logic\n');

// Simulate the validation logic
function testDispositionValidation(disposition, hasAnsweredCall, hasBadNumber, callDuration) {
  const dispositionsRequiringAnswer = [
    'booked', 'sale', 'not_interested', 'callback', 'call_back',
    'already_been_sold', 'over_age', 'medically_uninsurable', 'duplicate',
    'instant_presentation'
  ];
  
  const requiresAnswer = dispositionsRequiringAnswer.includes(disposition.toLowerCase());
  
  console.log(`Testing: ${disposition}`);
  console.log(`  Requires answer: ${requiresAnswer}`);
  console.log(`  Has answered call: ${hasAnsweredCall}`);
  console.log(`  Has bad number: ${hasBadNumber}`);
  console.log(`  Call duration: ${callDuration}s`);
  
  if (!requiresAnswer) {
    console.log(`  ✅ ALLOWED - ${disposition} does not require answered call\n`);
    return { allowed: true, reason: 'Does not require answer' };
  }
  
  if (hasBadNumber) {
    console.log(`  ❌ BLOCKED - Number is invalid/disconnected\n`);
    return { 
      allowed: false, 
      reason: 'Bad number detected',
      error: 'Cannot set disposition - call failed due to invalid/disconnected number'
    };
  }
  
  if (!hasAnsweredCall) {
    console.log(`  ❌ BLOCKED - Call was not answered\n`);
    return { 
      allowed: false, 
      reason: 'No answered call',
      error: 'Call must be answered to set this disposition'
    };
  }
  
  if (callDuration !== null && callDuration !== undefined && callDuration < 5) {
    console.log(`  ⚠️  WARNING - Very short call duration (${callDuration}s)\n`);
  }
  
  console.log(`  ✅ ALLOWED - Call was answered\n`);
  return { allowed: true, reason: 'Call was answered' };
}

// Test cases
console.log('Test Cases:\n');
console.log('='.repeat(60));

testDispositionValidation('booked', true, false, 120);
testDispositionValidation('booked', false, false, 0);
testDispositionValidation('booked', false, true, 0);
testDispositionValidation('sale', true, false, 300);
testDispositionValidation('sale', false, false, 0);
testDispositionValidation('not_interested', true, false, 60);
testDispositionValidation('not_interested', false, false, 0);
testDispositionValidation('no_answer', false, false, 0);
testDispositionValidation('no_answer_vm', false, false, 0);
testDispositionValidation('wrong_number', false, true, 0);
testDispositionValidation('wrong_number', false, false, 0);
testDispositionValidation('dnc', false, false, 0);
testDispositionValidation('instant_presentation', true, false, 60);
testDispositionValidation('instant_presentation', false, false, 0);

console.log('='.repeat(60));
console.log('\n✅ Validation logic test complete');
console.log('\n💡 If dispositions are broken, check:');
console.log('   1. Is the validation code being executed?');
console.log('   2. Are there errors in the try/catch that are being swallowed?');
console.log('   3. Is the twilio_call_logs query working correctly?');
console.log('   4. Are phone numbers being normalized correctly?');


