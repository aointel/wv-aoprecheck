const axios = require("axios");

// New Zoho Token
const ZOHO_ACCESS_TOKEN = "1000.6e1de2293af2ae0714dc97f3ba12fbba.23f479367755db4863215b56c35d90fc";
const ZOHO_API_URL = "https://www.zohoapis.com/rest/json/zv/api/users"; // Adjust if necessary

async function testZohoAPI() {
    try {
        const response = await axios.get(ZOHO_API_URL, {
            headers: {
                Authorization: `Zoho-oauthtoken ${ZOHO_ACCESS_TOKEN}`,
                Accept: "application/json",
            },
        });

        console.log("Zoho API Response:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("Error testing Zoho API:", error.message);
        if (error.response) {
            console.error("Response Status:", error.response.status);
            console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

testZohoAPI();
