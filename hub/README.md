# 🚀 Nuutapao Hub

<p align="center">
  <img src="../public/logo.png" alt="Nuutapao Hub Logo" width="140" />
</p>

<p align="center">
  <b>The official dashboard, launcher, and auto-updater for Nuutapao Tools.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows-blue.svg" alt="Platform Windows" />
  <img src="https://img.shields.io/badge/Version-4.0.0-brightgreen.svg" alt="Version 4.0.0" />
  <img src="https://img.shields.io/badge/Electron-30%2B-cyan.svg" alt="Electron Version" />
  <img src="https://img.shields.io/badge/License-MIT-orange.svg" alt="License MIT" />
</p>

---

## 📖 Overview

**Nuutapao Hub** is a lightweight, frameless companion application designed to manage, launch, and automatically update **Nuutapao Tools**. Built with Electron and vanilla web technologies, it provides a seamless, ultra-fast gateway to the Nuutapao Tools suite without bloat.

---

## ✨ Key Features

### ⚡ Instant Tool Launch & Single-Instance Intelligence
- **Intelligent Process Detection**: Checks if Nuutapao Tools is already running. If it is, Nuutapao Hub brings the existing window to the foreground instantly instead of launching redundant duplicate instances.
- **Smart Path Resolution**: Automatically scans and detects Nuutapao Tools across multiple locations:
  1. User-level NSIS installation (`%LOCALAPPDATA%\Programs\Nuutapao Tools\Nuutapao Tools.exe`)
  2. Local development / unpacked builds (`dist/win-unpacked/Nuutapao Tools.exe`)
  3. System-wide 64-bit installation (`C:\Program Files\Nuutapao Tools\Nuutapao Tools.exe`)
  4. System-wide 32-bit installation (`C:\Program Files (x86)\Nuutapao Tools\Nuutapao Tools.exe`)

### 🔄 GitHub Releases Auto-Updater
- **Direct GitHub API Integration**: Queries `https://api.github.com/repos/J1R4T/Nuutapao-Tools/releases` to discover new releases and compare SemVer tags.
- **In-App Download Engine**: Downloads release assets directly within the Hub interface with real-time progress, percentage calculations, and live transfer speeds (MB/s).
- **Automated Installer Handoff**: Once the update download completes, Hub automatically triggers the installer for a zero-hassle upgrade experience.
- **Release Notes Viewer**: Formats and displays release notes, changelogs, and asset information directly in the dashboard.

### 🎨 Glassmorphic Frameless UI
- **Futuristic Dark Aesthetic**: Sleek glassmorphism interface styled with CSS custom properties, neon ambient glows, and smooth transitions.
- **Custom Titlebar & Controls**: Native window management (Minimize, Maximize/Restore, Close) mapped via Electron IPC.
- **Instant Cold Startup**: Optimized GPU switches and `--optimize-for-size` flags ensure the Hub window opens in under 3 seconds.

---

## 📂 File Structure

```
hub/
├── assets/                  # Icons and visual assets
│   └── icon.ico             # Application icon
├── index.html               # Main dashboard UI structure
├── main.js                  # Electron main process (window, IPC, process management)
├── preload.js               # Secure contextBridge API (`window.hubAPI`)
├── app.js                   # Renderer logic (update checks, UI state, download progress)
├── style.css                # Glassmorphic styling and responsive layouts
└── README.md                # Documentation (this file)
```

---

## 🛠️ IPC API (`window.hubAPI`)

Nuutapao Hub enforces strict Electron security best practices with `nodeIntegration: false` and `contextIsolation: true`. All renderer actions communicate through `preload.js`:

| Channel / Method | Description |
| :--- | :--- |
| `hubAPI.launchTools()` | Launches or focuses `Nuutapao Tools.exe`. |
| `hubAPI.getSystemInfo()` | Returns installation status, detected version, and OS architecture. |
| `hubAPI.checkGitHubUpdates()` | Queries GitHub Releases API and compares SemVer versions. |
| `hubAPI.downloadAndInstallUpdate(opts)` | Streams update `.exe` from GitHub with live download progress. |
| `hubAPI.onDownloadProgress(callback)` | Listens for real-time progress events (`percent`, `speedMBps`, etc.). |
| `hubAPI.selectDirectory(currentPath)` | Opens native directory picker dialog. |
| `hubAPI.openExternal(url)` | Securely opens an HTTP/HTTPS URL in the user's default browser. |
| `hubAPI.close()`, `minimize()`, `maximize()`, `toggleMaximize()` | Controls the frameless window state. |

---

## 🚀 Running & Building

### Run in Development Mode
From the project root:
```bash
npm run hub
```

### Build Standalone Executable (.exe)
Builds the portable single-file executable and unpacked directory:
```bash
npm run build:hub
```

**Generated Artifacts:**
- **Portable Executable**: `dist/Nuutapao Hub.exe` (and `dist/hub/Nuutapao Hub.exe`)
- **Unpacked Folder**: `dist/hub/win-unpacked/Nuutapao Hub.exe`

---

## 📜 License

This project is part of Nuutapao Tools and is licensed under the [MIT License](../LICENSE).
