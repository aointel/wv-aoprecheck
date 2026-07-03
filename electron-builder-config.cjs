// Enhanced electron-builder configuration for AO Intelligence
module.exports = {
  "appId": "com.aointelligence.callconnectorpro",
  "productName": "AO Intelligence",
  "copyright": "© 2025 AO Intelligence. Powered by ConnectNow.",
  "directories": {
    "output": "electron-dist",
    "buildResources": "electron/build-resources"
  },
  "files": [
    "dist/**/*",
    "electron/**/*",
    "node_modules/**/*", 
    "package.json",
    "data/**/*",
    "logs/**/*"
  ],
  "extraResources": [
    {
      "from": "data",
      "to": "data"
    },
    {
      "from": "logs", 
      "to": "logs"
    }
  ],
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ],
    "requestedExecutionLevel": "asInvoker"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": "always",
    "createStartMenuShortcut": true,
    "shortcutName": "AO Intelligence",
    "uninstallDisplayName": "AO Intelligence - Powered by ConnectNow",
    "artifactName": "AOIntelligence-Setup-\${version}.\${ext}",
    "license": "electron/build-resources/license.txt",
    "include": "electron/installer.nsh",
    "runAfterFinish": true,
    "displayLanguageSelector": false,
    "installerLanguages": ["en_US"],
    "language": "1033"
  },
  "mac": {
    "target": "dmg",
    "category": "public.app-category.business"
  },
  "dmg": {
    "title": "AO Intelligence \${version} - Powered by ConnectNow",
    "artifactName": "AO-Intelligence-\${version}.\${ext}"
  },
  "linux": {
    "target": "AppImage",
    "category": "Office"
  },
  "publish": {
    "provider": "generic",
    "url": "https://aointelligence.replit.app/api/desktop/releases"
  }
};
