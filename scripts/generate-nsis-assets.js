const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { PNG } = require('pngjs');

const rootDir = path.join(__dirname, '..');
const buildDir = path.join(rootDir, 'build');
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

// 1. Extract first frame of Nuutapao petting2.gif
const ffmpeg = require('ffmpeg-static');
const pettingGifPath = path.join(rootDir, 'Nuutapao petting2.gif');
const pettingFramePath = path.join(buildDir, 'petting_frame.png');

try {
  cp.execFileSync(ffmpeg, ['-y', '-i', pettingGifPath, '-frames:v', '1', pettingFramePath], {
    stdio: 'ignore'
  });
} catch (e) {
  console.warn('Warning: Could not extract frame from GIF with ffmpeg, fallbacking:', e.message);
}

// Helper: 24-bit BMP creator
function writeBmp24(filePath, width, height, getRgbAtVisualPos) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = Buffer.alloc(fileSize);

  // File header (14 bytes)
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(0, 6);
  buf.writeUInt32LE(54, 10);

  // DIB header (BITMAPINFOHEADER - 40 bytes)
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22); // positive = bottom-up
  buf.writeUInt16LE(1, 26); // planes
  buf.writeUInt16LE(24, 28); // 24-bit RGB
  buf.writeUInt32LE(0, 30); // uncompressed
  buf.writeUInt32LE(pixelArraySize, 34);
  buf.writeInt32LE(2835, 38); // 72 DPI
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(0, 46);
  buf.writeUInt32LE(0, 50);

  // Bottom-up pixel rows
  for (let y = 0; y < height; y++) {
    const visualY = height - 1 - y;
    const rowOffset = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getRgbAtVisualPos(x, visualY);
      const pxOffset = rowOffset + x * 3;
      buf[pxOffset] = Math.min(255, Math.max(0, Math.round(b)));
      buf[pxOffset + 1] = Math.min(255, Math.max(0, Math.round(g)));
      buf[pxOffset + 2] = Math.min(255, Math.max(0, Math.round(r)));
    }
  }

  fs.writeFileSync(filePath, buf);
  console.log(`Generated BMP: ${path.basename(filePath)} (${width}x${height}, ${fileSize} bytes)`);
}

// Bilinear PNG resizer and alpha blender
function blendPngOntoCanvas(canvas, cW, cH, srcPng, dstX, dstY, dstW, dstH, opacity = 1.0) {
  for (let dy = 0; dy < dstH; dy++) {
    const cy = dstY + dy;
    if (cy < 0 || cy >= cH) continue;

    const sy = (dy / dstH) * (srcPng.height - 1);
    const y0 = Math.floor(sy);
    const y1 = Math.min(srcPng.height - 1, y0 + 1);
    const fy = sy - y0;

    for (let dx = 0; dx < dstW; dx++) {
      const cx = dstX + dx;
      if (cx < 0 || cx >= cW) continue;

      const sx = (dx / dstW) * (srcPng.width - 1);
      const x0 = Math.floor(sx);
      const x1 = Math.min(srcPng.width - 1, x0 + 1);
      const fx = sx - x0;

      // Sample 4 pixels
      const idx00 = (y0 * srcPng.width + x0) << 2;
      const idx10 = (y0 * srcPng.width + x1) << 2;
      const idx01 = (y1 * srcPng.width + x0) << 2;
      const idx11 = (y1 * srcPng.width + x1) << 2;

      // Interpolate alpha
      const a0 = srcPng.data[idx00 + 3] * (1 - fx) + srcPng.data[idx10 + 3] * fx;
      const a1 = srcPng.data[idx01 + 3] * (1 - fx) + srcPng.data[idx11 + 3] * fx;
      const alpha = (a0 * (1 - fy) + a1 * fy) / 255 * opacity;
      if (alpha <= 0.005) continue;

      // Interpolate RGB
      const r0 = srcPng.data[idx00] * (1 - fx) + srcPng.data[idx10] * fx;
      const r1 = srcPng.data[idx01] * (1 - fx) + srcPng.data[idx11] * fx;
      const srcR = r0 * (1 - fy) + r1 * fy;

      const g0 = srcPng.data[idx00 + 1] * (1 - fx) + srcPng.data[idx10 + 1] * fx;
      const g1 = srcPng.data[idx01 + 1] * (1 - fx) + srcPng.data[idx11 + 1] * fx;
      const srcG = g0 * (1 - fy) + g1 * fy;

      const b0 = srcPng.data[idx00 + 2] * (1 - fx) + srcPng.data[idx10 + 2] * fx;
      const b1 = srcPng.data[idx01 + 2] * (1 - fx) + srcPng.data[idx11 + 2] * fx;
      const srcB = b0 * (1 - fy) + b1 * fy;

      // Composite over canvas
      const cIdx = cy * cW + cx;
      const bg = canvas[cIdx];
      const invA = 1 - alpha;
      canvas[cIdx] = [
        srcR * alpha + bg[0] * invA,
        srcG * alpha + bg[1] * invA,
        srcB * alpha + bg[2] * invA
      ];
    }
  }
}

