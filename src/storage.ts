import { DEFAULT_SELECTION, eventById, normalizeSelection } from './data';
import type { RaceResult, SaveData, Selection } from './types';

export const STORAGE_KEY = 'marathon:save:v1';
export const bestKey = (s: Selection) => `${s.event}:${s.category}:${s.character}`;
export const medalKey = (s: Pick<Selection, 'event' | 'category'>) => `${s.event}:${s.category}`;
export const newSave = (): SaveData => ({ version: 1, selection: { ...DEFAULT_SELECTION }, muted: false, results: [], best: {}, medals: [] });

function isResult(value: unknown): value is RaceResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as RaceResult;
  const normalized = normalizeSelection(r);
  if (Object.entries(normalized).some(([key, val]) => r[key as keyof Selection] !== val)) return false;
  const distance = eventById(r.event).categories.find(c => c.id === r.category)!.distance;
  return typeof r.id === 'string' && r.id.length < 100 && typeof r.date === 'string' && Number.isFinite(Date.parse(r.date))
    && Number.isFinite(r.elapsed) && r.elapsed > 0 && r.distance === distance
    && Number.isInteger(r.rank) && r.rank >= 1 && r.rank <= 20 && Number.isInteger(r.aidCount) && r.aidCount >= 0 && r.aidCount <= 8
    && Array.isArray(r.splits) && r.splits.length === Math.ceil(distance / 5000)
    && r.splits.every((s, i) => s && s.distance === Math.min((i + 1) * 5000, distance) && Number.isFinite(s.elapsed)
      && s.elapsed > (r.splits[i - 1]?.elapsed ?? 0) && Number.isFinite(s.duration) && s.duration > 0)
    && Math.abs(r.splits.at(-1)!.elapsed - r.elapsed) < .01;
}
export function recordResult(save: SaveData, result: RaceResult): { pb: boolean; medal: boolean } {
  if (save.results.some(r => r.id === result.id)) return { pb: false, medal: false };
  const key = bestKey(result);
  const pb = !save.best[key] || result.elapsed < save.best[key].elapsed;
  const medal = !save.medals.includes(medalKey(result));
  save.results = [result, ...save.results].slice(0, 50);
  if (pb) save.best[key] = result;
  if (medal) save.medals.push(medalKey(result));
  return { pb, medal };
}
export class SaveStore {
  warning = '';
  private storage: Storage | null = null;
  constructor(storage?: Storage) {
    try { this.storage = storage ?? window.localStorage; }
    catch { this.warning = '浏览器存储不可用，本次成绩仅在当前页面保留。'; }
  }
  load(): SaveData {
    const save = newSave();
    if (!this.storage) return save;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return save;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || (parsed as SaveData).version !== 1) throw new Error('Unknown save version');
      const data = parsed as SaveData;
      save.selection = normalizeSelection(data.selection);
      save.muted = data.muted === true;
      save.results = Array.isArray(data.results) ? data.results.filter(isResult).slice(0, 50) : [];
      // Rebuild indexes from validated records; retain old PBs beyond the history limit.
      const records = [...save.results, ...Object.values(data.best && typeof data.best === 'object' ? data.best : {}).filter(isResult)];
      for (const result of records) {
        const key = bestKey(result);
        if (!save.best[key] || result.elapsed < save.best[key].elapsed) save.best[key] = result;
        if (!save.medals.includes(medalKey(result))) save.medals.push(medalKey(result));
      }
      return save;
    } catch {
      this.warning = '存档无法读取，已恢复默认设置。';
      return save;
    }
  }
  save(data: SaveData): boolean {
    if (!this.storage) return false;
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
    catch { this.warning = '浏览器无法保存，本次成绩仅在当前页面保留。'; return false; }
  }
}
