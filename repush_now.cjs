/**
 * repush_now.cjs - Immediately push RAMSEY test payload to EappSync localhost:7432
 * Uses the captured SyncPresentation body from the 3cec18b2 commit
 * to test full coverage injection without needing a new presentation.
 */
const http = require('http');

// Extracted from git 3cec18b2 RECOMMENDED plan (isSelected: true)
// Primary: SRGWL (CurrentProduct.Id=3), Coverage=8295 → SR10, face=8000, units=8
// A71 (ProductId=17), Coverage=100 → A71, face=100, units=1
// Spouse: SRGWL (SpouseProducts, Coverage=8295) → SR10, face=8000, units=8
const payload = {
  firstName: "RICHARD",
  lastName: "RAMSEY",
  dobMonth: "1",
  dobDay: "29",
  dobYear: "1954",
  gender: "Male",
  phone: "6369401985",
  email: "RRAMSEY_1@YAHOO.COM",
  occupation: "retired",
  spouseFirstName: "Mary",
  spouseLastName: "Ramsey",
  spouseDobMonth: "1",
  spouseDobDay: "29",
  spouseDobYear: "1955",
  spouseGender: "Female",
  city: "Saint Charles",
  zip: "63301",
  address: "",
  groupType: "POS",
  // Life coverage (SRGWL)
  life1GroupId: "SR10",
  life1Face: "8000",
  life1Units: "8",
  // A71000 accident
  accident1GroupId: "A71",
  accident1Face: "100",
  accident1Units: "1",
  // Extra FDS
  state: "MO",
  totalPremium: "130.94",
  isSenior: "True",
  hasLife: "True",
  hasAccident: "True",
  hasSpouseLife: "True",
  // Spouse life (SRGWL)
  spouseLife1GroupId: "SR10",
  spouseLife1Face: "8000",
  spouseLife1Units: "8",
  selectedPlanName: "RECOMMENDED",
  groupName: "RAMSEY GROUP",
};

const body = JSON.stringify(payload);
const req = http.request({
  hostname: 'localhost',
  port: 7432,
  path: '/inject-next',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`✅ EappSync responded ${res.statusCode}: ${data}`);
  });
});
req.on('error', err => console.error('❌ Could not reach localhost:7432:', err.message));
req.write(body);
req.end();
