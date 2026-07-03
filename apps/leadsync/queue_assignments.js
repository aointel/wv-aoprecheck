console.log('Script starting...');

// Catch unhandled rejections first
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
    process.exit(1);
});

console.log('Setting up imports...');

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

console.log('Imports complete');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define paths
const PATHS = {
    tokenFile: join(__dirname, 'ZohoUserCreate', 'zoho_tokens_voice.json'),
    agentsFile: join(__dirname, 'all_agents_full_data.csv'),
    outputFile: join(__dirname, 'ZohoUserCreate', 'queue_mappings.csv')
};

// Add this helper function
function checkFiles() {
    console.log('\nChecking required files:');
    
    const files = [
        { path: PATHS.tokenFile, name: 'Token file' },
        { path: PATHS.agentsFile, name: 'Agents file' }
    ];

    files.forEach(file => {
        const exists = existsSync(file.path);
        console.log(`${file.name} (${file.path}): ${exists ? '✓ exists' : '✗ missing'}`);
        if (!exists) {
            throw new Error(`Required file missing: ${file.path}`);
        }
    });
}

// Main function to run everything
async function main() {
    console.log('Starting script...');
    checkFiles();
    console.log('Current directory:', __dirname);
    console.log('Using paths:', PATHS);

    try {
        // Test file access first
        console.log('\nTesting file access...');
        
        try {
            const tokenData = readFileSync(PATHS.tokenFile, 'utf8');
            const tokens = JSON.parse(tokenData);
            console.log('✓ Token file exists and is valid JSON');
            console.log('Token expires:', tokens.expires_at);
        } catch (err) {
            throw new Error(`Token file error: ${err.message}`);
        }

        try {
            const agentsData = readFileSync(PATHS.agentsFile, 'utf8');
            const firstLine = agentsData.split('\n')[0];
            console.log('✓ Agents file exists');
            console.log('Headers:', firstLine);
        } catch (err) {
            throw new Error(`Agents file error: ${err.message}`);
        }

        console.log('\nStarting queue sync simulation...');
        await simulateQueueSync();

    } catch (error) {
        console.error('\nFATAL ERROR:', error.message);
        if (error.stack) {
            console.error('\nStack trace:', error.stack);
        }
        process.exit(1);
    }
}

// Function to get Zoho queues
async function getZohoQueues() {
    try {
        console.log('\n=== Getting Zoho Queues ===');
        const tokenData = readFileSync(PATHS.tokenFile, 'utf8');
        const tokens = JSON.parse(tokenData);
        console.log('Token loaded successfully');
        
        const url = 'https://voice.zoho.com/rest/json/zv/api/queues';
        console.log('\nMaking request to:', url);
        console.log('Token starts with:', tokens.access_token.substring(0, 30));

        const response = await fetch(url, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${tokens.access_token}`,
                'Accept': 'application/json'
            }
        });

        console.log('\nResponse received:');
        console.log('Status:', response.status);
        console.log('OK:', response.ok);
        
        const data = await response.json();
        console.log('\nResponse data:', JSON.stringify(data, null, 2));
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(data)}`);
        }

        // Check the actual structure
        if (!data || typeof data !== 'object') {
            throw new Error(`Invalid response format - got ${typeof data}`);
        }

        console.log('\nResponse properties:', Object.keys(data));

        // Check if we need to access data differently
        const queues = data.data || data.queues || data.result;
        if (!Array.isArray(queues)) {
            throw new Error(`Could not find queues array in response. Response structure: ${JSON.stringify(data)}`);
        }

        console.log(`\nFound ${queues.length} queues`);
        console.log('First queue:', JSON.stringify(queues[0], null, 2));

        return queues;
    } catch (error) {
        console.error('\nError in getZohoQueues:', error);
        throw error;
    }
}

