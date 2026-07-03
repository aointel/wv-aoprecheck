#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Version bump options
const bumpTypes = ['patch', 'minor', 'major'];
const bumpType = process.argv[2] || 'patch';

if (!bumpTypes.includes(bumpType)) {
  console.error('❌ Invalid version bump type. Use: patch, minor, or major');
  process.exit(1);
}

console.log(`🔖 Creating ${bumpType} release...`);

try {
  // Read current version
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const currentVersion = packageJson.version;
  console.log(`📋 Current version: ${currentVersion}`);

  // Bump version
  console.log('⬆️ Bumping version...');
  execSync(`npm version ${bumpType} --no-git-tag-version`, { stdio: 'inherit' });

  // Read new version
  const newPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const newVersion = newPackageJson.version;
  console.log(`🎯 New version: ${newVersion}`);

  // Build the application
  console.log('🔨 Building application...');
  execSync('node scripts/build-electron.js', { stdio: 'inherit' });

  // Commit and tag
  console.log('📝 Committing changes...');
  execSync('git add .', { stdio: 'inherit' });
  execSync(`git commit -m "Release v${newVersion}"`, { stdio: 'inherit' });
  execSync(`git tag v${newVersion}`, { stdio: 'inherit' });

  // Push to origin
  console.log('🚀 Pushing to origin...');
  execSync('git push origin main', { stdio: 'inherit' });
  execSync(`git push origin v${newVersion}`, { stdio: 'inherit' });

  console.log('✅ Release created successfully!');
  console.log(`🎉 Version ${newVersion} is now available`);
  console.log('📦 Installers are in dist-electron/');

} catch (error) {
  console.error('❌ Release failed:', error.message);
  process.exit(1);
}