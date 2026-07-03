import twilio from 'twilio';

// Get Twilio credentials from environment
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error('❌ Missing Twilio credentials. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

async function checkTwilioNumbers() {
  try {
    console.log('🔍 Fetching all available Twilio phone numbers...');
    
    const incomingPhoneNumbers = await client.incomingPhoneNumbers.list();
    
    console.log(`\n📞 Found ${incomingPhoneNumbers.length} Twilio numbers:\n`);
    
    // Group by state/area code
    const numbersByState = {};
    
    incomingPhoneNumbers.forEach(number => {
      const phoneNumber = number.phoneNumber;
      const areaCode = phoneNumber.substring(2, 5); // Extract area code
      
      // Map area codes to states (major ones)
      const areaCodeToState = {
        // California
        '209': 'CA', '213': 'CA', '310': 'CA', '323': 'CA', '408': 'CA', '415': 'CA', 
        '424': 'CA', '442': 'CA', '510': 'CA', '530': 'CA', '559': 'CA', '562': 'CA',
        '619': 'CA', '626': 'CA', '628': 'CA', '650': 'CA', '657': 'CA', '661': 'CA',
        '669': 'CA', '707': 'CA', '714': 'CA', '747': 'CA', '760': 'CA', '764': 'CA',
        '805': 'CA', '818': 'CA', '820': 'CA', '831': 'CA', '840': 'CA', '858': 'CA',
        '909': 'CA', '916': 'CA', '925': 'CA', '949': 'CA', '951': 'CA',

        // Texas
        '214': 'TX', '254': 'TX', '281': 'TX', '361': 'TX', '409': 'TX', '430': 'TX',
        '432': 'TX', '469': 'TX', '512': 'TX', '713': 'TX', '726': 'TX', '737': 'TX',
        '806': 'TX', '817': 'TX', '830': 'TX', '832': 'TX', '903': 'TX', '915': 'TX',
        '936': 'TX', '940': 'TX', '945': 'TX', '956': 'TX', '972': 'TX', '979': 'TX',

        // Florida
        '239': 'FL', '305': 'FL', '321': 'FL', '352': 'FL', '386': 'FL', '407': 'FL',
        '561': 'FL', '689': 'FL', '727': 'FL', '754': 'FL', '772': 'FL', '786': 'FL',
        '813': 'FL', '850': 'FL', '863': 'FL', '904': 'FL', '941': 'FL', '954': 'FL',

        // New York
        '212': 'NY', '315': 'NY', '332': 'NY', '347': 'NY', '516': 'NY', '518': 'NY',
        '585': 'NY', '607': 'NY', '631': 'NY', '646': 'NY', '680': 'NY', '716': 'NY',
        '718': 'NY', '838': 'NY', '845': 'NY', '914': 'NY', '917': 'NY', '929': 'NY',
        '934': 'NY',

        // Illinois
        '217': 'IL', '224': 'IL', '309': 'IL', '312': 'IL', '331': 'IL', '447': 'IL',
        '464': 'IL', '618': 'IL', '630': 'IL', '708': 'IL', '773': 'IL', '779': 'IL',
        '815': 'IL', '847': 'IL', '872': 'IL',

        // Pennsylvania
        '215': 'PA', '223': 'PA', '267': 'PA', '272': 'PA', '412': 'PA', '445': 'PA',
        '484': 'PA', '570': 'PA', '582': 'PA', '610': 'PA', '717': 'PA', '724': 'PA',
        '814': 'PA', '835': 'PA', '878': 'PA',

        // Ohio
        '216': 'OH', '220': 'OH', '234': 'OH', '283': 'OH', '330': 'OH', '380': 'OH',
        '419': 'OH', '440': 'OH', '513': 'OH', '567': 'OH', '614': 'OH', '680': 'OH',
        '740': 'OH', '937': 'OH',

        // Michigan
        '231': 'MI', '248': 'MI', '269': 'MI', '313': 'MI', '517': 'MI', '586': 'MI',
        '616': 'MI', '679': 'MI', '734': 'MI', '810': 'MI', '906': 'MI', '947': 'MI',
        '989': 'MI',

        // Georgia
        '229': 'GA', '404': 'GA', '470': 'GA', '478': 'GA', '678': 'GA', '706': 'GA',
        '762': 'GA', '770': 'GA', '912': 'GA',

        // North Carolina
        '252': 'NC', '336': 'NC', '704': 'NC', '743': 'NC', '828': 'NC', '910': 'NC',
        '919': 'NC', '980': 'NC', '984': 'NC',

        // Virginia
        '276': 'VA', '434': 'VA', '540': 'VA', '571': 'VA', '703': 'VA', '757': 'VA',
        '804': 'VA',

        // Washington
        '206': 'WA', '253': 'WA', '360': 'WA', '425': 'WA', '509': 'WA', '564': 'WA',

        // Oregon
        '458': 'OR', '503': 'OR', '541': 'OR', '971': 'OR',

        // Colorado
        '303': 'CO', '719': 'CO', '720': 'CO', '970': 'CO',

        // Arizona
        '480': 'AZ', '520': 'AZ', '602': 'AZ', '623': 'AZ', '928': 'AZ',

        // Nevada
        '702': 'NV', '725': 'NV', '775': 'NV',

        // Utah
        '385': 'UT', '435': 'UT', '801': 'UT',

        // Idaho
        '208': 'ID', '986': 'ID',

        // Montana
        '406': 'MT',

        // Wyoming
        '307': 'WY',

        // South Dakota
        '605': 'SD'
      };
      
      const state = areaCodeToState[areaCode] || 'Unknown';
      
      if (!numbersByState[state]) {
        numbersByState[state] = [];
      }
      numbersByState[state].push({
        number: phoneNumber,
        areaCode: areaCode,
        friendlyName: number.friendlyName || 'No name',
        region: number.region || 'Unknown',
        locality: number.locality || 'Unknown'
      });
    });
    
    // Display results
    Object.keys(numbersByState).sort().forEach(state => {
      const numbers = numbersByState[state];
      console.log(`📍 ${state} (${numbers.length} number${numbers.length > 1 ? 's' : ''}):`);
      numbers.forEach(num => {
        console.log(`   ${num.number} - ${num.friendlyName} (${num.region}, ${num.locality})`);
      });
      console.log('');
    });
    
    // Summary
    console.log('📊 Summary:');
    console.log(`Total numbers: ${incomingPhoneNumbers.length}`);
    console.log(`States covered: ${Object.keys(numbersByState).filter(s => s !== 'Unknown').length}`);
    console.log(`Unknown area codes: ${numbersByState['Unknown'] ? numbersByState['Unknown'].length : 0}`);
    
    if (numbersByState['Unknown']) {
      console.log('\n❓ Unknown area codes:');
      numbersByState['Unknown'].forEach(num => {
        console.log(`   ${num.number} (${num.areaCode})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error fetching Twilio numbers:', error);
  }
}

checkTwilioNumbers(); 