const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const appServer = require('../server');

describe('QR Maker API', () => {
  let tempDir;
  let port;

  before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nuu-qr-test-'));
    appServer.configureRuntime({ isPackaged: false, resourcesPath: '', userDataPath: tempDir });
    port = await appServer.startServer();
  });

  after(async () => {
    await appServer.stopServer();
    appServer.setDialog(null);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const post = (pathname, body) => fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });

  test('validates absolute URL payloads and supported sizes', () => {
    assert.deepEqual(appServer.validateQrRequest({ value: 'mailto:hello@example.com', size: 256 }), { value: 'mailto:hello@example.com', size: 256 });
    assert.equal(appServer.validateQrRequest({ value: 'not a link', size: 512 }).error, 'Enter a valid absolute URL.');
    assert.equal(appServer.validateQrRequest({ value: 'https://example.com', size: 300 }).error, 'QR size must be 256, 512, or 1024 pixels.');
    assert.equal(appServer.createQrOptions(512).errorCorrectionLevel, 'H');
  });

  test('generates a PNG data URL for a valid link', async () => {
    const response = await post('/api/qr', { value: 'https://example.com/path?q=nuutapao', size: 512 });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.size, 512);
    assert.match(body.dataUrl, /^data:image\/png;base64,/);
  });

  test('rejects malformed links and unsupported sizes', async () => {
    const invalidLink = await post('/api/qr', { value: 'hello world', size: 512 });
    assert.equal(invalidLink.status, 400);
    const invalidSize = await post('/api/qr', { value: 'https://example.com', size: 300 });
    assert.equal(invalidSize.status, 400);
  });

  test('returns a clear response when save is cancelled or unavailable', async () => {
    appServer.setDialog(null);
    const unavailable = await post('/api/qr/save', { value: 'https://example.com', size: 256 });
    assert.equal(unavailable.status, 501);

    appServer.setDialog({ showSaveDialog: async () => ({ canceled: true }) });
    const cancelled = await post('/api/qr/save', { value: 'https://example.com', size: 256 });
    assert.deepEqual(await cancelled.json(), { cancelled: true, path: null });
  });

  test('saves a generated PNG and reports filesystem failures', async () => {
    const target = path.join(tempDir, 'qr-output');
    appServer.setDialog({ showSaveDialog: async () => ({ canceled: false, filePath: target }) });
    const saved = await post('/api/qr/save', { value: 'tel:+66000000000', size: 1024 });
    const body = await saved.json();
    assert.equal(saved.status, 200);
    assert.equal(body.path, `${target}.png`);
    assert.equal(fs.existsSync(body.path), true);
    assert.deepEqual(fs.readFileSync(body.path).subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    appServer.setDialog({ showSaveDialog: async () => ({ canceled: false, filePath: path.join(tempDir, 'missing', 'qr.png') }) });
    const failed = await post('/api/qr/save', { value: 'https://example.com', size: 256 });
    assert.equal(failed.status, 500);
  });
});
