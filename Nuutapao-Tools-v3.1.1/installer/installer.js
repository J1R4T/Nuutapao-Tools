document.addEventListener('DOMContentLoaded', async () => {
  const terminalLogs = document.getElementById('terminalLogs');
  const terminalBox = document.getElementById('terminalBox');
  const installPathInput = document.getElementById('installPathInput');
  const browseBtn = document.getElementById('browseBtn');
  const desktopShortcutCheck = document.getElementById('desktopShortcutCheck');
  const startMenuShortcutCheck = document.getElementById('startMenuShortcutCheck');
  const installBtn = document.getElementById('installBtn');
  const controlsBar = document.getElementById('controlsBar');
  const completeBar = document.getElementById('completeBar');
  const launchBtn = document.getElementById('launchBtn');
  const progressFill = document.getElementById('progressFill');
  const petSlider = document.getElementById('petSlider');
  const minBtn = document.getElementById('minBtn');
  const closeBtn = document.getElementById('closeBtn');

  // Window controls
  if (minBtn) minBtn.addEventListener('click', () => window.installerAPI?.minimizeWindow());
  if (closeBtn) closeBtn.addEventListener('click', () => window.installerAPI?.closeWindow());

  // Set default path
  try {
    const defaultPath = await window.installerAPI?.getDefaultPath();
    if (defaultPath) {
      installPathInput.value = defaultPath;
    }
  } catch (err) {
    installPathInput.value = 'C:\\Program Files\\Nuutapao Tools';
  }

  // Check for existing installation and update button text
  async function checkExistingInstall() {
    try {
      const exists = await window.installerAPI?.checkExisting(installPathInput.value);
      if (exists) {
        installBtn.textContent = 'Reinstall (Fresh) 🔄';
        appendLog('⚠️ Existing installation detected — will reinstall fresh (all old data will be removed).');
      } else {
        installBtn.textContent = 'Start Install ✨';
      }
    } catch (_) {}
  }
  await checkExistingInstall();

  // Browse Directory
  if (browseBtn) {
    browseBtn.addEventListener('click', async () => {
      try {
        const selected = await window.installerAPI?.selectDirectory(installPathInput.value);
        if (selected) {
          installPathInput.value = selected;
          appendLog(`Selected directory: ${selected}`);
          await checkExistingInstall();
        }
      } catch (err) {}
    });
  }

  // Batched log rendering — during installation, hundreds of log lines per
  // second arrive via IPC.  Flushing them in a single rAF keeps the UI smooth.
  let pendingLogs = [];
  let logRafId = null;

  function flushLogs() {
    logRafId = null;
    if (pendingLogs.length === 0) return;
    const frag = document.createDocumentFragment();
    for (const text of pendingLogs) {
      const line = document.createElement('div');
      line.className = 'log-line';
      line.innerHTML = `<span>•</span> ${escapeHtml(text)}`;
      frag.appendChild(line);
    }
    pendingLogs = [];
    terminalLogs.appendChild(frag);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }

  function appendLog(text) {
    pendingLogs.push(text);
    if (!logRafId) {
      logRafId = requestAnimationFrame(flushLogs);
    }
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }

  function updateProgress(percent) {
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    progressFill.style.width = `${p}%`;
    petSlider.style.left = `${p}%`;
  }

  // Progress and Log Listeners from IPC
  if (window.installerAPI?.onProgress) {
    window.installerAPI.onProgress((data) => {
      if (typeof data === 'number') {
        updateProgress(data);
      } else if (data && data.percent !== undefined) {
        updateProgress(data.percent);
      }
    });
  }

  if (window.installerAPI?.onLog) {
    window.installerAPI.onLog((data) => {
      const msg = typeof data === 'string' ? data : data.message || JSON.stringify(data);
      appendLog(msg);
    });
  }

  // Start Installation
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      const targetPath = installPathInput.value.trim();
      if (!targetPath) return;

      installBtn.disabled = true;
      browseBtn.disabled = true;
      installPathInput.disabled = true;
      desktopShortcutCheck.disabled = true;
      startMenuShortcutCheck.disabled = true;

      appendLog(`Starting installation into ${targetPath}...`);
      updateProgress(5);

      try {
        const result = await window.installerAPI?.startInstallation(
          targetPath,
          desktopShortcutCheck.checked,
          startMenuShortcutCheck.checked
        );

        if (result && result.success) {
          updateProgress(100);
          appendLog('Installation completed successfully!');
          appendLog('Registered application shortcuts.');
          
          controlsBar.classList.add('hidden');
          completeBar.classList.remove('hidden');
        } else {
          appendLog(`Error: ${result?.error || 'Installation failed'}`);
          installBtn.disabled = false;
          browseBtn.disabled = false;
        }
      } catch (err) {
        appendLog(`Error: ${err.message}`);
        installBtn.disabled = false;
        browseBtn.disabled = false;
      }
    });
  }

  // Launch App
  if (launchBtn) {
    launchBtn.addEventListener('click', async () => {
      const targetPath = installPathInput.value.trim();
      await window.installerAPI?.launchApp(targetPath);
      window.installerAPI?.closeWindow();
    });
  }
});
