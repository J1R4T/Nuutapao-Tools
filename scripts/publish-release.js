/**
 * Helper script to create and upload releases to https://github.com/J1R4T/Nuutapao-Tools
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version || '4.0.0';
const tagName = `v${version}`;
const releaseTitle = `Nuutapao Tools v${version}`;

console.log('====================================================');
console.log(`🚀 GitHub Release Assistant for Nuutapao Tools (${tagName})`);
console.log('   Repository: https://github.com/J1R4T/Nuutapao-Tools');
console.log('====================================================\n');

// 1. Check for built executable files
const distDir = path.join(rootDir, 'dist');
const possibleAssets = [
  path.join(distDir, `Nuutapao Tools Setup ${version}.exe`),
  path.join(distDir, 'Nuutapao Hub.exe')
];

const availableAssets = possibleAssets.filter(p => fs.existsSync(p));

console.log('📦 Available files for upload:');
if (availableAssets.length === 0) {
  console.log('  ⚠️ No .exe files found in dist/. Please run:');
  console.log('     npm run build        (for Nuutapao Tools Setup)');
  console.log('     npm run build:hub    (for Nuutapao Hub)');
} else {
  availableAssets.forEach(a => {
    const stat = fs.statSync(a);
    const mb = (stat.size / (1024 * 1024)).toFixed(1);
    console.log(`  ✅ ${path.basename(a)} (${mb} MB)`);
  });
}
console.log('');

// 2. Check for GitHub Token for automated API upload
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

async function run() {
  if (token && availableAssets.length > 0) {
    console.log('🔑 GitHub Token detected! Attempting automatic release creation via API...');
    try {
      // Create release
      const createRes = await fetch('https://api.github.com/repos/J1R4T/Nuutapao-Tools/releases', {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'Nuutapao-Release-Script',
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tag_name: tagName,
          name: releaseTitle,
          body: `## ✨ What's New in Nuutapao Tools v${version}\n\n- Updated release for Nuutapao Tools\n- Nuutapao Hub auto-update support`,
          draft: false,
          prerelease: false
        })
      });

      const releaseData = await createRes.json();
      if (releaseData.id && releaseData.upload_url) {
        console.log(`🎉 Release created: ${releaseData.html_url}`);
        const uploadUrlBase = releaseData.upload_url.split('{')[0];

        for (const assetPath of availableAssets) {
          const fileName = path.basename(assetPath);
          console.log(`⏳ Uploading ${fileName}...`);
          const fileBuffer = fs.readFileSync(assetPath);
          const uploadRes = await fetch(`${uploadUrlBase}?name=${encodeURIComponent(fileName)}`, {
            method: 'POST',
            headers: {
              'Authorization': `token ${token}`,
              'User-Agent': 'Nuutapao-Release-Script',
              'Content-Type': 'application/octet-stream',
              'Content-Length': fileBuffer.length
            },
            body: fileBuffer
          });
          if (uploadRes.ok) {
            console.log(`✅ Uploaded ${fileName} successfully!`);
          } else {
            console.log(`❌ Failed to upload ${fileName}:`, await uploadRes.text());
          }
        }
        console.log('\n🌟 All done! Nuutapao Hub will now detect this new release!');
        return;
      }
    } catch (err) {
      console.log('⚠️ Automatic API upload encountered an error:', err.message);
    }
  }

  // 3. Web upload guidance (standard GitHub flow)
  const newReleaseUrl = `https://github.com/J1R4T/Nuutapao-Tools/releases/new?tag=${encodeURIComponent(tagName)}&title=${encodeURIComponent(releaseTitle)}`;
  console.log('📋 HOW TO UPLOAD YOUR .EXE TO GITHUB:');
  console.log('----------------------------------------------------');
  console.log('1. Open this URL in your browser:');
  console.log(`   👉 ${newReleaseUrl}\n`);
  console.log('2. Tag version is set to: ' + tagName);
  console.log('3. Release title is set to: ' + releaseTitle);
  console.log('4. Drag and drop these files from your "dist" folder:');
  availableAssets.forEach(a => console.log(`   📁 ${a}`));
  console.log('5. Click "Publish release"!\n');
  console.log('💡 Once published, Nuutapao Hub will automatically detect the update!');
  console.log('----------------------------------------------------');

  // Open browser to release page
  try {
    const startCmd = process.platform === 'win32' ? `start "" "${newReleaseUrl}"` : `open "${newReleaseUrl}"`;
    execSync(startCmd, { stdio: 'ignore' });
    console.log('🌐 Opening GitHub Releases in your default browser...');
  } catch (e) {
    // Ignore error if browser cannot be launched
  }
}

run();
