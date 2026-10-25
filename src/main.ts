import './style.css';
import { icon, landscapeArt, runnerArt, shoeArt } from './art';
import { RaceAudio } from './audio';
import { CHARACTERS, EVENTS, SHOES, characterById, courseSection, eventById, normalizeSelection, raceName, shoeById } from './data';
import { RaceInput } from './input';
import { FixedClock, createRace, formatPace, formatTime, makeResult, nextAid, stepRace } from './simulation';
import { SaveStore, bestKey, medalKey, recordResult } from './storage';
import type { RaceView } from './scene';
import type { RaceResult, RaceState, Selection } from './types';

const app = document.querySelector<HTMLDivElement>('#app')!;
const store = new SaveStore();
const save = store.load();
const audio = new RaceAudio();
audio.muted = save.muted;
let selection = save.selection;
let race: RaceState | null = null;
let view: RaceView | null = null;
let input: RaceInput | null = null;
let viewId = 0;
let hudElapsed = 0;
let raceReady = false;
let resultHandled = false;
let finishTimeout: number | undefined;
let toastTimeout: number | undefined;
const fixedClock = new FixedClock();
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const km = (distance: number) => (distance / 1000).toFixed(distance % 1000 === 0 ? 0 : distance === 42195 ? 3 : 4);
const selectedCheck = '<span class="selected-check" aria-hidden="true">' + icon('check') + '</span>';
const persist = () => { save.selection = { ...selection }; store.save(save); };
const soundButton = () => `<button class="icon-button sound-button" data-action="sound" aria-label="${save.muted ? '打开声音' : '静音'}" title="${save.muted ? '打开声音' : '静音'}">${icon(save.muted ? 'muted' : 'sound')}</button>`;
const bestSummary = () => save.best[bestKey(selection)] ? formatTime(save.best[bestKey(selection)].elapsed) : '等待你的第一步';

