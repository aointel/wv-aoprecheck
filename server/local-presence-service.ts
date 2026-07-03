import twilio from 'twilio';
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_API_KEY,
  TWILIO_API_SECRET,
} from './hardcoded-config';

interface TwilioNumber {
  phoneNumber: string;
  friendlyName: string;
  region: string;
  locality: string;
  postalCode: string;
  iso_country: string;
  addressRequirements: string;
}

export class LocalPresenceService {
  private client: twilio.Twilio | null = null;
  private availableNumbers: Map<string, string[]> = new Map();
  private areaCodeNumbers: Map<string, string[]> = new Map();
  private selectionCursor: Map<string, number> = new Map();
  private initialized = false;

  constructor() {
    const accountSid = TWILIO_ACCOUNT_SID;
    const apiKey = TWILIO_API_KEY;
    const apiSecret = TWILIO_API_SECRET;

    if (!accountSid || !apiKey || !apiSecret) {
      console.warn('⚠️ Missing Twilio API credentials for local presence service');
      return;
    }

    this.client = twilio(apiKey, apiSecret, { accountSid });
  }

  // Initialize by fetching all available Twilio numbers
  async initialize(): Promise<void> {
    if (this.initialized || !this.client) {
      console.log('🔄 Local Presence Service already initialized or no client available');
      return;
    }

    try {
      console.log('🔍 Initializing Local Presence Service in background...');
      
      // Large Twilio accounts (hundreds of numbers) can exceed 30s; avoid false timeout + broken catch (TWILIO_AUTH_TOKEN log).
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Initialization timeout')), 120000);
      });

      const initPromise = async () => {
        // Fetch ALL phone numbers without pagination limit
        console.log('📞 Fetching ALL Twilio phone numbers (no limit)...');
        const incomingPhoneNumbers = await this.client!.incomingPhoneNumbers.list(); // NO LIMIT - gets ALL numbers
        
        console.log(`📞 Found ${incomingPhoneNumbers.length} TOTAL Twilio numbers`);
        
        if (incomingPhoneNumbers.length === 0) {
          console.warn('⚠️ No phone numbers found in Twilio account');
          return;
        }

        // Clear existing mappings
        this.availableNumbers.clear();
        this.areaCodeNumbers.clear();
        this.selectionCursor.clear();

        // Process ALL numbers
        let processedCount = 0;
        for (const number of incomingPhoneNumbers) {
          const phoneNumber = number.phoneNumber;
          const state = this.extractStateFromNumber(phoneNumber, 'Unknown');
          
          if (state) {
            if (!this.availableNumbers.has(state)) {
              this.availableNumbers.set(state, []);
            }
            this.availableNumbers.get(state)!.push(phoneNumber);
            processedCount++;
          }

          const areaCode = this.extractAreaCode(phoneNumber);
          if (areaCode) {
            if (!this.areaCodeNumbers.has(areaCode)) {
              this.areaCodeNumbers.set(areaCode, []);
            }
            this.areaCodeNumbers.get(areaCode)!.push(phoneNumber);
          }
        }

        console.log(`✅ Local presence initialized with ${processedCount} numbers across ${this.availableNumbers.size} states`);
        console.log(`📊 Numbers per state: ${Array.from(this.availableNumbers.entries()).map(([state, nums]) => `${state}:${nums.length}`).join(', ')}`);
        this.initialized = true;
      };