// Helper to extract state from queue name (e.g., "FL_Market" -> "FL")
function extractStateFromQueueName(queueName) {
    // Handle different formats:
    // "GLOBE-AK", "WB - Alaska", "PAVET-TX", "CQL - PAVET - Florida" etc.
    
    // First try direct state code (e.g., "GLOBE-AK")
    const directMatch = queueName.match(/-([A-Z]{2})$/);
    if (directMatch) return directMatch[1];
    
    // Try full state name (e.g., "WB - Alaska")
    const stateNames = {
        'Alaska': 'AK', 'Alabama': 'AL', 'Arkansas': 'AR', 'Arizona': 'AZ',
        'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
        'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Iowa': 'IA',
        'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Kansas': 'KS',
        'Kentucky': 'KY', 'Louisiana': 'LA', 'Massachusetts': 'MA', 'Maryland': 'MD',
        'Maine': 'ME', 'Michigan': 'MI', 'Minnesota': 'MN', 'Missouri': 'MO',
        'Mississippi': 'MS', 'Montana': 'MT', 'North Carolina': 'NC', 'North Dakota': 'ND',
        'Nebraska': 'NE', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM',
        'Nevada': 'NV', 'New York': 'NY', 'Ohio': 'OH', 'Oklahoma': 'OK',
        'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
        'Virginia': 'VA', 'Vermont': 'VT', 'Washington': 'WA', 'Wisconsin': 'WI',
        'West Virginia': 'WV', 'Wyoming': 'WY'
    };

    for (const [stateName, stateCode] of Object.entries(stateNames)) {
        if (queueName.includes(stateName)) return stateCode;
    }

    return null;
}

// Add these validation functions
function validateQueue(queue) {
    console.log('\nAnalyzing queue:', queue.name);
    
    // Only accept these specific market formats:
    // GLOBE-XX, PAVET-XX, WILLKIT-XX (where XX is state code)
    const validQueueFormat = /^(GLOBE|PAVET|WILLKIT)-[A-Z]{2}$/;
    
    if (!validQueueFormat.test(queue.name)) {
        console.log('Skipping queue - not a main market queue:', queue.name);
        return false;
    }
    
    // Extract market type and state
    const [marketType, stateCode] = queue.name.split('-');
    
    if (!queue.name || !queue.id) {
        console.warn('Missing name or ID');
        return false;
    }

    // Add market type to queue object
    queue.marketType = marketType;
    queue.state = stateCode;
    return true;
}

function validateAgent(agent) {
    if (!agent.ID || !agent['Zoho Agent ID']) {
        console.warn(`Missing ID for agent: ${JSON.stringify(agent)}`);
        return false;
    }
    if (!agent.CombinedStates) {
        console.warn(`No states found for agent: ${agent.ID}`);
        return false;
    }
    return true;
}

function getAgentMarkets(agentRoles) {
    // Extract numbers from role string like "[1:2:3]" -> [1,2,3]
    const roleNumbers = (agentRoles.match(/\[([\d:]+)\]/)?.[1] || '')
        .split(':')
        .map(Number);
    
    // Map role numbers to markets
    const marketMap = {
        1: 'PAVET',    // Changed: 1 -> PAVET
        2: 'GLOBE',    // Kept: 2 -> GLOBE
        3: 'WILLKIT'   // Changed: 3 -> WILLKIT
    };
    
    return roleNumbers.map(num => marketMap[num]).filter(Boolean);
}

