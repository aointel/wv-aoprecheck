import { InsertCall } from '@shared/schema';

// Define the expected CSV column mappings for quality tracker data
export interface CSVFieldMapping {
  // Required fields for call identification
  taalkUID?: string;
  recordingId?: string;
  
  // Date and time fields
  date?: string;
  time?: string;
  callDate?: string;
  
  // Contact information
  phone?: string;
  clientPhone?: string;
  homePhone?: string;
  firstName?: string;
  lastName?: string;
  clientFirstName?: string;
  clientLastName?: string;
  name?: string;
  
  // Financial information
  monthlyPremium?: string;
  premium?: string;
  
  // Agent information
  agentName?: string;
  agentFirstName?: string;
  agentLastName?: string;
  pickedBy?: string;
  
  // Office/Location information
  office?: string;
  location?: string;
  branch?: string;
  
  // Call details
  duration?: string;
  callDuration?: string;
  voicemail?: string;
  transferred?: string;
  transferStatus?: string;
  
  // Quality tracking fields
  status?: string;
  persona?: string;
  notes?: string;
  
  // Recording information
  recording?: string;
  recordingUrl?: string;
  
  // Additional metadata
  sms?: string;
  clicked?: string;
  transferDelay?: string;
  durationAfterTransfer?: string;
}

// Common CSV header variations and their mappings - aligned with Taalk CSV structure
export const HEADER_MAPPINGS: Record<string, keyof CSVFieldMapping> = {
  // Date/Time variations
  'date': 'date',
  'time': 'time',
  'call_date': 'callDate',
  'calldate': 'callDate',
  'call_time': 'time',
  'calltime': 'time',
  
  // Phone variations
  'phone': 'phone',
  'phone_number': 'phone',
  'phonenumber': 'phone',
  'client_phone': 'clientPhone',
  'clientphone': 'clientPhone',
  'home_phone': 'homePhone',
  'homephone': 'homePhone',
  'taalk_clienthomep': 'homePhone',
  'taalk_memberphone': 'clientPhone',
  'taalk_memberemail': 'notes', // Store email in notes for now
  
  // Name variations - prioritizing Taalk fields
  'name': 'name',
  'taalk_memberfirstname': 'firstName',
  'taalk_primaryfirstname': 'firstName',
  'taalk_memberlastname': 'lastName',
  'first_name': 'firstName',
  'firstname': 'firstName',
  'last_name': 'lastName',
  'lastname': 'lastName',
  'client_first_name': 'clientFirstName',
  'clientfirstname': 'clientFirstName',
  'client_last_name': 'clientLastName',
  'clientlastname': 'clientLastName',
  'client_name': 'name',
  'clientname': 'name',
  
  // Premium variations
  'taalk_monthlypremium': 'monthlyPremium',
  'taalk_alp': 'premium',
  'monthly_premium': 'monthlyPremium',
  'monthlypremium': 'monthlyPremium',
  'premium': 'premium',
  
  // Agent variations - Taalk specific
  'taalk_agentfirstname': 'agentFirstName',
  'taalk_agentlastname': 'agentLastName',
  'taalk_agentassociateid': 'notes', // Store agent ID in notes
  'agent_name': 'agentName',
  'agentname': 'agentName',
  'agent_first_name': 'agentFirstName',
  'agentfirstname': 'agentFirstName',
  'agent_last_name': 'agentLastName',
  'agentlastname': 'agentLastName',
  
  // Duration variations
  'duration': 'duration',
  'call_duration': 'callDuration',
  'callduration': 'callDuration',
  

  
  // Recording variations
  'recording': 'recording',
  'recording_url': 'recordingUrl',
  'recordingurl': 'recordingUrl',
  'recording_id': 'recordingId',
  'recordingid': 'recordingId',
  'taalkuid': 'taalkUID',
  'taalk_uid': 'taalkUID',
  
  // Taalk specific tracking fields
  'persona': 'persona',
  'taalk_presentationguid': 'notes', // Store presentation GUID in notes
  'taalk_leadid': 'notes', // Store lead ID in notes
  'taalk_officename': 'office', // Map office name to office field
  'taalk_whathappenedtext': 'notes', // Store what happened text in notes
  'taalk_languageselected': 'notes', // Store language in notes
  'taalk_viewscreenshoturl': 'notes', // Store screenshot URL in notes for now
  
  // Status and quality fields
  'status': 'status',
  'call_status': 'status',
  'callstatus': 'status',
  'notes': 'notes',
  'call_notes': 'notes',
  'callnotes': 'notes',
};

