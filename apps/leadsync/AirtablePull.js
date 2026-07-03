const Airtable = require('airtable');

// Keep exact API key
const AIRTABLE_API_KEY = 'patleshPkD8kn1Wh7.9244af0e261df11b3f52733e57abf29a1a99f105c206899e9aca191c23dfe52b';
const AIRTABLE_BASE_ID = 'appNOF5lF1i6NJAOX';
let base;

console.log('\n====== API KEY VERIFICATION ======');
console.log({
    timestamp: new Date().toISOString(),
    apiKeyLength: AIRTABLE_API_KEY.length,
    apiKeyStart: AIRTABLE_API_KEY.substring(0, 15),
    apiKeyEnd: AIRTABLE_API_KEY.substring(AIRTABLE_API_KEY.length - 5)
});

try {
    // Initialize with explicit configuration
    const Airtable = require('airtable');
Airtable.configure({
    apiKey: AIRTABLE_API_KEY
});
base = Airtable.base(AIRTABLE_BASE_ID);
    
    console.log('Airtable connection initialized');
} catch (error) {
    console.error('Initialization error:', error);
    process.exit(1);
}

// Campaign data mapping - DO NOT MODIFY API SETTINGS ABOVE
const CAMPAIGN_DATA = {
    'PAVET': {
        'AL': '67770d61e345699491e695ca',
        'AK': '67770de8e345699491e69ce2', 
        'AZ': '67770dfde345699491e69d98',
        'AR': '67770e13e345699491e69e66',
        'CA': '67770e71e345699491e6a727',
        'CO': '67770f14e345699491e6b502',
        'CT': '67770f49e345699491e6ba73',
        'DE': '67771027e345699491e6cc2a',
        'DC': '6777103be345699491e6ce05',
        'FL': '6777104ee345699491e6d012',
        'GA': '67771062e345699491e6d1bb',
        'HI': '67771076e345699491e6d3d3',
        'ID': '67771090e345699491e6d5fc',
        'IL': '677710a8e345699491e6d8bf',
        'IN': '677710c5e345699491e6dc6f',
        'IA': '677711ace345699491e6ee5c',
        'KS': '677711cae345699491e6f00b',
        'KY': '67771231e345699491e6f553',
        'LA': '67771246e345699491e6f723',
        'ME': '67771265e345699491e6fa37',
        'MD': '67771276e345699491e6fb9b',
        'MA': '67771296e345699491e6fea5',
        'MI': '677712aee345699491e700ae',
        'MN': '677712bfe345699491e70224',
        'MS': '677712d0e345699491e703b7',
        'MO': '677712e1e345699491e70544',
        'MT': '677712f4e345699491e70703',
        'NE': '67771325e345699491e70bb2',
        'NV': '67771336e345699491e70d86',
        'NH': '67771348e345699491e70f5f',
        'NJ': '6777135ae345699491e71133',
        'NM': '67771472e345699491e7241a',
        'NY': '67771487e345699491e725e7',
        'NC': '677714c6e345699491e72bc6',
        'ND': '67771505e345699491e732b9',
        'OH': '67771515e345699491e73442',
        'OK': '67771527e345699491e73757',
        'OR': '67771534e345699491e738aa',
        'PA': '6777154ee345699491e73b48',
        'RI': '67771587e345699491e74080',
        'SC': '677715a4e345699491e7435e',
        'SD': '677715b5e345699491e744fe',
        'TN': '677715d7e345699491e747c6',
        'TX': '677715ede345699491e74897',
        'UT': '677715fde345699491e74921',
        'VT': '6777160de345699491e749d8',
        'VA': '67771621e345699491e74ba1',
        'WA': '67771634e345699491e74d90',
        'WV': '67771646e345699491e7545f',
        'WI': '67771657e345699491e75b16',
        'WY': '6777166ae345699491e75ca4'
    },
    'VN125': {
        'AL': '677ab08027b78ac01f4b99dc',
        'AK': '677ab16c27b78ac01f4ba371',
        'AZ': '677ab18327b78ac01f4ba4e7',
        'AR': '677ab19727b78ac01f4ba636',
        'CA': '677ab30327b78ac01f4bbd37',
        'CO': '677ab31727b78ac01f4bbd6c',
        'CT': '677ab33127b78ac01f4bbdb5',
        'DE': '677ab35927b78ac01f4bc05c',
        'DC': '677ab36e27b78ac01f4bc1ce',
        'FL': '677ab38727b78ac01f4bc35a',
        'GA': '677ab39a27b78ac01f4bc49c',
        'HI': '677ab3ec27b78ac01f4bc5db',
        'ID': '677ab41c27b78ac01f4bc80d',
        'IL': '677ab42c27b78ac01f4bc936',
        'IN': '677ab43f27b78ac01f4bca84',
        'IA': '677ab45427b78ac01f4bcbcf',
        'KS': '677ab46727b78ac01f4bcd05',
        'KY': '677ab47727b78ac01f4bce0c',
        'LA': '677ab48b27b78ac01f4bcfc3',
        'ME': '677ab49b27b78ac01f4bd0c2',
        'MD': '677ab4b127b78ac01f4bd221',
        'MA': '677ab4c627b78ac01f4bd35d',
        'MI': '677ab4da27b78ac01f4bd4a0',
        'MN': '677ab4e927b78ac01f4bd59a',
        'MS': '677ab50b27b78ac01f4bd79c',
        'MO': '677ab51f27b78ac01f4bd8cd',
        'MT': '677ab53e27b78ac01f4bda8d',
        'NE': '677ab57727b78ac01f4bdef4',
        'NV': '677ab5a127b78ac01f4be170',
        'NH': '677ab5b627b78ac01f4be330',
        'NJ': '677ab6e627b78ac01f4bef52',
        'NM': '677ab7eb27b78ac01f4bffc1',
        'NY': '677ab80b27b78ac01f4c0141',
        'NC': '677ab81827b78ac01f4c015a',
        'ND': '677ab82c27b78ac01f4c016e',
        'OH': '677ab88127b78ac01f4c02d9',
        'OK': '677ab8cb27b78ac01f4c05b5',
        'OR': '677ab8d927b78ac01f4c0693',
        'PA': '677ab91427b78ac01f4c0a18',
        'RI': '677ab92427b78ac01f4c0b16',
        'SC': '677ab92f27b78ac01f4c0c39',
        'SD': '677ab96127b78ac01f4c0f9f',
        'TN': '677ab97027b78ac01f4c1094',
        'TX': '677ab97b27b78ac01f4c113d',
        'UT': '677abb5d27b78ac01f4c269c',
        'VT': '677abb7227b78ac01f4c2808',
        'VA': '677abb8027b78ac01f4c2908',
        'WA': '677abc1627b78ac01f4c3298',
        'WV': '677abc2327b78ac01f4c3357',
        'WI': '677abc3727b78ac01f4c3496',
        'WY': '677abc4727b78ac01f4c3587'
    },
    'NCL05': {
        'AL': '677ab0a727b78ac01f4b9a0f',
        'AK': '677abd4727b78ac01f4c40e8',
        'AZ': '677abd5527b78ac01f4c4108',
        'AR': '677abde327b78ac01f4c4ac4',
        'CA': '677abdf327b78ac01f4c4bba',
        'CO': '677abe0127b78ac01f4c4cb8',
        'CT': '677abe0c27b78ac01f4c4d77',
        'DE': '677abe3827b78ac01f4c5025',
        'DC': '677abe4527b78ac01f4c50f4',
        'FL': '677abe5627b78ac01f4c51fb',
        'GA': '677abe8727b78ac01f4c5590',
        'HI': '677abe9427b78ac01f4c568b',
        'ID': '677abead27b78ac01f4c5858',
        'IL': '677abef027b78ac01f4c5dc4',
        'IN': '677abf3b27b78ac01f4c6240',
        'IA': '677abfad27b78ac01f4c63a9',
        'KS': '677abfcd27b78ac01f4c65be',
        'KY': '677abfe427b78ac01f4c6736',
        'LA': '677ac01427b78ac01f4c6a6d',
        'ME': '677ac03427b78ac01f4c6c9f',
        'MD': '677ac07e27b78ac01f4c71ec',
        'MA': '677ac0c127b78ac01f4c769f',
        'MI': '677ac0ce27b78ac01f4c7798',
        'MN': '677ac0da27b78ac01f4c7857',
        'MS': '677ac10d27b78ac01f4c7bac',
        'MO': '677ac11a27b78ac01f4c7c47',
        'MT': '677ac13327b78ac01f4c7c59',
        'NE': '677ac14427b78ac01f4c7c70',
        'NV': '677ac15027b78ac01f4c7c89',
        'NH': '677ac18027b78ac01f4c7d8e',
        'NJ': '677ac18b27b78ac01f4c7db3',
        'NM': '677ac19727b78ac01f4c7de2',
        'NY': '677ac1a827b78ac01f4c7ef2',
        'NC': '677ac1b427b78ac01f4c7fc0',
        'ND': '677ac1bf27b78ac01f4c8080',
        'OH': '677ac1f827b78ac01f4c826a',
        'OK': '677ac20627b78ac01f4c8290',
        'OR': '677ac21127b78ac01f4c8345',
        'PA': '677ac21f27b78ac01f4c843e',
        'RI': '677ac24127b78ac01f4c8633',
        'SC': '677ac24f27b78ac01f4c870c',
        'SD': '677ac25a27b78ac01f4c87ba',
        'TN': '677ac26527b78ac01f4c8872',
        'TX': '677ac27227b78ac01f4c8941',
        'UT': '677ac27d27b78ac01f4c8a00',
        'VT': '677ac29027b78ac01f4c8b3d',
        'VA': '677ac29d27b78ac01f4c8c56',
        'WA': '677ac2b227b78ac01f4c8daa',
        'WV': '677ac2c027b78ac01f4c8e88',
        'WI': '677ac2ce27b78ac01f4c8f50',
        'WY': '677ac2da27b78ac01f4c9011'
    },
    'NCL06': {
        'AL': '677ab0a727b78ac01f4b9a0f',
        'AK': '677abd4727b78ac01f4c40e8',
        'AZ': '677abd5527b78ac01f4c4108',
        'AR': '677abde327b78ac01f4c4ac4',
        'CA': '677abdf327b78ac01f4c4bba',
        'CO': '677abe0127b78ac01f4c4cb8',
        'CT': '677abe0c27b78ac01f4c4d77',
        'DE': '677abe3827b78ac01f4c5025',
        'DC': '677abe4527b78ac01f4c50f4',
        'FL': '677abe5627b78ac01f4c51fb',
        'GA': '677abe8727b78ac01f4c5590',
        'HI': '677abe9427b78ac01f4c568b',
        'ID': '677abead27b78ac01f4c5858',
        'IL': '677abef027b78ac01f4c5dc4',
        'IN': '677abf3b27b78ac01f4c6240',
        'IA': '677abfad27b78ac01f4c63a9',
        'KS': '677abfcd27b78ac01f4c65be',
        'KY': '677abfe427b78ac01f4c6736',
        'LA': '677ac01427b78ac01f4c6a6d',
        'ME': '677ac03427b78ac01f4c6c9f',
        'MD': '677ac07e27b78ac01f4c71ec',
        'MA': '677ac0c127b78ac01f4c769f',
        'MI': '677ac0ce27b78ac01f4c7798',
        'MN': '677ac0da27b78ac01f4c7857',
        'MS': '677ac10d27b78ac01f4c7bac',
        'MO': '677ac11a27b78ac01f4c7c47',
        'MT': '677ac13327b78ac01f4c7c59',
        'NE': '677ac14427b78ac01f4c7c70',
        'NV': '677ac15027b78ac01f4c7c89',
        'NH': '677ac18027b78ac01f4c7d8e',
        'NJ': '677ac18b27b78ac01f4c7db3',
        'NM': '677ac19727b78ac01f4c7de2',
        'NY': '677ac1a827b78ac01f4c7ef2',
        'NC': '677ac1b427b78ac01f4c7fc0',
        'ND': '677ac1bf27b78ac01f4c8080',
        'OH': '677ac1f827b78ac01f4c826a',
        'OK': '677ac20627b78ac01f4c8290',
        'OR': '677ac21127b78ac01f4c8345',
        'PA': '677ac21f27b78ac01f4c843e',
        'RI': '677ac24127b78ac01f4c8633',
        'SC': '677ac24f27b78ac01f4c870c',
        'SD': '677ac25a27b78ac01f4c87ba',
        'TN': '677ac26527b78ac01f4c8872',
        'TX': '677ac27227b78ac01f4c8941',
        'UT': '677ac27d27b78ac01f4c8a00',
        'VT': '677ac29027b78ac01f4c8b3d',
        'VA': '677ac29d27b78ac01f4c8c56',
        'WA': '677ac2b227b78ac01f4c8daa',
        'WV': '677ac2c027b78ac01f4c8e88',
        'WI': '677ac2ce27b78ac01f4c8f50',
        'WY': '677ac2da27b78ac01f4c9011'
    },
    'NCL07': {
        'AL': '67847e2c477432a7c853f1a4',
        'FL': '67847e69477432a7c853f1c3',
        'GA': '67847e86477432a7c853f1df',
        'NC': '67847e9f477432a7c853f1f5',
        'PA': '67847eb7477432a7c853f203',
        'TX': '67847eca477432a7c853f446'
    },
    'VET06': {
        'AL': '67770d61e345699491e695ca',
        'AK': '67770de8e345699491e69ce2',
        'AZ': '67770dfde345699491e69d98',
        'AR': '67770e13e345699491e69e66',
        'CA': '67770e71e345699491e6a727',
        'CO': '67770f14e345699491e6b502',
        'CT': '67770f49e345699491e6ba73',
        'DE': '67771027e345699491e6cc2a',
        'DC': '6777103be345699491e6ce05',
        'FL': '6777104ee345699491e6d012',
        'GA': '67771062e345699491e6d1bb',
        'HI': '67771076e345699491e6d3d3',
        'ID': '67771090e345699491e6d5fc',
        'IL': '677710a8e345699491e6d8bf',
        'IN': '677710c5e345699491e6dc6f',
        'IA': '677711ace345699491e6ee5c',
        'KS': '677711cae345699491e6f00b',
        'KY': '67771231e345699491e6f553',
        'LA': '67771246e345699491e6f723',
        'ME': '67771265e345699491e6fa37',
        'MD': '67771276e345699491e6fb9b',
        'MA': '67771296e345699491e6fea5',
        'MI': '677712aee345699491e700ae',
        'MN': '677712bfe345699491e70224',
        'MS': '677712d0e345699491e703b7',
        'MO': '677712e1e345699491e70544',
        'MT': '677712f4e345699491e70703',
        'NE': '67771325e345699491e70bb2',
        'NV': '67771336e345699491e70d86',
        'NH': '67771348e345699491e70f5f',
        'NJ': '6777135ae345699491e71133',
        'NM': '67771472e345699491e7241a',
        'NY': '67771487e345699491e725e7',
        'NC': '677714c6e345699491e72bc6',
        'ND': '67771505e345699491e732b9',
        'OH': '67771515e345699491e73442',
        'OK': '67771527e345699491e73757',
        'OR': '67771534e345699491e738aa',
        'PA': '6777154ee345699491e73b48',
        'RI': '67771587e345699491e74080',
        'SC': '677715a4e345699491e7435e',
        'SD': '677715b5e345699491e744fe',
        'TN': '677715d7e345699491e747c6',
        'TX': '677715ede345699491e74897',
        'UT': '677715fde345699491e74921',
        'VT': '6777160de345699491e749d8',
        'VA': '67771621e345699491e74ba1',
        'WA': '67771634e345699491e74d90',
        'WV': '67771646e345699491e7545f',
        'WI': '67771657e345699491e75b16',
        'WY': '6777166ae345699491e75ca4'
    }
};

