import { describe, expect, it } from 'vitest';
import { CHARACTERS, DEFAULT_SELECTION, EVENTS, SHOES, normalizeSelection, raceName } from '../../src/data';
import { FIXED_STEP, FixedClock, NEUTRAL_INPUT, TIME_SCALE, createRace, formatPace, formatTime, makeResult, nextAid, stepRace } from '../../src/simulation';
import type { InputState, RaceState, Selection } from '../../src/types';

const combinations = CHARACTERS.flatMap(character => SHOES.flatMap(shoe => EVENTS.flatMap(event => event.categories.map(category => ({ character: character.id, shoe: shoe.id, event: event.id, category: category.id })))));

function strategy(race: RaceState): InputState {
  const station = nextAid(race);
  const near = station && station.distance - race.distance < 300;
  let shift: InputState['shift'] = 0;
  if (near) shift = Math.sign(station.lane - race.lane) as InputState['shift'];
  else if (race.blocked) shift = race.lane === 1 ? -1 : 1;
  return { shift, recover: race.energy < 18, sprint: race.energy > 80 || race.totalDistance - race.distance < 650 && race.energy > 25 };
}
function run(selection: Selection, input = strategy) {
  const race = createRace(selection);
  let frames = 0;
  while (race.status === 'running' && frames < 60 * 60 * 15) { stepRace(race, input(race)); frames++; }
  return { race, realSeconds: frames * FIXED_STEP };
}

describe('playable character × shoe × course combinations', () => {
  it.each(combinations)('$character / $shoe / $event / $category finishes with a sensible pace and all splits', selection => {
    const { race, realSeconds } = run(selection);
    expect(race.status).toBe('finished');
    expect(race.distance).toBe(race.totalDistance);
    expect(realSeconds).toBeGreaterThan(selection.category === 'half' ? 160 : 320);
    expect(realSeconds).toBeLessThan(selection.category === 'half' ? 300 : 600);
    expect(race.splits).toHaveLength(Math.ceil(race.totalDistance / 5000));
    expect(race.splits.at(-1)?.distance).toBe(race.totalDistance);
    expect(race.splits.reduce((sum, split) => sum + split.duration, 0)).toBeCloseTo(race.elapsed, 6);
    expect(race.stations.every(station => station.status === 'collected')).toBe(true);
    expect(race.rank).toBeGreaterThanOrEqual(1); expect(race.rank).toBeLessThanOrEqual(20);
    expect(race.opponents).toHaveLength(19);
    expect(race.energy).toBeGreaterThanOrEqual(0); expect(race.energy).toBeLessThanOrEqual(100);
  });
  it.each(CHARACTERS.flatMap(c => SHOES.map(s => ({ ...DEFAULT_SELECTION, character: c.id, shoe: s.id }))))('pace and aids beat constant sprint: $character / $shoe', selection => {
    const paced = run(selection);
    const sprinting = run(selection, race => ({ ...strategy(race), sprint: true, recover: false }));
    expect(sprinting.race.status).toBe('finished');
    expect(paced.race.elapsed).toBeLessThan(sprinting.race.elapsed * .9);
  });
});