/**
 * Parse CSV headers and create a mapping to our field structure
 */
export function parseCSVHeaders(headers: string[]): Record<string, keyof CSVFieldMapping> {
  const mapping: Record<string, keyof CSVFieldMapping> = {};
  
  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    const mappedField = HEADER_MAPPINGS[normalizedHeader];
    
    if (mappedField) {
      mapping[header] = mappedField;
    }
  }
  
  return mapping;
}

/**
 * Convert a CSV row to a Call record using the field mapping
 */
export function mapCSVRowToCall(
  row: Record<string, string>,
  headerMapping: Record<string, keyof CSVFieldMapping>
): Partial<InsertCall> {
  const mappedData: CSVFieldMapping = {};
  
  // Map the CSV row data using our header mapping
  for (const [csvHeader, value] of Object.entries(row)) {
    const fieldName = headerMapping[csvHeader];
    if (fieldName && value && value.trim()) {
      mappedData[fieldName] = value.trim();
    }
  }
  
  // Generate TaalkUID if not provided
  const taalkUID = mappedData.taalkUID || 
                   mappedData.recordingId || 
                   `CSV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  // Parse date and time
  let callDate: Date | null = null;
  
  // Get raw date and time from the CSV row - use direct access first
  const rawDate = row['Date'] || mappedData.date;
  const rawTime = row['Time'] || mappedData.time;
  
  if (mappedData.callDate) {
    callDate = new Date(mappedData.callDate);
  } else if (rawDate && rawTime) {
    try {
      // Create a simple date string that JavaScript can parse
      // Convert "6/1/2025" + "7:54:41 PM" to a parseable format
      const dateTimeString = `${rawDate} ${rawTime}`;
      callDate = new Date(dateTimeString);
      
      // If that fails, try manual parsing
      if (isNaN(callDate.getTime())) {
        const dateParts = rawDate.split('/');
        if (dateParts.length === 3) {
          // MM/DD/YYYY format
          const month = parseInt(dateParts[0]) - 1; // JavaScript months are 0-based
          const day = parseInt(dateParts[1]);
          const year = parseInt(dateParts[2]);
          
          // Parse time manually
          let timeStr = rawTime.trim();
          const isPM = timeStr.toUpperCase().includes('PM');
          timeStr = timeStr.replace(/\s*(AM|PM)/i, '').trim();
          const timeParts = timeStr.split(':');
          let hours = parseInt(timeParts[0]);
          const minutes = parseInt(timeParts[1]);
          const seconds = parseInt(timeParts[2] || '0');
          
          // Convert to 24-hour format
          if (isPM && hours !== 12) {
            hours += 12;
          } else if (!isPM && hours === 12) {
            hours = 0;
          }
          
          // Create date object
          callDate = new Date(year, month, day, hours, minutes, seconds);
        }
      }
      
      // Final validation
      if (isNaN(callDate.getTime())) {
        callDate = null;
      }
    } catch (error) {
      callDate = null;
    }
  }
  
  // Determine phone number priority: homePhone > clientPhone > phone
  const phone = mappedData.homePhone || mappedData.clientPhone || mappedData.phone || '';
  
  // Determine name fields - prioritize Member names from Taalk CSV
  const firstName = row['Taalk_MemberFirstName'] || mappedData.clientFirstName || mappedData.firstName || '';
  const lastName = row['Taalk_MemberLastName'] || mappedData.clientLastName || mappedData.lastName || '';
  
  // Handle full name if individual names not available
  if (!firstName && !lastName && mappedData.name) {
    const nameParts = mappedData.name.split(' ');
    const parsedFirstName = nameParts[0] || '';
    const parsedLastName = nameParts.slice(1).join(' ') || '';
    
    return createCallRecord(taalkUID, phone, parsedFirstName, parsedLastName, mappedData, callDate, row);
  }
  
  return createCallRecord(taalkUID, phone, firstName, lastName, mappedData, callDate, row);
}

/**
 * Create a standardized call record
 */
function createCallRecord(
  taalkUID: string,
  phone: string,
  firstName: string,
  lastName: string,
  mappedData: CSVFieldMapping,
  callDate: Date | null,
  row: Record<string, string>
): Partial<InsertCall> {
  // Determine agent name
  const agentName = mappedData.agentName || 
                   (mappedData.agentFirstName && mappedData.agentLastName 
                     ? `${mappedData.agentFirstName} ${mappedData.agentLastName}`.trim()
                     : mappedData.pickedBy) || 
                   'Unknown Agent';
  
  // Premium handling
  const monthlyPremium = mappedData.monthlyPremium || mappedData.premium || '0.00';
  
  // Status determination
  const status = mappedData.status || 'pending';
  
  // Recording URL
  const recordingUrl = mappedData.recordingUrl || mappedData.recording || null;
  
  // Duration
  const callDuration = mappedData.callDuration || mappedData.duration || null;
  
  // Notes compilation - capture essential Taalk metadata only
  const notesParts = [];
  if (mappedData.notes) notesParts.push(mappedData.notes);
  if (mappedData.persona) notesParts.push(`Persona: ${mappedData.persona}`);
  
  // Extract office information for hierarchy system
  const office = mappedData.office || 
                 mappedData.location || 
                 mappedData.branch ||
                 row['Taalk_OfficeName'] || 
                 row['Office Name'] || 
                 row['office_name'] || 
                 row['Office'] ||
                 null;
  
  // Add other metadata
  const leadId = row['Taalk_LeadId'] || row['Lead ID'] || row['lead_id'];
  if (leadId && leadId.trim()) {
    notesParts.push(`Lead ID: ${leadId.trim()}`);
  }
  
  const presentationGUID = row['Taalk_PresentationGUID'] || row['Presentation GUID'] || row['presentation_guid'];
  if (presentationGUID && presentationGUID.trim()) {
    notesParts.push(`Presentation ID: ${presentationGUID.trim()}`);
  }
  
  const notes = notesParts.length > 0 ? notesParts.join(' | ') : 'Imported from CSV';
  
  return {
    taalkUID,
    phone,
    firstName,
    lastName,
    monthlyPremium,
    agentName,
    status,
    office,
    isFlagged: false,
    flagReason: null,
    callDate,
    recordingUrl,
    callDuration,
    transcriptionText: null,
    screenshotUrl: null,
    teamId: null,
    agentId: null,
    notes
  };
}

/**
 * Validate that required fields are present in the CSV mapping
 */
export function validateCSVMapping(headerMapping: Record<string, keyof CSVFieldMapping>): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const mappedFields = Object.values(headerMapping);
  const requiredFields: (keyof CSVFieldMapping)[] = ['phone'];
  const recommendedFields: (keyof CSVFieldMapping)[] = [
    'firstName', 'lastName', 'name', 'monthlyPremium', 'agentName', 'pickedBy'
  ];
  
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  // Check required fields
  for (const field of requiredFields) {
    if (!mappedFields.includes(field)) {
      missingFields.push(field);
    }
  }
  
  // Check recommended fields
  for (const field of recommendedFields) {
    if (!mappedFields.includes(field)) {
      warnings.push(`Recommended field '${field}' not found in CSV headers`);
    }
  }
  
  // Special validation for name fields
  const hasNameFields = mappedFields.includes('firstName') && mappedFields.includes('lastName');
  const hasFullName = mappedFields.includes('name');
  const hasClientNameFields = mappedFields.includes('clientFirstName') && mappedFields.includes('clientLastName');
  
  if (!hasNameFields && !hasFullName && !hasClientNameFields) {
    warnings.push('No name fields found. Please include firstName/lastName, name, or clientFirstName/clientLastName columns');
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings
  };
}