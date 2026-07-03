const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔧 Fixing package.json and building real installers...\n');

// Step 1: Read and backup current package.json
const packagePath = 'package.json';
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const backupPath = 'package.json.backup';

console.log('📁 Backing up package.json...');
fs.writeFileSync(backupPath, JSON.stringify(packageJson, null, 2));

// Step 2: Move electron packages to devDependencies
console.log('🔧 Moving electron packages to devDependencies...');
const electronPackages = ['electron', 'electron-builder', 'electron-is-dev', 'electron-reload', 'electron-updater'];

electronPackages.forEach(pkg => {
  if (packageJson.dependencies[pkg]) {
    packageJson.devDependencies[pkg] = packageJson.dependencies[pkg];
    delete packageJson.dependencies[pkg];
    console.log(`  ✅ Moved ${pkg} to devDependencies`);
  }
});

// Step 3: Write fixed package.json
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
console.log('✅ Package.json fixed\n');

try {
  // Step 4: Build web application first
  console.log('🔨 Building web application...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Web build complete\n');

  // Step 5: Build actual Electron installers
  console.log('⚡ Building real Electron installers...');
  execSync('npx electron-builder build --publish=never', { stdio: 'inherit' });
  
  console.log('\n🎉 SUCCESS! Real installers built!');
  
  // Step 6: List actual built files
  try {
    const files = fs.readdirSync('electron-dist');
    console.log('\n📦 Built installers:');
    files.forEach(file => {
      if (file.endsWith('.exe') || file.endsWith('.dmg') || file.endsWith('.AppImage')) {
        const stats = fs.statSync(`electron-dist/${file}`);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`  🚀 ${file} (${sizeInMB} MB)`);
        console.log(`     https://aointelligence.replit.app/api/desktop/download/${file}`);
      }
    });
  } catch (e) {
    console.log('⚠️  Could not list files');
  }

} catch (error) {
  console.error('❌ Build failed:', error.message);
} finally {
  // Step 7: Restore original package.json
  console.log('\n🔄 Restoring original package.json...');
  fs.writeFileSync(packagePath, fs.readFileSync(backupPath, 'utf8'));
  fs.unlinkSync(backupPath);
  console.log('✅ Package.json restored');
}