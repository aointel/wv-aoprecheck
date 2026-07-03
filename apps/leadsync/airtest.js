const axios = require("axios");
const fs = require("fs");

// Airtable Credentials
const AIRTABLE_TOKEN = "patleshPkD8kn1Wh7.eeb2cab7ed029d154c493a64aaeedf20d21dc242cc13ba8e6bceefa6c109ae57";
const BASE_ID = "appES9pwyWe9FPmAp";
const TABLE_NAME = "AgentStatus"; // Airtable Table Name

// Zoho Credentials
const ZOHO_CLIENT_ID = "1000.J997V5CGG0NS742VQA401ZFKTI5MJF";
const ZOHO_CLIENT_SECRET = "b60187effb9b211d02853c974b5f82ae3f51e53f54";
const ZOHO_TOKEN_FILE = "tokens.json"; // File to persist tokens
const ZOHO_API_URL = "https://voice.zoho.com/rest/json/zv/api/users";

// Function to load tokens from file
function loadTokens() {
    if (fs.existsSync(ZOHO_TOKEN_FILE)) {
        const data = fs.readFileSync(ZOHO_TOKEN_FILE, "utf8");
        return JSON.parse(data);
    }
    throw new Error("No tokens found. Please generate an initial token and save it in tokens.json.");
}

// Function to save tokens to file
function saveTokens(tokens) {
    fs.writeFileSync(ZOHO_TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

// Function to refresh Zoho access token
async function refreshZohoAccessToken(refreshToken) {
    try {
        const response = await axios.post("https://accounts.zoho.com/oauth/v2/token", null, {
            params: {
                refresh_token: refreshToken,
                client_id: ZOHO_CLIENT_ID,
                client_secret: ZOHO_CLIENT_SECRET,
                grant_type: "refresh_token",
            },
        });

        const newTokens = {
            access_token: response.data.access_token,
            refresh_token: refreshToken, // Refresh token does not change
            expires_in: response.data.expires_in,
        };

        saveTokens(newTokens); // Save updated tokens
        console.log("Zoho access token refreshed and saved.");
        return newTokens.access_token;
    } catch (error) {
        console.error("Failed to refresh Zoho access token:", error.message);
        if (error.response) {
            console.error("Response Data:", error.response.data);
        }
        throw new Error("Unable to refresh Zoho token.");
    }
}

// Function to fetch users from Zoho
async function fetchZohoUsers(accessToken) {
    try {
        const response = await axios.get(ZOHO_API_URL, {
            headers: {
                Authorization: `Zoho-oauthtoken ${accessToken}`,
                Accept: "application/json",
            },
        });
        console.log(`Fetched users from Zoho: (${response.data.users.length})`);
        return response.data.users;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.log("Zoho token expired. Refreshing token...");
            const tokens = loadTokens();
            const newAccessToken = await refreshZohoAccessToken(tokens.refresh_token);
            return fetchZohoUsers(newAccessToken); // Retry after refreshing the token
        }
        console.error("Error fetching users from Zoho:", error.message);
        throw error;
    }
}

// Function to validate and format data for Airtable
function formatRecords(users) {
    return users
        .filter(user => user.emailid && user.name && user.agentId) // Filter out incomplete records
        .map(user => ({
            fields: {
                Email: user.emailid,
                Name: user.name,
                AgentId: user.agentId,
                Role: user.zvtRoleName,
                Status: user.status === 1 ? "Active" : "Inactive",
                OnlineStatus: user.onlineStatus,
                Department: user.departmentName,
            },
        }));
}

// Function to push a batch of records to Airtable
async function pushBatchToAirtable(records) {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;
    const payload = { records };

    console.log("Pushing batch to Airtable:", JSON.stringify(payload, null, 2)); // Debug log

    try {
        const response = await axios.post(
            url,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${AIRTABLE_TOKEN}`,
                    "Content-Type": "application/json",
                },
            }
        );
        console.log(`Batch pushed successfully. Added ${response.data.records.length} records.`);
    } catch (error) {
        console.error("Error pushing batch to Airtable:", error.message);
        if (error.response) {
            console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

// Function to split data into batches
function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

// Main execution
(async () => {
    try {
        const tokens = loadTokens(); // Load tokens from file
        const users = await fetchZohoUsers(tokens.access_token); // Fetch users from Zoho

        const formattedRecords = formatRecords(users); // Format users into Airtable-compatible records

        const batches = chunkArray(formattedRecords, 10); // Split records into batches of 10

        for (const batch of batches) {
            await pushBatchToAirtable(batch); // Push each batch to Airtable
        }

        console.log("All users synced to Airtable successfully.");
    } catch (error) {
        console.error("Error in the sync process:", error.message);
    }
})();