async function fetchLeads() {
    console.log('\n====== FETCH OPERATION START ======');
    console.log({
        timestamp: new Date().toISOString(),
        operation: 'fetchLeads',
        table: 'Leads',
        view: 'Grid view',
        maxRecords: 1000
    });

    try {
        const records = await base('Leads').select({
            maxRecords: 1000,
            view: "Grid view"
        }).firstPage();

        console.log('\n====== FETCH OPERATION SUCCESS ======');
        console.log({
            timestamp: new Date().toISOString(),
            recordCount: records.length,
            firstRecordId: records[0]?.id,
            lastRecordId: records[records.length - 1]?.id
        });

        return records;
    } catch (error) {
        console.error('\n====== FETCH OPERATION ERROR ======');
        console.error({
            timestamp: new Date().toISOString(),
            errorType: error.name,
            errorMessage: error.message,
            stack: error.stack
        });
        throw error;
    }
}

async function sendToTaalkCampaign(lead, campaignId) {
    console.log('\n====== TAALK API REQUEST ======');
    console.log({
        leadName: `${lead.FirstName} ${lead.LastName}`,
        email: lead.Email,
        state: lead.State,
        groupCode: lead.GroupCode,
        campaignId: campaignId,
        timestamp: new Date().toISOString()
    });

    try {
        const response = await fetch('https://api.taalk.com/v1/leads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TAALK_API_KEY}`
            },
            body: JSON.stringify({
                campaignId: campaignId,
                firstName: lead.FirstName,
                lastName: lead.LastName,
                email: lead.Email,
                phone: lead.Phone,
                state: lead.State,
                groupCode: lead.GroupCode
            })
        });

        const responseData = await response.json();
        
        console.log('\n====== TAALK API RESPONSE ======');
        console.log({
            status: response.status,
            success: response.ok,
            responseData: responseData,
            timestamp: new Date().toISOString()
        });

        if (!response.ok) {
            throw new Error(`TAALK API error: ${response.status} ${response.statusText}`);
        }

        return responseData;

    } catch (error) {
        console.error('\n====== TAALK API ERROR ======');
        console.error({
            error: error.message,
            leadId: lead.id,
            timestamp: new Date().toISOString()
        });
        throw error;
    }
}