      await Promise.race([initPromise(), timeoutPromise]);

    } catch (error) {
      console.error('❌ PRODUCTION ERROR: Failed to initialize local presence service:', error);
      console.error('❌ PRODUCTION ERROR: Twilio credentials check:', {
        hasAccountSid: !!TWILIO_ACCOUNT_SID,
        hasAuthToken: !!TWILIO_AUTH_TOKEN,
        clientInitialized: !!this.client
      });
    }
  }

  // Get best local number for a lead's state
  getLocalNumber(leadState: string, excludeNumber?: string): string {
    console.log(`🔍 LOCAL PRESENCE CHECK: leadState=${leadState}, initialized=${this.initialized}, availableStates=${this.availableNumbers.size}, excludeNumber=${excludeNumber}`);
    
    if (!this.initialized) {
      console.warn('⚠️ Local presence service not initialized, using default number');
      return '+19142289324'; // Your actual Twilio number as fallback
    }

    // Best match: exact lead area-code match first.
    const leadAreaCode = this.extractAreaCode(excludeNumber || '');
    if (leadAreaCode) {
      const areaCodePool = this.areaCodeNumbers.get(leadAreaCode) || [];
      const areaSelected = this.selectNumber(areaCodePool, `ac:${leadAreaCode}`, excludeNumber);
      if (areaSelected) {
        console.log(`🎯 Selected exact area-code number ${areaSelected} for area code ${leadAreaCode}`);
        return areaSelected;
      }
    }

    // Direct state match
    const stateNumbers = this.availableNumbers.get(leadState.toUpperCase());
    if (stateNumbers && stateNumbers.length > 0) {
      console.log(`📍 Found ${stateNumbers.length} ${leadState} numbers: ${stateNumbers.join(', ')}`);

      const selectedNumber = this.selectNumber(stateNumbers, `st:${leadState.toUpperCase()}`, excludeNumber);
      if (selectedNumber) {
        console.log(`🎯 Selected local number ${selectedNumber} for ${leadState} lead (excluded ${excludeNumber})`);
        return selectedNumber;
      } else {
        console.log(`⚠️ All ${leadState} numbers excluded, trying nearby states`);
      }
    } else {
      console.log(`❌ NO NUMBERS FOUND for state ${leadState}! Available states: ${Array.from(this.availableNumbers.keys()).join(', ')}`);
    }

    // Try nearby states based on regions
    const nearbyStates = this.getNearbyStates(leadState);
    for (const nearbyState of nearbyStates) {
      const nearbyNumbers = this.availableNumbers.get(nearbyState);
      if (nearbyNumbers && nearbyNumbers.length > 0) {
        const selectedNumber = this.selectNumber(nearbyNumbers, `nearby:${nearbyState}`, excludeNumber);
        if (selectedNumber) {
          console.log(`🎯 Selected nearby number ${selectedNumber} (${nearbyState}) for ${leadState} lead`);
          return selectedNumber;
        } else {
          console.log(`⚠️ All ${nearbyState} nearby numbers excluded, trying next state`);
        }
      }
    }

    // Last non-default fallback: any number in account pool (still excludes lead phone).
    const allNumbers = Array.from(this.availableNumbers.values()).flat();
    const anySelected = this.selectNumber(allNumbers, 'pool:any', excludeNumber);
    if (anySelected) {
      console.log(`🎯 Selected pooled number ${anySelected} for ${leadState} lead`);
      return anySelected;
    }

    // Fallback to your actual Twilio number
    const defaultNumber = '+19142289324'; // Your verified Twilio number
    console.log(`📞 Using default number ${defaultNumber} for ${leadState} lead (no local presence available)`);
    return defaultNumber;
  }

  private extractAreaCode(phoneNumber: string): string | null {
    const digits = String(phoneNumber || '').replace(/\D/g, '');
    if (digits.length >= 10) {
      return digits.slice(-10, -7);
    }
    return null;
  }

  private normalizeTenDigits(phoneNumber: string): string {
    let digits = String(phoneNumber || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.substring(1);
    }
    return digits.slice(-10);
  }

  private selectNumber(numbers: string[], key: string, excludeNumber?: string): string | null {
    if (!Array.isArray(numbers) || numbers.length === 0) return null;

    const cleanExclude = this.normalizeTenDigits(excludeNumber || '');
    const filtered = numbers.filter((num) => {
      const cleanNum = this.normalizeTenDigits(num);
      const isExcluded = !!cleanExclude && cleanNum === cleanExclude;
      if (isExcluded) {
        console.log(`🚫 Excluding candidate ${num} - matches lead ${excludeNumber}`);
      }
      return !isExcluded;
    });

    if (filtered.length === 0) return null;

    const cursor = this.selectionCursor.get(key) || 0;
    const idx = cursor % filtered.length;
    const selected = filtered[idx];
    this.selectionCursor.set(key, (cursor + 1) % filtered.length);
    return selected;
  }

  // Extract state from phone number area code and region info
  private extractStateFromNumber(phoneNumber: string, region: string): string | null {
    // Area code to state mapping for major US area codes
    const areaCodeToState: { [key: string]: string } = {
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
      '212': 'NY', '315': 'NY', '347': 'NY', '516': 'NY', '518': 'NY', '585': 'NY',
      '607': 'NY', '631': 'NY', '646': 'NY', '680': 'NY', '716': 'NY', '718': 'NY',
      '845': 'NY', '914': 'NY', '917': 'NY', '929': 'NY',

      // Illinois
      '217': 'IL', '224': 'IL', '309': 'IL', '312': 'IL', '331': 'IL', '618': 'IL',
      '630': 'IL', '708': 'IL', '773': 'IL', '779': 'IL', '815': 'IL', '847': 'IL',
      '872': 'IL',

      // Pennsylvania
      '215': 'PA', '267': 'PA', '272': 'PA', '412': 'PA', '484': 'PA', '570': 'PA',
      '610': 'PA', '717': 'PA', '724': 'PA', '814': 'PA', '878': 'PA',

      // Ohio
      '216': 'OH', '220': 'OH', '234': 'OH', '330': 'OH', '380': 'OH', '419': 'OH',
      '440': 'OH', '513': 'OH', '567': 'OH', '614': 'OH', '740': 'OH', '937': 'OH',

      // Michigan
      '231': 'MI', '248': 'MI', '269': 'MI', '313': 'MI', '517': 'MI', '586': 'MI',
      '616': 'MI', '679': 'MI', '734': 'MI', '810': 'MI', '906': 'MI', '947': 'MI',

      // Georgia
      '229': 'GA', '404': 'GA', '470': 'GA', '478': 'GA', '678': 'GA', '706': 'GA',
      '762': 'GA', '770': 'GA', '912': 'GA',

      // North Carolina
      '252': 'NC', '336': 'NC', '704': 'NC', '743': 'NC', '828': 'NC', '910': 'NC',
      '919': 'NC', '980': 'NC', '984': 'NC',

      // New Jersey
      '201': 'NJ', '551': 'NJ', '609': 'NJ', '732': 'NJ', '848': 'NJ', '856': 'NJ',
      '862': 'NJ', '908': 'NJ', '973': 'NJ',

      // Virginia
      '276': 'VA', '434': 'VA', '540': 'VA', '571': 'VA', '703': 'VA', '757': 'VA', '804': 'VA',

      // Washington
      '206': 'WA', '253': 'WA', '360': 'WA', '425': 'WA', '509': 'WA', '564': 'WA',

      // Massachusetts
      '339': 'MA', '351': 'MA', '413': 'MA', '508': 'MA', '617': 'MA', '774': 'MA', '781': 'MA', '857': 'MA', '978': 'MA',

      // Tennessee
      '423': 'TN', '615': 'TN', '629': 'TN', '731': 'TN', '865': 'TN', '901': 'TN', '931': 'TN',

      // Indiana
      '219': 'IN', '260': 'IN', '317': 'IN', '463': 'IN', '574': 'IN', '765': 'IN', '812': 'IN', '930': 'IN',

      // Arizona
      '480': 'AZ', '520': 'AZ', '602': 'AZ', '623': 'AZ', '928': 'AZ',

      // Missouri
      '314': 'MO', '417': 'MO', '573': 'MO', '636': 'MO', '660': 'MO', '816': 'MO',

      // Maryland
      '240': 'MD', '301': 'MD', '410': 'MD', '443': 'MD', '667': 'MD',

      // Wisconsin
      '262': 'WI', '414': 'WI', '534': 'WI', '608': 'WI', '715': 'WI', '920': 'WI',

      // Minnesota
      '218': 'MN', '320': 'MN', '507': 'MN', '612': 'MN', '651': 'MN', '763': 'MN', '952': 'MN',

      // Colorado
      '303': 'CO', '719': 'CO', '720': 'CO', '970': 'CO',

      // Alabama
      '205': 'AL', '251': 'AL', '256': 'AL', '334': 'AL', '659': 'AL', '938': 'AL',

      // Louisiana
      '225': 'LA', '318': 'LA', '337': 'LA', '504': 'LA', '985': 'LA',

      // Kentucky
      '270': 'KY', '364': 'KY', '502': 'KY', '606': 'KY', '859': 'KY',

      // Oregon
      '458': 'OR', '503': 'OR', '541': 'OR', '971': 'OR',

      // Oklahoma
      '405': 'OK', '539': 'OK', '580': 'OK', '918': 'OK',

      // Connecticut
      '203': 'CT', '475': 'CT', '860': 'CT', '959': 'CT',

      // Iowa
      '319': 'IA', '515': 'IA', '563': 'IA', '641': 'IA', '712': 'IA',

      // Arkansas
      '479': 'AR', '501': 'AR', '870': 'AR',

      // Mississippi
      '228': 'MS', '601': 'MS', '662': 'MS', '769': 'MS',

      // Kansas
      '316': 'KS', '620': 'KS', '785': 'KS', '913': 'KS',

      // Utah
      '385': 'UT', '435': 'UT', '801': 'UT',

      // Nevada
      '702': 'NV', '725': 'NV', '775': 'NV',

      // New Mexico
      '505': 'NM', '575': 'NM',

      // Nebraska
      '308': 'NE', '402': 'NE', '531': 'NE',

      // West Virginia
      '304': 'WV', '681': 'WV',

      // Idaho
      '208': 'ID', '986': 'ID',

      // Hawaii
      '808': 'HI',

      // Maine
      '207': 'ME',

      // New Hampshire
      '603': 'NH',

      // Vermont
      '802': 'VT',

      // Rhode Island
      '401': 'RI',

      // Montana
      '406': 'MT',

      // Delaware
      '302': 'DE',

      // South Dakota
      '605': 'SD',

      // North Dakota
      '701': 'ND',

      // Alaska
      '907': 'AK',

      // Wyoming
      '307': 'WY',

      // District of Columbia
      '202': 'DC'
    };

    // Extract area code from phone number
    const areaCodeMatch = phoneNumber.match(/\+1(\d{3})/);
    if (areaCodeMatch) {
      const areaCode = areaCodeMatch[1];
      const state = areaCodeToState[areaCode];
      if (state) {
        return state;
      }
    }

    // Try to extract from region string
    const regionUpper = region.toUpperCase();
    const stateAbbreviations = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'];
    
    for (const state of stateAbbreviations) {
      if (regionUpper.includes(state)) {
        return state;
      }
    }

    return null;
  }

  // Get nearby states for fallback
  private getNearbyStates(state: string): string[] {
    const stateRegions: { [key: string]: string[] } = {
      // West Coast
      'CA': ['NV', 'AZ', 'OR', 'WA'],
      'OR': ['CA', 'WA', 'ID', 'NV'],
      'WA': ['OR', 'ID', 'CA'],

      // Southwest
      'AZ': ['CA', 'NV', 'UT', 'CO', 'NM', 'TX'],
      'NV': ['CA', 'AZ', 'UT', 'ID', 'OR'],
      'UT': ['AZ', 'CO', 'NV', 'ID', 'WY'],
      'NM': ['AZ', 'CO', 'TX', 'OK'],

      // Texas
      'TX': ['OK', 'AR', 'LA', 'NM'],

      // Southeast
      'FL': ['GA', 'AL'],
      'GA': ['FL', 'AL', 'TN', 'NC', 'SC'],
      'AL': ['GA', 'FL', 'TN', 'MS'],
      'SC': ['NC', 'GA'],
      'NC': ['SC', 'GA', 'TN', 'VA'],
      'TN': ['GA', 'AL', 'MS', 'AR', 'MO', 'KY', 'VA', 'NC'],

      // Northeast
      'NY': ['NJ', 'CT', 'PA', 'VT', 'MA'],
      'NJ': ['NY', 'PA', 'DE'],
      'PA': ['NY', 'NJ', 'DE', 'MD', 'WV', 'OH'],
      'CT': ['NY', 'MA', 'RI'],
      'MA': ['CT', 'RI', 'VT', 'NH', 'NY'],

      // Midwest
      'IL': ['IN', 'WI', 'IA', 'MO'],
      'IN': ['IL', 'OH', 'MI', 'KY'],
      'OH': ['PA', 'WV', 'KY', 'IN', 'MI'],
      'MI': ['OH', 'IN', 'WI'],
      'WI': ['MI', 'IL', 'IA', 'MN'],
      'MN': ['WI', 'IA', 'SD', 'ND'],
      'IA': ['MN', 'WI', 'IL', 'MO', 'SD', 'NE'],
      'MO': ['IA', 'IL', 'KY', 'TN', 'AR', 'OK', 'KS', 'NE'],

      // Mountain
      'CO': ['NM', 'OK', 'KS', 'NE', 'WY', 'UT'],
      'WY': ['CO', 'NE', 'SD', 'MT', 'ID', 'UT'],
      'MT': ['WY', 'SD', 'ND', 'ID'],
      'ID': ['MT', 'WY', 'UT', 'NV', 'OR', 'WA'],

      // Plains
      'KS': ['CO', 'OK', 'MO', 'NE'],
      'NE': ['KS', 'MO', 'IA', 'SD', 'WY', 'CO'],
      'SD': ['NE', 'IA', 'MN', 'ND', 'WY', 'MT'],
      'ND': ['SD', 'MN', 'MT'],

      // South
      'LA': ['TX', 'AR', 'MS'],
      'AR': ['LA', 'TX', 'OK', 'MO', 'TN', 'MS'],
      'MS': ['LA', 'AR', 'TN', 'AL'],
      'KY': ['TN', 'VA', 'WV', 'OH', 'IN', 'IL', 'MO'],
      'WV': ['PA', 'MD', 'VA', 'KY', 'OH'],
      'VA': ['WV', 'MD', 'DC', 'NC', 'TN', 'KY'],
      'MD': ['PA', 'WV', 'VA', 'DC', 'DE'],
      'DE': ['MD', 'PA', 'NJ'],
      'DC': ['MD', 'VA'],

      // New England
      'VT': ['NH', 'MA', 'NY'],
      'NH': ['VT', 'MA', 'ME'],
      'ME': ['NH'],
      'RI': ['CT', 'MA'],
      
      // Alaska and Hawaii (isolated)
      'AK': ['WA'], // Closest mainland state
      'HI': ['CA']  // Closest mainland state
    };

    return stateRegions[state.toUpperCase()] || [];
  }

  // Get available states
  getAvailableStates(): string[] {
    return Array.from(this.availableNumbers.keys());
  }

  // Get number count for a state
  getStateNumberCount(state: string): number {
    const numbers = this.availableNumbers.get(state.toUpperCase());
    return numbers ? numbers.length : 0;
  }

  // Get initialization status
  isInitialized(): boolean {
    return this.initialized;
  }

  // Force re-initialization (for production debugging)
  async forceReinitialize(): Promise<void> {
    console.log('🔄 PRODUCTION: Force re-initializing local presence service...');
    this.initialized = false;
    this.availableNumbers.clear();
    await this.initialize();
  }

  // Get diagnostic info for production debugging
  getDiagnosticInfo(): any {
    return {
      initialized: this.initialized,
      hasClient: !!this.client,
      stateCount: this.availableNumbers.size,
      areaCodeCount: this.areaCodeNumbers.size,
      availableStates: this.getAvailableStates(),
      sampleNumbers: Array.from(this.availableNumbers.entries()).slice(0, 5).map(([state, numbers]) => ({
        state,
        count: numbers.length,
        sample: numbers[0]
      }))
    };
  }
}

export const localPresenceService = new LocalPresenceService();