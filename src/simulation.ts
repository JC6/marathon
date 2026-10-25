import { characterById, courseSection, eventById, normalizeSelection, shoeById } from './data';
import type { InputState, Lane, RaceResult, RaceState, Selection, Split } from './types';

export const TIME_SCALE = 30;
export const FIXED_STEP = 1 / 60;
export const NEUTRAL_INPUT: InputState = { shift: 0, sprint: false, recover: false };
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function createRace(selection: Selection): RaceState {
  const selected = normalizeSelection(selection);
  const character = characterById(selected.character);
  const total = eventById(selected.event).categories.find(c => c.id === selected.category)!.distance;
  return {
    selection: selected, status: 'running', totalDistance: total, distance: 0, elapsed: 0,
    energy: character.energy, fatigue: selected.character === 'worker' ? .06 : 0,
    speed: 0, lane: 0, effort: 'cruise', exhausted: false, blocked: false, supplySlowUntil: 0,
    rank: 20, splits: [], events: [],
    stations: Array.from({ length: Math.floor(total / 5000) }, (_, i) => ({
      distance: (i + 1) * 5000, lane: (i % 2 === 0 ? -1 : 1) as Lane,
      type: i % 2 === 0 ? 'water' as const : 'gel' as const, status: 'pending' as const,
    })),
    opponents: Array.from({ length: 19 }, (_, id) => ({
      id, lane: ((id % 3) - 1) as Lane, distance: 4 + id * 2.5, speed: 0,
      baseSpeed: 3.04 + id * .045, style: (['steady', 'fast-start', 'kick'] as const)[id % 3], finishTime: null,
    })),
  };
}

export function nextAid(race: RaceState) {
  return race.stations.find(s => s.status === 'pending' && s.distance + 75 >= race.distance);
}

