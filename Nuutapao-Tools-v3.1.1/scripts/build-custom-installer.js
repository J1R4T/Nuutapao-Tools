const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const platform = isWin ? 'win' : isMac ? 'mac' : 'linux';

const winUnpackedDir = path.join(distDir, 'win-unpacked');
const macUnpackedDir = path.join(distDir, 'mac');
const payloadZip = path.join(distDir, 'payload.zip');

console.log('🎨 Step 0: Generating high-resolution Windows icons...');
execSync(`node scripts/generate-icons.js`, {
  cwd: rootDir,
  stdio: 'inherit'
});

console.log(`🚀 Step 1: Building core application payload for ${platform}...`);

const builderArgs = isWin ? '--dir --win --x64' : isMac ? '--dir --mac --x64' : '--dir --linux --x64';
execSync(`node ./node_modules/electron-builder/out/cli/cli.js ${builderArgs}`, {
  cwd: rootDir,
  stdio: 'inherit'
});

const unpackedDir = isWin ? winUnpackedDir : macUnpackedDir;
if (!fs.existsSync(unpackedDir)) {
  throw new Error(`Failed to generate unpacked directory at ${unpackedDir}.`);
}

console.log('📦 Step 2: Creating fast payload archive for instant installer startup...');
if (fs.existsSync(payloadZip)) {
  fs.unlinkSync(payloadZip);
}
// Create single zip archive for lightning-fast installer launch
execSync(`tar -cf "${payloadZip}" -C "${unpackedDir}" .`, {
  cwd: rootDir,
  stdio: 'inherit'
});

console.log('✨ Step 3: Packaging Custom Setup Installer...');

const customBuilderConfig = {
  appId: 'com.nuutapao.tools.customsetup',
  productName: 'Nuutapao Tools V.3.1.1 Custom Setup',
  directories: {
    output: 'dist/setup-out'
  },
  files: [
    'installer/**/*',
    'public/Nuutapao Human Head.png',
    'public/Nuutapao petting2.gif',
    'public/Nuutapao border.png',
    'public/logo.png',
    'public/icon.ico',
    'public/tray-icon.ico',
    'public/tray-icon.png',
    'icon.ico'
  ],
  extraMetadata: {
    main: 'installer/main.js'
  },
  win: {
    target: [
      {
        target: 'portable',
        arch: ['x64']
      }
    ],
    icon: 'public/icon.ico',
    artifactName: 'customsetup.exe'
  },
  portable: {
    splashImage: null
  },
  extraResources: [
    {
      from: 'dist/payload.zip',
      to: 'payload.zip'
    }
  ]
};

// Add macOS target if building on Mac
if (isMac) {
  customBuilderConfig.mac = {
    target: [{ target: 'dmg', arch: ['x64'] }],
    icon: 'public/logo.png',
    category: 'public.app-category.utilities',
    artifactName: 'customsetup.dmg'
  };
}

const configPath = path.join(rootDir, 'custom-installer-builder.json');
fs.writeFileSync(configPath, JSON.stringify(customBuilderConfig, null, 2), 'utf8');

const setupBuilderArgs = isWin ? '--win --x64' : isMac ? '--mac --x64' : '--linux --x64';
try {
  execSync(`node ./node_modules/electron-builder/out/cli/cli.js --config "${configPath}" ${setupBuilderArgs}`, {
    cwd: rootDir,
    stdio: 'inherit'
  });

  const builtExe = path.join(distDir, 'setup-out', 'customsetup.exe');
  const finalExe = path.join(distDir, 'customsetup.exe');
  if (fs.existsSync(builtExe)) {
    if (fs.existsSync(finalExe)) fs.unlinkSync(finalExe);
    fs.copyFileSync(builtExe, finalExe);
    fs.rmSync(path.join(distDir, 'setup-out'), { recursive: true, force: true });
  }

  const outputName = isWin ? 'customsetup.exe' : 'customsetup.dmg';
  console.log(`\n🎉 Custom Setup Installer built successfully: dist/${outputName}\n`);
} finally {
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
  if (fs.existsSync(payloadZip)) {
    fs.unlinkSync(payloadZip);
  }
}
