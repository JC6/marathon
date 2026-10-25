import type { InputState } from './types';

/** One input source for keyboard and simultaneous pointers. Recovery always wins. */
export class RaceInput {
  private keys = new Set<string>();
  private pointers = new Map<number, string>();
  private shifts: (-1 | 1)[] = [];
  private abort = new AbortController();
  constructor(root: HTMLElement, private isRunning: () => boolean, pause: () => void) {
    const signal = this.abort.signal;
    document.addEventListener('keydown', event => {
      if (event.code === 'Escape') { event.preventDefault(); pause(); return; }
      if (!isRunning() || !['ArrowLeft', 'ArrowRight', 'ArrowDown', 'Space'].includes(event.code)) return;
      event.preventDefault();
      if (this.keys.has(event.code) || event.repeat) return;
      this.keys.add(event.code);
      if (event.code === 'ArrowLeft') this.shifts.push(-1);
      if (event.code === 'ArrowRight') this.shifts.push(1);
    }, { signal });
    document.addEventListener('keyup', event => {
      this.keys.delete(event.code);
      if (isRunning() && ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    }, { signal });
    root.addEventListener('pointerdown', event => {
      const button = (event.target as Element).closest<HTMLElement>('[data-control]');
      if (!button || !isRunning()) return;
      event.preventDefault();
      const action = button.dataset.control!;
      this.pointers.set(event.pointerId, action);
      button.setPointerCapture(event.pointerId); button.classList.add('held');
      if (action === 'left') this.shifts.push(-1);
      if (action === 'right') this.shifts.push(1);
    }, { signal });
    const release = (event: PointerEvent) => {
      const action = this.pointers.get(event.pointerId);
      this.pointers.delete(event.pointerId);
      if (action && ![...this.pointers.values()].includes(action)) root.querySelector(`[data-control="${action}"]`)?.classList.remove('held');
    };
    root.addEventListener('pointerup', release, { signal });
    root.addEventListener('pointercancel', release, { signal });
    root.addEventListener('lostpointercapture', release, { signal });
  }
  take(): InputState {
    if (!this.isRunning()) return { shift: 0, sprint: false, recover: false };
    const actions = [...this.pointers.values()];
    const recover = this.keys.has('ArrowDown') || actions.includes('recover');
    return { shift: this.shifts.shift() ?? 0, recover, sprint: !recover && (this.keys.has('Space') || actions.includes('sprint')) };
  }
  clear() {
    this.keys.clear(); this.pointers.clear(); this.shifts = [];
    document.querySelectorAll('[data-control].held').forEach(element => element.classList.remove('held'));
  }
  dispose() { this.clear(); this.abort.abort(); }
}
