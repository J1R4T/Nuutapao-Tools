const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// Set NUUTAPAO_ELECTRON_TESTS=1 on a Windows desktop/CI worker with Electron
// renderer support. Restricted shells often cannot launch Chromium's renderer.
test.skip(process.env.NUUTAPAO_ELECTRON_TESTS !== '1', 'requires an Electron-capable desktop runner');

test.describe('Electron user journeys', () => {
  let app;
  let window;
  let userDataPath;

  test.beforeEach(async () => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'nuu-electron-test-'));
    app = await electron.launch({
      args: [path.join(__dirname, '..', '..'), `--user-data-dir=${userDataPath}`, '--disable-gpu'],
      env: { ...process.env, NUUTAPAO_TEST: '1' }
    });
    window = await app.firstWindow();
  });

  test.afterEach(async () => {
    await app?.close();
    fs.rmSync(userDataPath, { recursive: true, force: true });
  });

  test('loads the home UI and navigates across feature tabs', async () => {
    await expect(window.locator('#home-tab')).toBeVisible();
    for (const tab of ['clipper', 'converter', 'qr', 'history', 'settings', 'about']) {
      await window.locator(`[data-tab="${tab}"]`).click();
      await expect(window.locator(`#${tab}-tab`)).toBeVisible();
    }
  });

  test('validates an empty download URL without starting work', async () => {
    await window.locator('#fetchBtn').click();
    await expect(window.locator('#toastContainer')).toContainText(/URL|link/i);
  });

  test('generates a QR preview and exposes copy/save actions', async () => {
    await window.locator('[data-tab="qr"]').click();
    await window.locator('#qrValue').fill('https://example.com/nuutapao');
    await window.locator('#qrGenerateBtn').click();
    await expect(window.locator('#qrPreviewImage')).toBeVisible();
    await expect(window.locator('#qrPreviewImage')).toHaveAttribute('src', /^data:image\/png;base64,/);
    await expect(window.locator('#qrActions')).toBeVisible();
  });
});
