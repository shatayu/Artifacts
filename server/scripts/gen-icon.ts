// One-shot generator for the apple-touch-icon. Run with:
//   cd server && npx tsx scripts/gen-icon.ts
//
// Produces a 180x180 RGBA PNG with a solid blue background and a centered
// white "A" glyph drawn from a hand-written bitmap. No native deps so it
// runs anywhere Node does.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SIZE = 180;

// Background: iOS systemBlue-ish.
const BG = { r: 0x05, g: 0x77, b: 0xff, a: 0xff };
const FG = { r: 0xff, g: 0xff, b: 0xff, a: 0xff };

// Pixel grid for the letter "A" (10x12) — we scale it up so it occupies the
// middle ~70% of the icon. Each "1" becomes a square block.
// prettier-ignore
const GLYPH = [
  "0001111000",
  "0011001100",
  "0011001100",
  "0110000110",
  "0110000110",
  "1100000011",
  "1100000011",
  "1111111111",
  "1111111111",
  "1100000011",
  "1100000011",
  "1100000011",
];

function px(buf: Buffer, x: number, y: number, c: typeof BG): void {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  buf[i] = c.r;
  buf[i + 1] = c.g;
  buf[i + 2] = c.b;
  buf[i + 3] = c.a;
}

function buildRGBA(): Buffer {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  // Background fill
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      px(buf, x, y, BG);
    }
  }
  // Glyph block size & offset
  const gw = GLYPH[0]!.length;
  const gh = GLYPH.length;
  const block = Math.floor((SIZE * 0.62) / gh); // ~9px blocks
  const totalW = gw * block;
  const totalH = gh * block;
  const ox = Math.floor((SIZE - totalW) / 2);
  const oy = Math.floor((SIZE - totalH) / 2);
  for (let row = 0; row < gh; row++) {
    for (let col = 0; col < gw; col++) {
      if (GLYPH[row]![col] !== "1") continue;
      for (let by = 0; by < block; by++) {
        for (let bx = 0; bx < block; bx++) {
          px(buf, ox + col * block + bx, oy + row * block + by, FG);
        }
      }
    }
  }
  return buf;
}

function crc32(buf: Buffer): number {
  // Standard CRC-32, table-driven.
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function buildPNG(rgba: Buffer): Buffer {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;     // bit depth
  ihdr[9] = 6;     // color type RGBA
  ihdr[10] = 0;    // compression
  ihdr[11] = 0;    // filter
  ihdr[12] = 0;    // interlace

  // Build raw scanlines: 1 filter byte (0 = None) + row pixels
  const rowBytes = SIZE * 4;
  const raw = Buffer.alloc(SIZE * (1 + rowBytes));
  for (let y = 0; y < SIZE; y++) {
    raw[y * (1 + rowBytes)] = 0;
    rgba.copy(raw, y * (1 + rowBytes) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const idatData = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function main(): void {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outDir = join(__dirname, "..", "public");
  const outPath = join(outDir, "icon.png");
  mkdirSync(outDir, { recursive: true });
  const png = buildPNG(buildRGBA());
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes)`);
}

main();
