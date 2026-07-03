console.log("=== Starting app.js ===");

import dotenv from 'dotenv';
dotenv.config({ path: '.env2' });
import axios from 'axios';
import { stringify } from 'csv-stringify/sync';
import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import winston from 'winston';
import path from 'path';
import fetch from 'node-fetch';
import fs from 'fs';

console.log("=== Imports complete ===");

// File paths
const PRODUCER_LIST_FILE = "ZohoUserCreate/ProducerList.csv";
const OUTPUT_FILE = "available_agents_full_data.csv";
const UNMATCHED_FILE = "unmatched_agents.csv";
const ALL_USERS_OUTPUT_FILE = "all_agents_full_data.csv";
const ALL_USERS_UNMATCHED_FILE = "all_unmatched_agents.csv";

// Zoho Credentials
let ZOHO_ACCESS_TOKEN = process.env.ZOHO_ACCESS_TOKEN;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_API_URL = "https://voice.zoho.com/rest/json/zv/api/users";

console.log("=== Variables initialized ===");

// Enhanced logging configuration
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'lead-processing' },
    transports: [
        // API Integration logs
        new winston.transports.File({ 
            filename: path.join('logs', 'taaalk-api.log'),
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.File({ 
            filename: path.join('logs', 'zoho-api.log'),
            level: 'info'
        }),
        // Error logs with full details
        new winston.transports.File({ 
            filename: path.join('logs', 'error.log'),
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            )
        }),
        // Processing logs
        new winston.transports.File({ 
            filename: path.join('logs', 'processing.log'),
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message, ...metadata }) => {
                    return `${timestamp} [${level}]: ${message} ${Object.keys(metadata).length ? JSON.stringify(metadata, null, 2) : ''}`;
                })
            )
        }),
        // Console output for development
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Add logging functions
function logApiCall(api, operation, details) {
    logger.info(`${api} API Call`, {
        operation,
        ...details,
        timestamp: new Date().toISOString()
    });
}

function logError(error, context) {
    logger.error('Error occurred', {
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code
        },
        context,
        timestamp: new Date().toISOString()
    });
}

function logProcessing(action, details) {
    logger.info(`Processing: ${action}`, {
        ...details,
        timestamp: new Date().toISOString()
    });
}

// Add this at the top to debug
console.log("Checking env variables:");
console.log("ZOHO_REFRESH_TOKEN:", process.env.ZOHO_REFRESH_TOKEN);
console.log("ZOHO_CLIENT_ID:", process.env.ZOHO_CLIENT_ID);
console.log("ZOHO_CLIENT_SECRET:", process.env.ZOHO_CLIENT_SECRET);

// Add at the top with other imports
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Update refreshZohoAccessToken with longer delay
async function refreshZohoAccessToken(retries = 3, delay = 60000) { // 1 minute delay
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`\n=== Refreshing Zoho Token (Attempt ${attempt}/${retries}) ===`);
            
            const tokenUrl = "https://accounts.zoho.com/oauth/v2/token";
            const params = new URLSearchParams({
                refresh_token: ZOHO_REFRESH_TOKEN,
                client_id: process.env.ZOHO_CLIENT_ID,
                client_secret: process.env.ZOHO_CLIENT_SECRET,
                grant_type: "refresh_token"
            });

            console.log("Refreshing token...");
            const response = await axios.post(tokenUrl, params);
            
            if (response.data && response.data.access_token) {
                console.log("Got new access token");
                ZOHO_ACCESS_TOKEN = response.data.access_token;
                return response.data.access_token;
            }
            throw new Error("Failed to get access token");
        } catch (error) {
            if (error.response?.data?.error === 'Access Denied' && 
                error.response?.data?.error_description?.includes('too many requests')) {
                console.log("\nHit Zoho rate limit - waiting 1 minute before retry...");
                if (attempt < retries) {
                    await sleep(delay);
                    continue;
                }
                console.error("Still rate limited after all retries. Please wait 5-10 minutes before trying again.");
            }
            console.error("Token refresh error:", error.response?.data || error);
            throw error;
        }
    }
}

