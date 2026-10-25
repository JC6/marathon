import Phaser from 'phaser';
import { landscapeArt } from './art';
import { characterById, courseSection, eventById, shoeById } from './data';
import type { RaceState } from './types';

const color = (hex: string) => Number.parseInt(hex.slice(1), 16);
const AI_COLORS = [0x627f9c, 0xc18e55, 0x96a566, 0xb87c86, 0xe8e7d4, 0x438e87];

export interface RaceView {
  destroy(): void;
  resize(): void;
  setActive(active: boolean): void;
}

/** The renderer reads race state; it never owns the rules or the race clock. */
export async function mountRaceView(parent: HTMLElement, state: RaceState, tick: (delta: number) => void): Promise<RaceView> {
  let game: Phaser.Game;
  let disposed = false;
  let active = true;
  let drawing = false;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  let cssWidth = Math.max(1, parent.clientWidth);
  let cssHeight = Math.max(1, parent.clientHeight);
  let resolveReady: () => void;
  let rejectReady: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });

  class RaceScene extends Phaser.Scene {
    private brush!: Phaser.GameObjects.Graphics;
    private backdrop!: Phaser.GameObjects.Image;
    private banner!: Phaser.GameObjects.Text;
    private lane = 0;
    private aiLanes = state.opponents.map(opponent => Number(opponent.lane));
    private animation = 0;
    private backdropReady = false;
    constructor() { super('race'); }
    preload() {
      const svg = landscapeArt(state.selection.event).replace('class="landscape-art"', 'xmlns="http://www.w3.org/2000/svg" width="1440" height="560"');
      const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(svg)));
      this.load.svg('course', `data:image/svg+xml;base64,${encoded}`);
      this.load.on('loaderror', () => { /* The native course renderer remains usable. */ });
    }
    create() {
      this.cameras.main.setZoom(pixelRatio);
      this.cameras.main.setOrigin(0, 0);
      this.backdropReady = this.textures.exists('course');
      if (this.backdropReady) this.backdrop = this.add.image(0, 0, 'course').setOrigin(.5, 0);
      this.brush = this.add.graphics();
      this.banner = this.add.text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', fontSize: '18px', color: '#fffdf0' }).setOrigin(.5);
      resolveReady();
    }
    update(_time: number, delta: number) {
      if (disposed) return;
      drawing = true;
      tick(delta / 1000);
      if (state.status === 'running') this.animation += Math.min(delta, 100) / 1000;
      this.lane += (state.lane - this.lane) * Math.min(1, delta / 100);
      state.opponents.forEach(opponent => { this.aiLanes[opponent.id] += (opponent.lane - this.aiLanes[opponent.id]) * Math.min(1, delta / 160); });
      this.drawCourse();
      drawing = false;
    }
    private drawCourse() {
      const g = this.brush;
      const w = cssWidth, h = cssHeight;
      const event = eventById(state.selection.event);
      const section = courseSection(state.selection, state.distance);
      const horizon = h * .31 + section.grade * h * .8;
      const bottom = h * 1.08;
      const roadWidth = Math.min(w * .61, h * .78);
      const runnerScale = Math.min(Math.max(h / 590, 1), w / 380, 1.65) * 1.2;
      // Keep the player's feet above the HUD, including short phone/laptop screens.
      const compactLandscape = h <= 560 && w > h;
      const hudBottom = compactLandscape ? 18 : w <= 760 ? 134 : 144;
      const runnerY = Math.min(h * .746, h - hudBottom - 82);
      const cameraDistance = Math.max(65, 85 * ((bottom - horizon) / Math.max(h * .2, runnerY - horizon) - 1));
      const curve = Math.sin(state.distance / 2300) * Math.min(70, w * .08);
      const point = (distance: number) => {
        const scale = 1 / (1 + Math.max(-5, distance + cameraDistance) / 85);
        return { x: w / 2 + curve * (1 - scale), y: horizon + (bottom - horizon) * scale, scale, half: roadWidth * scale };
      };
      g.clear();
      this.cameras.main.setBackgroundColor(event.sky);
      if (this.backdropReady) this.backdrop.setPosition(w / 2 - curve * .25, 0).setDisplaySize(Math.max(w + 100, h * 1.8), horizon + h * .15);
      g.fillStyle(color(event.ground)); g.fillRect(0, horizon + h * .07, w, h);
      // The sea/canal runs along the left side, while Huangshan uses a lake.
      if (event.id !== 'shanghai') {
        g.fillStyle(event.id === 'huangshan' ? 0x85b7a0 : 0x7fb6b3);
        g.beginPath(); g.moveTo(0, horizon + h * .065); g.lineTo(w * .4, horizon + h * .065); g.lineTo(w * .04, h); g.lineTo(0, h); g.closePath(); g.fillPath();
      }
      const quad = (a: ReturnType<typeof point>, b: ReturnType<typeof point>, factor: number, fill: number) => {
        g.fillStyle(fill); g.beginPath(); g.moveTo(a.x - a.half * factor, a.y); g.lineTo(a.x + a.half * factor, a.y); g.lineTo(b.x + b.half * factor, b.y); g.lineTo(b.x - b.half * factor, b.y); g.closePath(); g.fillPath();
      };
      for (let distance = 1400; distance > -cameraDistance - 20; distance -= 20) {
        const far = point(distance), near = point(distance - 20);
        const stripe = Math.floor((state.distance + distance) / 35) % 2 === 0;
        quad(far, near, 1.07, stripe ? 0xf3eee0 : 0xc9bba0);
      }
      // One continuous road underlay prevents antialiasing seams between segments.
      quad(point(1400), point(-cameraDistance - 30), 1, 0x899693);
      for (let distance = 1400; distance > -cameraDistance - 20; distance -= 20) {
        const far = point(distance), near = point(distance - 20);
        const stripe = Math.floor((state.distance + distance) / 35) % 2 === 0;
        quad(far, near, 1, stripe ? 0x8a9794 : 0x899693);
        if (Math.floor((state.distance + distance) / 18) % 3 === 0) {
          for (const lane of [-1 / 3, 1 / 3]) {
            g.lineStyle(Math.max(.5, near.scale * 2), 0xe4e6d8, .55);
            g.lineBetween(far.x + far.half * lane, far.y, near.x + near.half * lane, near.y);
          }
        }
      }
      // Roadside markers are anchored to world distance, so they pass naturally.
      const objects: { distance: number; side: number; kind: number }[] = [];
      for (let i = 0; i < 17; i++) {
        const distance = i * 60 - state.distance % 60;
        if (distance > -5) objects.push({ distance, side: i % 2 ? -1 : 1, kind: Math.floor(state.distance / 60 + i) % 5 });
      }
      for (const item of objects.reverse()) {
        const p = point(item.distance);
        const x = p.x + item.side * p.half * 1.3;
        const scale = p.scale * Math.min(h / 640, 1.4);
        if (item.kind < 2 || section.crowd < .4) {
          g.fillStyle(0x7c8261); g.fillRect(x - 3 * scale, p.y - 55 * scale, 6 * scale, 55 * scale);
          g.fillStyle(event.id === 'yangzhou' ? 0x8ca871 : 0x648c6d);
          g.fillEllipse(x, p.y - 66 * scale, 49 * scale, 65 * scale);
          g.fillStyle(0x7e9d75); g.fillEllipse(x - 9 * scale, p.y - 75 * scale, 26 * scale, 36 * scale);
        } else {
          this.runner(x, p.y, scale * .68, AI_COLORS[item.kind], 0xe9e8d5, item.kind, false, true);
          g.lineStyle(2 * scale, 0xf1eddb); g.lineBetween(x + 15 * scale, p.y - 30 * scale, x + 15 * scale, p.y - 78 * scale);
          g.fillStyle(event.id === 'shanghai' ? 0xc78980 : 0xeab774);
          g.fillTriangle(x + 15 * scale, p.y - 78 * scale, x + 45 * scale, p.y - 73 * scale, x + 15 * scale, p.y - 60 * scale);
        }
      }
      this.banner.setVisible(false);
      for (const station of state.stations) {
        const distance = station.distance - state.distance;
        if (distance < -20 || distance > 700) continue;
        const p = point(distance);
        const x = p.x + station.lane * p.half * 1.16;
        const s = p.scale * Math.min(h / 640, 1.5);
        const tint = station.type === 'water' ? 0x4c9fab : 0xd99857;
        g.fillStyle(0xf9f4dd); g.fillRect(x - 42 * s, p.y - 73 * s, 84 * s, 15 * s);
        g.fillStyle(tint); g.fillTriangle(x - 51 * s, p.y - 73 * s, x, p.y - 100 * s, x + 51 * s, p.y - 73 * s);
        g.lineStyle(3 * s, 0xf9f4dd); g.lineBetween(x - 37 * s, p.y - 58 * s, x - 37 * s, p.y); g.lineBetween(x + 37 * s, p.y - 58 * s, x + 37 * s, p.y);
        g.fillStyle(tint); g.fillRect(x - 37 * s, p.y - 29 * s, 74 * s, 17 * s);
        for (let i = -1; i <= 1; i++) { g.fillStyle(0xfff9e9); g.fillRect(x + i * 18 * s - 4 * s, p.y - 39 * s, 8 * s, 10 * s); }
        if (station.status === 'collected') { g.fillStyle(0xf4d487, .5); g.fillCircle(x, p.y - 60 * s, 13 * s); }
      }
      const finish = state.totalDistance - state.distance;
      if (finish < 900) {
        const p = point(finish);
        const top = p.y - 180 * p.scale;
        g.fillStyle(0xe8704d); g.fillRect(p.x - p.half, top, p.half * 2, 30 * p.scale);
        g.fillRect(p.x - p.half, top, 12 * p.scale, p.y - top); g.fillRect(p.x + p.half - 12 * p.scale, top, 12 * p.scale, p.y - top);
        for (let i = 0; i < 16; i++) { g.fillStyle(i % 2 ? 0xfffbed : 0x324a48); g.fillRect(p.x - p.half + i * p.half / 8, p.y - 7 * p.scale, p.half / 8, 7 * p.scale); }
        this.banner.setVisible(true).setText('FINISH').setPosition(p.x, top + 15 * p.scale).setScale(Math.max(.22, p.scale));
      }
      const runners = state.opponents.filter(o => o.distance - state.distance > -22 && o.distance - state.distance < 900)
        .map(o => ({ ...o, relative: o.distance - state.distance })).sort((a, b) => b.relative - a.relative);
      let drawnPlayer = false;
      const drawPlayer = () => {
        const p = point(0);
        const s = p.scale * runnerScale;
        this.runner(p.x + this.lane * p.half * .63, p.y, s, color(characterById(state.selection.character).color), color(shoeById(state.selection.shoe).accent), 0, true);
      };
      for (const opponent of runners) {
        if (opponent.relative < 0 && !drawnPlayer) { drawPlayer(); drawnPlayer = true; }
        const p = point(opponent.relative);
        this.runner(p.x + this.aiLanes[opponent.id] * p.half * .63, p.y, p.scale * runnerScale, AI_COLORS[opponent.id % AI_COLORS.length], 0xe9e8d5, opponent.id, false);
      }
      if (!drawnPlayer) drawPlayer();
      if (state.status === 'finished') {
        for (let i = 0; i < 50; i++) {
          const x = (i * 127.7 + Math.sin(i) * 80) % w;
          const y = (i * 83.3) % (h * .8);
          g.fillStyle([0xe9704c, 0xf0d28f, 0x659b8a][i % 3]); g.fillRect(x, y, 5, 9);
        }
      }
    }
    private runner(x: number, y: number, scale: number, shirt: number, shoe: number, id: number, player: boolean, cheering = false) {
      const g = this.brush;
      const phase = this.animation * (state.effort === 'sprint' ? 17 : 13) + id * 1.4;
      const swing = cheering ? Math.sin(this.animation * 6 + id) * 4 : Math.sin(phase) * 11;
      const bob = Math.abs(Math.cos(phase)) * 2.5;
      const px = (v: number) => x + v * scale;
      const py = (v: number) => y - (v + bob) * scale;
      g.fillStyle(0x2d423b, .17); g.fillEllipse(x, y + 1 * scale, 36 * scale, 10 * scale);
      if (player) { g.lineStyle(1.6 * scale, 0xf8edcd, .8); g.strokeEllipse(x, y + 2 * scale, 47 * scale, 14 * scale); }
      g.lineStyle(7 * scale, 0xd9a183);
      g.lineBetween(px(-6), py(31), px(-7 - swing * .48), py(16)); g.lineBetween(px(-7 - swing * .48), py(16), px(-7 + swing * .65), py(3 + Math.max(0, swing * .25)));
      g.lineStyle(7 * scale, 0xe7b395);
      g.lineBetween(px(6), py(31), px(7 + swing * .48), py(16)); g.lineBetween(px(7 + swing * .48), py(16), px(7 - swing * .65), py(3 + Math.max(0, -swing * .25)));
      g.fillStyle(shoe); g.fillRoundedRect(px(-14 + swing * .65), py(7 + Math.max(0, swing * .25)), 13 * scale, 6 * scale, 2 * scale);
      g.fillRoundedRect(px(1 - swing * .65), py(7 + Math.max(0, -swing * .25)), 13 * scale, 6 * scale, 2 * scale);
      g.fillStyle(0x2d4145); g.fillRoundedRect(px(-12), py(41), 24 * scale, 16 * scale, 3 * scale);
      g.lineStyle(6 * scale, 0xe6ae8c);
      g.lineBetween(px(-12), py(58), px(-19), py(cheering ? 73 : 44 + swing * .3)); g.lineBetween(px(-19), py(cheering ? 73 : 44 + swing * .3), px(-13), py(cheering ? 85 : 39 + swing * .3));
      g.lineBetween(px(12), py(58), px(19), py(cheering ? 73 : 44 - swing * .3)); g.lineBetween(px(19), py(cheering ? 73 : 44 - swing * .3), px(13), py(cheering ? 85 : 39 - swing * .3));
      g.fillStyle(shirt); g.fillRoundedRect(px(-12), py(64), 24 * scale, 29 * scale, 5 * scale);
      g.fillStyle(0xf8f4dd); g.fillRoundedRect(px(-8), py(52), 16 * scale, 10 * scale, 1 * scale);
      g.lineStyle(1.3 * scale, 0x46625c); g.lineBetween(px(-3), py(49), px(-3), py(45)); g.lineBetween(px(2), py(49), px(2), py(45));
      g.fillStyle(0xe1a98a); g.fillRect(px(-4), py(69), 8 * scale, 9 * scale); g.fillCircle(px(0), py(76), 10 * scale);
      g.fillStyle(0x33423f); g.fillEllipse(px(0), py(80), 21 * scale, 14 * scale);
      if (player && state.selection.character === 'runner') { g.fillStyle(0xf6efda); g.fillRoundedRect(px(-11), py(84), 22 * scale, 5 * scale, 2 * scale); }
    }
  }
  const resize = () => {
    if (disposed || !game) return;
    cssWidth = Math.max(1, parent.clientWidth); cssHeight = Math.max(1, parent.clientHeight);
    game.scale.resize(Math.round(cssWidth * pixelRatio), Math.round(cssHeight * pixelRatio));
    game.canvas.style.width = `${cssWidth}px`; game.canvas.style.height = `${cssHeight}px`;
    if (!active && !drawing) game.step(performance.now(), 0);
  };
  const observer = new ResizeObserver(resize);
  try {
    game = new Phaser.Game({
      // This scene consists of paths and sprites; Canvas avoids a WebGL context and shader buffers.
      type: Phaser.CANVAS, parent, width: Math.round(cssWidth * pixelRatio), height: Math.round(cssHeight * pixelRatio),
      backgroundColor: eventById(state.selection.event).sky, scene: RaceScene,
      audio: { noAudio: true }, input: { keyboard: false, mouse: false, touch: false },
      render: { antialias: true, pixelArt: false, roundPixels: false },
      banner: false, fps: { target: 60, smoothStep: false },
    });
    game.events.once('destroy', () => { disposed = true; });
    const timeout = window.setTimeout(() => rejectReady(new Error('画面加载超时，请重试。')), 15000);
    try { await ready; } finally { window.clearTimeout(timeout); }
    if (disposed) throw new Error('Race view was closed.');
    game.canvas.setAttribute('aria-label', '马拉松赛道。使用方向键换道，空格冲刺，下方向键恢复。');
    game.canvas.setAttribute('role', 'img');
    resize(); observer.observe(parent);
    return {
      resize,
      setActive(value) {
        if (disposed) return;
        active = value;
        if (active) { game.loop.resetDelta(); game.loop.wake(); }
        else {
          game.loop.sleep();
          if (!drawing) game.step(performance.now(), 0);
        }
      },
      destroy() {
        if (disposed) return;
        disposed = true; observer.disconnect(); game.destroy(true);
        // Complete destruction even when the render loop is sleeping at a pause screen.
        game.step(performance.now(), 0);
      },
    };
  } catch (error) {
    disposed = true; observer.disconnect(); game!?.destroy(true); throw error;
  }
}
