import { fixed, t } from '../i18n/index.ts';

/** A dev-only corner readout (?fps): frames a second, the slowest frame gap, and how long each frame's work took. */
export function fpsOverlay() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;padding:4px 8px;background:rgba(0,0,0,0.75);color:#8cf07e;font:12px/1.4 ui-monospace,monospace;pointer-events:none;white-space:pre';
  document.body.appendChild(el);
  let frames = 0;
  let work = 0;
  let worst = 0;
  let prev = 0;
  let from = performance.now();
  return (now: number, workMs: number) => {
    if (prev) worst = Math.max(worst, now - prev);
    prev = now;
    frames++;
    work += workMs;
    const span = now - from;
    if (span < 500) return;
    el.textContent = t('menu.fps.readout', { fps: Math.round((frames * 1000) / span), worst: fixed(worst, 0), work: fixed(work / frames, 1) });
    frames = 0;
    work = 0;
    worst = 0;
    from = now;
  };
}
