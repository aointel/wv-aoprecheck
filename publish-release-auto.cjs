/**
 * Auto-publish GitHub release
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'mmandella';
const REPO = 'PolicyVerify';
const VERSION = '1.0.3';
const TAG = `v${VERSION}`;

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN environment variable not set!');
  console.log('\n📝 To set it:');
  console.log('$env:GITHUB_TOKEN = "your_github_personal_access_token"');
  console.log('\nGet a token from: https://github.com/settings/tokens');
  process.exit(1);
}

async function createRelease() {
  const releaseData = JSON.stringify({
    tag_name: TAG,
    name: `${TAG} - Screenshot Fix + Credit Enforcement`,
    body: `## 🚨 Critical Updates

### ✅ What's Fixed
- Screenshot upload to Supabase working
- VDP blocked at -8 credits (NO EXCEPTIONS)
- Low credit warnings
- Server-side version enforcement
- Aggressive auto-updates (every 10 min)

### 📥 Installation
Download and run \`AOIntelligence-Setup-${VERSION}.exe\`

**This update will be automatically installed for all users.**`,
    draft: false,
    prerelease: false
  });

  const options = {
    hostname: 'api.github.com',
    path: `/repos/${OWNER}/${REPO}/releases`,
    method: 'POST',
    headers: {
      'User-Agent': 'Node.js',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': releaseData.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 201) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Failed to create release: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(releaseData);
    req.end();
  });
}

console.log('🚀 Publishing release to GitHub...');
console.log(`   Repository: ${OWNER}/${REPO}`);
console.log(`   Tag: ${TAG}`);

createRelease()
  .then((release) => {
    console.log('✅ Release created successfully!');
    console.log(`   URL: ${release.html_url}`);
    console.log('\n📦 Now upload these files manually to the release:');
    console.log(`   1. electron-dist/AOIntelligence-Setup-${VERSION}.exe`);
    console.log(`   2. electron-dist/latest.yml`);
    console.log(`   3. electron-dist/AOIntelligence-Setup-${VERSION}.exe.blockmap`);
  })
  .catch((error) => {
    console.error('❌ Failed to create release:', error.message);
  });

