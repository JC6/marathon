import type { CharacterDefinition, CourseSection, EventDefinition, Selection, ShoeDefinition } from './types';

export const CHARACTERS: CharacterDefinition[] = [
  { id: 'runner', name: 'Runner', subtitle: '为下一次 PB 做好准备', description: '专注训练，状态充足。用稳定的节奏，跑出自己的最好成绩。', color: '#e96f49', speed: 3.65, energy: 100, fatigueRate: 1 },
  { id: 'worker', name: 'Worker', subtitle: '下班之后，仍然出发', description: '带着一天的疲惫来到起点。照顾好体力，每一次完赛都值得庆祝。', color: '#577f96', speed: 3.45, energy: 76, fatigueRate: 1.24 },
];
export const SHOES: ShoeDefinition[] = [
  { id: 'cumulus', name: 'ASICS GEL-CUMULUS 25', tagline: '稳健完赛', description: '缓慢积累疲劳，为后程多留一点力气。', color: '#e4e9df', accent: '#5a8395', speed: .98, sprint: 1.20, fatigueRate: .70, ratings: [3, 5, 3] },
  { id: '260x', name: '特步 260X', tagline: '均衡巡航', description: '在速度与体力之间，找到舒服的节奏。', color: '#eef0c6', accent: '#93a34d', speed: 1, sprint: 1.27, fatigueRate: 1, ratings: [4, 4, 4] },
  { id: '160x', name: '特步 160X 7.0', tagline: '竞速冲刺', description: '更有力的加速，需要更谨慎地分配体力。', color: '#f5a36d', accent: '#cc4c41', speed: 1.025, sprint: 1.39, fatigueRate: 1.15, ratings: [5, 3, 5] },
];
const full = { id: 'full' as const, distance: 42195 };
const half = { id: 'half' as const, distance: 21097.5 };
function course(rows: [number, string, number, number, number][]): CourseSection[] {
  return rows.map(([end, label, grade, wind, crowd]) => ({ end, label, grade, wind, crowd }));
}
const xiamen = course([[.18, '海岸起跑', 0, .2, .8], [.4, '环岛海风', .006, .9, .3], [.56, '跨海桥梁', .022, .7, .4], [.74, '滨海大道', -.01, .3, .3], [.9, '沿海归途', .003, .6, .5], [1, '海边终点', 0, .15, 1]]);
const shanghai = course([[.16, '外滩出发', 0, .1, 1], [.38, '城市街区', .002, .1, .9], [.57, '梧桐树下', -.002, .1, .7], [.78, '滨江长路', 0, .5, .5], [.92, '城市回响', .002, .2, .8], [1, '奔向终点', 0, .1, 1]]);
const huangshanFull = course([[.16, '山城起跑', .005, .1, .7], [.34, '迎山公路', .025, .1, .3], [.48, '山间缓坡', -.018, .2, .2], [.64, '林荫起伏', .03, .1, .3], [.81, '向湖而行', -.025, .3, .2], [1, '湖畔终点', .003, .4, .6]]);
const huangshanHalf = course([[.22, '山城起跑', .005, .1, .7], [.47, '迎山公路', .025, .1, .3], [.68, '山间折返', -.012, .2, .3], [.87, '林荫归途', -.015, .1, .4], [1, '回到山城', 0, .1, .8]]);
const yangzhou = course([[.2, '古城出发', 0, .1, .8], [.42, '运河春色', .004, .2, .5], [.67, '园林长廊', -.003, .1, .4], [.86, '柳岸清风', 0, .3, .5], [1, '扬州终点', 0, .1, .9]]);
export const EVENTS: EventDefinition[] = [
  { id: 'xiamen', name: '厦门马拉松', english: 'XIAMEN', tag: '向海而跑', description: '沿着海岸线，把海风留在身后。', color: '#2a8b95', sky: '#cde9e5', ground: '#d3dca8', categories: [full], sections: { full: xiamen, half: xiamen } },
  { id: 'shanghai', name: '上海马拉松', english: 'SHANGHAI', tag: '穿行城市', description: '从都市街角，跑进滨江的晨光。', color: '#687fa2', sky: '#dce5ef', ground: '#b9c5b0', categories: [full], sections: { full: shanghai, half: shanghai } },
  { id: 'huangshan', name: '黄山马拉松', english: 'HUANGSHAN', tag: '迎山向湖', description: '跟随公路起伏，在山水之间找到节奏。', color: '#6a8c68', sky: '#dce9d4', ground: '#97b993', categories: [half, full], sections: { full: huangshanFull, half: huangshanHalf } },
  { id: 'yangzhou', name: '扬州半程马拉松', english: 'YANGZHOU', tag: '跑过春天', description: '穿过古城与柳岸，收集运河边的风。', color: '#b17d80', sky: '#f0e3d8', ground: '#c1d3aa', categories: [half], sections: { full: yangzhou, half: yangzhou } },
];
export const DEFAULT_SELECTION: Selection = { character: 'runner', shoe: 'cumulus', event: 'xiamen', category: 'full' };
export const characterById = (id: Selection['character']) => CHARACTERS.find(c => c.id === id)!;
export const shoeById = (id: Selection['shoe']) => SHOES.find(s => s.id === id)!;
export const eventById = (id: Selection['event']) => EVENTS.find(e => e.id === id)!;
export function normalizeSelection(value: Partial<Selection> | null | undefined): Selection {
  const event = EVENTS.find(e => e.id === value?.event) ?? EVENTS[0];
  return {
    character: CHARACTERS.find(c => c.id === value?.character)?.id ?? DEFAULT_SELECTION.character,
    shoe: SHOES.find(s => s.id === value?.shoe)?.id ?? DEFAULT_SELECTION.shoe,
    event: event.id,
    category: event.categories.find(c => c.id === value?.category)?.id ?? event.categories[0].id,
  };
}
export function raceName(selection: Pick<Selection, 'event' | 'category'>): string {
  const event = eventById(selection.event);
  return event.name + (event.id === 'huangshan' ? ` · ${selection.category === 'half' ? '半马' : '全马'}` : '');
}
export function courseSection(selection: Selection, distance: number): CourseSection {
  const event = eventById(selection.event);
  const total = event.categories.find(c => c.id === selection.category)!.distance;
  return event.sections[selection.category].find(s => distance / total < s.end) ?? event.sections[selection.category].at(-1)!;
}