// Function to fetch available users from Zoho
async function fetchAvailableZohoUsers() {
    try {
        await refreshZohoAccessToken();
        console.log("Token refreshed, making API request...");
        
        let allUsers = [];
        let from = 0;
        const offset = 50;
        
        while (true) {
            const response = await axios.get(ZOHO_API_URL, {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${ZOHO_ACCESS_TOKEN}`,
                    'Accept': 'application/json'
                },
                params: {
                    from: from,
                    offset: offset,
                    status: 1,  // Active users
                    onlineStatus: 'Available'  // Only available agents
                }
            });

            if (!response.data || !response.data.users) break;
            
            allUsers = allUsers.concat(response.data.users);
            
            if (response.data.users.length < offset) break;
            from += offset;
        }

        console.log(`Found ${allUsers.length} available agents`);
        return allUsers;

    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

// Function to load CSV data
function loadCSV(filePath) {
    try {
        console.log(`Loading data from ${filePath} (RAW mode)...`);
        const fileContent = readFileSync(filePath, "utf8");

        // 1) Read EVERYTHING in each line as an array of fields
        const recordsRaw = parse(fileContent, {
            columns: false,
            skip_empty_lines: true,
            relax_column_count: true,
            relax_quotes: true,
            trim: false,                 // turn off trimming
            bom: true,
            delimiter: ',',              // normal CSV
            quote: '"',                  // normal quotes
            allow_quoted_line_breaks: true
        });

        console.log(`[DEBUG] Got ${recordsRaw.length} rows in RAW array mode.`);
        // Show first row fully
        if (recordsRaw.length > 0) {
            console.log("First row (raw array of fields):", recordsRaw[0]);
        }

        // 2) Also parse them with columns: true, if you still want named columns
        //    You can keep or remove this step depending on what you want.
        const recordsParsed = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
            relax_quotes: true,
            trim: true,
            bom: true
        });

        console.log(`[DEBUG] Got ${recordsParsed.length} rows in PARSED mode (columns).`);
        // Show first row
        if (recordsParsed.length > 0) {
            console.log("First parsed row (named columns):", recordsParsed[0]);
        }

        // Return whichever you want: 
        // - If you truly only want raw lines, return recordsRaw
        // - If you still want columns, stick to recordsParsed
        // For debugging, let's return the raw arrays so we see everything:
        return recordsRaw;

    } catch (error) {
        console.error(`Failed to load ${filePath}:`, error.message);
        throw error;
    }
}

// Helper function to deduplicate states
function deduplicateStates(stateString) {
    if (!stateString) return '';
    
    // Split states, filter unique values, and sort
    const uniqueStates = [...new Set(stateString.split(',')
        .map(state => state.trim())
        .filter(state => state.length > 0))]
        .sort();
    
    return uniqueStates.join(', ');
}

// Log state data with deduplication
function logStateData(email, id, name, states) {
    const cleanedStates = deduplicateStates(states);
    
    logger.info('Processing state data', {
        email,
        id,
        name,
        states: cleanedStates,
        stateCount: cleanedStates.split(',').length,
        timestamp: new Date().toISOString()
    });
}

/**
 * Return all 2-letter uppercase abbreviations found in the entire row's text
 * WITHOUT deduplicating or sorting. Just raw matches in the order found.
 */
function extractStateAbbreviations(producerData) {
    // Convert row object to a string
    const rowString = JSON.stringify(producerData);

    // Find all 2-letter, uppercase sequences (e.g. "AL", "GA", "TX", etc.)
    // We'll not deduplicate or sort them, just keep them as-is.
    const matches = rowString.match(/\b[A-Z]{2}\b/g) || [];
    return matches;  // no dedup, no sort
}

// Function to combine available agents with ProducerList
function combineData(availableAgents, producerList) {
    const combined = [];
    const unmatched = [];

    availableAgents.forEach(agent => {
        // Extract the Associate ID from braces in agent.name
        const associateIdMatch = agent.name?.match(/\{(\d+)\}/);
        const associateId = associateIdMatch ? associateIdMatch[1].trim() : null;

        // Only match by Associate ID - remove email fallback
        let producerData = null;
        if (associateId) {
            producerData = producerList.find(
                p => p["Associate ID"]?.toString().trim() === associateId
            );
        }

        // If not found, do nothing else - no email approach
        if (producerData) {
            // existing logic to assemble "Total States" or abbreviations
            const totalStates = producerData["Life-and-Health Licensed States"] || "";
            combined.push({
                ID: agent.emailid || "",
                "Agent Name": agent.name || "",
                "Associate ID": associateId || "",
                "Total States": totalStates,
                "Online Status": agent.onlineStatus || ""
            });
        } else {
            unmatched.push(agent);
        }
    });

    saveDataToCSV(unmatched, UNMATCHED_FILE);
    return combined;
}

// Function to combine all users data with ProducerList
function combineAllUsersData(allUsers, producerList) {
    const combined = [];

    allUsers.forEach(agent => {
        // Only keep "Available" agents
        if (agent.onlineStatus !== 'Available') {
            return;
        }

        // Parse Associate ID {123232} from braces if present
        const idMatch = agent.name?.match(/\{(\d+)/);
        const associateId = idMatch ? idMatch[1] : null;

        // Only match by that Associate ID, no email fallback
        let producerData = null;
        if (associateId) {
            producerData = producerList.find(
                p => String(p["Associate ID"] || "").trim() === associateId
            );
        }

        if (producerData) {
            // existing logic to assemble total states, etc.
            const totalStates = producerData["Life-and-Health Licensed States"] || "";
            combined.push({
                "Agent Name": agent.name || "",
                "Designated Market": producerData["Designated Market"] || "",
                "Total States": totalStates,
                "Online Status": agent.onlineStatus || "",
                "Agent Status": agent.status || "",
                "Department": agent.departmentName || "",
                "MGA": producerData["MGA"] || "",
                "RGA": producerData["RGA"] || ""
            });
        }
    });

    saveDataToCSV(combined, OUTPUT_FILE);
    console.log(`Saved ${combined.length} available agents to ${OUTPUT_FILE}`);
    return combined;
}

// Function to save data to CSV
function saveDataToCSV(data, filename) {
    try {
        // Convert to CSV string
        const output = stringify(data, { header: true });
        
        // Write file synchronously
        writeFileSync(filename, output);

        // Verify file was written
        const exists = fs.existsSync(filename);
        const size = fs.statSync(filename).size;

        console.log(`Saved ${data.length} records to ${filename} (${size} bytes)`);

        // If the file doesn't exist at all, that is a real error:
        if (!exists) {
            throw new Error(`Failed to write ${filename} (file does not exist)`);
        }
        
        // If it's 0 bytes, we just warn instead of throwing
        if (size === 0) {
            console.warn(`Warning: ${filename} is 0 bytes. Possibly no matching records?`);
        }
    } catch (error) {
        console.error(`Error saving ${filename}:`, error);
        throw error; // Re-throw to stop execution if file write fails from another issue
    }
}

// Function to fetch ALL Zoho users without filtering
async function fetchAllZohoUsers() {
    try {
        const accessToken = await refreshZohoAccessToken();
        console.log("Got access token:", accessToken.substring(0, 20) + "...");
        
        let allUsers = [];
        let from = 0;
        const offset = 50;
        
        while (true) {
            console.log(`Fetching users ${from} to ${from + offset}...`);
            const response = await axios.get('https://voice.zoho.com/rest/json/zv/api/users', {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${accessToken}`,  // Use the token we just got
                    'Accept': 'application/json'
                },
                params: {
                    from,
                    offset,
                    sortBy: 'NAME'
                }
            });

            if (!response.data || !response.data.users) {
                console.log("No more users found");
                break;
            }

            console.log(`Got ${response.data.users.length} users`);
            allUsers = allUsers.concat(response.data.users);
            
            if (response.data.users.length < offset) break;
            from += offset;
        }

        return allUsers;
    } catch (error) {
        console.error('Error fetching users:', error.response?.data || error);
        throw error;
    }
}

