/**
 * Two languages, English and Chinese. The current one is a module-level
 * setting (picked at start-up from a saved choice or the browser), so text
 * helpers can be called without threading it everywhere. Tests run in English.
 */

export type Lang = 'en' | 'zh';

let current: Lang = 'en';

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
}

/** Saved choice first, then the browser's language. */
export function detectLang(saved: string | null, browser: string): Lang {
  if (saved === 'zh' || saved === 'en') return saved;
  return /^zh\b/i.test(browser) ? 'zh' : 'en';
}

type Dict = Record<string, { en: string; zh: string }>;

const DICT: Dict = {
  // HUD
  postcards: { en: 'Postcards', zh: '明信片' },
  map: { en: 'Map', zh: '地图' },
  useLocation: { en: 'Use my location', zh: '用我的位置' },
  finding: { en: 'Finding your sky…', zh: '正在找你的天空…' },
  yourSky: { en: 'Your sky', zh: '你的天空' },
  weather: { en: 'Weather', zh: '天气' },
  real: { en: 'real', zh: '真实' },
  forecast: { en: '(forecast)', zh: '（预报）' },
  language: { en: '中文', zh: 'English' },
  noLocation: { en: 'No location this time. Tap the place name to pick a city instead.', zh: '这次没拿到位置。点左上角的地名可以手选城市。' },
  cannotDraw: { en: 'The sky could not be drawn on this device. Please try a newer browser.', zh: '这台设备画不出天空。请换一个新一点的浏览器。' },
  arrivedIn: { en: 'Arrived in {name}.', zh: '到了{name}。' },
  somewhere: { en: 'Somewhere', zh: '某处' },
  home: { en: 'Home', zh: '家' },
  // Journey line
  walkingTo: { en: 'Walking to {name}', zh: '走向{name}' },
  ridingTo: { en: 'On the train to {name}', zh: '坐火车去{name}' },
  flyingTo: { en: 'Flying to {name}', zh: '飞往{name}' },
  kmToGo: { en: '{km} km to go', zh: '还有 {km} 公里' },
  almostThere: { en: 'almost there', zh: '快到了' },
  restingIn: { en: 'Resting in {name}', zh: '在{name}歇脚' },
  journeysEnd: { en: "Journey's end: {name}", zh: '旅途终点：{name}' },
  offOnFoot: { en: 'Off again, on foot to {name}.', zh: '又出发了，走路去{name}。' },
  offByTrain: { en: 'Off again, by train to {name}.', zh: '又出发了，坐火车去{name}。' },
  offFlying: { en: 'Off again, flying to {name}.', zh: '又出发了，飞去{name}。' },
  homeward: { en: 'Homeward', zh: '回家' },
  homeAgain: { en: 'Home again. The kettle, the window, the same sky.', zh: '到家了。水壶、窗台，还有同一片天空。' },
  leftHome: { en: 'Left {name} before the streets woke up.', zh: '趁街道还没醒，离开了{name}。' },
  leftWithSand: { en: 'Left {name} with sand still in my boots.', zh: '靴子里还有沙，就离开了{name}。' },
  // Album
  close: { en: 'Close', zh: '关闭' },
  noPostcards: { en: 'No postcards yet. The first one arrives with the first place.', zh: '还没有明信片。到第一站就会收到。' },
  morning: { en: 'morning', zh: '早上' },
  afternoon: { en: 'afternoon', zh: '下午' },
  evening: { en: 'evening', zh: '傍晚' },
  night: { en: 'night', zh: '夜里' },
  // Map
  nextRoute: { en: 'Where next?', zh: '下一条去哪' },
  nextHint: { en: 'Tap a route. The wanderer sets off for it once this one is done. Untapped, the nearest one is next.', zh: '点一条路线，走完这条就去那里。不点的话，走完去最近的一条。' },
  walkingNow: { en: 'walking now', zh: '正在走' },
  walkedDone: { en: 'walked', zh: '走过了' },
  byFoot: { en: 'on foot, {km} km', zh: '步行 {km} 公里' },
  byTrain: { en: 'by train, {km} km', zh: '坐火车 {km} 公里' },
  byPlane: { en: 'by plane, {km} km', zh: '坐飞机 {km} 公里' },
  chosenNext: { en: 'next', zh: '下一条' },
  placesOf: { en: '{n} of {total} places', zh: '{total} 站里到了 {n} 站' },
  kmOf: { en: '{km} km of {total}', zh: '走了 {km} 公里，共 {total}' },
  // City chooser
  whereAreYou: { en: 'Where are you?', zh: '你在哪里？' },
  typeCity: { en: 'Type a city', zh: '输入城市名' },
  search: { en: 'Search', zh: '搜索' },
  cityNote: { en: 'The sky, the weather and the start of the journey follow the city you pick. Only the city is used, never a street.', zh: '天空、天气和旅程的起点都跟着你选的城市走。只用到城市，不会用到街道。' },
  looking: { en: 'Looking…', zh: '正在找…' },
  noPlace: { en: 'No such place found. Try the nearest big city.', zh: '没找到这个地方。试试最近的大城市。' },
  // Install hint
  keepSky: { en: 'Keep the sky with you.', zh: '把这片天空带在身边。' },
  iosHint: { en: 'Tap Share, then <b>Add to Home Screen</b>. Wanderling then opens like an app, even without a signal.', zh: '点分享，再点<b>添加到主屏幕</b>。之后 Wanderling 会像 App 一样打开，没信号也能用。' },
  promptHint: { en: 'Add Wanderling to your home screen; it opens like an app, even without a signal.', zh: '把 Wanderling 加到主屏幕，像 App 一样打开，没信号也能用。' },
  gotIt: { en: 'Got it', zh: '知道了' },
  add: { en: 'Add', zh: '添加' },
};

/** Look up a phrase, filling {name}-style slots. */
export function t(key: keyof typeof DICT, params: Record<string, string | number> = {}): string {
  const entry = DICT[key];
  let s = entry ? entry[current] : String(key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Thousands separators in the style of the language. */
export function formatKm(km: number): string {
  return Math.round(km).toLocaleString(current === 'zh' ? 'zh-CN' : 'en-US');
}

import type { Place, Route } from './types';

export function placeName(p: Place): string {
  return current === 'zh' && p.zh?.name ? p.zh.name : p.name;
}

export function placeRegion(p: Place): string | undefined {
  return current === 'zh' ? (p.zh?.region ?? p.region) : p.region;
}

export function placeNote(p: Place): string {
  if (current === 'zh' && p.zh?.note) return p.zh.note;
  return p.note ?? t('arrivedIn', { name: placeName(p) });
}

export function routeName(r: Route): string {
  return current === 'zh' && r.nameZh ? r.nameZh : r.name;
}