async function processLeads(leads) {
    console.log(`\n====== STARTING LEAD PROCESSING ======`);
    console.log(`Total leads to process: ${leads.length}`);

    for (const lead of leads) {
        console.log(`\n----- Processing Lead -----`);
        console.log({
            id: lead.id,
            name: `${lead.FirstName} ${lead.LastName}`,
            email: lead.Email,
            phone: lead.Phone,
            state: lead.State,
            groupCode: lead.GroupCode,
            timestamp: new Date().toISOString()
        });

        const campaignId = CAMPAIGN_DATA[lead.GroupCode]?.[lead.State];
        
        if (campaignId) {
            console.log(`✓ Found campaign ID: ${campaignId} for ${lead.GroupCode}/${lead.State}`);
            await sendToTaalkCampaign(lead, campaignId);
        } else {
            console.warn(`✗ No campaign found for GroupCode: ${lead.GroupCode}, State: ${lead.State}`);
        }
    }

    console.log(`\n====== COMPLETED LEAD PROCESSING ======\n`);
}

async function main() {
    console.log('Main Execution Starting', {
        timestamp: new Date().toISOString()
    });

    try {
        const records = await fetchLeads();
        await processLeads(records);
        
        console.log('Main Execution Complete', {
            timestamp: new Date().toISOString(),
            status: 'success'
        });
    } catch (error) {
        console.error('Main Execution Failed', {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Process monitoring
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection', {
        timestamp: new Date().toISOString(),
        reason: reason.toString(),
        stack: reason?.stack
    });
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception', {
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});

main();
