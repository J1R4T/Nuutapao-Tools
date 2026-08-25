const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const srcPath = path.join(__dirname, '..', 'public', 'logo.png');
const srcBuffer = fs.readFileSync(srcPath);
const srcPng = PNG.sync.read(srcBuffer);

console.log(`Source image loaded: ${srcPng.width}x${srcPng.height}`);

// Step 1: Find bounding box of non-transparent content to auto-trim empty margins
let minX = srcPng.width, maxX = 0, minY = srcPng.height, maxY = 0;
for (let y = 0; y < srcPng.height; y++) {
  for (let x = 0; x < srcPng.width; x++) {
    const idx = (srcPng.width * y + x) << 2;
    const alpha = srcPng.data[idx + 3];
    if (alpha > 10) { // non-transparent
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

console.log(`Bounding box: x=[${minX}, ${maxX}], y=[${minY}, ${maxY}]`);

const cropWidth = maxX - minX + 1;
const cropHeight = maxY - minY + 1;
const maxDim = Math.max(cropWidth, cropHeight);

// High quality area-averaging resize function
function resizeImage(targetSize) {
  const dst = new PNG({ width: targetSize, height: targetSize });
  
  // Center the cropped content in a square target with a 5% margin for visual balance
  const padding = Math.max(1, Math.round(targetSize * 0.04));
  const innerSize = targetSize - padding * 2;
  const scale = innerSize / maxDim;
  const scaledW = Math.round(cropWidth * scale);
  const scaledH = Math.round(cropHeight * scale);
  const offsetX = Math.round((targetSize - scaledW) / 2);
  const offsetY = Math.round((targetSize - scaledH) / 2);

  // Initialize dst data to fully transparent
  dst.data.fill(0);

  for (let dy = 0; dy < scaledH; dy++) {
    for (let dx = 0; dx < scaledW; dx++) {
      const targetDstX = offsetX + dx;
      const targetDstY = offsetY + dy;
      if (targetDstX < 0 || targetDstX >= targetSize || targetDstY < 0 || targetDstY >= targetSize) continue;

      // Map back to source crop rectangle using area sampling
      const srcX0 = minX + (dx / scaledW) * cropWidth;
      const srcX1 = minX + ((dx + 1) / scaledW) * cropWidth;
      const srcY0 = minY + (dy / scaledH) * cropHeight;
      const srcY1 = minY + ((dy + 1) / scaledH) * cropHeight;

      const xStart = Math.max(0, Math.floor(srcX0));
      const xEnd = Math.min(srcPng.width - 1, Math.ceil(srcX1));
      const yStart = Math.max(0, Math.floor(srcY0));
      const yEnd = Math.min(srcPng.height - 1, Math.ceil(srcY1));

      let rSum = 0, gSum = 0, bSum = 0, aSum = 0, weightSum = 0;

      for (let sy = yStart; sy <= yEnd; sy++) {
        const yWeight = Math.max(0, Math.min(sy + 1, srcY1) - Math.max(sy, srcY0));
        if (yWeight <= 0) continue;

        for (let sx = xStart; sx <= xEnd; sx++) {
          const xWeight = Math.max(0, Math.min(sx + 1, srcX1) - Math.max(sx, srcX0));
          if (xWeight <= 0) continue;

          const weight = xWeight * yWeight;
          const sIdx = (srcPng.width * sy + sx) << 2;
          const sa = srcPng.data[sIdx + 3] / 255;

          rSum += srcPng.data[sIdx] * sa * weight;
          gSum += srcPng.data[sIdx + 1] * sa * weight;
          bSum += srcPng.data[sIdx + 2] * sa * weight;
          aSum += srcPng.data[sIdx + 3] * weight;
          weightSum += weight;
        }
      }

      const dstIdx = (targetSize * targetDstY + targetDstX) << 2;
      if (weightSum > 0 && aSum > 0) {
        const finalAlpha = aSum / weightSum;
        const normAlpha = finalAlpha / 255;
        if (normAlpha > 0.001) {
          dst.data[dstIdx] = Math.round((rSum / weightSum) / normAlpha);
          dst.data[dstIdx + 1] = Math.round((gSum / weightSum) / normAlpha);
          dst.data[dstIdx + 2] = Math.round((bSum / weightSum) / normAlpha);
          dst.data[dstIdx + 3] = Math.round(finalAlpha);
        }
      }
    }
  }

  return PNG.sync.write(dst);
}

// Generate PNGs of various sizes
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngBuffers = {};

for (const s of sizes) {
  pngBuffers[s] = resizeImage(s);
  console.log(`Generated ${s}x${s} PNG: ${pngBuffers[s].length} bytes`);
}

// Build Windows ICO file containing all sizes
function createIco(buffers) {
  const count = buffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  const entries = [];
  const imageDatas = [];

  for (const { size, buffer } of buffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // Width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // Height
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // Size of image data
    entry.writeUInt32LE(offset, 12); // Offset to image data

    entries.push(entry);
    imageDatas.push(buffer);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...entries, ...imageDatas]);
}

const icoBuffer = createIco(sizes.map(s => ({ size: s, buffer: pngBuffers[s] })));
console.log(`Built ICO: ${icoBuffer.length} bytes`);

// Save files
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

fs.writeFileSync(path.join(publicDir, 'tray-icon.png'), pngBuffers[32]);
fs.writeFileSync(path.join(publicDir, 'tray-icon-16.png'), pngBuffers[16]);
fs.writeFileSync(path.join(publicDir, 'tray-icon.ico'), icoBuffer);
fs.writeFileSync(path.join(publicDir, 'icon.ico'), icoBuffer);
fs.writeFileSync(path.join(rootDir, 'icon.ico'), icoBuffer);

console.log('✅ All icons generated and written successfully!');
