const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('bundled yt-dlp starts and reports its version', () => {
  const binary = path.join(__dirname, '..', 'tools', 'yt-dlp.exe');
  const result = spawnSync(binary, ['--version'], { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout.trim(), /^\d{4}\.\d{2}\.\d{2}/);
});

test('bundled development FFmpeg starts and reports its version', () => {
  const binary = require('ffmpeg-static');
  const result = spawnSync(binary, ['-version'], { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ffmpeg version /m);
});