async function generateQueueAssignments() {
    try {
        console.log('Starting queue assignment generation...');
        
        // Read agent data
        console.log('Reading all_agents_full_data.csv...');
        const agentData = readFileSync(PATHS.agentsFile, 'utf8');
        console.log('Found all_agents_full_data.csv');

        // Parse the CSV data
        const agents = parse(agentData, {
            columns: true,
            skip_empty_lines: true
        });
        console.log(`Found ${agents.length} agents`);

        console.log('\nFetching Zoho queues...');
        const queues = await getZohoQueues();
        console.log(`Found ${queues.length} queues`);

        const validQueues = queues.filter(validateQueue);
        console.log(`${validQueues.length} of ${queues.length} queues are valid`);

        const validAgents = agents.filter(validateAgent);
        console.log(`${validAgents.length} of ${agents.length} agents are valid`);

        console.log('\nGenerating assignments...');
        const assignments = [];
        let totalAssignments = 0;

        // Add debug logging for first few records
        console.log('\nSample Agent Data:');
        console.log(agents.slice(0, 2));

        console.log('\nSample Queue Data:');
        console.log(queues.slice(0, 2));

        validAgents.forEach(agent => {
            const states = agent.CombinedStates.split(',').map(s => s.trim());
            const agentRoles = agent['Agent Name'].match(/\[(.*?)\]/)?.[1] || '';
            const agentMarkets = getAgentMarkets(agentRoles);
            
            validQueues.forEach(queue => {
                // Check if agent has both:
                // 1. License for the queue's state
                // 2. Role number matching queue's market
                if (queue.state && 
                    states.includes(queue.state) && 
                    agentMarkets.includes(queue.marketType)) {
                    
                    assignments.push({
                        AgentEmail: agent.ID,
                        AgentID: agent['Zoho Agent ID'],
                        AgentName: agent['Agent Name'],
                        QueueName: queue.name,
                        QueueID: queue.groupid,
                        State: queue.state,
                        MarketType: queue.marketType,
                        AgentRoles: agentRoles,
                        Markets: states.join(', ')
                    });
                    totalAssignments++;
                }
            });
        });

        // Group assignments by state for analysis
        const stateAssignments = {};
        assignments.forEach(a => {
            if (!stateAssignments[a.State]) {
                stateAssignments[a.State] = {
                    queues: new Set(),
                    agents: new Set()
                };
            }
            stateAssignments[a.State].queues.add(a.QueueName);
            stateAssignments[a.State].agents.add(a.AgentEmail);
        });

        // Show state coverage
        console.log('\nState Coverage Analysis:');
        Object.entries(stateAssignments).forEach(([state, data]) => {
            console.log(`\nState: ${state}`);
            console.log(`Queues: ${Array.from(data.queues).join(', ')}`);
            console.log(`Agents: ${data.agents.size}`);
        });

        // After generating assignments
        console.log('\nSample Assignments:');
        console.log(assignments.slice(0, 5));

        console.log(`\nGenerated ${totalAssignments} queue assignments`);

        // Save assignments to CSV
        console.log('\nSaving to queue_mappings.csv...');
        const csv = stringify(assignments, { 
            header: true,
            columns: ['AgentEmail', 'AgentID', 'AgentName', 'AgentRoles', 'Markets', 'QueueName', 'QueueID', 'State', 'MarketType']
        });
        writeFileSync(PATHS.outputFile, csv);
        console.log('Queue assignments saved successfully');

        return assignments;
    } catch (error) {
        console.error('Error generating queue assignments:', error);
        throw error;
    }
}

// Add preview function
async function previewQueueAssignments() {
    const assignments = await generateQueueAssignments();
    
    // Group by queue
    const queueSummary = {};
    assignments.forEach(assignment => {
        if (!queueSummary[assignment.QueueName]) {
            queueSummary[assignment.QueueName] = {
                queueId: assignment.QueueID,
                state: assignment.State,
                agentCount: 0,
                agents: []
            };
        }
        queueSummary[assignment.QueueName].agentCount++;
        queueSummary[assignment.QueueName].agents.push({
            name: assignment.AgentName,
            email: assignment.AgentEmail
        });
    });

    // Display summary
    console.log('\nQueue Assignment Preview:');
    console.log('=======================');
    Object.entries(queueSummary).forEach(([queueName, data]) => {
        console.log(`\nQueue: ${queueName}`);
        console.log(`State: ${data.state}`);
        console.log(`Total Agents: ${data.agentCount}`);
        console.log('Agents:', data.agents.map(a => a.name).join(', '));
        console.log('-------------------');
    });
}

// Change how we detect main module
// Remove this line:
// const isMainModule = import.meta.url === `file://${__filename}`;

// Replace with:
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

// Also add debug info
console.log('Process argv[1]:', process.argv[1]);
console.log('This file:', fileURLToPath(import.meta.url));
console.log('Is main module:', isMainModule);

if (isMainModule) {
    console.log('Running as main module...');
    (async () => {
        try {
            await main();
        } catch (error) {
            console.error('Failed to run main:', error);
            process.exit(1);
        }
    })();
} else {
    console.log('Running as imported module');
}

