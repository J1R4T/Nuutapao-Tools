const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const hubDistDir = path.join(distDir, 'hub');

console.log('🚀 Building Nuutapao Hub Executable (.exe)...');

// Ensure destination directories exist
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
if (!fs.existsSync(hubDistDir)) fs.mkdirSync(hubDistDir, { recursive: true });

// Ensure icon is in place
const iconSrc = path.join(rootDir, 'public', 'icon.ico');
const iconHub = path.join(rootDir, 'hub', 'assets', 'icon.ico');
if (fs.existsSync(iconSrc) && !fs.existsSync(iconHub)) {
  fs.copyFileSync(iconSrc, iconHub);
}

const hubBuilderConfig = {
  appId: 'com.nuutapao.hub',
  productName: 'Nuutapao Hub',
  directories: {
    output: 'dist/hub'
  },
  files: [
    'hub/**/*',
    'public/icon.ico',
    'public/tray-icon.png',
    'public/Nuutapao Human.png',
    'icon.ico'
  ],
  extraMetadata: {
    name: 'nuutapao-hub',
    version: '4.0.0',
    main: 'hub/main.js'
  },
  win: {
    target: [
      {
        target: 'portable',
        arch: ['x64']
      },
      {
        target: 'dir',
        arch: ['x64']
      }
    ],
    icon: fs.existsSync(iconSrc) ? 'public/icon.ico' : undefined,
    artifactName: 'Nuutapao Hub.exe'
  },
  portable: {
    splashImage: null
  }
};

const configPath = path.join(rootDir, 'hub-builder.json');
fs.writeFileSync(configPath, JSON.stringify(hubBuilderConfig, null, 2), 'utf8');

console.log('📦 Running electron-builder to generate Nuutapao Hub.exe...');
const cliPath = path.join(rootDir, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');

try {
  execSync(`node "${cliPath}" --config "${configPath}" --win --x64`, {
    cwd: rootDir,
    stdio: 'inherit'
  });

  // Copy portable exe to top-level dist for easy access
  const builtExe = path.join(hubDistDir, 'Nuutapao Hub.exe');
  const targetExe = path.join(distDir, 'Nuutapao Hub.exe');
  if (fs.existsSync(builtExe)) {
    fs.copyFileSync(builtExe, targetExe);
    console.log(`\n🎉 Success! Nuutapao Hub.exe created at:\n  - ${builtExe}\n  - ${targetExe}`);
  }

  // Also note the unpacked directory
  const unpackedExe = path.join(hubDistDir, 'win-unpacked', 'Nuutapao Hub.exe');
  if (fs.existsSync(unpackedExe)) {
    console.log(`  - Unpacked: ${unpackedExe}`);
  }
} finally {
  if (fs.existsSync(configPath)) {
    try { fs.unlinkSync(configPath); } catch (e) {}
  }
}
