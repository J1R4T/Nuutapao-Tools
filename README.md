# 🦊 Nuutapao Tools

<p align="center">
  <img src="public/logo.png" alt="Nuutapao Tools Logo" width="160" />
</p>

<p align="center">
  <b>A sleek, adorable, and high-performance media downloader, clipper, converter, and asset discovery tool powered by yt-dlp and Electron.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue.svg" alt="Platform Windows macOS" />
  <img src="https://img.shields.io/badge/Version-4.0.0-brightgreen.svg" alt="Version 4.0.0" />
  <img src="https://img.shields.io/badge/Node.js-18%2B-green.svg" alt="Node Version" />
  <img src="https://img.shields.io/badge/License-MIT-orange.svg" alt="License MIT" />
</p>

---

## ✨ Features

- ⚡ **Multi-Threaded Turbo Downloads**: Spawns optimized `yt-dlp` processes with fragment-level multi-threading for maximum download speeds.
- 🌐 **Comprehensive Platform Support**: Works with YouTube, TikTok, Instagram, Facebook, X (Twitter), Bilibili, Douyin, Reddit, Twitch, SoundCloud, Vimeo, and more.
- ✂️ **Precision Clipper**: Select precise time ranges and cut clips directly from live streams or videos without downloading the entire file.
- 🖼️ **API-less Assets Finder & Shuffled Discovery Feed**:
  - Search across the open web for both high-resolution **Photos** and animated **GIFs** with **zero API keys required**.
  - Pinterest-style shuffled multi-topic discovery feed when the search bar is empty (film photography, Y2K retro, anime scenery, aesthetic vibes).
  - Built-in machine learning from user interests that organically tunes recommendations over time.
- 🔊 **Cute & Pop Sound Effects (SFX) Engine**:
  - Procedural sound synthesis powered by native browser Web Audio API (zero `.mp3` or `.wav` overhead).
  - Delightful bubble pops, cheer chimes, airy whooshes, and victory completion fanfares.
  - Dual-control UI with titlebar quick mute/unmute (`🔊` / `🔇`) and Settings volume slider + preview.
- 🔄 **Built-in File Converter**: Convert downloaded or local video, audio, and image files to MP4, WebM, MKV, MP3, WAV, M4A, PNG, and JPG.
- 🚀 **Nuutapao Hub Integration**: Standalone companion launcher with single-instance window focusing and in-app GitHub auto-updates.
- 🍪 **Advanced Cookie & Auth Handling**: Import cookies directly from browsers (Chrome, Edge, Brave, Opera, etc.) or use a Netscape `cookies.txt` file for private, member-only, and age-restricted downloads.
- 🔒 **Secure DNS (DoH) & Proxy / VPN**: Integrated Secure DNS-over-HTTPS (Cloudflare, Google, OpenDNS) and SOCKS5/HTTP proxy support to bypass ISP domain blocks.
- 🇹🇭 **Full Multilingual Support**: English and Thai localization with full Unicode support for video titles, metadata, and folders.

---

## 📥 Installation

Download the latest installer from the **[Releases](https://github.com/J1R4T/Nuutapao-Tools/releases)** page:
- **`Nuutapao Tools Setup 4.0.0.exe`**: Official Windows NSIS installer with desktop and start menu shortcuts.
- **`Nuutapao Hub.exe`**: Portable standalone launcher and auto-updater.
- **`customsetup.exe`**: Custom animated installer with rich interactive setup experience.

---

## 🛠️ Development & Building from Source

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm`

### 1. Clone the repository
```bash
git clone https://github.com/J1R4T/Nuutapao-Tools.git
cd Nuutapao-Tools
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development mode
```bash
# Launch Nuutapao Tools
npm start

# Launch Nuutapao Hub
npm run hub
```

### 4. Run automated tests
```bash
# Run unit & API test suites (64 automated tests)
npm test
```

### 5. Build production executables (.exe)
```bash
# Build Nuutapao Tools NSIS Installer (dist/Nuutapao Tools Setup 4.0.0.exe)
npm run build

# Build Nuutapao Hub Portable (.exe) (dist/Nuutapao Hub.exe)
npm run build:hub

# Build Custom Setup Installer (dist/customsetup.exe)
npm run build:custom-setup

# Package clean source code zip for GitHub Release
npm run package:source
```

---

## 📂 Project Structure

```
Nuutapao Tools/
├── main.js                  # Electron main process & window management
├── preload.js               # IPC preload bridge
├── server.js                # Express & WebSocket backend for yt-dlp/ffmpeg & web search
├── app-state.js             # Atomic persistence & profile store
├── installer.nsh            # NSIS installer scripting
├── package.json             # App configuration and dependencies
├── hub/                     # Nuutapao Hub launcher & updater source
│   ├── main.js              # Hub Electron process
│   ├── preload.js           # Hub IPC bridge
│   ├── app.js               # Hub renderer & update logic
│   └── README.md            # Hub documentation
├── installer/               # Custom UI installer source
├── public/                  # Frontend UI (HTML, CSS, JS, Assets)
├── scripts/                 # Custom build and packaging scripts
├── test/                    # Automated test suites (unit & API tests)
└── tools/                   # Bundled yt-dlp binaries and notices
```

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.  
Bundled third-party binaries (`yt-dlp` and `FFmpeg`) are distributed under their respective open-source licenses (see `tools/NOTICE.txt`).
