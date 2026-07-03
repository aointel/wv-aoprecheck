const Airtable = require("airtable");

const AIRTABLE_TOKEN = "pat2Mn6qtFRwIPncS.292814e92dd7b22f8c00ea5b1f80d7ad906b99cdfc991af8d2cde783228a963a";
const BASE_ID = "appES9pwyWe9FPmAp";
const TABLE_NAME = "Agents"; // Replace with your table name

const base = new Airtable({ apiKey: AIRTABLE_TOKEN }).base(BASE_ID);

async function testAirtableConnection() {
    try {
        const records = await base(TABLE_NAME).select({ maxRecords: 1 }).firstPage();
        console.log("Airtable Connection Successful. Sample Record:", records[0]?.fields);
    } catch (error) {
        console.error("Error Connecting to Airtable:", error.message);
        if (error.response) {
            console.error("Response Data:", error.response.data);
        }
    }
}

testAirtableConnection();
