const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;

console.log(`🚀 Publishing version ${version} to GitHub...`);

try {
  // Build the app
  console.log('📦 Building application...');
  execSync('npm run build', { stdio: 'inherit' });

  // Build Electron for all platforms
  console.log('🔨 Building Electron for all platforms...');
  execSync('npm run electron-dist', { stdio: 'inherit' });

  // Create a release on GitHub
  console.log('📤 Creating GitHub release...');
  
  const releaseNotes = `
## What's New in v${version}

- Updated application with latest features
- Bug fixes and improvements
- Enhanced performance and stability

## Downloads

- **Windows**: AOIntelligence-Setup-${version}.exe
- **macOS**: AOIntelligence-${version}.dmg (Intel & Apple Silicon)
- **Linux**: AOIntelligence-${version}.AppImage

## Installation

1. Download the appropriate installer for your operating system
2. Run the installer
3. The app will automatically update in the future

## Auto-Update

This version includes auto-update functionality. When a new version is available, you'll be notified and can download it directly from within the app.
  `.trim();

  // Create release using GitHub CLI (if available) or git tags
  try {
    execSync(`gh release create v${version} electron-dist/*.exe electron-dist/*.dmg electron-dist/*.AppImage -t "AO Intelligence v${version}" -n "${releaseNotes}"`, { stdio: 'inherit' });
    console.log('✅ Release created successfully!');
  } catch (error) {
    console.log('⚠️  GitHub CLI not available, creating git tag instead...');
    execSync(`git tag v${version}`, { stdio: 'inherit' });
    execSync(`git push origin v${version}`, { stdio: 'inherit' });
    console.log('✅ Git tag created. Please create a release manually on GitHub.');
  }

  console.log('🎉 Release process completed!');
  console.log('📋 Next steps:');
  console.log('1. Users with the app installed will be notified of the update');
  console.log('2. They can download the new version from the update dialog');
  console.log('3. Or they can download manually from the GitHub releases page');

} catch (error) {
  console.error('❌ Release failed:', error.message);
  process.exit(1);
}
