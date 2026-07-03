# ConnectNow Electron Desktop App

This document explains how to build and distribute the ConnectNow application as a desktop Electron app with auto-updater functionality.

## Features

- **Desktop Application**: Native desktop experience with system integration
- **Auto-Updater**: Automatic updates from GitHub releases
- **Cross-Platform**: Windows, macOS, and Linux support
- **Installer Generation**: Professional installers for all platforms
- **Security**: Secure preload scripts and context isolation

## Development

### Start Development Mode
```bash
node scripts/dev-electron.js
```
This will:
1. Start the web server on localhost:5000
2. Wait for the server to be ready
3. Launch Electron pointing to the development server

### Build for Production
```bash
node scripts/build-electron.js
```
This will:
1. Build the web application (`npm run build`)
2. Package the Electron app with electron-builder
3. Generate installers in `dist-electron/`

## Release Process

### Create a New Release
```bash
# Patch release (1.0.1 -> 1.0.2)
node scripts/release.js patch

# Minor release (1.0.1 -> 1.1.0)
node scripts/release.js minor

# Major release (1.0.1 -> 2.0.0)
node scripts/release.js major
```

This will:
1. Bump the version in package.json
2. Build the application
3. Commit and tag the release
4. Push to GitHub
5. Trigger auto-updater for existing installations

## Auto-Updater

The app checks for updates:
- On startup (after 3 seconds)
- Via File → Check for Updates menu
- Automatically downloads and prompts to install

Updates are served from GitHub releases using the configured repository.

## Installation Files

After building, you'll find installers in `dist-electron/`:

### Windows
- `ConnectNow Setup 1.0.1.exe` - NSIS installer
- `ConnectNow 1.0.1.exe` - Portable executable

### macOS
- `ConnectNow-1.0.1.dmg` - DMG installer
- `ConnectNow-1.0.1-mac.zip` - ZIP archive

### Linux
- `ConnectNow-1.0.1.AppImage` - AppImage executable
- `connectnow_1.0.1_amd64.deb` - Debian package

## Configuration

### Electron Builder Config
Edit `electron-builder.json` to customize:
- App metadata (name, description, author)
- Platform-specific settings
- Code signing certificates
- Update server configuration

### Auto-Updater Config
The updater is configured to use GitHub releases from:
- Owner: `mmandella`
- Repository: `PolicyVerify`

Change these in `electron-builder.json` under the `publish` section.

## Security

The Electron app follows security best practices:
- Context isolation enabled
- Node integration disabled
- Secure preload script
- External link handling
- CSP-friendly configuration

## Troubleshooting

### Development Issues
- Ensure the web server is running on port 5000
- Check that all dependencies are installed (`npm install`)
- Verify Electron is installed (`npx electron --version`)

### Build Issues
- Clear node_modules and reinstall if needed
- Check that all build dependencies are available
- Ensure you have the required system tools for native builds

### Update Issues
- Verify GitHub repository access
- Check that releases are properly tagged
- Ensure the update server URL is correct

## Distribution

1. **GitHub Releases**: Automatic via the release script
2. **Direct Distribution**: Share installer files from dist-electron/
3. **Enterprise**: Deploy via your organization's software distribution system

The auto-updater will handle updates automatically once users install the initial version.