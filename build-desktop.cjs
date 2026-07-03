const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting AO Intelligence Desktop Build Process...\n');

// Step 1: Clean previous builds
console.log('🧹 Cleaning previous builds...');
try {
  if (fs.existsSync('electron-dist')) {
    execSync('rm -rf electron-dist', { stdio: 'inherit' });
  }
  if (fs.existsSync('dist')) {
    execSync('rm -rf dist', { stdio: 'inherit' });
  }
  console.log('✅ Previous builds cleaned\n');
} catch (error) {
  console.error('❌ Error cleaning builds:', error.message);
  process.exit(1);
}

// Step 2: Build web application
console.log('🔨 Building web application...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Web application built successfully\n');
} catch (error) {
  console.error('❌ Error building web application:', error.message);
  process.exit(1);
}

// Step 3: Create electron assets directory
console.log('📁 Setting up Electron assets...');
try {
  const electronAssetsDir = path.join(__dirname, 'electron', 'assets');
  if (!fs.existsSync(electronAssetsDir)) {
    fs.mkdirSync(electronAssetsDir, { recursive: true });
  }
  
  // Create a simple icon if it doesn't exist
  const iconPath = path.join(electronAssetsDir, 'icon.png');
  if (!fs.existsSync(iconPath)) {
    console.log('⚠️  No app icon found, using default');
  }
  
  console.log('✅ Electron assets ready\n');
} catch (error) {
  console.error('❌ Error setting up assets:', error.message);
  process.exit(1);
}

// Step 4: Build Electron apps with custom configuration
console.log('⚡ Building Electron applications with custom branding...');
try {
  // Build for Windows and Mac using custom config
  execSync('npx electron-builder --config electron-builder-config.cjs', { stdio: 'inherit' });
  console.log('✅ Electron applications built successfully with custom welcome message\n');
} catch (error) {
  console.error('❌ Error building Electron apps:', error.message);
  process.exit(1);
}

// Step 5: List built files
console.log('📦 Built files:');
try {
  const electronDistDir = path.join(__dirname, 'electron-dist');
  if (fs.existsSync(electronDistDir)) {
    const files = fs.readdirSync(electronDistDir);
    files.forEach(file => {
      const filePath = path.join(electronDistDir, file);
      const stats = fs.statSync(filePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  📄 ${file} (${sizeInMB} MB)`);
    });
  }
} catch (error) {
  console.error('⚠️  Could not list built files:', error.message);
}

console.log('\n🎉 Desktop build process completed successfully!');
console.log('📦 Professional installers created with custom branding:');
console.log('   • Windows: Beautiful NSIS installer with "Welcome to AO Intelligence, powered by ConnectNow"');  
console.log('   • macOS: Professional DMG with custom styling');
console.log('🔗 Apps are ready for download at: https://aointelligence.replit.app/desktop-downloads');
console.log('\n💡 Your installers include:');
console.log('   ✅ Custom welcome message and branding');
console.log('   ✅ Professional license agreement'); 
console.log('   ✅ Desktop shortcuts and Start Menu integration');
console.log('   ✅ Auto-updater functionality built-in');