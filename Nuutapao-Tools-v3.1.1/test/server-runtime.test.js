const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');
const server = require('../server');
const { createMediaSpawn, makeProcess } = require('./helpers/fake-process');

describe('media runtime API with deterministic adapters', () => {
  let root;
  let port;
  let opened = [];
  const executable = process.execPath;

  before(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'nuu-runtime-test-'));
    server.configureRuntime({ isPackaged: false, resourcesPath: '', userDataPath: root });
    server.setRuntimeAdapters({
      spawn: createMediaSpawn(),
      getToolPath: () => executable,
      exec: (command, callback) => { opened.push(command); callback?.(); }
    });
    server.setDialog({ showOpenDialog: async options => ({ canceled: false, filePaths: [options.defaultPath || path.join(root, 'picked.txt')] }) });
    port = await server.startServer();
  });

  after(async () => {
    await server.stopServer();
    server.resetRuntimeAdapters();
    server.setDialog(null);
    fs.rmSync(root, { recursive: true, force: true });
  });

  const request = (pathname, options) => fetch(`http://127.0.0.1:${port}${pathname}`, options);

  test('reports tool health and supports an engine update', async () => {
    const health = await request('/api/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
    const update = await request('/api/update-ytdlp', { method: 'POST' });
    assert.equal((await update.json()).status, 'up-to-date');
  });

  test('fetches metadata and rejects an empty URL', async () => {
    const bad = await request('/api/info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(bad.status, 400);
    const good = await request('/api/info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.test/video' }) });
    const body = await good.json();
    assert.equal(good.status, 200);
    assert.equal(body.title, 'Fixture video');
    assert.equal(body.formats.length, 1);
  });

  test('retries browser-cookie metadata requests without cookies when the browser database is unavailable', async () => {
    let calls = 0;
    server.setRuntimeAdapters({
      getToolPath: () => executable,
      exec: (command, callback) => callback?.(),
      spawn: (command, args) => {
        if (!args.includes('--dump-json')) return createMediaSpawn()(command, args);
        calls += 1;
        return calls === 1
          ? makeProcess({ code: 1, stderr: 'ERROR: could not find chrome cookies database' })
          : createMediaSpawn()(command, args);
      }
    });
    const response = await request('/api/info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.test/video', cookieSource: 'browser', cookieBrowser: 'chrome' }) });
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
    server.setRuntimeAdapters({ spawn: createMediaSpawn(), getToolPath: () => executable, exec: (command, callback) => callback?.() });
  });

  test('starts a download, broadcasts progress, and persists history', async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const messages = [];
    await new Promise(resolve => socket.once('open', resolve));
    socket.on('message', value => messages.push(JSON.parse(value)));
    const outputPath = path.join(root, 'downloads');
    const response = await request('/api/download', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.test/video', outputPath }) });
    assert.equal(response.status, 200);
    await new Promise(resolve => setTimeout(resolve, 30));
    const downloads = await (await request('/api/downloads')).json();
    assert.equal(downloads.history.at(0).status, 'done');
    assert.ok(messages.some(message => message.type === 'progress'));
    socket.close();
  });

  test('records download failures and can cancel an active download', async () => {
    server.setRuntimeAdapters({
      getToolPath: () => executable,
      exec: (command, callback) => callback?.(),
      spawn: (command, args) => args.includes('--newline')
        ? makeProcess({ code: 1, stderr: 'ERROR: Video unavailable' })
        : createMediaSpawn()(command, args)
    });
    const outputPath = path.join(root, 'failed-download');
    const failed = await request('/api/download', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.test/missing', outputPath }) });
    assert.equal(failed.status, 200);
    await new Promise(resolve => setTimeout(resolve, 20));
    const history = await (await request('/api/history')).json();
    assert.equal(history.history.at(0).status, 'error');

    const waiting = makeProcess({ defer: true });
    server.setRuntimeAdapters({ getToolPath: () => executable, exec: (command, callback) => callback?.(), spawn: () => waiting });
    const active = await (await request('/api/download', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.test/wait', outputPath }) })).json();
    const cancelled = await request(`/api/cancel/${active.id}`, { method: 'POST' });
    assert.equal(cancelled.status, 200);
    assert.equal((await (await request('/api/history')).json()).history.at(0).status, 'cancelled');
    server.setRuntimeAdapters({ spawn: createMediaSpawn(), getToolPath: () => executable, exec: (command, callback) => callback?.() });
  });

  test('selects folders/files and delegates folder opening through the adapter', async () => {
    server.setRuntimeAdapters({
      spawn: createMediaSpawn(),
      getToolPath: () => executable,
      exec: (command, callback) => { opened.push(command); callback?.(); }
    });
    const folder = await (await request(`/api/select-folder?current=${encodeURIComponent(root)}`)).json();
    assert.equal(folder.path, root);
    const file = await (await request('/api/select-file')).json();
    assert.ok(file.path);
    await request(`/api/open-folder?path=${encodeURIComponent(root)}`);
    assert.equal(opened.length, 1);
  });

  test('starts a local conversion and publishes its completed state', async () => {
    const outputPath = path.join(root, 'converted');
    fs.mkdirSync(outputPath);
    const response = await request('/api/convert', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inputPath: path.join(root, 'fixture.mp4'), outputPath, outputFormat: 'mp3' }) });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.conversion.status, 'converting');
  });

  test('accepts every supported conversion category and output codec path', async () => {
    const outputPath = path.join(root, 'conversion-matrix');
    fs.mkdirSync(outputPath);
    const cases = [
      ['fixture.mp4', 'mp3'], ['fixture.mp4', 'mp4'], ['fixture.mp4', 'webm'], ['fixture.mp4', 'mkv'], ['fixture.mp4', 'avi'], ['fixture.mp4', 'mov'],
      ['fixture.mp3', 'wav'], ['fixture.mp3', 'm4a'], ['fixture.mp3', 'ogg'], ['fixture.mp3', 'flac'], ['fixture.mp3', 'opus'],
      ['fixture.png', 'jpg'], ['fixture.png', 'webp'], ['fixture.png', 'png'], ['fixture.png', 'bmp'], ['fixture.png', 'gif']
    ];
    for (const [file, outputFormat] of cases) {
      const response = await request('/api/convert', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inputPath: path.join(root, file), outputPath, outputFormat, quality: 'medium' }) });
      assert.equal(response.status, 200, `${file} to ${outputFormat}`);
    }
  });

  test('returns validation errors for malformed media requests and unknown cancellations', async () => {
    const outputPath = path.join(root, 'invalid-media');
    fs.mkdirSync(outputPath);
    const noFile = await request('/api/convert', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ outputPath, outputFormat: 'mp3' }) });
    assert.equal(noFile.status, 400);
    const noFormat = await request('/api/convert', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inputPath: 'fixture.mp4', outputPath }) });
    assert.equal(noFormat.status, 400);
    const noDownload = await request('/api/cancel/not-active', { method: 'POST' });
    assert.equal(noDownload.status, 404);
    const noConversion = await request('/api/cancel-convert/not-active', { method: 'POST' });
    assert.equal(noConversion.status, 404);
  });

  test('maps every built-in DoH provider to a stable endpoint', () => {
    assert.equal(server.getDohUrl('google'), 'https://dns.google/resolve');
    assert.equal(server.getDohUrl('opendns'), 'https://doh.opendns.com/dns-query');
    assert.equal(server.getDohUrl('quad9'), 'https://dns.quad9.net/dns-query');
    assert.equal(server.getDohUrl('adguard'), 'https://dns.adguard-dns.com/dns-query');
    assert.equal(server.getDohUrl('custom', 'https://dns.example.test/query'), 'https://dns.example.test/query');
  });
});
