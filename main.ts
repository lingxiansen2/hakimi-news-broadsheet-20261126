/**
 * Hakimi World News Broadsheet — 26 November 2026
 * Entry for make.fun competition `news-image-20261126`.
 *
 * Uses Node 22 standard library only. Deterministically writes the verified
 * broadsheet image (`entry.png`) to `$MAKEFUN_OUTPUT_DIR/entry.png` (or `/output/entry.png`).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1_048_576;
const MAX_DIMENSION = 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function resolvePaths(): { sourcePath: string; targetPath: string } {
  const rootDir = dirname(fileURLToPath(import.meta.url));
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  return {
    sourcePath: join(rootDir, 'entry.png'),
    targetPath: join(outDir, 'entry.png'),
  };
}

function parseJpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    const segmentLen = bytes.readUInt16BE(offset + 2);
    if (segmentLen < 2) break;
    offset += 2 + segmentLen;
  }
  return null;
}

function assertValidImage(bytes: Buffer): void {
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw new Error(`Image size ${bytes.length} exceeds limits (1..${MAX_BYTES} bytes).`);
  }
  const isPng = bytes.subarray(0, 8).equals(PNG_SIGNATURE);
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isPng && !isJpeg) {
    throw new Error('Image must begin with a valid PNG or JPEG header.');
  }
  if (isPng && bytes.length >= 24) {
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (width === 0 || height === 0 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new Error(`PNG dimensions ${width}x${height} exceed ${MAX_DIMENSION}x${MAX_DIMENSION}.`);
    }
  } else if (isJpeg) {
    if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
      throw new Error('JPEG file is missing EOI end marker.');
    }
    const dims = parseJpegDimensions(bytes);
    if (!dims || dims.width === 0 || dims.height === 0 || dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION) {
      throw new Error(`JPEG dimensions exceed ${MAX_DIMENSION}x${MAX_DIMENSION} or could not be parsed.`);
    }
  }
}

function main(): void {
  const { sourcePath, targetPath } = resolvePaths();
  const payload = readFileSync(sourcePath);
  assertValidImage(payload);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, payload);
}

main();
