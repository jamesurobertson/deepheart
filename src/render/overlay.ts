import * as THREE from 'three';
import type { HitKind } from '../game/sim.ts';
import { fmt } from '../game/format.ts';

const MAX_NUMBERS = 140;

interface Bar {
  el: HTMLElement;
  fill: HTMLElement;
  lag: HTMLElement;
  shown: number;
}

export interface BarSpec {
  id: number;
  pos: THREE.Vector3;
  ratio: number;
  label?: string;
  tone: 'normal' | 'elite' | 'boss';
}

/**
 * Screen-space layer over the canvas: floating damage numbers and the little
 * health bars above enemies. DOM keeps pixel fonts crisp at any zoom.
 */
export class Overlay {
  private layer: HTMLElement;
  private camera: THREE.Camera;
  private numbers: HTMLElement[] = [];
  private bars = new Map<number, Bar>();
  private stacks = new Map<number, { t: number; n: number }>();
  private v = new THREE.Vector3();

  constructor(layer: HTMLElement, camera: THREE.Camera) {
    this.layer = layer;
    this.camera = camera;
  }

  private project(p: THREE.Vector3): { x: number; y: number } {
    this.v.copy(p).project(this.camera);
    return { x: (this.v.x * 0.5 + 0.5) * this.layer.clientWidth, y: (-this.v.y * 0.5 + 0.5) * this.layer.clientHeight };
  }

  number(at: THREE.Vector3, amount: number, kind: HitKind | 'hurt' | 'gold', stack?: number) {
    let { x, y } = this.project(at);
    // MapleStory-style stacking: rapid hits on the same target line up upward instead of overlapping.
    if (stack !== undefined) {
      const now = performance.now();
      const st = this.stacks.get(stack);
      const n = st && now - st.t < 350 ? st.n + 1 : 0;
      this.stacks.set(stack, { t: now, n });
      if (this.stacks.size > 200) this.stacks.clear();
      y -= (n % 6) * (kind === 'normal' ? 24 : 34);
    }
    const el = document.createElement('div');
    el.className = `dn dn-${kind}`;
    el.textContent = kind === 'gold' ? `+${fmt(amount)}` : kind === 'hurt' ? `-${fmt(amount)}` : fmt(amount);
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * (kind === 'normal' ? 16 : 30))}px`);
    el.addEventListener('animationend', () => this.drop(el), { once: true });
    this.layer.appendChild(el);
    this.numbers.push(el);
    if (this.numbers.length > MAX_NUMBERS) this.drop(this.numbers[0]);
  }

  private drop(el: HTMLElement) {
    const i = this.numbers.indexOf(el);
    if (i >= 0) this.numbers.splice(i, 1);
    el.remove();
  }

  /** Reconcile health bars with the enemies that should show one this frame. */
  syncBars(specs: BarSpec[], dt: number) {
    const seen = new Set<number>();
    for (const s of specs) {
      seen.add(s.id);
      let b = this.bars.get(s.id);
      if (!b) {
        const el = document.createElement('div');
        el.className = `hpbar ${s.tone}`;
        el.innerHTML = `${s.label ? `<span class="hpbar-name">${s.label}</span>` : ''}<div class="hpbar-track"><i class="lag"></i><i class="fill"></i></div>`;
        this.layer.appendChild(el);
        b = { el, fill: el.querySelector('.fill')!, lag: el.querySelector('.lag')!, shown: s.ratio };
        this.bars.set(s.id, b);
      }
      const { x, y } = this.project(s.pos);
      b.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      b.fill.style.width = `${Math.max(0, s.ratio) * 100}%`;
      // The pale "recent damage" segment drains after the real bar, like fighting games.
      b.shown = Math.max(s.ratio, b.shown - dt * 0.9);
      b.lag.style.width = `${Math.max(0, b.shown) * 100}%`;
    }
    for (const [id, b] of this.bars) {
      if (!seen.has(id)) {
        b.el.remove();
        this.bars.delete(id);
      }
    }
  }

  /** Screen position of a world point (for flying loot to the HUD). */
  toScreen(p: THREE.Vector3) {
    return this.project(p);
  }
}