describe('race rules', () => {
  it('keeps Huangshan in one event and avoids unnecessary full-marathon suffixes', () => {
    expect(EVENTS).toHaveLength(4); expect(combinations).toHaveLength(30);
    expect(EVENTS.filter(e => e.id === 'huangshan')).toHaveLength(1);
    expect(raceName(DEFAULT_SELECTION)).toBe('厦门马拉松');
    expect(raceName({ event: 'shanghai', category: 'full' })).toBe('上海马拉松');
    expect(raceName({ event: 'huangshan', category: 'half' })).toBe('黄山马拉松 · 半马');
    expect(normalizeSelection({ event: 'yangzhou', category: 'full' }).category).toBe('half');
  });
  it('fixed clock produces the same race at 30, 60, 120 Hz and irregular frame rates', () => {
    const advance = (deltas: number[]) => {
      const race = createRace(DEFAULT_SELECTION); const clock = new FixedClock();
      for (const delta of deltas) clock.advance(delta, () => stepRace(race, NEUTRAL_INPUT));
      return race;
    };
    const expected = advance(Array(600).fill(1 / 60));
    for (const deltas of [Array(300).fill(1 / 30), Array(1200).fill(1 / 120), Array.from({ length: 200 }, () => [.011, .039]).flat()]) {
      const actual = advance(deltas);
      expect(actual.distance).toBeCloseTo(expected.distance, 8); expect(actual.energy).toBeCloseTo(expected.energy, 8);
      expect(actual.elapsed).toBe(expected.elapsed);
    }
    const race = createRace(DEFAULT_SELECTION); const clock = new FixedClock();
    clock.advance(100, () => stepRace(race, NEUTRAL_INPUT));
    expect(race.elapsed).toBeCloseTo(.1 * TIME_SCALE);
  });
  it('pause freezes competitors, time, supplies and energy', () => {
    const race = createRace(DEFAULT_SELECTION); race.status = 'paused';
    const snapshot = structuredClone(race);
    for (let i = 0; i < 120; i++) stepRace(race, { shift: 1, sprint: true, recover: false });
    expect(race).toEqual(snapshot);
    expect(() => makeResult(race, 'bad', new Date().toISOString())).toThrow();
  });
  it('gives recovery precedence, bounds lanes and recovers automatically from exhaustion', () => {
    const race = createRace(DEFAULT_SELECTION); race.energy = 0;
    for (let i = 0; i < 200; i++) stepRace(race, { shift: 1, sprint: true, recover: true });
    expect(race.lane).toBe(1); expect(race.effort).toBe('recover'); expect(race.energy).toBeGreaterThan(0); expect(race.distance).toBeGreaterThan(0);
    for (let i = 0; i < 1500; i++) stepRace(race, NEUTRAL_INPUT);
    expect(race.exhausted).toBe(false); expect(race.effort).toBe('cruise');
  });
  it('collects an aid once, adds a short slowdown, and misses it in the wrong lane', () => {
    const race = createRace(DEFAULT_SELECTION); race.distance = 4990; race.lane = -1; race.energy = 50;
    stepRace(race, NEUTRAL_INPUT);
    expect(race.stations[0].status).toBe('collected'); expect(race.energy).toBeCloseTo(62, 1);
    expect(race.events.filter(e => e.type === 'aid')).toHaveLength(1);
    const speed = race.speed;
    stepRace(race, NEUTRAL_INPUT);
    expect(race.speed).toBeLessThan(speed); expect(race.events.filter(e => e.type === 'aid')).toHaveLength(0);
    race.distance = 10080; race.lane = -1; stepRace(race, NEUTRAL_INPUT);
    expect(race.stations[1].status).toBe('missed');
  });
  it('a close runner slows passing until the player changes lane', () => {
    const race = createRace(DEFAULT_SELECTION);
    race.opponents.forEach(o => { o.distance = 1000; });
    const blocker = race.opponents[0]; blocker.distance = 1; blocker.baseSpeed = 1;
    race.lane = -1; stepRace(race, { ...NEUTRAL_INPUT, sprint: true });
    expect(race.blocked).toBe(true);
    const slow = race.speed;
    stepRace(race, { ...NEUTRAL_INPUT, sprint: true, shift: 1 });
    expect(race.blocked).toBe(false); expect(race.speed).toBeGreaterThan(slow);
  });
  it('interpolates the finish and ranks by actual crossing time in the same step', () => {
    const race = createRace(DEFAULT_SELECTION); race.distance = race.totalDistance - .5; race.elapsed = 12000;
    race.splits = Array.from({ length: 8 }, (_, i) => ({ distance: (i + 1) * 5000, elapsed: (i + 1) * 1400, duration: 1400 }));
    race.opponents.forEach(o => { o.distance = race.totalDistance - 100; o.finishTime = null; });
    race.opponents[0].distance = race.totalDistance; race.opponents[0].finishTime = 11999;
    race.opponents[1].distance = race.totalDistance - .9; race.opponents[1].baseSpeed = 3;
    stepRace(race, NEUTRAL_INPUT);
    expect(race.status).toBe('finished'); expect(race.elapsed).toBeGreaterThan(12000); expect(race.elapsed).toBeLessThan(12000.5);
    expect(race.rank).toBe(2); expect(race.events.some(e => e.type === 'finish')).toBe(true);
    const result = makeResult(race, 'finish', '2026-10-26T00:00:00Z');
    expect(result.splits.at(-1)?.elapsed).toBe(result.elapsed);
    stepRace(race, NEUTRAL_INPUT); expect(race.events).toHaveLength(0);
  });
  it('formats runner time and pace consistently', () => {
    expect(formatTime(3661.9)).toBe('01:01:01'); expect(formatPace(1000 / 300)).toBe('5′00″'); expect(formatPace(0)).toBe('—:—');
  });
});
