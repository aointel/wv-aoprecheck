// Required dependencies
const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify");

// File paths
const AVAILABLE_AGENTS_FILE = "available_agents.json";
const OUTPUT_FILE = "available_agents_filtered.csv";

// Function to load and filter available agents
function loadAvailableAgents() {
    try {
        const rawData = fs.readFileSync(AVAILABLE_AGENTS_FILE, "utf8");
        const data = JSON.parse(rawData);

        console.log(`Loaded ${data.length} agents from available_agents.json`);

        // Filter only agents with 'onlineStatus' === 'Available'
        const filteredData = data
            .filter((agent) => agent.onlineStatus === "Available")
            .map((agent) => {
                const match = agent.name.match(/\{(\d+)\}/); // Extract digits inside {}
                if (match) {
                    return {
                        AssociateID: match[1],
                        Name: agent.name,
                        OnlineStatus: agent.onlineStatus,
                        Email: agent.emailid,
                        Department: agent.departmentName,
                    };
                }
                return null; // Exclude agents without a valid AssociateID
            })
            .filter((agent) => agent !== null); // Remove null entries

        console.log(`Filtered ${filteredData.length} agents with 'Available' status and valid AssociateIDs`);
        return filteredData;
    } catch (error) {
        console.error("Error loading available agents:", error.message);
        return [];
    }
}

// Function to save data to CSV
function saveDataToCSV(data, filename) {
    stringify(data, { header: true }, (err, output) => {
        if (err) {
            console.error(`Failed to save data to ${filename}:`, err.message);
            return;
        }
        fs.writeFileSync(filename, output);
        console.log(`Data successfully saved to ${filename}`);
    });
}

// Main execution
(async () => {
    try {
        console.log("Starting process to filter available agents...");

        // Step 1: Load available agents
        const availableAgents = loadAvailableAgents();

        // Step 2: Save filtered data to CSV
        saveDataToCSV(availableAgents, OUTPUT_FILE);

        console.log("Process completed successfully.");
    } catch (error) {
        console.error("Error in the process:", error.message);
    }
})();