// 2. Load Nuutapao Human and Petting PNGs
const humanPngPath = path.join(rootDir, 'Nuutapao Human.png');
const humanPng = PNG.sync.read(fs.readFileSync(humanPngPath));

let pettingPng = null;
if (fs.existsSync(pettingFramePath)) {
  pettingPng = PNG.sync.read(fs.readFileSync(pettingFramePath));
}

// 3. Generate installerSidebar.bmp (164x314)
{
  const W = 164;
  const H = 314;
  const canvas = new Array(W * H);

  // Background: Deep dark gradient (#121215 to #1E1E26) with soft warm ambient glow
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const baseR = 18 * (1 - t) + 26 * t;
    const baseG = 18 * (1 - t) + 26 * t;
    const baseB = 22 * (1 - t) + 34 * t;

    for (let x = 0; x < W; x++) {
      // Warm glow behind character
      const dist = Math.hypot((x - 82) / 60, (y - 180) / 90);
      const glow = Math.max(0, 1 - dist) * 0.28;

      canvas[y * W + x] = [
        baseR + glow * 255,
        baseG + glow * 107,
        baseB + glow * 74
      ];
    }
  }

  // Draw Nuutapao Human character in sidebar
  // Aspect ratio = 995x1103 (0.902)
  const charW = 152;
  const charH = Math.round(charW * 1103 / 995); // ~168px
  const charX = Math.round((W - charW) / 2); // 6
  const charY = 88; // placed nicely in lower-middle

  blendPngOntoCanvas(canvas, W, H, humanPng, charX, charY, charW, charH);

  // If petting PNG exists, place at top right corner as a cute badge
  if (pettingPng) {
    const petW = 56;
    const petH = 56;
    const petX = W - petW - 10;
    const petY = 12;
    blendPngOntoCanvas(canvas, W, H, pettingPng, petX, petY, petW, petH);
  }

  writeBmp24(path.join(buildDir, 'installerSidebar.bmp'), W, H, (x, y) => canvas[y * W + x]);
  writeBmp24(path.join(buildDir, 'uninstallerSidebar.bmp'), W, H, (x, y) => canvas[y * W + x]);
}

// 4. Generate installerHeader.bmp (150x57)
{
  const W = 150;
  const H = 57;
  const canvas = new Array(W * H);

  // Background: Clean dark tone (#18181D)
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const baseR = 20 * (1 - t) + 28 * t;
    const baseG = 20 * (1 - t) + 28 * t;
    const baseB = 26 * (1 - t) + 36 * t;

    for (let x = 0; x < W; x++) {
      const glow = Math.max(0, 1 - Math.hypot((x - 120) / 40, (y - 28) / 25)) * 0.22;
      canvas[y * W + x] = [
        baseR + glow * 255,
        baseG + glow * 107,
        baseB + glow * 74
      ];
    }
  }

  // Draw petting mascot on the right side
  if (pettingPng) {
    const petSize = 48;
    const petX = W - petSize - 6;
    const petY = Math.round((H - petSize) / 2);
    blendPngOntoCanvas(canvas, W, H, pettingPng, petX, petY, petSize, petSize);
  } else {
    const headW = 46;
    const headH = 46;
    blendPngOntoCanvas(canvas, W, H, humanPng, W - headW - 6, Math.round((H - headH) / 2), headW, headH);
  }

  writeBmp24(path.join(buildDir, 'installerHeader.bmp'), W, H, (x, y) => canvas[y * W + x]);
}

console.log('✅ NSIS decoration images generated successfully!');