function renderSetup(focus?: string) {
  const event = eventById(selection.event);
  const distance = event.categories.find(c => c.id === selection.category)!.distance;
  document.body.classList.remove('in-race');
  app.innerHTML = `
    <header class="site-header"><a class="brand" href="/" aria-label="Marathon 首页"><span class="brand-mark">M</span>Marathon<span class="brand-dot">.</span></a>
      <nav aria-label="游戏菜单">${soundButton()}<button class="text-button" data-action="records">${icon('medal')}<span>我的纪录</span></button><button class="icon-button" data-action="help" aria-label="玩法说明">${icon('help')}</button></nav>
    </header>
    <main class="setup-main">
      <section class="intro"><div><p class="eyebrow">A LITTLE RUN. A LONG WAY.</p><h1>跑自己的节奏<span>。</span></h1><p class="intro-description">选一双跑鞋，去一座城市。把下一步，交给自己。</p></div><div class="edition"><span class="status-dot"></span> 随时可以出发 <span>01 — 04 / 中国</span></div></section>
      <section class="course-hero" aria-label="所选赛道预览"><div class="hero-copy"><p class="eyebrow">NEXT START LINE <span>↗</span></p><h2>${event.tag}</h2><p>${event.description}</p><div class="hero-facts"><span><b>${km(distance)}</b> km</span><span class="hero-location">${raceName(selection)}</span></div></div><div class="hero-art">${landscapeArt(selection.event)}<div class="hero-runner">${runnerArt(selection.character)}</div><span class="art-caption">${event.english} / RUN YOUR OWN RACE</span></div></section>
      <div class="equipment-grid">
        <section class="choice-section" aria-labelledby="character-heading"><div class="section-heading"><h2 id="character-heading"><span>01</span> 今天，以什么状态出发</h2><span class="section-note">选择角色</span></div><div class="character-grid">
          ${CHARACTERS.map(character => `<button class="choice-card character-card ${selection.character === character.id ? 'selected' : ''}" data-character="${character.id}" aria-pressed="${selection.character === character.id}">${runnerArt(character.id)}<span class="character-copy"><strong>${character.name}</strong><span class="card-subtitle">${character.subtitle}</span><span class="tag">${character.id === 'runner' ? '体力充足 · 稳定巡航' : '带点疲惫 · 进阶挑战'}</span></span>${selectedCheck}</button>`).join('')}
        </div><p class="selection-description">${characterById(selection.character).description}</p></section>
        <section class="choice-section" aria-labelledby="shoe-heading"><div class="section-heading"><h2 id="shoe-heading"><span>02</span> 选一双同行的跑鞋</h2><span class="section-note">选择装备</span></div><div class="shoe-grid">
          ${SHOES.map(shoe => `<button class="choice-card shoe-card ${selection.shoe === shoe.id ? 'selected' : ''}" data-shoe="${shoe.id}" aria-pressed="${selection.shoe === shoe.id}">${shoeArt(shoe.id)}<strong>${shoe.name}</strong><span class="card-subtitle">${shoe.tagline}</span><span class="shoe-ratings">${['巡航', '耐力', '冲刺'].map((label, i) => `<span>${label}<span class="rating-bars" aria-label="${shoe.ratings[i]} / 5">${Array.from({ length: 5 }, (_, j) => `<i class="${j < shoe.ratings[i] ? 'filled' : ''}"></i>`).join('')}</span></span>`).join('')}</span>${selectedCheck}</button>`).join('')}
        </div><p class="selection-description">${shoeById(selection.shoe).description}</p></section>
      </div>
      <section class="choice-section event-section" aria-labelledby="event-heading"><div class="section-heading"><h2 id="event-heading"><span>03</span> 下一站，跑向哪里</h2><span class="section-note">4 座城市 · 5 个起点</span></div><div class="event-grid">
        ${EVENTS.map(course => `<button class="choice-card event-card ${selection.event === course.id ? 'selected' : ''}" data-event="${course.id}" aria-pressed="${selection.event === course.id}"><div class="event-art">${landscapeArt(course.id)}<span class="event-code">${course.english}</span></div><span class="event-copy"><strong>${course.name}</strong><span>${course.id === 'huangshan' ? '半马 / 全马' : km(course.categories[0].distance) + ' km'}<span class="event-tag">${course.tag}</span></span></span>${selectedCheck}</button>`).join('')}
      </div>
      ${selection.event === 'huangshan' ? `<div class="category-row"><span>黄山马拉松项目</span><div class="segmented" aria-label="比赛项目">${event.categories.map(category => `<button data-category="${category.id}" aria-pressed="${selection.category === category.id}" class="${selection.category === category.id ? 'active' : ''}">${category.id === 'half' ? '半马' : '全马'} <span>${km(category.distance)} km</span></button>`).join('')}</div><small>两个项目分别记录成绩</small></div>` : ''}
      </section>
      <footer class="setup-footer"><span>每一位跑者，都有自己的终点。</span><span>原创场景 · 跑鞋数值为游戏设定 <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noopener">开源致谢 ↗</a></span></footer>
      ${store.warning ? `<p class="storage-warning" role="status">${escapeHtml(store.warning)}</p>` : ''}
    </main>
    <div class="start-dock"><div class="start-dock-inner"><div class="selected-summary"><span class="ready-label"><span class="status-dot"></span> 准备就绪</span><strong>${raceName(selection)}</strong><small>${characterById(selection.character).name} <span>·</span> ${shoeById(selection.shoe).name}</small></div><div class="start-record"><span>个人最好 / ${characterById(selection.character).name}</span><strong>${bestSummary()}</strong></div><button class="primary-button start-button" data-action="start"><span>站上起跑线<small>约 ${selection.category === 'half' ? '3–5' : '6–10'} 分钟</small></span>${icon('arrow')}</button></div></div>
    <div id="toast" class="toast" role="status"></div>`;
  if (focus) app.querySelector<HTMLButtonElement>(focus)?.focus({ preventScroll: true });
}

function destroyRace() {
  viewId++;
  window.clearTimeout(finishTimeout); window.clearTimeout(toastTimeout);
  input?.dispose(); input = null;
  view?.destroy(); view = null;
  audio.quiet(); fixedClock.reset();
  race = null; raceReady = false; resultHandled = false;
}

