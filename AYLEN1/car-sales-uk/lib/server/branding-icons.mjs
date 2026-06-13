/**
 * Generate PWA / favicon assets from a square logo buffer (sharp).
 */
import sharp from 'sharp';

const BG = { r: 7, g: 10, b: 20, alpha: 1 };

const SIZES = {
  'icon-16': 16,
  'icon-32': 32,
  'icon-48': 48,
  'apple-touch-icon': 180,
  'icon-192': 192,
  'icon-512': 512,
  'maskable-192': 192,
  'maskable-512': 512
};

function writeIcoFromPngs(entries) {
  const count = entries.length;
  const headerSize = 6;
  const entrySize = 16;
  let offset = headerSize + count * entrySize;
  const chunks = [];
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  chunks.push(header);
  for (const { size, png } of entries) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    chunks.push(entry);
    chunks.push(png);
    offset += png.length;
  }
  return Buffer.concat(chunks);
}

async function resizeLogo(input, size) {
  return sharp(input)
    .resize(size, size, { fit: 'contain', background: BG })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function resizeMaskable(input, canvas) {
  const inner = Math.round(canvas * 0.72);
  const logo = await sharp(input)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: canvas, height: canvas, channels: 4, background: BG }
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * @param {Buffer} inputBuffer
 * @returns {Promise<Record<string, Buffer>>}
 */
export async function generateIconSet(inputBuffer) {
  const normalized = await sharp(inputBuffer)
    .rotate()
    .resize(1024, 1024, { fit: 'contain', background: BG })
    .png()
    .toBuffer();

  const out = {
    'source-1024': normalized
  };

  out['icon-16'] = await resizeLogo(normalized, SIZES['icon-16']);
  out['icon-32'] = await resizeLogo(normalized, SIZES['icon-32']);
  out['icon-48'] = await resizeLogo(normalized, SIZES['icon-48']);
  out['apple-touch-icon'] = await resizeLogo(normalized, SIZES['apple-touch-icon']);
  out['icon-192'] = await resizeLogo(normalized, SIZES['icon-192']);
  out['icon-512'] = await resizeLogo(normalized, SIZES['icon-512']);
  out['maskable-192'] = await resizeMaskable(normalized, 192);
  out['maskable-512'] = await resizeMaskable(normalized, 512);
  out['favicon.ico'] = writeIcoFromPngs([
    { size: 16, png: out['icon-16'] },
    { size: 32, png: out['icon-32'] },
    { size: 48, png: out['icon-48'] }
  ]);

  return out;
}

export function buffersToDataUrls(buffers) {
  const urls = {};
  for (const [key, buf] of Object.entries(buffers)) {
    const mime = key === 'favicon.ico' ? 'image/x-icon' : 'image/png';
    urls[key] = 'data:' + mime + ';base64,' + buf.toString('base64');
  }
  return urls;
}
