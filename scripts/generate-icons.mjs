// Generates icons/icon-{16,48,128}.png without any npm dependency.
// Produces a rounded blue square with a simple white arrow/redirect glyph.
// Run once: `node scripts/generate-icons.mjs`

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "icons");
mkdirSync(OUT_DIR, { recursive: true });

const BG = [43, 125, 233, 255];   // #2b7de9
const FG = [255, 255, 255, 255];  // white
const TRANSPARENT = [0, 0, 0, 0];

function crc32Table() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
    table[n] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = crc32Table();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, pixels) {
  const rowBytes = 1 + size * 4;
  const raw = Buffer.alloc(rowBytes * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const off = y * rowBytes + 1 + x * 4;
      raw[off] = pixels[idx];
      raw[off + 1] = pixels[idx + 1];
      raw[off + 2] = pixels[idx + 2];
      raw[off + 3] = pixels[idx + 3];
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;          // bit depth
  ihdr[9] = 6;          // color type: RGBA
  ihdr[10] = 0;         // compression
  ihdr[11] = 0;         // filter
  ihdr[12] = 0;         // interlace

  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = color[3];
}

function drawRoundedBackground(pixels, size) {
  const radius = Math.max(2, Math.round(size * 0.18));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = true;
      // top-left corner
      if (x < radius && y < radius) {
        const dx = radius - x, dy = radius - y;
        if (dx * dx + dy * dy > radius * radius) inside = false;
      }
      // top-right
      else if (x >= size - radius && y < radius) {
        const dx = x - (size - radius - 1), dy = radius - y;
        if (dx * dx + dy * dy > radius * radius) inside = false;
      }
      // bottom-left
      else if (x < radius && y >= size - radius) {
        const dx = radius - x, dy = y - (size - radius - 1);
        if (dx * dx + dy * dy > radius * radius) inside = false;
      }
      // bottom-right
      else if (x >= size - radius && y >= size - radius) {
        const dx = x - (size - radius - 1), dy = y - (size - radius - 1);
        if (dx * dx + dy * dy > radius * radius) inside = false;
      }
      setPixel(pixels, size, x, y, inside ? BG : TRANSPARENT);
    }
  }
}

// Draw a simple right-facing arrow centered in the icon.
function drawArrow(pixels, size) {
  const cy = Math.floor(size / 2);
  const stemThickness = Math.max(2, Math.round(size * 0.14));
  const stemStart = Math.round(size * 0.22);
  const stemEnd = Math.round(size * 0.62);
  const headHalf = Math.max(3, Math.round(size * 0.2));
  const headTip = Math.round(size * 0.82);

  // stem: horizontal rectangle
  for (let y = cy - Math.floor(stemThickness / 2); y < cy - Math.floor(stemThickness / 2) + stemThickness; y++) {
    for (let x = stemStart; x <= stemEnd; x++) {
      setPixel(pixels, size, x, y, FG);
    }
  }

  // head: filled triangle pointing right
  for (let x = stemEnd; x <= headTip; x++) {
    const progress = (x - stemEnd) / Math.max(1, headTip - stemEnd);
    const half = Math.round(headHalf * (1 - progress));
    for (let y = cy - half; y <= cy + half; y++) {
      setPixel(pixels, size, x, y, FG);
    }
  }
}

function generate(size) {
  const pixels = new Uint8Array(size * size * 4);
  drawRoundedBackground(pixels, size);
  drawArrow(pixels, size);
  const png = makePng(size, pixels);
  const outPath = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath}`);
}

for (const size of [16, 48, 128]) generate(size);