async function startRace() {
  destroyRace();
  persist(); void audio.unlock();
  const id = viewId;
  const state = createRace(selection);
  race = state;
  hudElapsed = 0;
  document.body.classList.add('in-race');
  app.innerHTML = `<main class="race-screen"><div id="race-canvas" class="race-canvas"></div>
    <div class="race-top"><div class="race-title"><span class="mini-brand">M</span><div><strong>${raceName(selection)}</strong><span id="course-section">准备起跑</span></div></div><div class="race-actions">${soundButton()}<button class="icon-button" data-action="pause" aria-label="暂停比赛">${icon('pause')}</button></div></div>
    <div class="race-hud" aria-label="比赛状态"><div class="hud-distance"><span>已跑 / ${km(state.totalDistance)} km</span><strong><b id="distance">0.00</b><small>km</small></strong></div><div><span>用时 <small>×30</small></span><strong id="elapsed">00:00:00</strong></div><div><span>配速 / km</span><strong id="pace">—:—</strong></div><div><span>当前名次</span><strong><b id="rank">20</b><small>/ 20</small></strong></div></div>
    <div class="course-progress" aria-label="赛程进度"><div id="progress-fill"></div>${state.stations.map(station => `<i style="left:${station.distance / state.totalDistance * 100}%" title="${station.distance / 1000} km 补给"></i>`).join('')}</div>
    <div class="race-info"><div id="aid-hint" class="aid-hint"></div><div id="effort-hint" class="effort-hint">稳定巡航</div></div>
    <div class="energy-panel"><div><span>体力 <b id="energy-number">${state.energy}</b></span><span id="energy-label">留一点力气给后程</span></div><div class="energy-track" role="progressbar" aria-label="体力" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${state.energy}"><div id="energy-fill"></div></div><span class="fatigue-label">疲劳 <b id="fatigue-number">0</b>%</span></div>
    <div class="race-controls" aria-label="比赛操作"><div class="lane-controls"><button data-control="left" aria-label="向左换道"><span>←</span><small>换道</small></button><button data-control="right" aria-label="向右换道"><span>→</span><small>换道</small></button></div><div class="effort-controls"><button data-control="recover" aria-label="按住恢复体力"><span>恢复</span><small>按住 / ↓</small></button><button data-control="sprint" class="sprint-control" aria-label="按住冲刺"><span>冲刺 ↗</span><small>按住 / 空格</small></button></div></div>
    <p class="keyboard-hint">← → 换道 <span>空格 冲刺</span> ↓ 恢复 <span>Esc 暂停</span></p>
    <div id="race-overlay" class="race-overlay"><div class="overlay-card loading-card"><span class="loading-orbit"></span><p class="eyebrow">GET READY</p><h1>起跑线就在前面</h1><p>正在准备${eventById(selection.event).name}的赛道…</p></div></div>
    <div id="toast" class="toast race-toast" role="status"></div><div id="announcer" class="sr-only" aria-live="polite"></div>
  </main>`;
  input = new RaceInput(app, () => raceReady && state.status === 'running', () => { if (raceReady) state.status === 'paused' ? resumeRace() : pauseRace(); });
  try {
    const { mountRaceView } = await import('./scene');
    if (id !== viewId) return;
    const created = await mountRaceView(document.querySelector<HTMLElement>('#race-canvas')!, state, delta => tickRace(state, delta));
    if (id !== viewId) { created.destroy(); return; }
    view = created;
    raceReady = true;
    document.querySelector('#race-overlay')!.innerHTML = `<div class="overlay-card ready-card"><p class="eyebrow">YOUR RACE. YOUR PACE.</p><h1>准备好出发了吗？</h1><p>自动向前跑，掌握自己的节奏。</p><div class="ready-tips"><span><b>← →</b> 换道避让</span><span><b>空格</b> 按住冲刺</span><span><b>↓</b> 按住恢复</span></div><p class="small-copy">每 5 km 留意左、右补给站。半马约 3–5 分钟，马拉松约 6–10 分钟。</p><button class="primary-button" data-action="go">出发 ${icon('arrow')}</button><button class="plain-button" data-action="quit">返回准备</button></div>`;
    state.status = 'paused';
    view.setActive(false);
    document.querySelector<HTMLButtonElement>('[data-action="go"]')!.focus();
    updateHud(state);
  } catch (error) {
    if (id !== viewId) return;
    document.querySelector('#race-overlay')!.innerHTML = `<div class="overlay-card"><h1>赛道暂时没有准备好</h1><p>${escapeHtml(error instanceof Error ? error.message : '请重试，或更新浏览器后再试。')}</p><button class="primary-button" data-action="start">重新加载</button><button class="plain-button" data-action="quit">返回准备</button></div>`;
  }
}

