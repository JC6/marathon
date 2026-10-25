export type CharacterId = 'runner' | 'worker';
export type ShoeId = 'cumulus' | '260x' | '160x';
export type EventId = 'xiamen' | 'shanghai' | 'huangshan' | 'yangzhou';
export type CategoryId = 'half' | 'full';
export type Lane = -1 | 0 | 1;
export type Effort = 'recover' | 'cruise' | 'sprint';

export interface CharacterDefinition {
  id: CharacterId; name: string; subtitle: string; description: string;
  color: string; speed: number; energy: number; fatigueRate: number;
}
export interface ShoeDefinition {
  id: ShoeId; name: string; tagline: string; description: string;
  color: string; accent: string; speed: number; sprint: number; fatigueRate: number;
  ratings: [number, number, number];
}
export interface RaceCategory { id: CategoryId; distance: number }
export interface CourseSection {
  end: number; label: string; grade: number; wind: number; crowd: number;
}
export interface EventDefinition {
  id: EventId; name: string; english: string; tag: string; description: string;
  color: string; sky: string; ground: string; categories: RaceCategory[];
  sections: Record<CategoryId, CourseSection[]>;
}
export interface Selection {
  character: CharacterId; shoe: ShoeId; event: EventId; category: CategoryId;
}
export interface InputState { shift: -1 | 0 | 1; sprint: boolean; recover: boolean }
export interface Split { distance: number; elapsed: number; duration: number }
export interface AidStation {
  distance: number; lane: Lane; type: 'water' | 'gel'; status: 'pending' | 'collected' | 'missed';
}
export interface Opponent {
  id: number; lane: Lane; distance: number; speed: number; baseSpeed: number;
  style: 'steady' | 'fast-start' | 'kick'; finishTime: number | null;
}
export interface RaceState {
  selection: Selection; status: 'running' | 'paused' | 'finished';
  distance: number; totalDistance: number; elapsed: number;
  energy: number; fatigue: number; speed: number; lane: Lane; effort: Effort;
  exhausted: boolean; blocked: boolean; supplySlowUntil: number;
  rank: number; opponents: Opponent[]; stations: AidStation[]; splits: Split[];
  events: RaceEvent[];
}
export type RaceEvent =
  | { type: 'aid'; station: number; aid: 'water' | 'gel' }
  | { type: 'split'; split: Split }
  | { type: 'final-kilometre' }
  | { type: 'finish' };
export interface RaceResult extends Selection {
  id: string; date: string; elapsed: number; distance: number; rank: number;
  splits: Split[]; aidCount: number;
}
export interface SaveData {
  version: 1; selection: Selection; muted: boolean;
  results: RaceResult[]; best: Record<string, RaceResult>; medals: string[];
}
