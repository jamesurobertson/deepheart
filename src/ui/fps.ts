/** A dev-only corner readout (?fps): frames a second, the slowest frame gap, and how long each frame's work took. */
export function fpsOverlay(quality: () => string) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;padding:4px 8px;background:rgba(0,0,0,0.75);color:#8cf07e;font:12px/1.4 ui-monospace,monospace;pointer-events:none;white-space:pre';
  document.body.appendChild(el);
  let frames = 0;
  let work = 0;
  let worst = 0;
  let prev = 0;
  let from = performance.now();
  return (t: number, workMs: number) => {
    if (prev) worst = Math.max(worst, t - prev);
    prev = t;
    frames++;
    work += workMs;
    const span = t - from;
    if (span < 500) return;
    el.textContent = `${Math.round((frames * 1000) / span)} fps · worst ${worst.toFixed(0)} ms\nwork ${(work / frames).toFixed(1)} ms · ${quality()}`;
    frames = 0;
    work = 0;
    worst = 0;
    from = t;
  };
}