function tickRace(state: RaceState, delta: number) {
  if (!raceReady || state.status !== 'running') return;
  fixedClock.advance(delta, () => {
    if (state.status !== 'running') return;
    stepRace(state, input!.take());
    for (const event of state.events) {
      if (event.type === 'aid') { audio.cue('aid'); toast(event.aid === 'water' ? '补水成功 · 体力 +12' : '能量胶补给 · 体力 +22'); }
      if (event.type === 'split') {
        audio.cue('split');
        toast(event.split.distance === state.totalDistance
          ? `完赛！${km(event.split.distance)} km · ${formatTime(event.split.elapsed)}`
          : `${km(event.split.distance)} km · ${formatTime(event.split.duration)} / 本段`);
      }
      if (event.type === 'final-kilometre') { audio.cue('crowd'); toast('最后 1 km，终点就在前方！'); }
      if (event.type === 'finish') finishRace(state);
    }
  });
  hudElapsed += delta;
  if (hudElapsed >= .1 || resultHandled) { updateHud(state); hudElapsed = 0; }
  if (state.status === 'running') audio.tick(state.speed, state.energy, performance.now());
}

function updateHud(state: RaceState) {
  const setText = (id: string, value: string) => { const element = document.getElementById(id); if (element && element.textContent !== value) element.textContent = value; };
  setText('distance', (state.distance / 1000).toFixed(2)); setText('elapsed', formatTime(state.elapsed));
  setText('pace', formatPace(state.speed)); setText('rank', String(state.rank));
  setText('energy-number', String(Math.round(state.energy))); setText('fatigue-number', String(Math.round(state.fatigue * 100)));
  setText('course-section', courseSection(state.selection, state.distance).label);
  const progress = document.getElementById('progress-fill');
  if (progress) progress.style.width = `${state.distance / state.totalDistance * 100}%`;
  const energy = document.getElementById('energy-fill');
  if (energy) { energy.style.width = `${state.energy}%`; energy.style.background = state.energy < 25 ? '#dc7952' : '#478b7b'; energy.parentElement!.setAttribute('aria-valuenow', String(Math.round(state.energy))); }
  setText('energy-label', state.exhausted ? '自动恢复中，体力回升后继续' : state.energy < 25 ? '放慢一点，为后程补充体力' : '留一点力气给后程');
  const effortLabel = state.exhausted ? '体力不足 · 自动恢复' : state.effort === 'sprint' ? '正在冲刺 ↗' : state.effort === 'recover' ? '放慢脚步 · 恢复体力' : '稳定巡航';
  setText('effort-hint', effortLabel + (state.blocked ? ' · 换道超越' : ''));
  const station = nextAid(state);
  const aid = document.getElementById('aid-hint');
  if (aid) {
    const near = station && station.distance - state.distance < 600;
    aid.classList.toggle('approaching', !!near);
    aid.textContent = station ? `${station.lane === -1 ? '← 左侧' : '右侧 →'} ${station.type === 'water' ? '饮水站' : '能量胶'} · ${Math.max(0, Math.round((station.distance - state.distance) / 10) * 10)} m` : '终点在前方，保持节奏';
  }
}

function pauseRace(reason = '休息一下，再出发。') {
  if (!race || !raceReady || race.status !== 'running') return;
  race.status = 'paused'; input?.clear(); fixedClock.reset(); audio.quiet();
  view?.setActive(false);
  document.querySelector('#race-overlay')!.innerHTML = `<div class="overlay-card"><p class="eyebrow">TAKE A BREATH</p><h1>比赛已暂停</h1><p>${reason}</p><p class="small-copy">用时和跑者都停在原地。准备好后继续。</p><button class="primary-button" data-action="resume">继续比赛 ${icon('arrow')}</button><button class="plain-button" data-action="quit">结束本场，返回准备</button></div>`;
  document.querySelector<HTMLButtonElement>('[data-action="resume"]')!.focus();
}
function resumeRace() {
  if (!race || !raceReady || race.status !== 'paused') return;
  if (document.hidden) return;
  input?.clear(); fixedClock.reset(); race.status = 'running';
  view?.setActive(true);
  document.querySelector('#race-overlay')!.innerHTML = '';
  (document.activeElement as HTMLElement)?.blur();
  void audio.unlock();
}