async function simulateQueueSync() {
    try {
        console.log('\n=== Queue Sync Simulation ===');

        // 1. Get current queue state
        console.log('Fetching current queue memberships...');
        const currentQueues = await getZohoQueues();
        console.log(`Raw queues from Zoho: ${currentQueues.length}`);
        
        // Log first few queues
        console.log('Sample queues:', currentQueues.slice(0, 3));
        
        // 2. Filter valid queues
        const validQueues = currentQueues.filter(queue => {
            const isValid = validateQueue(queue);
            if (!isValid) {
                console.log(`Filtered out queue: ${queue.name}`);
            }
            return isValid;
        });
        console.log(`Valid queues after filtering: ${validQueues.length}`);
        
        // 3. Get agent assignments
        console.log('\nGenerating desired assignments...');
        const desiredAssignments = await generateQueueAssignments();
        console.log(`Generated ${desiredAssignments.length} assignments`);
        
        // Log first few assignments
        console.log('Sample assignments:', desiredAssignments.slice(0, 3));

        // 4. Analyze changes by state and market
        const changes = {
            byState: {},
            byMarket: {},
            totalAgents: new Set(),
            totalQueues: new Set()
        };

        // Group desired assignments
        desiredAssignments.forEach(assignment => {
            // Track by state
            if (!changes.byState[assignment.State]) {
                changes.byState[assignment.State] = {
                    queues: new Set(),
                    agents: new Set(),
                    markets: new Set()
                };
            }
            changes.byState[assignment.State].queues.add(assignment.QueueName);
            changes.byState[assignment.State].agents.add(assignment.AgentID);
            changes.byState[assignment.State].markets.add(assignment.MarketType);

            // Track by market
            if (!changes.byMarket[assignment.MarketType]) {
                changes.byMarket[assignment.MarketType] = {
                    queues: new Set(),
                    agents: new Set(),
                    states: new Set()
                };
            }
            changes.byMarket[assignment.MarketType].queues.add(assignment.QueueName);
            changes.byMarket[assignment.MarketType].agents.add(assignment.AgentID);
            changes.byMarket[assignment.MarketType].states.add(assignment.State);

            // Track totals using Zoho Agent ID
            changes.totalAgents.add(assignment.AgentID);
            changes.totalQueues.add(assignment.QueueName);
        });

        // 5. Show summary
        console.log('\n=== Summary of Changes ===');
        console.log(`Total Queues to Update: ${changes.totalQueues.size}`);
        console.log(`Total Agents to Assign: ${changes.totalAgents.size}`);

        // 6. Show state-by-state breakdown
        console.log('\n=== State Coverage ===');
        Object.entries(changes.byState).forEach(([state, data]) => {
            console.log(`\nState: ${state}`);
            console.log(`Queues: ${data.queues.size}`);
            console.log(`Agents: ${data.agents.size}`);
            console.log(`Markets: ${Array.from(data.markets).join(', ')}`);
        });

        // 7. Show market breakdown
        console.log('\n=== Market Coverage ===');
        Object.entries(changes.byMarket).forEach(([market, data]) => {
            console.log(`\nMarket: ${market}`);
            console.log(`Queues: ${data.queues.size}`);
            console.log(`Agents: ${data.agents.size}`);
            console.log(`States: ${Array.from(data.states).join(', ')}`);
        });

        // 8. Show detailed queue changes
        console.log('\n=== Detailed Queue Changes ===');
        for (const queue of currentQueues) {
            const desiredMembers = desiredAssignments
                .filter(a => a.QueueID === queue.id)
                .map(a => a.AgentID);

            const currentMembers = queue.members || [];
            const toAdd = desiredMembers.filter(m => !currentMembers.includes(m));
            const toRemove = currentMembers.filter(m => !desiredMembers.includes(m));

            if (toAdd.length || toRemove.length) {
                console.log(`\nQueue: ${queue.name}`);
                console.log(`Current Members: ${currentMembers.length}`);
                console.log(`Desired Members: ${desiredMembers.length}`);
                console.log(`To Add: ${toAdd.length}`);
                console.log(`To Remove: ${toRemove.length}`);
            }
        }

        // 9. Save simulation results
        const simulationReport = {
            timestamp: new Date().toISOString(),
            summary: {
                totalQueues: changes.totalQueues.size,
                totalAgents: changes.totalAgents.size,
                statesCovered: Object.keys(changes.byState).length,
                marketsCovered: Object.keys(changes.byMarket).length
            },
            stateDetails: Object.fromEntries(
                Object.entries(changes.byState).map(([state, data]) => [
                    state,
                    {
                        queues: Array.from(data.queues),
                        agents: Array.from(data.agents),
                        markets: Array.from(data.markets)
                    }
                ])
            ),
            marketDetails: Object.fromEntries(
                Object.entries(changes.byMarket).map(([market, data]) => [
                    market,
                    {
                        queues: Array.from(data.queues),
                        agents: Array.from(data.agents),
                        states: Array.from(data.states)
                    }
                ])
            )
        };

        writeFileSync(
            'queue_sync_simulation.json', 
            JSON.stringify(simulationReport, null, 2)
        );

        console.log('\nSimulation complete. Results saved to queue_sync_simulation.json');

    } catch (error) {
        console.error('Simulation failed:', error);
        throw error;
    }
}

export { generateQueueAssignments, previewQueueAssignments, simulateQueueSync }; 