/** Advance exactly one fixed real-time step. All racing quantities use simulated seconds. */
export function stepRace(race: RaceState, input: InputState, realSeconds = FIXED_STEP): void {
  race.events = [];
  if (race.status !== 'running' || realSeconds <= 0 || !Number.isFinite(realSeconds)) return;
  const dt = realSeconds * TIME_SCALE;
  const oldDistance = race.distance;
  const oldElapsed = race.elapsed;
  race.elapsed += dt;
  race.lane = clamp(race.lane + input.shift, -1, 1) as Lane;
  const character = characterById(race.selection.character);
  const shoe = shoeById(race.selection.shoe);
  const section = courseSection(race.selection, race.distance);
  if (race.energy <= .01) race.exhausted = true;
  if (race.exhausted && race.energy >= 18) race.exhausted = false;
  race.effort = input.recover || race.exhausted ? 'recover' : input.sprint ? 'sprint' : 'cruise';
  const effort = race.effort;
  const terrain = 1 - section.grade * 4 - section.wind * .025;
  const energyFactor = race.energy < 15 ? .65 + race.energy / 15 * .35 : 1;
  const effortSpeed = effort === 'sprint' ? shoe.sprint : effort === 'recover' ? (race.exhausted ? .48 : .70) : 1;
  const supplyFactor = race.elapsed < race.supplySlowUntil ? .74 : 1;
  race.speed = character.speed * shoe.speed * effortSpeed * (1 - race.fatigue * .32) * terrain * energyFactor * supplyFactor;
  race.blocked = false;
  let nextDistance = oldDistance + race.speed * dt;

  for (const opponent of race.opponents) {
    if (opponent.finishTime !== null) continue;
    const old = opponent.distance;
    const progress = old / race.totalDistance;
    const profile = opponent.style === 'fast-start' ? (progress < .35 ? 1.10 : .91)
      : opponent.style === 'kick' ? (progress < .72 ? .94 : 1.15) : 1;
    const aiSection = courseSection(race.selection, old);
    opponent.speed = opponent.baseSpeed * profile * (1 - progress * .035) * (1 - aiSection.grade * 4 - aiSection.wind * .025);
    opponent.distance = Math.min(race.totalDistance, old + opponent.speed * dt);
    opponent.lane = (((opponent.id + Math.floor(race.elapsed / (210 + opponent.id * 7))) % 3) - 1) as Lane;
    if (opponent.distance >= race.totalDistance) opponent.finishTime = oldElapsed + (race.totalDistance - old) / opponent.speed;
    if (opponent.lane === race.lane && old > oldDistance && old - oldDistance < 5 && nextDistance > opponent.distance - .8 && opponent.finishTime === null) {
      nextDistance = Math.max(oldDistance, Math.min(nextDistance, opponent.distance - .8));
      race.blocked = true;
    }
  }

  const terrainCost = 1 + Math.max(0, section.grade) * 7 + section.wind * .08;
  const drain = effort === 'sprint' ? .080 * (shoe.sprint / 1.27) : effort === 'cruise' ? .0052 : -.034;
  race.energy = clamp(race.energy - drain * dt * (drain > 0 ? terrainCost * (race.selection.character === 'worker' ? 1.08 : 1) : 1), 0, 100);
  const fatigueChange = effort === 'sprint' ? .00017 : effort === 'recover' ? -.000026 : .000012;
  race.fatigue = clamp(race.fatigue + fatigueChange * dt * (fatigueChange > 0 ? shoe.fatigueRate * character.fatigueRate * terrainCost : 1), 0, 1);
  race.distance = Math.min(nextDistance, race.totalDistance);
  race.speed = (race.distance - oldDistance) / dt;

  for (const [index, station] of race.stations.entries()) {
    if (station.status !== 'pending') continue;
    if (race.distance >= station.distance - 35 && oldDistance <= station.distance + 75 && race.lane === station.lane) {
      station.status = 'collected';
      race.energy = clamp(race.energy + (station.type === 'gel' ? 22 : 12), 0, 100);
      race.fatigue = Math.max(0, race.fatigue - (station.type === 'gel' ? .035 : .018));
      race.supplySlowUntil = race.elapsed + 24;
      race.events.push({ type: 'aid', station: index, aid: station.type });
    } else if (race.distance > station.distance + 75) station.status = 'missed';
  }

  let marker = Math.min((race.splits.length + 1) * 5000, race.totalDistance);
  while (race.distance >= marker && (race.splits.at(-1)?.distance ?? 0) < marker) {
    const elapsed = oldElapsed + dt * (marker - oldDistance) / Math.max(.000001, nextDistance - oldDistance);
    const split: Split = { distance: marker, elapsed, duration: elapsed - (race.splits.at(-1)?.elapsed ?? 0) };
    race.splits.push(split);
    race.events.push({ type: 'split', split });
    if (marker === race.totalDistance) break;
    marker = Math.min(marker + 5000, race.totalDistance);
  }
  if (oldDistance < race.totalDistance - 1000 && race.distance >= race.totalDistance - 1000) race.events.push({ type: 'final-kilometre' });
  if (race.distance >= race.totalDistance) {
    race.status = 'finished';
    race.elapsed = race.splits.at(-1)!.elapsed;
    race.events.push({ type: 'finish' });
  }
  race.rank = 1 + race.opponents.filter(o => race.status === 'finished'
    ? o.finishTime !== null && o.finishTime <= race.elapsed
    : o.distance > race.distance).length;
}

export function makeResult(race: RaceState, id: string, date: string): RaceResult {
  if (race.status !== 'finished') throw new Error('Only completed races can be recorded.');
  return { ...race.selection, id, date, elapsed: race.elapsed, distance: race.totalDistance, rank: race.rank,
    splits: race.splits.map(s => ({ ...s })), aidCount: race.stations.filter(s => s.status === 'collected').length };
}
export class FixedClock {
  private accumulator = 0;
  reset() { this.accumulator = 0; }
  advance(realSeconds: number, update: () => void) {
    this.accumulator += clamp(realSeconds, 0, .1);
    while (this.accumulator + 1e-10 >= FIXED_STEP) {
      update();
      this.accumulator -= FIXED_STEP;
    }
  }
}
export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 3600).toString().padStart(2, '0')}:${Math.floor(whole / 60 % 60).toString().padStart(2, '0')}:${(whole % 60).toString().padStart(2, '0')}`;
}
export function formatPace(speed: number): string {
  if (speed <= .01) return '—:—';
  const seconds = Math.round(1000 / speed);
  return `${Math.floor(seconds / 60)}′${(seconds % 60).toString().padStart(2, '0')}″`;
}
