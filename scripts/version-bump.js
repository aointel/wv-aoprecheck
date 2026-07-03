const fs = require('fs');
const path = require('path');

// Get version bump type from command line argument
const bumpType = process.argv[2] || 'patch';

if (!['major', 'minor', 'patch'].includes(bumpType)) {
  console.error('❌ Invalid bump type. Use: major, minor, or patch');
  process.exit(1);
}

// Read package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Parse current version
const version = packageJson.version;
const versionParts = version.split('.').map(Number);
const [major, minor, patch] = versionParts;

// Bump version based on type
let newVersion;
switch (bumpType) {
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log(`🚀 Version bumped from ${version} to ${newVersion}`);
console.log(`📝 Updated package.json`);
console.log(`\n💡 Next steps:`);
console.log(`   1. Run: npm run build-desktop`);
console.log(`   2. Test desktop apps`);
console.log(`   3. Deploy to server for auto-updates`);