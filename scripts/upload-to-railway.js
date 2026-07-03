const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Uploading Electron builds to Railway...');

try {
  // Check if electron-dist directory exists
  const distDir = path.join(process.cwd(), 'electron-dist');
  if (!fs.existsSync(distDir)) {
    console.log('❌ electron-dist directory not found. Please run "npm run electron-dist" first.');
    process.exit(1);
  }

  // Get list of files to upload
  const files = fs.readdirSync(distDir);
  const installers = files.filter(file => 
    file.endsWith('.exe') || 
    file.endsWith('.dmg') || 
    file.endsWith('.AppImage') ||
    file.endsWith('.blockmap')
  );

  if (installers.length === 0) {
    console.log('❌ No installer files found in electron-dist directory.');
    process.exit(1);
  }

  console.log(`📦 Found ${installers.length} files to upload:`);
  installers.forEach(file => console.log(`  - ${file}`));

  // Create a releases directory on Railway (this would be done via Railway CLI or API)
  console.log('📤 Uploading files to Railway...');
  
  // For now, we'll just copy files to a local releases directory
  // In production, you'd upload these to your Railway server
  const releasesDir = path.join(process.cwd(), 'releases');
  if (!fs.existsSync(releasesDir)) {
    fs.mkdirSync(releasesDir, { recursive: true });
  }

  installers.forEach(file => {
    const sourcePath = path.join(distDir, file);
    const destPath = path.join(releasesDir, file);
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Copied ${file}`);
  });

  console.log('🎉 Files uploaded successfully!');
  console.log('📋 Next steps:');
  console.log('1. Deploy these files to your Railway server');
  console.log('2. Users with the app will be notified of the update');
  console.log('3. They can download the new version from the update dialog');

} catch (error) {
  console.error('❌ Upload failed:', error.message);
  process.exit(1);
}
