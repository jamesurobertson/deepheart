/** A tiny PNG reader/writer for 8-bit RGB/RGBA images (the atlas build and the demo's trimmed atlas). */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync, crc32 } from 'node:zlib';

export interface Image { w: number; h: number; data: Uint8Array }

/** Undo PNG row filters for a w×h block starting at `off` in the inflated stream. */
function unfilter(raw: Buffer, off: number, w: number, h: number, bpp: number): { px: Uint8Array; next: number } {
  const stride = w * bpp;
  const px = new Uint8Array(w * h * bpp);
  for (let y = 0; y < h; y++) {
    const f = raw[off + y * (stride + 1)];
    const row = off + y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let v = raw[row + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { px, next: off + h * (stride + 1) };
}

/** Adam7 interlace passes: x start, y start, x step, y step. */
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

export function readPng(path: string): Image {
  const buf = readFileSync(path);
  let pos = 8;
  let w = 0;
  let h = 0;
  let type = 0;
  let interlaced = false;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      type = body[9];
      interlaced = body[12] === 1;
      if (body[8] !== 8 || (type !== 6 && type !== 2)) throw new Error(`${path}: only 8-bit RGB/RGBA PNGs are supported`);
    } else if (kind === 'IDAT') idat.push(body);
    pos += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  let px: Uint8Array;
  if (!interlaced) px = unfilter(raw, 0, w, h, bpp).px;
  else {
    // Each pass is its own small filtered image; scatter its pixels into place.
    px = new Uint8Array(w * h * bpp);
    let off = 0;
    for (const [xs, ys, dx, dy] of ADAM7) {
      const pw = Math.ceil((w - xs) / dx);
      const ph = Math.ceil((h - ys) / dy);
      if (pw <= 0 || ph <= 0) continue;
      const pass = unfilter(raw, off, pw, ph, bpp);
      off = pass.next;
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
        px.set(pass.px.subarray((y * pw + x) * bpp, (y * pw + x + 1) * bpp), ((ys + y * dy) * w + xs + x * dx) * bpp);
      }
    }
  }
  if (bpp === 4) return { w, h, data: px };
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([px[i * 3], px[i * 3 + 1], px[i * 3 + 2], 255], i * 4);
  return { w, h, data };
}

export function writePng(path: string, img: Image) {
  const chunk = (kind: string, body: Buffer) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(kind, 4, 'ascii');
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(img.h * (img.w * 4 + 1));
  for (let y = 0; y < img.h; y++) Buffer.from(img.data.buffer, img.data.byteOffset + y * img.w * 4, img.w * 4).copy(raw, y * (img.w * 4 + 1) + 1);
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
