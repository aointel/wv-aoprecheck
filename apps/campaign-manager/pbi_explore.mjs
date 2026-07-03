const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6IlFaZ045SHFOa0dORU00R2VLY3pEMDJQY1Z2NCIsImtpZCI6IlFaZ045SHFOa0dORU00R2VLY3pEMDJQY1Z2NCJ9.eyJhdWQiOiJodHRwczovL2FuYWx5c2lzLndpbmRvd3MubmV0L3Bvd2VyYmkvYXBpIiwiaXNzIjoiaHR0cHM6Ly9zdHMud2luZG93cy5uZXQvMTNjMjBjYzQtNWI3ZS00NWVhLWIxNjctMDY0OTljOTY5MTM4LyIsImlhdCI6MTc3NDk5NzY4MiwibmJmIjoxNzc0OTk3NjgyLCJleHAiOjE3NzUwMDIxMDYsImFjY3QiOjAsImFjciI6IjEiLCJhaW8iOiJBWFFBaS84YkFBQUFZRTJxeTZUendZd3R3V21BS29iNDV3TEdYU3FaNC9veHdmNXNpQ2lUVENGTWNZM3hBd3VpMmNMRjRHU1V1TzhYZU55cGF3dHhiOFJlMkhRL1Q3b1l3RDN3c2lyTXhPNUJtWmgzSDhBQ2oycFBTZE52ZDdyOXR0MmtXL2ZJN1hrRTMxVVNBcDJmNFhJR0VoNXgyZ2t5Ync9PSIsImFtciI6WyJwd2QiLCJtZmEiXSwiYXBwaWQiOiI4NzFjMDEwZi01ZTYxLTRmYjEtODNhYy05ODYxMGE3ZTkxMTAiLCJhcHBpZGFjciI6IjAiLCJmYW1pbHlfbmFtZSI6Ik1hbmRlbGxhIiwiZ2l2ZW5fbmFtZSI6Ik1pY2hhZWwiLCJpZHR5cCI6InVzZXIiLCJpcGFkZHIiOiIyNjAxOjYwMDo5MTgxOjg5NzA6YTFkMTo2NDQ6NDQxMTpjYzkzIiwibmFtZSI6Ik1pY2hhZWwgTWFuZGVsbGEiLCJvaWQiOiIwYWIwZTRjNi0wZGYwLTRmOTAtYjk0Zi0zZTc0YjA0ODk1ODkiLCJwdWlkIjoiMTAwMzIwMDMyMjk1NUEyNiIsInJoIjoiMS5BU2dBeEF6Q0UzNWI2a1d4WndaSm5KYVJPQWtBQUFBQUFBQUF3QUFBQUFBQUFBQUFBREVvQUEuIiwic2NwIjoidXNlcl9pbXBlcnNvbmF0aW9uIiwic2lkIjoiMDAzMjg5OWEtYTE1ZS00ZjUxLWY5NWItYjdhZWIxMjZlOWI3Iiwic2lnbmluX3N0YXRlIjpbImttc2kiXSwic3ViIjoiOGdMWU40czdNa09rS1dUdHZLZ2tsdHBCdHc5cWhKb2VUNkowQ183RnhKbyIsInRpZCI6IjEzYzIwY2M0LTViN2UtNDVlYS1iMTY3LTA2NDk5Yzk2OTEzOCIsInVuaXF1ZV9uYW1lIjoibWljaGFlbG1hbmRlbGxhQGFvZ2xvYmVsaWZlLmNvbSIsInVwbiI6Im1pY2hhZWxtYW5kZWxsYUBhb2dsb2JlbGlmZS5jb20iLCJ1dGkiOiJUQWVYcWdvVHFFbVgwWlE4TXhGZEFBIiwidmVyIjoiMS4wIiwid2lkcyI6WyJiNzlmYmY0ZC0zZWY5LTQ2ODktODE0My03NmIxOTRlODU1MDkiXSwieG1zX2FjdF9mY3QiOiIzIDUiLCJ4bXNfY2MiOlsiQ1AxIl0sInhtc19mdGQiOiJ3ZG1FbEVxYUtSbHl2bFNvQkYzX2VEMmo5YnhyM0lOa3dobThsV0R0bWVFQmRYTjNaWE4wTXkxa2MyMXoiLCJ4bXNfaWRyZWwiOiIxIDYiLCJ4bXNfc3ViX2ZjdCI6IjMgOCJ9.S8f98dmA76QNY4DPSs31e1kzCXoNVGWv1TJzCV2_3y_bBKsZGzflNp6V7rlYR1xrsAJWZONRp0KNVKvlPGaOXShQmT3bm7hIQO86JTsbTslLIeF4HVfrEviyMdqZx3IyKvcIfpWFOAV_ZSyptHZ4gmm--rYpk_TdlFteZej2GfVroQK3ambl17HlPmy1UzpGiVVPmiXZ3NAOmCk05UkrTambNP0oQzBLrBZIB2mHc8dO90pyPbbKjc2bR6ieLsBrIWEtf5TFYeyieNTIWRjUhNBrFDW6AqrbA-JW4t4JYZQdPJHeP4sx51taT0EMD3v5f3Uof8dQ6npiAMr06K8T8A';

const h = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };
const BASE = 'https://api.powerbi.com/v1.0/myorg';
const WABI = 'https://wabi-us-west2-redirect.analysis.windows.net';
const reportId = 'd715326d-8dc8-4e47-a9d3-112e24d07784';
const datasetId = '42179fdb-50db-4bdb-9ecb-cf1cdda661de';

// Try the XMLA endpoint — this is what Power BI Desktop uses
// Also try the explore/explorationVisualization endpoint that the web app uses
const explorationBody = {
  modelId: datasetId,
  queries: [{
    Query: {
      Commands: [{
        SemanticQueryDataShapeCommand: {
          Query: {
            Version: 2,
            From: [{ Name: 'a', Entity: 'Agent Summary', Type: 0 }],
            Select: [
              { Column: { Expression: { SourceRef: { Source: 'a' } }, Property: 'Agent Name' }, Name: 'AgentName' },
              { Measure: { Expression: { SourceRef: { Source: 'a' } }, Property: 'Total Presentations' }, Name: 'TotalPres' },
              { Measure: { Expression: { SourceRef: { Source: 'a' } }, Property: 'Total ALP' }, Name: 'TotalALP' },
            ],
            OrderBy: [{ Direction: 2, Expression: { Measure: { Expression: { SourceRef: { Source: 'a' } }, Property: 'Total ALP' } } }]
          },
          Binding: { Primary: { Groupings: [{ Projections: [0, 1, 2] }] }, DataReduction: { DataVolume: 4, Primary: { Top: { Count: 100 } } }, Version: 1 }
        }
      }]
    },
    QueryId: '',
    ApplicationContext: { DatasetId: datasetId, Sources: [{ ReportId: reportId }] }
  }],
  cancelQueries: [],
  modelId: -1
};

// Try WABI public query endpoint
const wabiR = await fetch(`${WABI}/public/reports/querydata?synchronous=true`, {
  method: 'POST',
  headers: { ...h, 'X-PowerBI-ResourceKey': reportId },
  body: JSON.stringify(explorationBody)
});
const wabiText = await wabiR.text();
console.log('WABI status:', wabiR.status);
console.log('WABI response:', wabiText.slice(0, 1000));
