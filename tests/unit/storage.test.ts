import { describe, expect, it } from 'vitest';
import { DEFAULT_SELECTION } from '../../src/data';
import { STORAGE_KEY, SaveStore, bestKey, medalKey, newSave, recordResult } from '../../src/storage';
import type { RaceResult } from '../../src/types';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
const result = (id = '1', elapsed = 12600): RaceResult => ({
  ...DEFAULT_SELECTION, id, elapsed, date: '2026-10-26T00:00:00Z', distance: 42195, rank: 5, aidCount: 8,
  splits: Array.from({ length: 9 }, (_, i) => { const distance = Math.min((i + 1) * 5000, 42195); return { distance, elapsed: distance / 42195 * elapsed, duration: (distance - i * 5000) / 42195 * elapsed }; }),
});
describe('versioned local records', () => {
  it('uses the agreed default and round trips selection, mute, results and PB', () => {
    const memory = new MemoryStorage(); const store = new SaveStore(memory);
    const save = store.load(); expect(save.selection).toEqual(DEFAULT_SELECTION);
    save.selection = { character: 'worker', shoe: '160x', event: 'huangshan', category: 'half' }; save.muted = true;
    recordResult(save, result()); expect(store.save(save)).toBe(true); expect(store.load()).toEqual(save);
  });
  it('separates PB by role and category and retains the shoe in the result', () => {
    const save = newSave(); recordResult(save, result());
    const worker = { ...result('2', 13000), character: 'worker' as const, shoe: '260x' as const };
    recordResult(save, worker);
    expect(Object.keys(save.best)).toHaveLength(2); expect(save.best[bestKey(worker)].shoe).toBe('260x');
    expect(save.medals).toEqual([medalKey(DEFAULT_SELECTION)]);
    const half = { ...worker, event: 'huangshan' as const, category: 'half' as const };
    expect(bestKey(half)).not.toBe(bestKey({ ...half, category: 'full' }));
  });
  it('keeps only 50 recent races, while retaining old PBs and medals', () => {
    const memory = new MemoryStorage(); const store = new SaveStore(memory); const save = newSave();
    recordResult(save, result('old-pb', 12000));
    for (let i = 0; i < 60; i++) recordResult(save, result(String(i), 13000 + i));
    expect(save.results).toHaveLength(50); expect(save.results.some(r => r.id === 'old-pb')).toBe(false);
    store.save(save); const loaded = store.load();
    expect(loaded.best[bestKey(DEFAULT_SELECTION)].id).toBe('old-pb'); expect(loaded.medals).toHaveLength(1);
  });
  it('records once and awards PB only on improvement', () => {
    const save = newSave();
    expect(recordResult(save, result())).toEqual({ pb: true, medal: true });
    expect(recordResult(save, result())).toEqual({ pb: false, medal: false }); expect(save.results).toHaveLength(1);
    expect(recordResult(save, result('2', 13000))).toEqual({ pb: false, medal: false });
    expect(recordResult(save, result('3', 12000))).toEqual({ pb: true, medal: false });
  });
  it.each(['{bad', 'null', '{"version":999}', '[]'])('handles corrupt or unsupported saves: %s', value => {
    const memory = new MemoryStorage(); memory.setItem(STORAGE_KEY, value); const store = new SaveStore(memory);
    expect(store.load()).toEqual(newSave()); expect(store.warning).not.toBe('');
  });
  it('filters malformed records and normalizes invalid equipment', () => {
    const memory = new MemoryStorage(); const data = { ...newSave(), selection: { character: 'invalid', shoe: 'invalid', event: 'yangzhou', category: 'full' }, results: [null, {}, { ...result(), rank: 200 }, { ...result(), splits: [null] }, result()], best: { arbitrary: { elapsed: -20 } }, medals: ['fake'] };
    memory.setItem(STORAGE_KEY, JSON.stringify(data)); const loaded = new SaveStore(memory).load();
    expect(loaded.selection).toEqual({ ...DEFAULT_SELECTION, event: 'yangzhou', category: 'half' });
    expect(loaded.results).toHaveLength(1); expect(Object.keys(loaded.best)).toHaveLength(1); expect(loaded.medals).toEqual(['xiamen:full']);
  });
  it('survives unavailable storage and quota errors, preserving in-memory records', () => {
    const broken = new MemoryStorage(); broken.getItem = () => { throw new Error('blocked'); }; broken.setItem = () => { throw new Error('quota'); };
    const store = new SaveStore(broken); const save = store.load();
    recordResult(save, result()); expect(store.save(save)).toBe(false); expect(store.warning).toContain('无法保存');
    expect(save.results).toHaveLength(1);
  });
});