function finishRace(state: RaceState) {
  if (resultHandled) return;
  resultHandled = true; input?.clear(); audio.quiet(); audio.cue('finish');
  view?.setActive(false);
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const result = makeResult(state, id, new Date().toISOString());
  const flags = recordResult(save, result); persist();
  document.getElementById('announcer')!.textContent = '完赛！用时 ' + formatTime(result.elapsed);
  finishTimeout = window.setTimeout(() => showResult(result, flags.pb, flags.medal), 1300);
}

function showResult(result: RaceResult, pb: boolean, medal: boolean) {
  window.clearTimeout(toastTimeout);
  document.getElementById('toast')?.classList.remove('visible');
  const previousBest = save.best[bestKey(result)];
  document.querySelector('#race-overlay')!.innerHTML = `<section class="overlay-card result-card" aria-label="完赛成绩"><div class="result-top"><span class="result-medal">${icon('medal')}</span><p class="eyebrow">EVERY FINISH IS A NEW START.</p><h1>${pb ? '这是你的新纪录。' : '每一步，都算数。'}</h1><p>${raceName(result)} · 完赛</p></div><div class="result-time">${formatTime(result.elapsed)}</div><div class="result-badges">${pb ? '<span>PERSONAL BEST</span>' : ''}${medal ? '<span>首次完赛奖牌 ✓</span>' : ''}</div><div class="result-stats"><span><small>最终名次</small><b>${result.rank}<small> / 20</small></b></span><span><small>平均配速</small><b>${formatPace(result.distance / result.elapsed)}</b></span><span><small>补给次数</small><b>${result.aidCount}</b></span></div><p class="result-kit">${characterById(result.character).name} · ${shoeById(result.shoe).name}</p><details class="split-details"><summary>查看分段成绩 <span>${result.splits.length} 段</span></summary><table><thead><tr><th>距离</th><th>本段用时</th><th>累计用时</th></tr></thead><tbody>${result.splits.map(split => `<tr><td>${km(split.distance)} km</td><td>${formatTime(split.duration)}</td><td>${formatTime(split.elapsed)}</td></tr>`).join('')}</tbody></table></details>${!pb && previousBest ? `<p class="small-copy">该角色个人最好 ${formatTime(previousBest.elapsed)}</p>` : ''}${store.warning ? `<p class="storage-warning">${escapeHtml(store.warning)}</p>` : ''}<div class="result-actions"><button class="primary-button" data-action="start">再跑一次 ${icon('arrow')}</button><button class="secondary-button" data-action="quit">返回准备</button></div></section>`;
  document.querySelector<HTMLButtonElement>('[data-action="start"]')!.focus();
}

function toast(message: string) {
  const element = document.getElementById('toast');
  if (!element) return;
  window.clearTimeout(toastTimeout); element.textContent = message; element.classList.add('visible');
  toastTimeout = window.setTimeout(() => element.classList.remove('visible'), 3000);
}

