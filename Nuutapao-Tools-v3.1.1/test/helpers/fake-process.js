const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

function makeProcess({ stdout = '', stderr = '', code = 0, pid = 4242, defer = false } = {}) {
  const proc = new EventEmitter();
  proc.pid = pid;
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.kill = () => {
    proc.killed = true;
    queueMicrotask(() => proc.emit('close', 1));
    return true;
  };
  const finish = () => {
    if (stdout) proc.stdout.write(stdout);
    if (stderr) proc.stderr.write(stderr);
    proc.stdout.end();
    proc.stderr.end();
    proc.emit('close', code);
  };
  if (!defer) queueMicrotask(finish);
  proc.finish = finish;
  return proc;
}

function createMediaSpawn() {
  return (command, args) => {
    if (args.includes('--version')) return makeProcess({ stdout: '2026.08.01\n' });
    if (args.includes('-U')) return makeProcess({ stdout: 'yt-dlp is up to date (2026.08.01)\n' });
    if (args.includes('--dump-json')) {
      return makeProcess({ stdout: JSON.stringify({
        title: 'Fixture video', uploader: 'Fixture author', duration: 60,
        formats: [{ format_id: '18', ext: 'mp4', resolution: '360p', vcodec: 'avc1', acodec: 'mp4a' }]
      }) });
    }
    if (args.includes('-progress') && args.includes('pipe:1')) {
      return makeProcess({ stdout: 'out_time_us=1000000\nprogress=end\n' });
    }
    if (args.includes('-hide_banner')) return makeProcess({ stderr: 'Duration: 00:00:01.00\n' });
    return makeProcess({ stdout: 'NuuMeta:Fixture video|||\n[download] 100% of 1.00MiB at 1.00MiB/s ETA 00:00\n' });
  };
}

module.exports = { makeProcess, createMediaSpawn };
