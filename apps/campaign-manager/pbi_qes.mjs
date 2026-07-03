import { readFileSync } from 'fs';

const MWC_TOKEN = 'MWCToken eyJhbGciOiJSUzI1NiIsImtpZCI6IkZGRkVEQzhFRTYyOTY3MTEyNEU3ODM3RTJEMkYyRUEwMzlCNENCNUQiLCJ4NXQiOiJfXzdjanVZcFp4RWs1NE4tTFM4dW9EbTB5MTAiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJ3ZXN0dXMyLnBiaWRlZGljYXRlZC53aW5kb3dzLm5ldCIsImV4cCI6MTc3NTAwMjEwNiwibmJmIjoxNzc0OTk3OTgzLCJvcmlnaW5hbEF1dGhvcml6YXRpb25IZWFkZXIiOiJCZWFyZXIgZXlKMGVYQWlPaUpLVjFRaUxDSmhiR2NpT2lKU1V6STFOaUlzSW5nMWRDSTZJbEZhWjA0NVNIRk9hMGRPUlUwMFIyVkxZM3BFTURKUVkxWjJOQ0lzSW10cFpDSTZJbEZhWjA0NVNIRk9hMGRPUlUwMFIyVkxZM3BFTURKUVkxWjJOQ0o5LmV5SmhkV1FpT2lKb2RIUndjem92TDJGdVlXeDVjMmx6TG5kcGJtUnZkM011Ym1WMEwzQnZkMlZ5WW1rdllYQnBJaXdpYVhOeklqb2lhSFIwY0hNNkx5OXpkSE11ZDJsdVpHOTNjeTV1WlhRdk1UTmpNakJqWXpRdE5XSTNaUzAwTldWaExXSXhOamN0TURZME9UbGpPVFk1TVRNNEx5SXNJbWxoZENJNk1UYzNORGs1TnpZNE1pd2libUptSWpveE56YzBPVGszTmpneUxDSmxlSEFpT2pFM056VXdNREl4TURZc0ltRmpZM1FpT2pBc0ltRmpjaUk2SWpFaUxDSmhhVzhpT2lKQldGRkJhUzg0WWtGQlFVRlpSVEp4ZVRaVWVuZFpkM1IzVjIxQlMyOWlORFYzVEVkWVUzRmFOQzl2ZUhkbU5YTnBRMmxVVkVOR1RXTlpNM2hCZDNWcE1tTk1SalJIVTFWMVR6aFlaVTU1Y0dGM2RIaGlPRkpsTWtoUkwxUTNiMWwzUkROM2MybHlUWGhQTlVKdFdtZ3pTRGhCUTJveWNGQlRaRTUyWkRjeU9YUjBNbXRYTDJaSk4xaHJSVE14VlZOQmNESm1ORmhKUjBWb05YZ3laMnQ1WW5jOVBTSXNJbUZ0Y2lJNld5SndkMlFpTENKdFptRWlYU3dpWVhCd2FXUWlPaUk0TnpGak1ERXdaaTAxWlRZeExUUm1ZakV0T0ROaFl5MDVPRFl4TUdFM1pUa3hNVEFpTENKaGNIQnBaR0ZqY2lJNklqQWlMQ0ptWVcxcGJIbGZibUZ0WlNJNklrMWhibVJsYkd4aElpd2laMmwyWlc1ZmJtRnRaU0k2SWsxcFkyaGhaV3dpTENKcFpIUjVjQ0k2SW5WelpYSWlMQ0pwY0dGa1pISWlPaUl5TmpBeE9qWXdNRG81TVRneE9qZzVOekE2WVRGa01UbzJORFE2TkRReE1UcGpZemt6SWl3aWJtRnRaU0k2SWsxcFkyaGhaV3dnVFdGdVpHVnNiR0VpTENKdmFXUWlPaUl3WVdJd1pUUmpOaTB3WkdZd0xUUm1PVEF0WWprMFppMHpaVGMwWWpBME9EazFPRGtpTENKd2RXbGtJam9pTVRBd016SXdNRE15TWprMU5VRXlOaUlzSW5Kb0lqb2lNUzVCVTJkQmVFRjZRMFV6TldJMmExZDRXbmRhU201S1lWSlBRV3RCUVVGQlFVRkJRVUYzUVVGQlFVRkJRVUZCUVVGQlJFVnZRVUV1SWl3aWMyTndJam9pZFhObGNsOXBiWEJsY25OdmJtRjBhVzl1SWl3aWMybGtJam9pTURBek1qZzVPV0V0WVRFMVpTMDBaalV4TFdZNU5XSXRZamRoWldJeE1qWmxPV0kzSWl3aWMybG5ibWx1WDNOMFlYUmxJanBiSW10dGMya2lYU3dpYzNWaUlqb2lPR2RNV1U0MGN6ZE5hMDlyUzFkVWRIWkxaMnRzZEhCQ2RIYzVjV2hLYjJWVU5rb3dRMTgzUm5oS2J5SXNJblJwWkNJNklqRXpZekl3WTJNMExUVmlOMlV0TkRWbFlTMWlNVFkzTFRBMk5EazVZemsyT1RFek9DSXNJblZ1YVhGMVpWOXVZVzFsSWpvaWJXbGphR0ZsYkcxaGJtUmxiR3hoUUdGdloyeHZZbVZzYVdabExtTnZiU0lzSW5Wd2JpSTZJbTFwWTJoaFpXeHRZVzVrWld4c1lVQmhiMmRzYjJKbGJHbG1aUzVqYjIwaUxDSjFkR2tpT2lKVVFXVlljV2R2VkhGRmJWZ3dXbEU0VFhoR1pFRkJJaXdpZG1WeUlqb2lNUzR3SWl3aWQybGtjeUk2V3lKaU56bG1ZbVkwWkMwelpXWTVMVFEyT0RrdE9ERTBNeTAzTm1JeE9UUmxPRFUxTURraVhTd2lleG10WDJGamRGOW1ZM1FpT2lJeklEVWlMQ0o0YlhOZlkyTWlPbHNpUTFBeElsMHNJbmh0YzE5bWRHUWlPaUl5Tmlwc1ZXbEJRelkzWW5jM1kyVmpjWE5IYW5KcFJHNUZkakpOYms5NVkycHZkamhFUldkU05IQXlSV3h2UVdaT05qSjRhMlpQY1dSaGIwd3hjbVJ2YlhFM1VEWjJJaXdpZUcxemZYSmpZaUk2SWpRaUxDSjRiWE5mWTNNaU9sc2lRMUF4SWwwc0luaHRjMTltZEdRaU9pSTJJaXdpZUcxemZYTjFZbDltWTNRaU9pSXpJRGdpZlEuUzhmOThkbUE3NlFOWTREUFNzMzFlMWt6Q1hvTlZHV3YxVEp6Q1YyXzN5X2JCS3NaR3pmbE5wNlY3cmxZUjF4cnNBSldaT05ScDBLTlZLdmxQR2FPWFNoUW1UM2JtN2hJUU84NkpUc2JUc2xMSWVGNEhWZnJFdml5TWRxWngzSXlLdmNJZnBXRk9BVl9aU3lwdEhaNGdtbS0tclkwcGtfVGRsRnRlWmVqMkdmVnJvUUszYW1ibDE3SGxQbXkxVXpwR2lWVlBtaVhaM05BT21DazA1VWtyVGFtYk5QMG9RekJMckJaSUIybUhjOGRPOTBweVBiYktqYzJiUjZpZUxzQnJJV0V0ZjVURllleWllTlRJV1JqVWhOQnJGRFc2QXFyYkEtSlc0dDRKWVpRZFBKSGVQNHN4NTF0YVQwRU1EM3Y1ZjNVb2Y4ZFE2bnBpQU1yMDZLOFQ4QSIsInJvbGxvdXRGcWRuIjoid2VzdHVzMi5wYmlkZWRpY2F0ZWQud2luZG93cy5uZXQiLCJ2aXJ0dWFsU2VydmljZU9iamVjdElkIjoiREE5NTZDRTQtOUE0NC00NzIwLUE2RDEtNUZENkNFMkUzODk4Iiwid29ya2xvYWRDbGFpbXMiOiJ7XHJcbiAgXCJxZXNcIjoge1xyXG4gICAgXCJ1c2VyXCI6IFwibWljaGFlbG1hbmRlbGxhQGFvZ2xvYmVsaWZlLmNvbVwiLFxyXG4gICAgXCJkYXRhYmFzZVwiOiBcIjQyMTc5ZmRiLTUwZGItNGJkYi05ZWNiLWNmMWNkZGE2NjFkZVwiLFxyXG4gICAgXCJkYXRhU291cmNlXCI6IFwicGJpZGVkaWNhdGVkOi8vd2VzdHVzMi5wYmlkZWRpY2F0ZWQud2luZG93cy5uZXQvMEFFQ0FGMDctRUNBQy00QjBGLUJGNkQtQUVDMzE4Q0E2RThEXCIsXHJcbiAgICBcInJvbGVzXCI6IG51bGwsXHJcbiAgICBcIndvcmtzcGFjZU9iamVjdElkXCI6IFwiNjA4OTUxYmUtYWQ2ZS00ZDY2LWExOTQtMjJkMmE2ZDYyNjI2XCIsXHJcbiAgICBcImRhdGFzZXRGcmllbmRseU5hbWVcIjogXCJIUFBybzNcIlxyXG4gIH1cclxufSIsInRva2VuVHlwZSI6Ik13Y1Rva2VuIiwidGlkIjoiMTNjMjBjYzQtNWI3ZS00NWVhLWIxNjctMDY0OTljOTY5MTM4Iiwid29ya3NwYWNlSWQiOiI2MDg5NTFiZS1hZDZlLTRkNjYtYTE5NC0yMmQyYTZkNjI2MjYiLCJjdXN0b21lckNhcGFjaXR5T2JqZWN0SWQiOiIwQUVDQUYwNy1FQ0FDLTRCMEYtQkY2RC1BRUMzMThDQTZFOEQiLCJpYXQiOjE3NzQ5OTc5ODN9.mrBMkun4OzbyK0QVsQZWSkOzuBH_rjslqeEnFbcTRd_IOsXSqcQOcER6teTBU_hvDdUoW5Hj4FPbsmz3JD30IQP-cLZoA873oZ5dQoMF5vFJY5isXYG-Mtm46c3kWIq2xUE6pfRNOCLKKO9yrpF9cdYvX3XEPPC-Adq0Q6iCNbqXjFxnI8h-Hi6PICY5EGKXk4CyI22eCBp1sm630HP28GGbyp4C4AMm2jd-VEWAq2jXB0-MiIrBTcNon2waEHWAPfpnVZZq2VsWClA69BXrhgQgdrffV2sDe2LWvBCUBRY4hy-jxmfLrc3MrDZW_YamitnqafDDvgoPtjgEU20Pqw';

