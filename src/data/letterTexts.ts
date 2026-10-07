import type { LetterKind } from '../core/letters';
import type { Terrain } from '../core/types';

/**
 * The skeletons the letter engine fills in: human-written lines with a few
 * `{slots}`. English first, Chinese alongside. Every line follows the voice
 * and the red lines in docs/design/decisions.md section 6; a test scans
 * this file for them (tests/letterTexts.test.ts).
 *
 * Slots: {place} {terrain} {yourWeather} {hisWeather} {yourTimeOfDay} {bagItem}.
 */
export interface Skeleton {
  id: string;
  kind: LetterKind;
  en: string;
  zh: string;
  /** Only where the land looks like this; unset means anywhere. */
  terrains?: Terrain[];
  /** Weather letters: which forecast they answer. */
  outlook?: 'rain' | 'snow' | 'wind';
}

export const SKELETONS: Skeleton[] = [
  // --- Little things from the road -------------------------------------
  { id: 'm.dog', kind: 'moment', en: 'A dog walked with me for a while. We did not talk. It was nice.', zh: '一只狗陪我走了一段。我们没说话。挺好的。' },
  { id: 'm.bench', kind: 'moment', en: 'I found a bench that faces the water. I sat for a very long time. Benches are good.', zh: '我找到一张面朝水的长椅。坐了很久很久。长椅是好东西。', terrains: ['coast', 'lake'] },
  { id: 'm.road', kind: 'moment', en: 'The road went up, then down, then up again. I think it was deciding.', zh: '路往上，又往下，又往上。我觉得它在拿主意。', terrains: ['hills', 'mountain'] },
  { id: 'm.bird', kind: 'moment', en: 'A bird sat on a post and looked at me. I looked back. It left first.', zh: '一只鸟停在桩子上看我。我也看它。它先走了。' },
  { id: 'm.clouds', kind: 'moment', en: 'I counted the clouds today. I got to eleven and lost one.', zh: '今天我数云。数到十一，弄丢了一朵。' },
  { id: 'm.puddle', kind: 'moment', en: 'There was a puddle shaped like a boot. I stepped around it. It seemed polite.', zh: '有个水洼长得像靴子。我绕过去了。这样比较有礼貌。' },
  { id: 'm.stones', kind: 'moment', en: 'Someone left a stone on a stone. I added a third. Now it is a tower.', zh: '有人把一块石头放在另一块上。我加了第三块。现在它是一座塔了。', terrains: ['mountain', 'hills', 'coast'] },
  { id: 'm.bread', kind: 'moment', en: 'The wind smelled of bread for a whole minute. I walked slower.', zh: '风里有面包味，整整一分钟。我走得慢了些。', terrains: ['city', 'plain'] },
  { id: 'm.leaf', kind: 'moment', en: 'My leaf keeps pointing at the sun. I let it. It knows things I do not.', zh: '我的叶子总朝着太阳。我由它去。它知道一些我不知道的事。' },
  { id: 'm.gate', kind: 'moment', en: 'I passed a gate with no fence. I went through it anyway. It felt right.', zh: '路过一扇没有围栏的门。我还是从门里走过去了。这样才对。', terrains: ['plain', 'hills'] },
  { id: 'm.trees', kind: 'moment', en: 'The trees here are very tall. They did not mind me walking under them.', zh: '这里的树很高。我从底下走过，它们不介意。', terrains: ['forest'] },
  { id: 'm.sand', kind: 'moment', en: 'Sand gets everywhere. I have decided to like it.', zh: '沙子哪里都是。我决定喜欢它。', terrains: ['desert'] },
  { id: 'm.still', kind: 'moment', en: 'The water was so still. I could see a second sky in it.', zh: '水面很静。里面有第二片天空。', terrains: ['lake'] },
  { id: 'm.mountain', kind: 'moment', en: 'I saw a mountain today. It saw me too, I think. We nodded.', zh: '今天我看见一座山。它大概也看见了我。我们点了点头。', terrains: ['mountain'] },
  { id: 'm.sea', kind: 'moment', en: 'The sea kept coming back to the same place. I waited to see if it would stop. It did not.', zh: '海一直回到同一个地方。我等着看它会不会停。它没有。', terrains: ['coast'] },
  { id: 'm.eyes', kind: 'moment', en: 'I walked with my eyes closed for three steps. That was enough adventure.', zh: '我闭着眼走了三步。冒险够了。' },
  { id: 'm.kick', kind: 'moment', en: 'A stone on the path wanted kicking. I kicked it. We both got further.', zh: '路上有块石头想被踢。我踢了。我们都往前多走了一点。' },
  { id: 'm.leaffall', kind: 'moment', en: 'A leaf fell on my leaf. We said hello. Then it went on without me.', zh: '一片叶子落在我的叶子上。我们打了招呼。然后它自己走了。' },
  { id: 'm.lamp', kind: 'moment', en: 'A street lamp came on while I watched. I think it did it for me.', zh: '我正看着，一盏路灯亮了。我觉得是为我亮的。', terrains: ['city'] },

  // --- A word about your weather ---------------------------------------
  { id: 'w.rain1', kind: 'weather', outlook: 'rain', en: 'Rain tomorrow where you are. Bring your walking roof.', zh: '明天你那边有雨。带上你的会走的屋顶。' },
  { id: 'w.rain2', kind: 'weather', outlook: 'rain', en: 'The clouds say rain for you tomorrow. They are usually right.', zh: '云说你那边明天有雨。它们一般不会错。' },
  { id: 'w.rain3', kind: 'weather', outlook: 'rain', en: 'Your sky will leak a little tomorrow. Mind the puddles.', zh: '明天你的天空会漏一点水。小心水洼。' },
  { id: 'w.snow1', kind: 'weather', outlook: 'snow', en: 'Snow tomorrow where you are. Everything will be quieter.', zh: '明天你那边下雪。什么都会安静一点。' },
  { id: 'w.snow2', kind: 'weather', outlook: 'snow', en: 'Your sky is bringing snow tomorrow. Wrap your scarf twice.', zh: '你的天空明天会带雪来。围巾多绕一圈。' },
  { id: 'w.wind1', kind: 'weather', outlook: 'wind', en: 'A big wind tomorrow where you are. Hold on to your hat.', zh: '明天你那边风很大。按住帽子。' },
  { id: 'w.wind2', kind: 'weather', outlook: 'wind', en: 'The wind is coming your way tomorrow. My leaf already knows.', zh: '风明天往你那边去。我的叶子已经知道了。' },

  // --- Meanwhile: a surprise that came and went while the person was away --
  { id: 'x.rainbow1', kind: 'missed', en: 'There was a rainbow after the rain. I stood under it a while and thought of you.', zh: '雨后出了彩虹。我在下面站了一会儿，想到了你。' },
  { id: 'x.rainbow2', kind: 'missed', en: 'The rain stopped and the sky made a rainbow. It did not stay long. I looked for us both.', zh: '雨停了，天上出了一道彩虹。没停留多久。我替我们俩看了。' },
  { id: 'x.moon1', kind: 'missed', en: 'The moon was full tonight. I sat and watched it for a long time. It was very round.', zh: '今晚月亮圆了。我坐着看了很久。真的很圆。' },
  { id: 'x.moon2', kind: 'missed', en: 'A full moon tonight. I did not walk. Some things you just look at.', zh: '今晚满月。我没有走路。有些东西只能看着。' },
  { id: 'x.sleep1', kind: 'missed', en: 'I slept by the road last night. A firefly kept watch. I hope you slept well too.', zh: '昨晚我在路边睡了。一只萤火虫替我守着。希望你也睡得好。' },

  // --- The back of a postcard, when a place has no line of its own ------
  { id: 'p.here', kind: 'postcard', en: 'I am in {place} now. I will tell you about it soon.', zh: '我到{place}了。回头慢慢跟你说。' },
  { id: 'p.sky', kind: 'postcard', en: 'This is {place}. The sky here is a different kind of big.', zh: '这是{place}。这里的天空是另一种大。' },
  { id: 'p.sit', kind: 'postcard', en: 'Made it to {place}. I sat down first. Then I looked.', zh: '到{place}了。我先坐下，然后才看。' },
];

export function skeletonsOf(kind: LetterKind): Skeleton[] {
  return SKELETONS.filter((s) => s.kind === kind);
}

/** Moments that fit the land being walked, plus the ones that fit anywhere. */
export function momentsFor(terrain: Terrain): Skeleton[] {
  return SKELETONS.filter((s) => s.kind === 'moment' && (!s.terrains || s.terrains.includes(terrain)));
}

export function weatherSkeletons(outlook: 'rain' | 'snow' | 'wind'): Skeleton[] {
  return SKELETONS.filter((s) => s.kind === 'weather' && s.outlook === outlook);
}

export function missedSkeletons(): Skeleton[] {
  return skeletonsOf('missed');
}

export function skeletonById(id: string): Skeleton | undefined {
  return SKELETONS.find((s) => s.id === id);
}
