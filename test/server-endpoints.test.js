const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const appServer = require('../server');

describe('Server API Endpoints & State Management', () => {
  let serverPort;
  let tempDir;

  before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nuu-api-test-'));
    appServer.configureRuntime({
      isPackaged: false,
      resourcesPath: '',
      userDataPath: tempDir
    });
    serverPort = await appServer.startServer();
  });

  after(async () => {
    await appServer.stopServer();
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {}
    }
  });

  test('GET /api/app-state returns initial profile state', async () => {
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/app-state`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.version, 2);
    assert.equal(typeof data.settings, 'object');
    assert.equal(Array.isArray(data.history), true);
  });

  test('PATCH /api/app-state updates settings and persists profile', async () => {
    const patchBody = {
      settings: { theme: 'dark', language: 'th', runInBackground: false },
      downloadDefaults: { format: 'wav', quality: 'high' }
    };
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/app-state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody)
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.settings.theme, 'dark');
    assert.equal(data.settings.language, 'th');
    assert.equal(data.settings.runInBackground, false);
    assert.equal(data.downloadDefaults.format, 'wav');
  });

  test('POST /api/migrate performs one-time migration from client payload', async () => {
    const migratePayload = {
      settings: { alwaysOnTop: true },
      converterSavePath: '/custom/save/path',
      history: [{ id: 'migrated-dl-1', title: 'Migrated Download', status: 'done' }]
    };
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(migratePayload)
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.migrated, true);
    assert.equal(data.settings.alwaysOnTop, true);
    assert.equal(data.downloadDefaults.converterSavePath, '/custom/save/path');
    assert.equal(data.history.length, 1);
    assert.equal(data.history[0].id, 'migrated-dl-1');
  });

  test('GET /api/history returns history from server profile', async () => {
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/history`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(Array.isArray(data.history), true);
    assert.equal(data.history.length, 1);
  });

  test('DELETE /api/history/:id deletes single history item', async () => {
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/history/migrated-dl-1`, {
      method: 'DELETE'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.history.length, 0);
  });

  test('DELETE /api/history clears all history', async () => {
    // Add item first via patch
    await fetch(`http://127.0.0.1:${serverPort}/api/app-state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history: [{ id: 'temp-1', title: 'Temp' }]
      })
    });

    const clearRes = await fetch(`http://127.0.0.1:${serverPort}/api/history`, {
      method: 'DELETE'
    });
    assert.equal(clearRes.status, 200);
    const clearData = await clearRes.json();
    assert.equal(clearData.history.length, 0);
  });

  test('GET /api/config returns default save paths from state', async () => {
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/config`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.defaultPath);
    assert.ok(data.converterSavePath);
  });

  test('GET /api/assets/search validates query and reports setup_required when keys are unset', async () => {
    // 1. Missing query
    const resEmpty = await fetch(`http://127.0.0.1:${serverPort}/api/assets/search?q=`);
    assert.equal(resEmpty.status, 400);
    const errData = await resEmpty.json();
    assert.equal(errData.error, 'Search query is required.');

    // 2. Pixabay missing key
    const resPixabay = await fetch(`http://127.0.0.1:${serverPort}/api/assets/search?q=cat&source=pixabay`);
    assert.equal(resPixabay.status, 200);
    const pixabayData = await resPixabay.json();
    assert.equal(pixabayData.setup_required, 'pixabay');

    // 3. Giphy missing key
    const resGiphy = await fetch(`http://127.0.0.1:${serverPort}/api/assets/search?q=cat&source=giphy&type=gif`);
    assert.equal(resGiphy.status, 200);
    const giphyData = await resGiphy.json();
    assert.equal(giphyData.setup_required, 'giphy');

    // 4. Google source is API-less and does not require setup
    const resGoogle = await fetch(`http://127.0.0.1:${serverPort}/api/assets/search?q=cat&source=google`);
    assert.equal(resGoogle.status, 200);
    const googleData = await resGoogle.json();
    assert.equal(googleData.setup_required, undefined);
    assert.ok(Array.isArray(googleData.items));
  });

  test('POST /api/assets/download validates payload and saves asset to disk', async () => {
    // 1. Missing fields
    const resBad = await fetch(`http://127.0.0.1:${serverPort}/api/assets/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(resBad.status, 400);

    // 2. Download from local static server
    const downloadDir = path.join(tempDir, 'assets-out');
    const resDl = await fetch(`http://127.0.0.1:${serverPort}/api/assets/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `http://127.0.0.1:${serverPort}/style.css`,
        filename: 'downloaded-sample.css',
        savePath: downloadDir
      })
    });
    assert.equal(resDl.status, 200);
    const dlData = await resDl.json();
    assert.equal(dlData.success, true);
    assert.ok(fs.existsSync(dlData.path));
    assert.ok(fs.statSync(dlData.path).size > 0);

    // 3. Download without savePath defaults to user's Downloads folder
    const resDefaultDl = await fetch(`http://127.0.0.1:${serverPort}/api/assets/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `http://127.0.0.1:${serverPort}/style.css`,
        filename: 'default-downloads-test.css'
      })
    });
    assert.equal(resDefaultDl.status, 200);
    const defaultDlData = await resDefaultDl.json();
    assert.equal(defaultDlData.success, true);
    assert.ok(defaultDlData.path.includes(path.join('Downloads', 'default-downloads-test.css')));
    assert.ok(fs.existsSync(defaultDlData.path));
    try { fs.unlinkSync(defaultDlData.path); } catch {}
  });
});