const ENDPOINT = 'https://pbipwus24-westus2.pbidedicated.windows.net/webapi/capacities/0AECAF07-ECAC-4B0F-BF6D-AEC318CA6E8D/workloads/QES/QueryExecutionService/automatic/public/query';
const DATASET_ID = '42179fdb-50db-4bdb-9ecb-cf1cdda661de';
const REPORT_ID = 'd715326d-8dc8-4e47-a9d3-112e24d07784';
const ACTIVITY_ID = 'c8d65f82-23b2-440b-96d2-198706d7e65e';

// Construct a DAX query against the Veteran Presentations table
// Try different possible table/column names
const queries = [
  // Try 1: direct DAX via QES
  {
    queries: [{
      query: "EVALUATE TOPN(500, 'Veteran Presentations', 'Veteran Presentations'[ALP], DESC)",
      queryId: '1',
    }],
    serializerSettings: { includeNulls: true },
  },
  // Try 2: simpler EVALUATE all
  {
    queries: [{
      query: "EVALUATE 'Veteran Presentations'",
      queryId: '2',
    }],
    serializerSettings: { includeNulls: true },
  },
];

for (const body of queries) {
  console.log('Trying query:', body.queries[0].query.slice(0, 80));
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'authorization': MWC_TOKEN,
        'content-type': 'application/json;charset=UTF-8',
        'activityid': ACTIVITY_ID,
        'requestid': crypto.randomUUID(),
        'x-ms-parent-activity-id': ACTIVITY_ID,
        'x-ms-root-activity-id': ACTIVITY_ID,
        'x-ms-workload-resource-moniker': DATASET_ID,
        'origin': 'https://app.powerbi.com',
        'referer': 'https://app.powerbi.com/',
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    console.log('Status:', r.status);
    console.log('Response:', text.slice(0, 1000));
    console.log('---');
    if (r.ok && !text.includes('error')) break;
  } catch(e) {
    console.log('Error:', e.message);
  }
}