function showDialog(kind: 'help' | 'records') {
  const dialog = document.createElement('dialog');
  dialog.className = 'info-dialog';
  dialog.innerHTML = `<button class="icon-button dialog-close" aria-label="关闭">${icon('close')}</button>${kind === 'help' ? `
    <p class="eyebrow">FIND YOUR RHYTHM</p><h2>跑步很简单。<br>节奏，由你掌握。</h2><p>跑者会自动向前。适时超越、恢复和补给，带着自己的节奏跑过终点。</p>
    <div class="instruction-list"><div><kbd>←</kbd><kbd>→</kbd><span><strong>左右换道</strong>避让前方跑者，靠近补给站。</span></div><div><kbd>空格</kbd><span><strong>按住冲刺</strong>提高速度，也会更快消耗体力。</span></div><div><kbd>↓</kbd><span><strong>按住恢复</strong>放慢速度，恢复体力并缓解疲劳。</span></div><div><kbd>Esc</kbd><span><strong>随时暂停</strong>离开页面也会自动暂停。</span></div></div><p>手机直接使用屏幕按钮，可以一边换道一边冲刺。恢复与冲刺同时按下时，优先恢复。</p><p>每 5 km 左右交替出现饮水站、能量胶站。提前靠近对应一侧即可领取。没力气时会自动减速恢复，坚持就能到达终点。</p><div class="info-note">比赛以 30 倍时间推进；路线和装备数值是游戏化设计。记录保存在当前浏览器，按赛事、项目和角色区分 PB。</div>` : `
    <p class="eyebrow">YOUR MILES, YOUR STORIES</p><h2>每一次出发，都留下足迹。</h2><div class="medal-collection">${EVENTS.flatMap(event => event.categories.map(category => `<div class="collection-item ${save.medals.includes(medalKey({ event: event.id, category: category.id })) ? 'earned' : ''}">${icon('medal')}<span>${event.name}${event.id === 'huangshan' ? ' · ' + (category.id === 'half' ? '半马' : '全马') : ''}</span><small>${save.medals.includes(medalKey({ event: event.id, category: category.id })) ? '已完赛' : '等待出发'}</small></div>`)).join('')}</div>
    <h3>个人最好</h3>${Object.values(save.best).length ? `<div class="record-list">${Object.values(save.best).map(result => `<div><span><strong>${raceName(result)}</strong><small>${characterById(result.character).name} · ${shoeById(result.shoe).name}</small></span><b>${formatTime(result.elapsed)}</b></div>`).join('')}</div>` : '<p class="empty-state">还没有成绩。去完成你的第一场比赛吧。</p>'}
    <h3>最近比赛 <small>最多保留 50 场</small></h3>${save.results.length ? `<div class="record-list">${save.results.map(result => `<div><span><strong>${raceName(result)}</strong><small>${new Date(result.date).toLocaleDateString('zh-CN')} · ${characterById(result.character).name} · 第 ${result.rank} 名</small></span><b>${formatTime(result.elapsed)}</b></div>`).join('')}</div>` : '<p class="empty-state">从第一步开始。</p>'}<p class="small-copy">个人最好和完赛奖牌会持续保留。清除浏览器数据会同时清除记录。</p>`}`;
  document.body.append(dialog);
  const prior = document.activeElement as HTMLElement | null;
  const close = () => dialog.close();
  dialog.querySelector('button')!.addEventListener('click', close);
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } });
  dialog.addEventListener('close', () => { dialog.remove(); prior?.focus(); }, { once: true });
  dialog.showModal();
}

app.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'sound') {
    save.muted = !save.muted; audio.setMuted(save.muted); persist();
    app.querySelectorAll<HTMLButtonElement>('.sound-button').forEach(element => { element.innerHTML = icon(save.muted ? 'muted' : 'sound'); element.setAttribute('aria-label', save.muted ? '打开声音' : '静音'); element.title = save.muted ? '打开声音' : '静音'; });
  } else if (action === 'start') void startRace();
  else if (action === 'go') { resumeRace(); audio.cue('start'); toast('出发！按住冲刺加速，按住恢复补充体力。'); }
  else if (action === 'pause') pauseRace();
  else if (action === 'resume') resumeRace();
  else if (action === 'quit') { destroyRace(); renderSetup('[data-action="start"]'); }
  else if (action === 'help' || action === 'records') showDialog(action);
  else if (!race) {
    let focus = '';
    if (button.dataset.character) { selection = normalizeSelection({ ...selection, character: button.dataset.character as Selection['character'] }); focus = `[data-character="${selection.character}"]`; }
    if (button.dataset.shoe) { selection = normalizeSelection({ ...selection, shoe: button.dataset.shoe as Selection['shoe'] }); focus = `[data-shoe="${selection.shoe}"]`; }
    if (button.dataset.event) { const selectedEvent = eventById(button.dataset.event as Selection['event']); selection = normalizeSelection({ ...selection, event: selectedEvent.id, category: selectedEvent.categories[0].id }); focus = `[data-event="${selection.event}"]`; }
    if (button.dataset.category) { selection = normalizeSelection({ ...selection, category: button.dataset.category as Selection['category'] }); focus = `[data-category="${selection.category}"]`; }
    if (focus) { persist(); renderSetup(focus); }
  }
});
window.addEventListener('blur', () => pauseRace('切换窗口时，比赛已自动暂停。'));
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseRace('离开页面时，比赛已自动暂停。'); });
window.addEventListener('pagehide', () => { input?.clear(); audio.quiet(); });
renderSetup();