// Export both functions properly
async function processAllUsers() {
    try {
        console.log("\n=== Starting Agent Sync Process ===");

        // Step 1: Fetch ALL agents from Zoho
        console.log("\n1. Fetching agents from Zoho...");
        const allUsers = await fetchAllZohoUsers();
        console.log(`Found ${allUsers.length} total Zoho users`);
        if (allUsers.length > 0) {
            console.log("Sample user:", allUsers[0]);
        }

        // Step 2: Load ProducerList
        console.log("\n2. Loading ProducerList...");
        const producerList = loadCSV(PRODUCER_LIST_FILE);
        console.log(`Loaded ${producerList.length} records from ProducerList`);

        // Step 3: Combine data
        console.log("\n3. Matching agents with ProducerList...");
        const combinedData = combineAllUsersData(allUsers, producerList);
        console.log(`Matched ${combinedData.length} agents`);

        // Step 4: Save to CSV
        console.log("\n4. Saving results...");
        saveDataToCSV(combinedData, ALL_USERS_OUTPUT_FILE);

        console.log("\n=== Agent Sync Complete ===");
    } catch (error) {
        console.error("\nERROR:", error);
        throw error;
    }
}

// Change from regular function to exported function
async function getZohoUsers() {
    try {
        const accessToken = await refreshZohoAccessToken();
        console.log("Got access token, fetching users...");
        
        const response = await axios.get('https://voice.zoho.com/rest/json/zv/api/users', {
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Accept': 'application/json'
            },
            params: {
                status: 1,        // 1-Active
                agentStatus: 0,   // 0-Available
                from: 0,          // Starting index
                offset: 50,       // Max records per call
                sortBy: 'NAME'    // Sort by name
            }
        });

        if (response.data && response.data.users) {
            const availableUsers = response.data.users;
            console.log(`Found ${availableUsers.length} available users`);
            console.log("Sample user:", availableUsers[0]);
            return availableUsers;
        } else {
            console.log('API Response:', response.data);
            return [];
        }
    } catch (error) {
        console.error('Error fetching users:', error.response?.data || error);
        throw error;
    }
}

