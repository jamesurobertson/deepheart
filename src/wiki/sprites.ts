/** Sprite icons for the wiki, cut from the game's atlas without pulling in three.js. */

type Rect = { x: number; y: number; w: number; h: number };

let sheet: HTMLImageElement | null = null;
const rects = new Map<string, Rect>();
const trimmed = new Map<string, HTMLCanvasElement | null>();

export async function loadSprites(base: string) {
  const img = new Image();
  img.src = `${base}assets/sprites/atlas.png`;
  const [list] = await Promise.all([fetch(`${base}assets/sprites/atlas.txt`).then((r) => r.text()), img.decode()]);
  for (const line of list.split('\n')) {
    const [name, x, y, w, h] = line.trim().split(/\s+/);
    if (name && h) rects.set(name, { x: +x, y: +y, w: +w, h: +h });
  }
  sheet = img;
}

function rectFor(name: string): Rect | null {
  for (const n of [name, `${name}_idle_anim_f0`, `${name}_anim_f0`, `${name}_idle`, `${name}_anim_f10`]) {
    const r = rects.get(n);
    if (r) return r;
  }
  return null;
}

/** The sprite's first frame with its empty border cut away. */
function cut(name: string): HTMLCanvasElement | null {
  if (trimmed.has(name)) return trimmed.get(name)!;
  const r = rectFor(name);
  let out: HTMLCanvasElement | null = null;
  if (r && sheet) {
    const c = document.createElement('canvas');
    c.width = r.w;
    c.height = r.h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(sheet, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    const px = g.getImageData(0, 0, r.w, r.h).data;
    let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        if (px[(y * r.w + x) * 4 + 3] < 20) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    if (x1 >= 0) {
      out = document.createElement('canvas');
      out.width = x1 - x0 + 1;
      out.height = y1 - y0 + 1;
      out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    }
  }
  trimmed.set(name, out);
  return out;
}

/** A placeholder the page fills in once the sheet has loaded. */
export const spr = (name: string, box = 24) => `<i class="spr" data-s="${name}" style="--box:${box}px"></i>`;

/** Fill every placeholder under `root` with its sprite, scaled by whole pixels to fit its box. */
export function hydrateSprites(root: HTMLElement) {
  if (!sheet) return;
  for (const el of root.querySelectorAll<HTMLElement>('i.spr[data-s]:not(.done)')) {
    const src = cut(el.dataset.s!);
    el.classList.add('done');
    if (!src) continue;
    const box = parseInt(el.style.getPropertyValue('--box')) || 24;
    const k = Math.max(1, Math.floor(box / Math.max(src.width, src.height)));
    const c = document.createElement('canvas');
    c.width = src.width * k;
    c.height = src.height * k;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    el.appendChild(c);
  }
}
