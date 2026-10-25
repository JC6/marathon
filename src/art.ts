import { shoeById } from './data';
import type { CharacterId, EventId, ShoeId } from './types';

export function icon(name: 'arrow' | 'sound' | 'muted' | 'pause' | 'medal' | 'close' | 'help' | 'chevron' | 'check'): string {
  const paths = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    sound: '<path d="m11 5-5 4H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    muted: '<path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 6 6m0-6-6 6"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    medal: '<path d="m7 3 5 7 5-7M6 3h4l2 3 2-3h4"/><circle cx="12" cy="15" r="6"/><path d="m12 12 1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L9 14.3l2-.3Z"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9a2.7 2.7 0 1 1 4 2.3c-1.3.7-1.3 1.7-1.3 1.7m0 3h.01"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

export function shoeArt(id: ShoeId, large = false): string {
  const shoe = shoeById(id);
  const brand = id === 'cumulus'
    ? '<path d="M96 45q38 2 58 25m-36-31q-6 22-27 31m16-24q32 0 53 20m-26-27q-7 21-29 32" fill="none" stroke="' + shoe.accent + '" stroke-width="3"/>'
    : '<path d="m99 43 17 6 34-9-23 17 17 10-20-3-29 12 18-19Z" fill="' + shoe.accent + '"/>';
  return `<svg class="shoe-art${large ? ' large' : ''}" viewBox="0 0 240 115" aria-hidden="true">
    <ellipse cx="124" cy="99" rx="88" ry="5" fill="#182f31" opacity=".08"/>
    <path d="M29 74 37 34q2-7 9-2l15 15 28-8 23-18q9-5 16 1l24 31 49 16q15 5 15 15l-12 5-138 2-36-9Z" fill="${shoe.color}" stroke="#243f3e" stroke-opacity=".15" stroke-width="1.5"/>
    <path d="M37 34 49 46l17 5 22-8 10-9 7 7-16 13-27 5-17-6-10 16Z" fill="${shoe.accent}" opacity=".55"/>
    <path d="m111 24 34 34 25 9" stroke="#fcfcf4" stroke-width="9" fill="none"/>
    <path d="m113 32 11-5m-5 12 11-5m-4 12 11-5m-4 12 11-5" stroke="#526462" stroke-width="2" stroke-linecap="round"/>
    ${brand}
    <path d="M29 73q40 13 78 7l30-3q37 4 79 1l1 10q-35 10-76 7l-42 1-54-5-18-7Z" fill="#fffdf0" stroke="#dbdfce" stroke-width="1"/>
    <path d="M29 84q39 12 75 8l37-2q39 4 76-7v5q-37 12-80 9l-35 2-54-6-19-7Z" fill="${shoe.accent}"/>
    <path d="m46 83 6 8m14-7 4 9m17-8 2 9m68-9 1 9m17-8-1 8m16-10-2 7" stroke="#c2c6b9" stroke-width="1"/>
    <path d="m169 66 27 10m-20-11 26 10" stroke="#899b91" opacity=".4"/>
  </svg>`;
}

export function runnerArt(id: CharacterId): string {
  const shirt = id === 'runner' ? '#e96f49' : '#577f96';
  return `<svg class="runner-art" viewBox="0 0 160 185" aria-hidden="true">
    <ellipse cx="82" cy="171" rx="49" ry="6" fill="#192e32" opacity=".08"/>
    <path d="m83 108 19 22-30 28" fill="none" stroke="#cb9272" stroke-width="12" stroke-linecap="round"/>
    <path d="m72 107-9 30-29 17" fill="none" stroke="#e6ae8c" stroke-width="12" stroke-linecap="round"/>
    <path d="m68 95 24 2 7 20-14 7-11-15-5 17-15-5Z" fill="#263e42"/>
    <path d="m72 54 19 3 7 26-7 19-30-4 1-24Z" fill="${shirt}"/>
    <path d="m68 63-18 23-17-7m56-14 18 15 15-13" fill="none" stroke="#e6ae8c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="m75 55 3-13 13 2-3 15" fill="#d59b7c"/>
    <ellipse cx="85" cy="33" rx="13" ry="16" fill="#e6ae8c" transform="rotate(13 85 33)"/>
    <path d="M72 34q-6-23 12-22 17-1 18 14l-19-5-4 13Z" fill="#293b3e"/>
    ${id === 'runner' ? '<path d="m72 24 28 5 10 2" stroke="#fff9e8" stroke-width="6" stroke-linecap="round"/>' : '<path d="m87 29 14 3m-4-2-1 7-8-2Z" stroke="#233c43" fill="none" stroke-width="2"/>'}
    <rect x="69" y="78" width="19" height="13" rx="2" fill="#fffdf1"/>
    <text x="78.5" y="87" text-anchor="middle" font-size="7" font-weight="700" fill="#294244">${id === 'runner' ? '001' : '002'}</text>
    <path d="m71 151 9 6-3 8-22-1 1-5Z" fill="#eef0dc" stroke="#5a8395" stroke-width="3" stroke-linejoin="round"/>
    <path d="m32 147 7 10-9 8-17-4 1-5Z" fill="#eef0dc" stroke="#5a8395" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;
}

/** Original vector scenery, shared by course cards and the route preview. */
export function landscapeArt(event: EventId): string {
  let scene = '';
  if (event === 'xiamen') {
    scene = `<path d="M0 142q115-24 245 4t475-10v144H0Z" fill="#79b9b6"/>
      <path d="M0 168q125-17 260 5t460-4M10 201q100-10 180 2m270 13 190-6" fill="none" stroke="#bde1d8" stroke-width="3"/>
      <path d="m422 142 15-86 29 86m-17 0 24-103 29 103" fill="#87a8a4"/><path d="m437 56 8 86m28-103 6 103" stroke="#c9ddcf" stroke-width="2"/>
      <path d="M170 163h401M204 163v29m58-29v32m60-32v31m60-31v30m60-30v29m60-29v26" stroke="#edf1dc" stroke-width="6"/>
      <path d="M205 163q100-110 178 0m0 0q66-81 118 0" fill="none" stroke="#edf1dc" stroke-width="4"/>
      <path d="M0 187q139-31 239 13t220 80H0Z" fill="#e4d9b5"/><path d="M0 213q135-35 235 8t176 59H0Z" fill="#d0d8a6"/>
      <path d="m53 211 5-62m-1 7q-22-28-44-8 33-10 44 8m0 0q18-29 42-5-27-12-42 5m0 0q-4-31 23-35-16 11-23 35" fill="#5e8b6c" stroke="#5e8b6c" stroke-width="4"/>`;
  } else if (event === 'shanghai') {
    scene = `<path d="M0 170h720v110H0Z" fill="#aac9c5"/>
      <g fill="#8fabb9"><path d="M44 156V85h40v71m14 0V60h32v96m20 0V93h53v63m290 0V65h36v91m15 0V41h20v115m37 0V78h48v78m19 0V56h30v100"/>
      <path d="m314 156 15-114h11l21 114m46 0V59l12-33 14 33v97m-3-95 18-22v117h-18"/></g>
      <path d="M254 155V44m0 0V24m-16 70h32m-28 22h24" stroke="#b57778" stroke-width="6"/><circle cx="254" cy="85" r="17" fill="#bc8480"/><circle cx="254" cy="48" r="9" fill="#bc8480"/>
      <g fill="#e3d9be" stroke="#bfbaa7" stroke-width="2"><path d="M0 188v-49h41v49m8 0v-65h56v65m10 0v-47h47v47m9 0v-58h59v58m9 0v-46h54v46"/></g>
      <path d="M54 123h46l-23-21Zm119 7h55l-27-21Z" fill="#666e68"/>
      <g stroke="#acac9b" stroke-width="5"><path d="M12 155v17m15-17v17m34-32v31m15-31v31m15-31v31m38-18v20m17-20v20m40-29v29m17-29v29m17-29v29m33-16v16m17-16v16"/></g>
      <path d="M0 207q260-10 720 40v33H0Z" fill="#bdc9b4"/>`;
  } else if (event === 'huangshan') {
    scene = `<path d="m0 178 65-73 43 21 48-83 36 27 28-40 57 78 38-21 59 70 60-92 52 35 57-62 38 55 34-18 105 103Z" fill="#b1c8ac"/>
      <path d="m0 193 68-45 49 12 48-80 29 44 29-15 45 80 61-63 28 27 73-52 25 55 39-23 55 71 59-33 112 22Z" fill="#7eaa8b"/>
      <path d="m104 166 62-84 9 31-21 26 4 20Zm290-23 36-40 14 37-15-12-23 30Z" fill="#e4e9d7" opacity=".8"/>
      <path d="M0 208q233-29 720-6v78H0Z" fill="#8fbdad"/>
      <path d="M320 227h212m-110 14h241m-345 12h114" stroke="#c1d9c4" stroke-width="3"/>
      <path d="M0 206q131-7 259 74H0Z" fill="#719c69"/>
      <g fill="#e7e6cf"><path d="M49 220v-30h50v30m9 9v-45h66v45"/></g><path d="m40 193 35-23 34 23Zm59-6 42-26 44 26Z" fill="#4c6860"/>
      <g fill="#4f7d61"><path d="m567 224 14-45 15 45h-11v24h-8v-24m38-5 19-59 20 59h-15v33h-9v-33m42 12 15-47 15 47h-11v25h-8v-25"/></g>`;
  } else {
    scene = `<path d="M0 166q240-36 720-5v119H0Z" fill="#b6cba3"/><path d="M316 159q-100 65-59 121h248q-182-75-123-121Z" fill="#91b6b0"/>
      <path d="M236 202q92-79 192 0v15h-42q-57-51-109 0h-41Z" fill="#e5dcc3"/><path d="M237 192q93-78 190 0" fill="none" stroke="#eae3d1" stroke-width="6"/>
      <path d="M76 172v-49h77v49m-67-50V92h58v30" fill="#e8dac5"/>
      <path d="m64 126 50-28 52 28Zm13-30 37-25 38 25Z" fill="#66776b"/><path d="M114 72V61m-18 69v40m36-40v40" stroke="#9d7c64" stroke-width="5"/>
      <path d="M543 234q-16-72 15-128" stroke="#7d8e66" stroke-width="8" fill="none"/>
      <path d="M558 110q-81-25-77 70m77-70q-32-19-38 88m38-88q24-15 58 70m-58-70q68-11 89 63" fill="none" stroke="#8caa70" stroke-width="13" stroke-linecap="round"/>
      <g fill="#b9908b"><circle cx="54" cy="231" r="12"/><circle cx="70" cy="220" r="14"/><circle cx="88" cy="235" r="12"/></g>`;
  }
  const skies = { xiamen: '#cee5df', shanghai: '#dde6e9', huangshan: '#e0e8d4', yangzhou: '#efe3d6' };
  return `<svg class="landscape-art" viewBox="0 0 720 280" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path fill="${skies[event]}" d="M0 0h720v280H0Z"/><circle cx="600" cy="62" r="27" fill="#fff3d3"/>
    <path d="M56 62h96m-58-10h32m239 24h83" stroke="#f6f5e8" stroke-width="7" stroke-linecap="round"/>
    ${scene}
    <path d="M0 265q209-54 378 15" fill="none" stroke="#eff0de" stroke-width="38"/>
    <path d="M0 265q209-54 378 15" fill="none" stroke="#a4afa5" stroke-width="28"/>
    <path d="M0 265q209-54 378 15" fill="none" stroke="#f6f5e8" stroke-width="1.5" stroke-dasharray="14 17"/>
    <g fill="#f3f0dd"><path d="m676 101 6 3 7-4-6 7Zm-31-16 5 3 6-4-5 7Z"/></g>
  </svg>`;
}
