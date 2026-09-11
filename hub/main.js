const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Performance Optimizations — applied before app ready
app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds');
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('js-flags', '--optimize-for-size');

let hubWindow;

// --- Single Instance Lock ---
// Prevent duplicate Hub windows when user re-launches while already running
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  // Another instance is already running — quit this one immediately
  app.quit();
} else {
  // When another instance tries to launch, bring existing window to front
  app.on('second-instance', () => {
    if (hubWindow) {
      if (hubWindow.isMinimized()) hubWindow.restore();
      hubWindow.show();
      hubWindow.focus();
    }
  });

  function createHubWindow() {
    const icoPath = path.join(__dirname, 'assets', 'icon.ico');
    const rootIco = path.join(__dirname, '..', 'icon.ico');
    const pubIco = path.join(__dirname, '..', 'public', 'icon.ico');
    const icon = fs.existsSync(icoPath) ? icoPath
      : fs.existsSync(rootIco) ? rootIco
      : fs.existsSync(pubIco) ? pubIco
      : undefined;

    hubWindow = new BrowserWindow({
      width: 960,
      height: 640,
      frame: false,
      transparent: true,
      resizable: false,
      show: false,
      backgroundColor: '#090a10',
      icon: icon,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        backgroundThrottling: false
      }
    });

    hubWindow.loadFile(path.join(__dirname, 'index.html'));

    // Use ready-to-show (fires when first render is done) — faster than did-finish-load
    hubWindow.once('ready-to-show', () => {
      hubWindow.show();
      hubWindow.focus();
    });
  }

  app.whenReady().then(createHubWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Window controls
  ipcMain.on('hub-close', () => {
    hubWindow?.close();
  });

  ipcMain.on('hub-minimize', () => {
    hubWindow?.minimize();
  });

  ipcMain.on('hub-maximize', () => {
    if (hubWindow && !hubWindow.isMaximized()) {
      hubWindow.setResizable(true);
      hubWindow.maximize();
    }
  });

  ipcMain.on('hub-unmaximize', () => {
    if (hubWindow && hubWindow.isMaximized()) {
      hubWindow.unmaximize();
      hubWindow.setSize(960, 640);
      hubWindow.center();
    }
  });

  ipcMain.on('hub-toggle-maximize', () => {
    if (hubWindow) {
      if (hubWindow.isMaximized()) {
        hubWindow.unmaximize();
        hubWindow.setSize(960, 640);
        hubWindow.center();
      } else {
        hubWindow.setResizable(true);
        hubWindow.maximize();
      }
    }
  });

  // Launch main tools program — search multiple install locations
  // Helper: check if a process is running and try to bring its window to front
  function isProcessRunningAndFocus(processName) {
    const { execSync } = require('child_process');
    try {
      // Check if the process is running
      const result = execSync(`tasklist /FI "IMAGENAME eq ${processName}" /NH`, { encoding: 'utf8', timeout: 5000 });
      if (!result.includes(processName)) return false;

      // Process is running — bring its window to front using PowerShell + Win32 API
      const psScript = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class Win32Focus {
            [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
            [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
            [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
          }
"@
        $procs = Get-Process -Name '${processName.replace('.exe', '')}' -ErrorAction SilentlyContinue
        foreach ($p in $procs) {
          if ($p.MainWindowHandle -ne 0) {
            if ([Win32Focus]::IsIconic($p.MainWindowHandle)) {
              [Win32Focus]::ShowWindow($p.MainWindowHandle, 9)
            }
            [Win32Focus]::SetForegroundWindow($p.MainWindowHandle)
            break
          }
        }
      `.trim();
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\\\"')}"`, { timeout: 8000, windowsHide: true });
      return true;
    } catch (err) {
      return false;
    }
  }

  ipcMain.handle('hub-launch-tools', async () => {
    // First check if Nuutapao Tools is already running — if so, just bring it to front
    if (isProcessRunningAndFocus('Nuutapao Tools.exe')) {
      return { success: true, alreadyRunning: true, message: 'Nuutapao Tools is already running — brought to front.' };
    }

    const localAppData = process.env.LOCALAPPDATA || '';
    const possiblePaths = [
      // Installed location (NSIS per-user install)
      path.join(localAppData, 'Programs', 'Nuutapao Tools', 'Nuutapao Tools.exe'),
      // Development unpacked build
      path.join(__dirname, '..', 'dist', 'win-unpacked', 'Nuutapao Tools.exe'),
      // System-wide install
      'C:\\Program Files\\Nuutapao Tools\\Nuutapao Tools.exe',
      'C:\\Program Files (x86)\\Nuutapao Tools\\Nuutapao Tools.exe'
    ];

    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          const child = spawn(p, [], { detached: true, stdio: 'ignore' });
          child.unref();
          return { success: true, path: p };
        }
      } catch (err) {
        // skip inaccessible paths
      }
    }

    return { success: false, message: 'Nuutapao Tools executable not found. Please install it first or check the install path.' };
  });

  // Select install directory — native dialog
  ipcMain.handle('hub-select-dir', async (event, currentPath) => {
    const result = await dialog.showOpenDialog(hubWindow, {
      title: 'Select Destination Directory',
      defaultPath: currentPath || 'C:\\Program Files\\Nuutapao Tools',
      properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Provide system/version info to renderer
  ipcMain.handle('hub-system-info', async () => {
    const localAppData = process.env.LOCALAPPDATA || '';
    const installPath = path.join(localAppData, 'Programs', 'Nuutapao Tools', 'Nuutapao Tools.exe');
    const installedVer = getInstalledToolsVersion();
    return {
      installed: fs.existsSync(installPath),
      installPath: fs.existsSync(installPath) ? path.dirname(installPath) : null,
      installedVersion: installedVer,
      platform: process.platform,
      arch: process.arch
    };
  });

  // Helper: detect installed version from Windows Registry or executable VersionInfo
  function getInstalledToolsVersion() {
    const { execSync } = require('child_process');
    const localAppData = process.env.LOCALAPPDATA || '';
    const exePath = path.join(localAppData, 'Programs', 'Nuutapao Tools', 'Nuutapao Tools.exe');

    if (fs.existsSync(exePath)) {
      try {
        const regOut = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\NuutapaoTools" /v DisplayVersion', {
          encoding: 'utf8',
          timeout: 3000,
          stdio: ['ignore', 'pipe', 'ignore']
        });
        const match = regOut.match(/DisplayVersion\s+REG_SZ\s+([^\r\n]+)/i);
        if (match && match[1]) {
          return match[1].trim();
        }
      } catch (e) {}

      try {
        const psOut = execSync(`powershell -NoProfile -Command "(Get-Item '${exePath}').VersionInfo.FileVersion"`, {
          encoding: 'utf8',
          timeout: 4000,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'ignore']
        });
        if (psOut && psOut.trim()) {
          return psOut.trim();
        }
      } catch (e) {}
    }

    return '4.0.0';
  }

  // Semver helpers
  function parseSemver(str) {
    if (!str) return [0, 0, 0];
    const cleaned = str.replace(/^[^\d]*/, '');
    const parts = cleaned.split('.').map(p => parseInt(p, 10) || 0);
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }

  function compareSemver(a, b) {
    const vA = parseSemver(a);
    const vB = parseSemver(b);
    for (let i = 0; i < 3; i++) {
      if (vA[i] > vB[i]) return 1;
      if (vA[i] < vB[i]) return -1;
    }
    return 0;
  }

  // Check for updates on GitHub Releases
  ipcMain.handle('hub-check-github-updates', async () => {
    const installedVer = getInstalledToolsVersion();
    const repoUrl = 'https://api.github.com/repos/J1R4T/Nuutapao-Tools/releases';

    try {
      const res = await fetch(repoUrl, {
        headers: {
          'User-Agent': 'Nuutapao-Hub',
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!res.ok) {
        return {
          success: false,
          error: `GitHub API HTTP ${res.status}`,
          installedVersion: 'v' + installedVer,
          latestVersion: 'v' + installedVer,
          hasUpdate: false
        };
      }

      const releases = await res.json();
      if (!Array.isArray(releases) || releases.length === 0) {
        return {
          success: true,
          installedVersion: 'v' + installedVer,
          latestVersion: 'v' + installedVer,
          hasUpdate: false,
          message: 'No releases found on GitHub.'
        };
      }

      let bestRelease = null;
      let bestAsset = null;
      let bestVersionStr = '';

      for (const rel of releases) {
        if (rel.draft) continue;
        const exeAsset = (rel.assets || []).find(a => a.name.toLowerCase().endsWith('.exe'));
        if (!exeAsset) continue;

        const rawVer = rel.tag_name || rel.name || '';
        const parsed = parseSemver(rawVer);
        const verStr = parsed.join('.');

        if (!bestRelease || compareSemver(verStr, bestVersionStr) > 0) {
          bestRelease = rel;
          bestAsset = exeAsset;
          bestVersionStr = verStr;
        }
      }

      if (!bestRelease || !bestAsset) {
        return {
          success: true,
          installedVersion: 'v' + installedVer,
          latestVersion: 'v' + installedVer,
          hasUpdate: false,
          message: 'No executable releases found on GitHub.'
        };
      }

      const hasUpdate = compareSemver(bestVersionStr, installedVer) > 0;

      return {
        success: true,
        hasUpdate,
        installedVersion: 'v' + installedVer,
        latestVersion: 'v' + bestVersionStr,
        releaseTag: bestRelease.tag_name,
        releaseName: bestRelease.name || bestRelease.tag_name,
        releaseDate: bestRelease.published_at,
        releaseNotes: bestRelease.body || 'No release notes provided.',
        assetName: bestAsset.name,
        assetSize: bestAsset.size,
        downloadUrl: bestAsset.browser_download_url,
        htmlUrl: bestRelease.html_url
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        installedVersion: 'v' + installedVer,
        latestVersion: 'v' + installedVer,
        hasUpdate: false
      };
    }
  });

  // Download & Install update from GitHub release asset
  ipcMain.handle('hub-download-and-install-update', async (event, { downloadUrl, assetName }) => {
    if (!downloadUrl) throw new Error('No download URL provided');

    const updateDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP, 'Nuutapao Hub', 'updates');
    if (!fs.existsSync(updateDir)) {
      fs.mkdirSync(updateDir, { recursive: true });
    }

    const fileName = assetName || 'Nuutapao_Tools_Update.exe';
    const targetPath = path.join(updateDir, fileName);

    try {
      const res = await fetch(downloadUrl, {
        headers: { 'User-Agent': 'Nuutapao-Hub' },
        redirect: 'follow'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to download update file`);

      const totalBytes = parseInt(res.headers.get('content-length') || '0', 10);
      const fileStream = fs.createWriteStream(targetPath);

      let downloadedBytes = 0;
      let lastTime = Date.now();
      let bytesSinceLast = 0;
      let currentSpeedMBps = '0.0';

      const reader = res.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        downloadedBytes += value.length;
        bytesSinceLast += value.length;
        fileStream.write(Buffer.from(value));

        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed >= 0.2) {
          const speed = (bytesSinceLast / (1024 * 1024)) / elapsed;
          currentSpeedMBps = speed.toFixed(1);
          lastTime = now;
          bytesSinceLast = 0;

          const percent = totalBytes > 0 ? Math.min(100, (downloadedBytes / totalBytes) * 100) : 0;
          const downloadedMB = (downloadedBytes / (1024 * 1024)).toFixed(1);
          const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);

          event.sender.send('hub-download-progress', {
            percent,
            downloadedMB,
            totalMB,
            speedMBps: currentSpeedMBps,
            downloadedBytes,
            totalBytes
          });
        }
      }

      await new Promise((resolve, reject) => {
        fileStream.end(resolve);
        fileStream.on('error', reject);
      });

      // Send 100% completion event
      event.sender.send('hub-download-progress', {
        percent: 100,
        downloadedMB: (downloadedBytes / (1024 * 1024)).toFixed(1),
        totalMB: (totalBytes / (1024 * 1024)).toFixed(1),
        speedMBps: 'Complete',
        downloadedBytes,
        totalBytes
      });

      // Auto-launch the downloaded installer
      try {
        const child = spawn(targetPath, [], { detached: true, stdio: 'ignore' });
        child.unref();
      } catch (launchErr) {
        console.error('Failed to auto-launch installer:', launchErr);
      }

      return { success: true, targetPath };
    } catch (err) {
      throw err;
    }
  });

  // Safely open external link
  ipcMain.handle('hub-open-external', async (event, url) => {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
      return true;
    }
    return false;
  });

} // end single-instance else block
