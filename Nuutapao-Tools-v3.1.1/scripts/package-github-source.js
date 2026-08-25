const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const githubSourceDir = path.join(distDir, 'github-source');
const targetDir = path.join(githubSourceDir, 'Nuutapao-Tools-v3.1.1');
const zipFile = path.join(githubSourceDir, 'Nuutapao-Tools-v3.1.1-Source.zip');

console.log('📦 Packaging clean source code for GitHub release...');

// Ensure directory exists
if (!fs.existsSync(githubSourceDir)) {
  fs.mkdirSync(githubSourceDir, { recursive: true });
}

// Clean old folder
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

// Source files and folders to include
const includeItems = [
  'installer',
  'public',
  'scripts',
  'test',
  'tools',
  '.gitignore',
  'app-state.js',
  'icon.ico',
  'installer.nsh',
  'LICENSE',
  'main.js',
  'Nuutapao Human Head.png',
  'Nuutapao Human.png',
  'Nuutapao petting2.gif',
  'package-lock.json',
  'package.json',
  'playwright.config.js',
  'preload.js',
  'README.md',
  'server.js'
];

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      if (['node_modules', 'dist', '.git', '.cache'].includes(entry)) continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

for (const item of includeItems) {
  const srcPath = path.join(rootDir, item);
  const destPath = path.join(targetDir, item);
  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, destPath);
    console.log(`  + Copied ${item}`);
  }
}

// Create clean source ZIP
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

const sysTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
const tarBin = (process.platform === 'win32' && fs.existsSync(sysTar)) ? sysTar : 'tar';

try {
  execSync(`"${tarBin}" -a -c -f "${zipFile}" -C "${githubSourceDir}" "Nuutapao-Tools-v3.1.1"`, {
    cwd: rootDir,
    stdio: 'inherit'
  });
  console.log(`✨ Created source archive: ${zipFile}`);
} catch (e) {
  console.warn('tar -a failed, creating zip with standard tar:', e.message);
  execSync(`"${tarBin}" -cf "${zipFile}" -C "${githubSourceDir}" "Nuutapao-Tools-v3.1.1"`, {
    cwd: rootDir,
    stdio: 'inherit'
  });
}

console.log('✅ GitHub source code package updated successfully!');
