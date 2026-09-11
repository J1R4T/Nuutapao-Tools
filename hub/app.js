/**
 * Nuutapao Hub — Desktop Launcher & Program Updater Prototype Logic
 */

(function () {
  'use strict';

  // --- State ---
  let soundEnabled = true;
  let currentAppVersion = 'v4.0.0';
  let latestAppVersion = 'v4.0.0';
  let activeReleaseInfo = null;
  let isCheckingUpdates = false;
  let isUpdating = false;

  // --- Elements ---
  const hubWindow = document.getElementById('hubWindow');
  const ambientCanvas = document.getElementById('ambientCanvas');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');
  const hubCloseBtn = document.getElementById('hubCloseBtn');

  const viewDeck = document.getElementById('viewDeck');
  const viewToolsDetail = document.getElementById('viewToolsDetail');

  const cardTools = document.getElementById('cardTools');
  const backToDeckBtn = document.getElementById('backToDeckBtn');

  const lblCurrentVersion = document.getElementById('lblCurrentVersion');
  const lblLatestVersion = document.getElementById('lblLatestVersion');
  const btnCheckUpdates = document.getElementById('btnCheckUpdates');
  const checkUpdatesIcon = document.getElementById('checkUpdatesIcon');
  const btnPrimaryUpdate = document.getElementById('btnPrimaryUpdate');
  const btnPrimaryText = document.getElementById('btnPrimaryText');
  const btnLaunchApp = document.getElementById('btnLaunchApp');
  const btnChangeDir = document.getElementById('btnChangeDir');
  const lblInstallPath = document.getElementById('lblInstallPath');

  const panelChangelog = document.getElementById('panelChangelog');
  const panelChangelogTitle = document.getElementById('panelChangelogTitle');
  const panelReleaseDate = document.getElementById('panelReleaseDate');
  const changelogList = document.getElementById('changelogList');
  const btnOpenGitHubRelease = document.getElementById('btnOpenGitHubRelease');

  const panelProgress = document.getElementById('panelProgress');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressPctText = document.getElementById('progressPctText');
  const progressSpeedText = document.getElementById('progressSpeedText');
  const progressSizeText = document.getElementById('progressSizeText');
  const progressStatusHeading = document.getElementById('progressStatusHeading');
  const progressStatusSub = document.getElementById('progressStatusSub');
  const installTerminal = document.getElementById('installTerminal');
  const progressFinishedActions = document.getElementById('progressFinishedActions');
  const btnLaunchNewVersion = document.getElementById('btnLaunchNewVersion');

  const hubToast = document.getElementById('hubToast');

  // =========================================================================
  // Web Audio Synthesizer (No external audio assets needed!)
  // =========================================================================
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
  }

  function playTone(freq, type, duration, vol = 0.08, rampDown = true) {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      if (rampDown) {
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      }

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context policy safe fallback
    }
  }

  function playCardHoverSound() {
    playTone(587.33, 'sine', 0.08, 0.04); // D5 soft ping
  }

  function playCardClickSound() {
    playTone(880, 'triangle', 0.12, 0.07); // A5 chime
    setTimeout(() => playTone(1174.66, 'sine', 0.18, 0.06), 60); // D6
  }

  function playWhooshSound() {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(740, audioCtx.currentTime + 0.22);

      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {}
  }

  function playSuccessChime() {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 major chord
    notes.forEach((note, index) => {
      setTimeout(() => {
        playTone(note, 'triangle', 0.35, 0.1);
      }, index * 90);
    });
  }

  // =========================================================================
  // Background Ambient Particles Canvas
  // =========================================================================
  function initAmbientCanvas() {
    if (!ambientCanvas) return;
    const ctx = ambientCanvas.getContext('2d');
    let width = (ambientCanvas.width = window.innerWidth);
    let height = (ambientCanvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = ambientCanvas.width = window.innerWidth;
      height = ambientCanvas.height = window.innerHeight;
    });

    const particles = [];
    const particleCount = 45;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: (Math.random() - 0.5) * 0.4,
        alpha: Math.random() * 0.6 + 0.2,
        hue: Math.random() > 0.6 ? 25 : 270 // warm orange or purple dust
      });
    }

    function render() {
      ctx.clearRect(0, 0, width, height);

      for (let p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 75%, ${p.alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsla(${p.hue}, 90%, 65%, ${p.alpha})`;
        ctx.fill();
      }

      requestAnimationFrame(render);
    }

    render();
  }

  // =========================================================================
  // 3D Parallax Tilt on Cards
  // =========================================================================
  function setupCardTilt(card) {
    if (!card) return;

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -12;
      const rotateY = ((x - centerX) / centerX) * 12;

      card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-8px) scale3d(1.03, 1.03, 1.03)`;
    });

    card.addEventListener('mouseenter', () => {
      playCardHoverSound();
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale3d(1, 1, 1)';
    });
  }

  // =========================================================================
  // Toast Notification Helper
  // =========================================================================
  let toastTimer = null;
  function showToast(message, duration = 3000) {
    if (!hubToast) return;
    hubToast.innerHTML = message;
    hubToast.classList.remove('hidden');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      hubToast.classList.add('hidden');
    }, duration);
  }

  // =========================================================================
  // View Navigation
  // =========================================================================
  function switchView(fromView, toView) {
    playWhooshSound();
    fromView.classList.remove('active');
    toView.classList.add('active');
  }

  // =========================================================================
  // GitHub Releases Updater Logic
  // =========================================================================
  function appendTerminalLine(text, className = '') {
    const line = document.createElement('div');
    line.className = 'term-line ' + className;
    line.textContent = text;
    installTerminal.appendChild(line);
    installTerminal.scrollTop = installTerminal.scrollHeight;
  }

  function renderReleaseNotes(notes) {
    if (!changelogList || !notes || !notes.trim()) return;
    const lines = notes.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#') && !l.toLowerCase().startsWith('note patch'));

    if (lines.length === 0) return;

    changelogList.innerHTML = '';
    lines.slice(0, 8).forEach(line => {
      const cleanText = line.replace(/^[-*+•\s]+/, '').trim();
      if (!cleanText) return;

      const li = document.createElement('li');
      li.className = 'changelog-item';

      let icon = '✨';
      if (/fix|bug/i.test(cleanText)) icon = '🐛';
      else if (/speed|fast|turbo|optimi/i.test(cleanText)) icon = '⚡';
      else if (/add|new|feature/i.test(cleanText)) icon = '🌟';
      else if (/ui|design|look/i.test(cleanText)) icon = '🎨';
      else if (/security|protect/i.test(cleanText)) icon = '🛡️';

      li.innerHTML = `
        <span class="item-icon">${icon}</span>
        <div class="item-body">
          <strong>${cleanText}</strong>
        </div>
      `;
      changelogList.appendChild(li);
    });
  }

  async function checkForGitHubUpdates(showToastNotification = false) {
    if (isCheckingUpdates) return;
    isCheckingUpdates = true;
    if (checkUpdatesIcon) checkUpdatesIcon.classList.add('spinning');

    try {
      if (window.electronAPI && window.electronAPI.checkGitHubUpdates) {
        const result = await window.electronAPI.checkGitHubUpdates();
        if (result) {
          if (result.installedVersion) {
            currentAppVersion = result.installedVersion.startsWith('v') ? result.installedVersion : 'v' + result.installedVersion;
            lblCurrentVersion.textContent = currentAppVersion;
          }

          if (result.success) {
            activeReleaseInfo = result;
            latestAppVersion = result.latestVersion.startsWith('v') ? result.latestVersion : 'v' + result.latestVersion;
            lblLatestVersion.textContent = latestAppVersion;

            if (result.hasUpdate) {
              lblLatestVersion.style.color = '#ff7043';
              btnPrimaryText.textContent = `⚡ Update to ${latestAppVersion}`;
              btnPrimaryUpdate.style.background = 'linear-gradient(135deg, #ff4500 0%, #ff7043 100%)';
              btnPrimaryUpdate.classList.add('pulse-update');
              btnPrimaryUpdate.disabled = false;
              btnPrimaryUpdate.style.opacity = '1';

              if (panelChangelogTitle) {
                panelChangelogTitle.textContent = `✨ What's New in ${result.releaseName || latestAppVersion}`;
              }
              if (panelReleaseDate && result.releaseDate) {
                try {
                  const d = new Date(result.releaseDate);
                  panelReleaseDate.textContent = 'Released ' + d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                } catch (e) {}
              }
              if (result.releaseNotes) {
                renderReleaseNotes(result.releaseNotes);
              }

              if (showToastNotification) {
                showToast(`🔔 New release available: ${latestAppVersion} on GitHub!`);
              }
            } else {
              lblLatestVersion.style.color = '#4ade80';
              btnPrimaryText.textContent = `Already Up to Date (${currentAppVersion})`;
              btnPrimaryUpdate.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
              btnPrimaryUpdate.classList.remove('pulse-update');
              btnPrimaryUpdate.disabled = false;
              btnPrimaryUpdate.style.opacity = '1';

              if (showToastNotification) {
                showToast(`✅ Nuutapao Tools is up to date (${currentAppVersion})`);
              }
            }
          } else if (result.error && showToastNotification) {
            showToast(`⚠️ ${result.error}`);
          }
        }
      }
    } catch (err) {
      console.error('Update check failed:', err);
      if (showToastNotification) {
        showToast('⚠️ Could not connect to GitHub API');
      }
    } finally {
      isCheckingUpdates = false;
      if (checkUpdatesIcon) {
        setTimeout(() => checkUpdatesIcon.classList.remove('spinning'), 400);
      }
    }
  }

  async function startRealUpdate() {
    if (isUpdating) return;

    if (!activeReleaseInfo || !activeReleaseInfo.downloadUrl) {
      showToast('🔍 Checking GitHub Releases for latest download package...');
      await checkForGitHubUpdates(true);
      if (!activeReleaseInfo || !activeReleaseInfo.downloadUrl) {
        showToast('ℹ️ No .exe installer asset found on GitHub yet.');
        return;
      }
    }

    isUpdating = true;
    playCardClickSound();

    panelChangelog.classList.add('hidden');
    panelProgress.classList.remove('hidden');
    progressFinishedActions.classList.add('hidden');

    btnPrimaryUpdate.disabled = true;
    btnPrimaryUpdate.style.opacity = '0.5';

    installTerminal.innerHTML = '';
    const releaseTag = activeReleaseInfo.releaseTag || activeReleaseInfo.latestVersion;
    const assetName = activeReleaseInfo.assetName || 'Nuutapao Tools Setup.exe';
    const mbTotal = activeReleaseInfo.assetSize ? (activeReleaseInfo.assetSize / (1024 * 1024)).toFixed(1) : '143.0';

    appendTerminalLine(`[1/4] Connecting to GitHub Releases (${releaseTag})...`, 'highlight');
    appendTerminalLine(`[2/4] Package: ${assetName} (${mbTotal} MB)`);
    progressStatusHeading.textContent = `Downloading ${assetName}...`;
    progressStatusSub.textContent = 'Streaming high-speed release package from GitHub CDN';

    if (window.electronAPI && window.electronAPI.onDownloadProgress) {
      window.electronAPI.onDownloadProgress((data) => {
        progressBarFill.style.width = data.percent.toFixed(1) + '%';
        progressPctText.textContent = Math.round(data.percent) + '%';
        progressSpeedText.textContent = `${data.speedMBps} MB/s`;
        progressSizeText.textContent = `${data.downloadedMB} / ${data.totalMB} MB`;
      });
    }

    try {
      appendTerminalLine(`[3/4] Streaming data from GitHub CDN...`);
      const result = await window.electronAPI.downloadAndInstallUpdate({
        downloadUrl: activeReleaseInfo.downloadUrl,
        assetName: activeReleaseInfo.assetName
      });

      if (result && result.success) {
        appendTerminalLine(`[4/4] Download verified & installer launched!`, 'success');
        finishUpdate(activeReleaseInfo.latestVersion);
      } else {
        throw new Error('Download was not completed');
      }
    } catch (err) {
      appendTerminalLine(`❌ Error: ${err.message}`, 'error');
      progressStatusHeading.textContent = 'Download Failed';
      progressStatusSub.textContent = err.message;
      btnPrimaryUpdate.disabled = false;
      btnPrimaryUpdate.style.opacity = '1';
      isUpdating = false;
      showToast(`❌ Update failed: ${err.message}`);
    }
  }

  function finishUpdate(newVer) {
    isUpdating = false;
    currentAppVersion = (newVer && newVer.startsWith('v')) ? newVer : ('v' + (newVer || '4.0.0'));

    lblCurrentVersion.textContent = currentAppVersion;
    lblCurrentVersion.style.color = '#4ade80';

    progressStatusHeading.textContent = `🎉 Installer Ready & Launched!`;
    progressStatusSub.textContent = 'Setup wizard launched. Complete setup to finish update.';
    progressSpeedText.textContent = 'Complete';

    appendTerminalLine('✨ Setup wizard is running. Follow on-screen prompts to complete.', 'success');

    progressFinishedActions.classList.remove('hidden');

    btnPrimaryText.textContent = `Already Up to Date (${currentAppVersion})`;
    btnPrimaryUpdate.style.opacity = '1';
    btnPrimaryUpdate.disabled = false;
    btnPrimaryUpdate.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    btnPrimaryUpdate.classList.remove('pulse-update');

    playSuccessChime();
    showToast(`✨ Installer started! Complete installation to finish.`);
  }

  // =========================================================================
  // Event Bindings
  // =========================================================================
  function initEvents() {
    // Sound Toggle
    soundToggleBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
      soundToggleBtn.title = soundEnabled ? 'Sound Enabled' : 'Sound Muted';
      if (soundEnabled) playCardClickSound();
    });

    // Close Hub
    hubCloseBtn.addEventListener('click', () => {
      playCardClickSound();
      showToast('👋 Closing Nuutapao Hub...', 1500);
      setTimeout(() => {
        if (window.electronAPI && window.electronAPI.closeWindow) {
          window.electronAPI.closeWindow();
        } else if (window.opener) {
          window.close();
        } else {
          // Visual exit animation in browser
          const win = document.getElementById('hubWindow');
          win.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
          win.style.transform = 'scale(0.8) translateY(30px)';
          win.style.opacity = '0';
          setTimeout(() => {
            win.style.display = 'none';
            alert('Nuutapao Hub closed. You can refresh the page to reopen.');
          }, 400);
        }
      }, 300);
    });

    function openToolsDetail() {
      playCardClickSound();
      switchView(viewDeck, viewToolsDetail);
      // Automatically check for GitHub updates when opening tools details
      checkForGitHubUpdates(false);
    }

    // Card 2: Creator Tools (Transition to Detail View: card moves left, info moves right)
    cardTools.addEventListener('click', (e) => {
      e.stopPropagation();
      openToolsDetail();
    });

    const cardToolsWrap = document.getElementById('cardToolsWrap');
    if (cardToolsWrap) {
      cardToolsWrap.addEventListener('click', () => {
        openToolsDetail();
      });
    }

    cardTools.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openToolsDetail();
      }
    });

    // Return to Hub Deck (Transition back to centered cards deck)
    backToDeckBtn.addEventListener('click', () => {
      playCardClickSound();
      switchView(viewToolsDetail, viewDeck);
    });

    // Check for updates button
    if (btnCheckUpdates) {
      btnCheckUpdates.addEventListener('click', (e) => {
        e.stopPropagation();
        playCardClickSound();
        checkForGitHubUpdates(true);
      });
    }

    // View on GitHub Releases button
    if (btnOpenGitHubRelease) {
      btnOpenGitHubRelease.addEventListener('click', (e) => {
        e.stopPropagation();
        playCardClickSound();
        const url = activeReleaseInfo?.htmlUrl || 'https://github.com/J1R4T/Nuutapao-Tools/releases';
        if (window.electronAPI && window.electronAPI.openExternal) {
          window.electronAPI.openExternal(url);
        } else {
          window.open(url, '_blank');
        }
      });
    }

    // Primary Update Action
    btnPrimaryUpdate.addEventListener('click', () => {
      if (activeReleaseInfo && activeReleaseInfo.hasUpdate) {
        startRealUpdate();
      } else {
        checkForGitHubUpdates(true);
      }
    });

    // Launch Program
    btnLaunchApp.addEventListener('click', async () => {
      playCardClickSound();
      showToast('🚀 Launching Nuutapao Tools...');
      if (window.electronAPI && window.electronAPI.launchApp) {
        try {
          const result = await window.electronAPI.launchApp();
          if (result && result.success) {
            if (result.alreadyRunning) {
              showToast('🔄 Nuutapao Tools is already open — brought to front!');
            } else {
              showToast('✅ Nuutapao Tools launched! Have fun creating!');
            }
          } else {
            showToast('⚠️ ' + (result?.message || 'Could not find Nuutapao Tools executable.'));
          }
        } catch (err) {
          showToast('❌ Failed to launch: ' + err.message);
        }
      } else {
        showToast('ℹ️ Launch is only available in the desktop app.');
      }
    });

    btnLaunchNewVersion.addEventListener('click', async () => {
      playSuccessChime();
      showToast('🚀 Launching Nuutapao Tools v4.0.0...');
      if (window.electronAPI && window.electronAPI.launchApp) {
        try {
          const result = await window.electronAPI.launchApp();
          if (result && result.success) {
            if (result.alreadyRunning) {
              showToast('🔄 Nuutapao Tools is already open — brought to front!');
            } else {
              showToast('✅ Nuutapao Tools v4.0.0 launched with Turbo Engine!');
            }
          } else {
            showToast('⚠️ ' + (result?.message || 'Could not find Nuutapao Tools executable.'));
          }
        } catch (err) {
          showToast('❌ Failed to launch: ' + err.message);
        }
      } else {
        showToast('ℹ️ Launch is only available in the desktop app.');
      }
    });

    // Change Directory picker (native dialog in Electron, prompt fallback in browser)
    btnChangeDir.addEventListener('click', async () => {
      playCardClickSound();
      if (window.electronAPI && window.electronAPI.selectDirectory) {
        try {
          const newPath = await window.electronAPI.selectDirectory(lblInstallPath.textContent);
          if (newPath) {
            lblInstallPath.textContent = newPath;
            showToast(`📁 Install path updated to: ${newPath}`);
          }
        } catch (err) {
          showToast('❌ Failed to select directory: ' + err.message);
        }
      } else {
        const newPath = prompt('Set install destination directory:', lblInstallPath.textContent);
        if (newPath && newPath.trim()) {
          lblInstallPath.textContent = newPath.trim();
          showToast(`📁 Install path updated to: ${newPath.trim()}`);
        }
      }
    });

    // Keyboard navigation (ESC closes modal, Arrow keys between cards)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (viewToolsDetail.classList.contains('active')) {
          switchView(viewToolsDetail, viewDeck);
        }
      }
    });

    // Setup 3D Tilt for active card
    setupCardTilt(cardTools);
  }

  // =========================================================================
  // Window Dragging (Browser fallback + Native Electron drag support)
  // =========================================================================
  function setupWindowDragging() {
    const titlebar = document.getElementById('hubTitlebar');
    const win = document.getElementById('hubWindow');
    if (!titlebar || !win) return;

    let isDragging = false;
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('.titlebar-controls')) return;
      if (window.electronAPI) return; // Handled natively by Electron -webkit-app-region: drag

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = win.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      titlebar.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      win.style.position = 'fixed';
      win.style.left = `${initialLeft + dx}px`;
      win.style.top = `${initialTop + dy}px`;
      win.style.margin = '0';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        titlebar.style.cursor = '';
      }
    });
  }

  // =========================================================================
  // Initialize
  // =========================================================================
  window.addEventListener('DOMContentLoaded', () => {
    initAmbientCanvas();
    initEvents();
    setupWindowDragging();

    // Set the update button to green 'already up to date' since version matches
    if (currentAppVersion === latestAppVersion) {
      lblCurrentVersion.style.color = '#4ade80';
      btnPrimaryUpdate.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    }

    // Fetch installed path and version from Electron
    if (window.electronAPI && window.electronAPI.getSystemInfo) {
      window.electronAPI.getSystemInfo().then(info => {
        if (info && info.installPath && lblInstallPath) {
          lblInstallPath.textContent = info.installPath;
        }
        if (info && info.installedVersion) {
          currentAppVersion = info.installedVersion.startsWith('v') ? info.installedVersion : 'v' + info.installedVersion;
          lblCurrentVersion.textContent = currentAppVersion;
        }
        // Defer update check so UI renders instantly first
        setTimeout(() => checkForGitHubUpdates(false), 3000);
      }).catch(() => {
        setTimeout(() => checkForGitHubUpdates(false), 3000);
      });
    } else {
      setTimeout(() => checkForGitHubUpdates(false), 3000);
    }
  });
})();