// Export functions as ES modules
export { processAllUsers, getZohoUsers };

console.log("=== Reached bottom of file ===");

async function testTokenRefresh() {
    try {
        console.log("\n=== Testing Token Refresh ===");
        
        // Try refresh with stored token
        const tokenUrl = "https://accounts.zoho.com/oauth/v2/token";
        const params = new URLSearchParams({
            refresh_token: process.env.ZOHO_REFRESH_TOKEN,
            client_id: process.env.ZOHO_CLIENT_ID,
            client_secret: process.env.ZOHO_CLIENT_SECRET,
            grant_type: "refresh_token"
        });

        console.log("Attempting token refresh...");
        const response = await axios.post(tokenUrl, params);
        
        if (response.data && response.data.access_token) {
            console.log("✓ Successfully refreshed token");
            console.log("New access token:", response.data.access_token.substring(0, 20) + "...");
            return true;
        }
        return false;
    } catch (error) {
        console.error("Token refresh failed:", error.response?.data || error);
        return false;
    }
}

if (process.argv[1]?.endsWith('app.js')) {
    console.log("\n=== Testing token refresh first ===");
    testTokenRefresh()
        .then(success => {
            if (success) {
                console.log("Token refresh successful - proceeding with sync");
                return processAllUsers();
            } else {
                throw new Error("Token refresh failed - stopping");
            }
        })
        .then(() => {
            console.log("\n=== app.js complete ===");
        })
        .catch(error => {
            console.error("\nERROR:", error);
            process.exit(1);
        });
} else {
    console.log("=== Not running directly ===", {
        argv1: process.argv[1],
        metaUrl: import.meta.url
    });
}

// Use the existing Zoho functions in app.js instead
async function getAgentsFromZoho() {
    try {
        // Use existing processAllUsers function instead of undefined getAllZohoUsers
        const users = await processAllUsers();
        
        if (!users || !Array.isArray(users)) {
            console.error('No users returned from Zoho or invalid response:', users);
            return [];
        }

        // Filter for TECHNICIAN role
        const agents = users.filter(user => {
            return user && user.zvtRoleName === 'TECHNICIAN';
        });

        console.log(`Found ${agents.length} agents from ${users.length} total users`);
        return agents;

    } catch (error) {
        console.error('Error getting agents from Zoho:', error);
        throw error;
    }
}

// Function to get all agents
export async function getAllAgents() {
    try {
        const zohoAgents = await getAgentsFromZoho();
        
        // Add null check here too
        if (!zohoAgents) {
            console.error('No agents returned from Zoho');
            return [];
        }

        return zohoAgents;
    } catch (error) {
        console.error('Error getting agents:', error);
        throw error;
    }
}
