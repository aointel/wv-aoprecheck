/**
 * Service for mapping database field names to clean display names
 */

// Mapping of database field names to user-friendly display names
export const FIELD_DISPLAY_NAMES: Record<string, string> = {
  // Basic fields
  'Date': 'Date',
  'Time': 'Time',
  'Phone': 'Phone Number',
  'Name': 'Client Name',
  'Duration': 'Call Duration',
  'Persona': 'Lead Type',
  'Recording': 'Recording URL',
  
  // Taalk fields with cleaned names
  'Taalk_PresentationGUID': 'Presentation ID',
  'Taalk_AgentFirstName': 'Agent First Name',
  'Taalk_AgentLastName': 'Agent Last Name',
  'Taalk_AgentAssociateID': 'Agent ID',
  'Taalk_LeadId': 'Lead ID',
  'Taalk_MemberPhone': 'Member Phone',
  'Taalk_MemberFirstName': 'Member First Name',
  'Taalk_OfficeName': 'Office Name',
  'Taalk_WhatHappenedText': 'Call Summary',
  'Taalk_ALP': 'ALP Amount',
  'Taalk_ViewScreenshotURL': 'Screenshot URL',
  'Taalk_LanguageSelected': 'Language'
};

// Reverse mapping for database operations
export const DISPLAY_TO_DB_MAPPING: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_DISPLAY_NAMES).map(([db, display]) => [display, db])
);

/**
 * Convert database field name to display name
 */
export function getDisplayName(dbFieldName: string): string {
  return FIELD_DISPLAY_NAMES[dbFieldName] || dbFieldName;
}

/**
 * Convert display name back to database field name
 */
export function getDbFieldName(displayName: string): string {
  return DISPLAY_TO_DB_MAPPING[displayName] || displayName;
}

/**
 * Get all available fields for CSV template
 */
export function getAvailableFields(): Array<{ dbName: string; displayName: string }> {
  return Object.entries(FIELD_DISPLAY_NAMES).map(([dbName, displayName]) => ({
    dbName,
    displayName
  }));
}

/**
 * Generate a clean CSV template header row
 */
export function generateTemplateHeaders(): string[] {
  return Object.keys(FIELD_DISPLAY_NAMES);
}

/**
 * Process CSV headers for display in the UI
 */
export function processHeadersForDisplay(headers: string[]): Array<{
  original: string;
  display: string;
  mapped: boolean;
}> {
  return headers.map(header => ({
    original: header,
    display: getDisplayName(header),
    mapped: FIELD_DISPLAY_NAMES.hasOwnProperty(header)
  }));
}