import type { LetterKind } from '../core/letters';
import type { Terrain, WeatherCondition } from '../core/types';

/**
 * The skeletons the letter engine fills in: human-written lines with a few
 * `{slots}`. English first, Chinese alongside. Every line follows the voice
 * and the red lines in docs/design/decisions.md section 6; a test scans
 * this file for them (tests/letterTexts.test.ts).
 *
 * Slots: {place} {terrain} {yourWeather} {hisWeather} {yourTemp} {hisTemp} {yourTimeOfDay} {bagItem} {name}.
 *
 * New lines follow ruling 16 too: where the wanderling is spoken of rather
 * than speaking, his name is written out, not a pronoun.
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
  /**
   * Postcard letters: how this stop went (2 to 3 sentences); `departure` ones
   * are for the first place, `station` for the little station of the going-out stretch.
   */
  story?: 'stop' | 'departure' | 'station';
  /**
   * The two-skies line closing a postcard letter (review v1, ruling 5):
   * `apart` when the weathers differ, `alike` when they match, `together`
   * for the place he set out from (the same sky), `his` when only his is known.
   */
  contrast?: 'apart' | 'alike' | 'together' | 'his';
  /** Questions: what the person can answer. A reply skeleton per option is `<id>.r.<option>`, and `<id>.r.none` when no answer came. */
  options?: { id: string; en: string; zh: string }[];
  /** Replies: the question they answer. */
  replyTo?: string;
  /** Only once there is something in his pack. */
  needsBag?: boolean;
  /** Sky letters: which kind of night or day they are about. */
  sky?: 'moonSeen' | 'moonHidden' | 'meteors' | 'longest' | 'shortest' | 'equinox';
}

/** The one thing in his pack (review v2: one pocket, nothing used up, never a word about it being empty). */
export const BAG_ITEMS: Record<string, { en: string; zh: string; short: { en: string; zh: string } }> = {
  pebble: { en: 'a pebble from your street', zh: '你家门口的一颗石子', short: { en: 'your pebble', zh: '你的石子' } },
  button: { en: 'a button from your coat', zh: '你外套上的一颗纽扣', short: { en: 'your button', zh: '你的纽扣' } },
  pencil: { en: 'the pencil by your window', zh: '你窗边的那截铅笔', short: { en: 'your pencil', zh: '你的铅笔' } },
};
/** What he takes himself when nobody chose (no fuss about it). */
export const BAG_DEFAULT = 'pebble';

/** A question, its options, and its replies, written out in one place. */
function question(
  id: string,
  en: string,
  zh: string,
  options: [string, string, string, { en: string; zh: string }][],
  none: { en: string; zh: string },
): Skeleton[] {
  return [
    { id, kind: 'question', en, zh, options: options.map(([opt, oen, ozh]) => ({ id: opt, en: oen, zh: ozh })) },
    ...options.map(([opt, , , reply]) => ({ id: `${id}.r.${opt}`, kind: 'moment' as const, replyTo: id, ...reply })),
    { id: `${id}.r.none`, kind: 'moment', replyTo: id, ...none },
  ];
}

/** The questions that come every four or five days after the first week, in order. */
export const GENERAL_QUESTIONS = ['q.hat', 'q.star', 'q.rest', 'q.puddle', 'q.wave', 'q.sing'];

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
  { id: 'm.name', kind: 'moment', en: 'Someone asked my name today. I said {name}, very clearly.', zh: '今天有人问我叫什么。我很清楚地说了：{name}。' },
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
  { id: 'm.bag1', kind: 'moment', needsBag: true, en: 'I took {bagItem} out of my pack today. Just to look. Then I put it back.', zh: '今天我把{bagItem}从背包里拿出来。只是看看。又放回去了。' },
  { id: 'm.bag2', kind: 'moment', needsBag: true, en: 'I showed {bagItem} to a goose. The goose was not impressed. I was.', zh: '我把{bagItem}给一只鹅看。鹅不怎么在意。我很在意。' },
  { id: 'm.lamp', kind: 'moment', en: 'A street lamp came on while I watched. I think it did it for me.', zh: '我正看着，一盏路灯亮了。我觉得是为我亮的。', terrains: ['city'] },

  // --- The first week (review v2, section 4) ----------------------------
  // Day 0, the evening of the day he set out.
  { id: 'd0.night', kind: 'moment', en: 'My first night away from home. I found a dry spot under a hedge. Your sky is right above me. I checked twice.', zh: '离家的第一个晚上。我在树篱下找到一块干爽的地方。你的天空就在我头顶。我看了两遍。' },
  // Day 1: may he take one thing of yours (the pack's one pocket).
  ...question(
    'q.bag',
    'May I take one thing of yours on the road? It has to fit in my pack.',
    '我能带一样你的东西上路吗？要装得进我的背包。',
    [
      ['pebble', 'A pebble from your street', '你家门口的一颗石子', { en: 'Your pebble is in my pack. It clicks when I walk. I like the sound.', zh: '你的石子在我背包里。走路时它咔哒咔哒响。我喜欢这个声音。' }],
      ['button', 'A button from your coat', '你外套上的一颗纽扣', { en: 'Your button is in my pack. I check on it every hour. It is always there.', zh: '你的纽扣在我背包里。我每个钟头都看它一眼。它一直都在。' }],
      ['pencil', 'The pencil by your window', '你窗边的那截铅笔', { en: 'Your pencil is in my pack. I am writing this with it. It knows your window.', zh: '你的铅笔在我背包里。这封信就是用它写的。它认得你的窗户。' }],
    ],
    { en: 'I could not decide, so I took a pebble from your street. It is a good one.', zh: '我拿不定主意，就从你家门口捡了一颗石子。是颗好石子。' },
  ),
  // Day 4, aboard the night train: the first of his questions.
  ...question(
    'q.window',
    'The train has a big window. What should I look out for?',
    '火车上有一扇大窗户。我该看些什么？',
    [
      ['cows', 'Cows', '牛', { en: 'I looked for cows, like you said. I counted nine. One looked back.', zh: '照你说的，我找牛。数到九头。有一头回头看了我。' }],
      ['clouds', 'Clouds', '云', { en: 'I watched the clouds, like you said. They kept up with the train all day.', zh: '照你说的，我看云。它们一整天都跟得上火车。' }],
      ['trains', 'Other trains', '别的火车', { en: 'I watched for other trains, like you said. Two went by. One hooted hello.', zh: '照你说的，我看别的火车。有两列开过去。其中一列鸣笛打了招呼。' }],
    ],
    { en: 'I looked at everything out of the window. It all went the other way.', zh: '窗外的东西我都看了一遍。它们都往反方向走。' },
  ),
  // Day 7: the week of sky, a little picture of seven squares.
  { id: 'k.week', kind: 'week', en: 'I kept a square of your sky for every day this week. Here they are.', zh: '这一周你的天空，我每天都留了一小块。都在这里。' },

  // --- He will ask you: every four or five days after the first week -----
  ...question(
    'q.hat',
    'I found a hat on a fence post. Should I wear it?',
    '我在篱笆桩上看到一顶帽子。要戴上吗？',
    [
      ['wear', 'Wear it', '戴上', { en: 'I wore the hat for a mile. Then a goat wanted it. I let the goat have it.', zh: '我戴着帽子走了一段。后来一只山羊想要它。我就给了山羊。' }],
      ['leave', 'Leave it there', '留在那儿', { en: 'I left the hat on its post. It looked happy there.', zh: '我把帽子留在桩子上了。它在那儿看起来挺高兴。' }],
      ['higher', 'Hang it higher', '挂高一点', { en: 'I hung the hat on a higher post. Now it can see further.', zh: '我把帽子挂到更高的桩子上。现在它能看得更远了。' }],
    ],
    { en: 'I thought about the hat all day. In the end, it stayed on its post.', zh: '那顶帽子我想了一整天。最后它还是留在桩子上。' },
  ),
  ...question(
    'q.star',
    'Tonight I will pick one star to watch. Which one?',
    '今晚我要挑一颗星星看。看哪一颗？',
    [
      ['bright', 'The brightest', '最亮的', { en: 'I watched the brightest star. It did not blink once. I did.', zh: '我看了最亮的那颗。它一下也没眨。我眨了。' }],
      ['small', 'A small one', '一颗小的', { en: 'I watched a small star. Nobody else was watching it. It seemed pleased.', zh: '我看了一颗小星星。没有别人在看它。它好像挺高兴。' }],
      ['moon', 'One near the moon', '月亮旁边的', { en: 'I watched the star beside the moon. They looked like old friends.', zh: '我看了月亮旁边那颗星。它们像是老朋友。' }],
    ],
    { en: 'I could not pick just one star. So I watched them all.', zh: '我挑不出一颗星星。就把它们都看了。' },
  ),
  ...question(
    'q.rest',
    'I found a good stone to sit on. How long should I sit?',
    '我找到一块好坐的石头。我该坐多久？',
    [
      ['minute', 'A minute', '一分钟', { en: 'I sat for one minute exactly. I stood up very rested.', zh: '我刚好坐了一分钟。站起来时休息得很好。' }],
      ['hour', 'An hour', '一个钟头', { en: 'I sat for an hour. A snail crossed the whole path in that time.', zh: '我坐了一个钟头。这段时间里，一只蜗牛爬过了整条路。' }],
      ['warm', 'Until it is warm', '坐到石头变暖', { en: 'I sat until the stone was warm. Then it was hard to leave.', zh: '我一直坐到石头暖了。然后就舍不得走了。' }],
    ],
    { en: 'I sat on the stone for a while. The stone did not mind.', zh: '我在那块石头上坐了一会儿。石头不介意。' },
  ),
  ...question(
    'q.puddle',
    'There is a big puddle on the path. Around it, or through it?',
    '路上有个大水洼。绕过去，还是踩过去？',
    [
      ['around', 'Around', '绕过去', { en: 'I went around the puddle. It took a while. The puddle seemed grateful.', zh: '我绕过了水洼。绕了好一会儿。水洼好像很领情。' }],
      ['through', 'Through', '踩过去', { en: 'I went straight through the puddle. My boots are very clean now.', zh: '我直接踩了过去。现在靴子很干净。' }],
      ['jump', 'Jump it', '跳过去', { en: 'I jumped the puddle. Mostly. One boot disagrees.', zh: '我跳过了水洼。差不多吧。有一只靴子不同意。' }],
    ],
    { en: 'I looked at the puddle for a long time. Then I went around.', zh: '我看着水洼看了很久。然后绕过去了。' },
  ),
  ...question(
    'q.wave',
    'People wave at me sometimes. Should I wave first?',
    '有时会有人朝我挥手。我要先挥吗？',
    [
      ['always', 'Always', '总是先挥', { en: 'I waved first at everyone today. Most waved back. One tree did not.', zh: '今天我对每个人都先挥了手。大多数挥了回来。有一棵树没有。' }],
      ['dogs', 'Only at dogs', '只对狗先挥', { en: 'I waved only at dogs today. They all wagged. That counts.', zh: '今天我只对狗先挥手。它们都摇了尾巴。这也算。' }],
      ['back', 'Wave back', '等别人先挥', { en: 'I waited, then waved back. Everyone was very polite today.', zh: '我先等着，再挥回去。今天大家都很有礼貌。' }],
    ],
    { en: 'I waved whenever I felt like it. It was a good amount.', zh: '我想挥手的时候就挥。刚刚好。' },
  ),
  ...question(
    'q.sing',
    'I want to sing while I walk. A loud song, or a quiet one?',
    '我想边走边唱。大声唱，还是小声唱？',
    [
      ['loud', 'Loud', '大声', { en: 'I sang a loud song. Some birds joined in. Some left.', zh: '我大声唱了一首。有的鸟跟着唱。有的飞走了。' }],
      ['quiet', 'Quiet', '小声', { en: 'I sang a very quiet song. Only my leaf heard it.', zh: '我很小声地唱了一首。只有我的叶子听见了。' }],
      ['hum', 'Just hum', '哼着就好', { en: 'I hummed all afternoon. My boots kept the time.', zh: '我哼了一下午。靴子替我打拍子。' }],
    ],
    { en: 'I did not sing in the end. I listened, and the road hummed.', zh: '最后我没有唱。我听着，路在哼歌。' },
  ),

  // --- The sky: full moons, falling stars, the turning days (review 3, ruling 8) --
  { id: 'k.moonSeen1', kind: 'sky', sky: 'moonSeen', en: 'The moon was so round last night. I think you saw it too.', zh: '昨晚的月亮好圆。我想你也看到了。' },
  { id: 'k.moonSeen2', kind: 'sky', sky: 'moonSeen', en: 'Last night the moon was full. We looked at the same one.', zh: '昨晚是满月。我们看的是同一个月亮。' },
  { id: 'k.moonHidden', kind: 'sky', sky: 'moonHidden', en: 'The moon was full last night. I could not see it from here. I knew it was there.', zh: '昨晚是满月。我这里看不见它。但我知道它在。' },
  { id: 'k.meteors1', kind: 'sky', sky: 'meteors', en: 'Last night was a night for falling stars. I saw two. I kept one for you.', zh: '昨晚是流星的夜晚。我看到两颗。留了一颗给你。' },
  { id: 'k.meteors2', kind: 'sky', sky: 'meteors', en: 'Stars were falling last night, a few at a time. I made no wishes. I just watched.', zh: '昨晚星星一颗一颗地落下来。我没许愿。只是看着。' },
  { id: 'k.longest', kind: 'sky', sky: 'longest', en: 'Today is the longest day where you are. I will walk until the last light.', zh: '今天是你那边白天最长的一天。我要一直走到最后一点光。' },
  { id: 'k.shortest', kind: 'sky', sky: 'shortest', en: 'Today is the shortest day where you are. I will light my lamp early.', zh: '今天是你那边白天最短的一天。我会早点点灯。' },
  { id: 'k.equinox', kind: 'sky', sky: 'equinox', en: 'Today the day and the night are the same length. Very fair of them.', zh: '今天白天和黑夜一样长。它们真公平。' },

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
  { id: 'x.cat1', kind: 'missed', en: 'A cat walked behind me for a long while. When I stopped, it stopped. We are almost friends.', zh: '一只猫跟在我后面走了好久。我停，它也停。我们差不多算朋友了。' },
  { id: 'x.sleep1', kind: 'missed', en: 'I slept by the road last night. A firefly kept watch. I hope you slept well too.', zh: '昨晚我在路边睡了。一只萤火虫替我守着。希望你也睡得好。' },

  // --- A postcard letter: how the stop went (review 3, ruling 9) ---------
  // The card's back keeps the place's one arrival line; the letter tells a
  // little more, then closes with the two skies.
  { id: 's.ask', kind: 'postcard', story: 'stop', en: 'I asked a cat the way to {place}. It walked off. I followed, and here I am.', zh: '我问一只猫去{place}怎么走。它走开了。我跟着它，就到了。' },
  { id: 's.stay', kind: 'postcard', story: 'stop', en: 'I stayed in {place} for half a day. I sat, I looked, I sat again.', zh: '我在{place}待了半天。坐一会儿，看一会儿，又坐一会儿。' },
  { id: 's.boots', kind: 'postcard', story: 'stop', en: 'The road into {place} was longer than the map said. My boots did not mind.', zh: '去{place}的路比地图上长。我的靴子不介意。' },
  { id: 's.wave', kind: 'postcard', story: 'stop', en: 'Someone in {place} waved at me. I waved back with both hands, to be sure.', zh: '{place}有人朝我挥手。为了保险，我用两只手挥了回去。' },
  { id: 's.map', kind: 'postcard', story: 'stop', en: 'I found {place} on my map first. Then I found the real one. Both were nice.', zh: '我先在地图上找到了{place}。然后找到了真的那个。两个都不错。' },
  { id: 's.city1', kind: 'postcard', story: 'stop', terrains: ['city'], en: '{place} is full of doors. I knocked on none of them. I counted eleven bicycles.', zh: '{place}到处都是门。我一扇也没敲。我数了十一辆自行车。' },
  { id: 's.city2', kind: 'postcard', story: 'stop', terrains: ['city'], en: 'The streets in {place} go in every direction. I picked the one with a bakery.', zh: '{place}的街往四面八方走。我挑了有面包店的那条。' },
  { id: 's.coast1', kind: 'postcard', story: 'stop', terrains: ['coast'], en: 'In {place} the wind tastes of salt. I sat on the harbour wall. Boats came and went.', zh: '{place}的风是咸的。我坐在港口的墙上。船来了又走。' },
  { id: 's.coast2', kind: 'postcard', story: 'stop', terrains: ['coast'], en: 'I walked along the water into {place}. A gull came with me. I think it wanted my bread.', zh: '我沿着水边走进{place}。一只海鸥跟着我。我想它是看上了我的面包。' },
  { id: 's.lake1', kind: 'postcard', story: 'stop', terrains: ['lake'], en: '{place} sits by very still water. I skipped a stone. It went four times.', zh: '{place}挨着一片很静的水。我打了个水漂。跳了四下。' },
  { id: 's.lake2', kind: 'postcard', story: 'stop', terrains: ['lake'], en: 'There is a little jetty in {place}. I sat at the end, feet over the water.', zh: '{place}有一座小码头。我坐在尽头，脚悬在水面上。' },
  { id: 's.mountain1', kind: 'postcard', story: 'stop', terrains: ['mountain'], en: 'The way up to {place} was steep. I stopped often. The view waited for me.', zh: '去{place}的路很陡。我常常停下来。风景一直等着我。' },
  { id: 's.mountain2', kind: 'postcard', story: 'stop', terrains: ['mountain'], en: 'In {place} the air is thin and cold. Everything looks very far away.', zh: '{place}的空气又薄又凉。什么都显得很远。' },
  { id: 's.forest1', kind: 'postcard', story: 'stop', terrains: ['forest'], en: 'The path to {place} went under tall trees. It was green and quiet. I whispered, just in case.', zh: '去{place}的路穿过高高的树。又绿又静。我说话都小声了。' },
  { id: 's.forest2', kind: 'postcard', story: 'stop', terrains: ['forest'], en: 'Near {place} I found a mushroom bigger than my foot. I left it where it was.', zh: '在{place}附近我看到一朵比我的脚还大的蘑菇。我没碰它。' },
  { id: 's.hills1', kind: 'postcard', story: 'stop', terrains: ['hills'], en: '{place} is at the top of a long hill. I got there slowly. Then I sat for a long time.', zh: '{place}在一道长坡的顶上。我慢慢爬上去。然后坐了很久。' },
  { id: 's.hills2', kind: 'postcard', story: 'stop', terrains: ['hills'], en: 'From {place} I could see the road I came on. It looks small from here.', zh: '从{place}能看见我走来的路。从这里看它好小。' },
  { id: 's.plain1', kind: 'postcard', story: 'stop', terrains: ['plain'], en: 'The fields around {place} go on and on. I followed a fence most of the way.', zh: '{place}周围的田一直铺到天边。大半路我都跟着一道篱笆走。' },
  { id: 's.plain2', kind: 'postcard', story: 'stop', terrains: ['plain'], en: 'In {place} a cow looked at me for a long time. I looked back. We are friends now, I think.', zh: '在{place}，一头牛看了我很久。我也看着它。我想我们现在是朋友了。' },
  { id: 's.desert1', kind: 'postcard', story: 'stop', terrains: ['desert'], en: '{place} is warm and very quiet. My footprints followed me all the way in.', zh: '{place}很暖，也很安静。我的脚印一路跟着我走进来。' },
  { id: 's.desert2', kind: 'postcard', story: 'stop', terrains: ['desert'], en: 'I reached {place} with sand in both boots. I emptied them. More sand came.', zh: '我到{place}时两只靴子里都是沙。倒干净了。又进来了。' },
  { id: 'st.bench', kind: 'postcard', story: 'station', en: '{place} has one bench and one clock. I sat on the bench. The clock did the rest.', zh: '{place}只有一张长椅和一座钟。我坐在长椅上。剩下的交给钟。' },
  { id: 'st.rails', kind: 'postcard', story: 'station', en: 'I waited at {place} for the night train. The rails hummed before it came.', zh: '我在{place}等夜班火车。车还没来，铁轨先响了。' },
  { id: 's.depart1', kind: 'postcard', story: 'departure', en: 'I set off from {place} today. My pack is heavy and my leaf is up.', zh: '今天我从{place}出发了。背包很沉，叶子竖着。' },
  { id: 's.depart2', kind: 'postcard', story: 'departure', en: 'We start here, in {place}. I looked back once. Then I walked.', zh: '我们从{place}出发。我回头看了一眼。然后就走了。' },

  // --- Two skies: the line that closes a postcard letter -----------------
  { id: 'c.apart1', kind: 'postcard', contrast: 'apart', en: 'I had {hisWeather} here, {hisTemp}. You had {yourWeather}, {yourTemp}.', zh: '我这边是{hisWeather}，{hisTemp}。你那边是{yourWeather}，{yourTemp}。' },
  { id: 'c.apart2', kind: 'postcard', contrast: 'apart', en: 'Here I had {hisWeather}, {hisTemp}. With you, {yourWeather}. Two skies, one day.', zh: '这里是{hisWeather}，{hisTemp}。你那里是{yourWeather}。两片天，同一天。' },
  { id: 'c.alike1', kind: 'postcard', contrast: 'alike', en: 'I had {hisWeather} here, {hisTemp}. You had {yourWeather} too. Maybe the clouds follow me.', zh: '我这边是{hisWeather}，{hisTemp}。你那边也是{yourWeather}。说不定云在跟着我。' },
  { id: 'c.alike2', kind: 'postcard', contrast: 'alike', en: 'Here I had {hisWeather}, {hisTemp}. You had {yourWeather} as well. Our skies agree today.', zh: '这里是{hisWeather}，{hisTemp}。你那边也是{yourWeather}。今天我们的天空意见一致。' },
  { id: 'c.together', kind: 'postcard', contrast: 'together', en: 'We had the same sky when I left. We both had {yourWeather}.', zh: '我出发时，我们头顶是同一片天。那会儿我们俩都是{yourWeather}。' },
  { id: 'c.his', kind: 'postcard', contrast: 'his', en: 'Here I had {hisWeather}, {hisTemp}.', zh: '这里是{hisWeather}，{hisTemp}。' },

  // --- The back of a postcard, when a place has no line of its own ------
  // (Letters from before review 3 used these too; kept so old ones still read.)
  { id: 'p.here', kind: 'postcard', en: 'I am in {place} now. I will tell you about it soon.', zh: '我到{place}了。回头慢慢跟你说。' },
  { id: 'p.sky', kind: 'postcard', en: 'This is {place}. The sky here is a different kind of big.', zh: '这是{place}。这里的天空是另一种大。' },
  { id: 'p.sit', kind: 'postcard', en: 'Made it to {place}. I sat down first. Then I looked.', zh: '到{place}了。我先坐下，然后才看。' },
];

/** The weather in a few words, for the two-skies line. */
const WEATHER_WORDS: Record<WeatherCondition, { en: string; zh: string }> = {
  clear: { en: 'sunshine', zh: '晴天' },
  'partly-cloudy': { en: 'some clouds', zh: '多云' },
  overcast: { en: 'grey skies', zh: '阴天' },
  fog: { en: 'fog', zh: '雾天' },
  drizzle: { en: 'drizzle', zh: '毛毛雨' },
  rain: { en: 'rain', zh: '雨天' },
  'heavy-rain': { en: 'heavy rain', zh: '大雨' },
  thunderstorm: { en: 'a storm', zh: '雷雨' },
  snow: { en: 'snow', zh: '雪天' },
  'heavy-snow': { en: 'deep snow', zh: '大雪' },
};

/** Weathers that count as the same sky: sun, cloud, wet, snow. */
function skyGroup(c: WeatherCondition): string {
  if (c === 'clear' || c === 'partly-cloudy') return 'sun';
  if (c === 'overcast' || c === 'fog') return 'cloud';
  if (c === 'snow' || c === 'heavy-snow') return 'snow';
  return 'wet';
}

function isCondition(v: string | undefined): v is WeatherCondition {
  return !!v && v in WEATHER_WORDS;
}

/** What a postcard letter carries about the two weathers; all optional. */
export interface SkyVars {
  /** His weather at the place on arrival. */
  hisCond?: WeatherCondition;
  hisTemp?: number;
  /** The person's weather at that moment. */
  yourCond?: WeatherCondition;
  yourTemp?: number;
  /** The place he set out from: one sky for both. */
  together?: boolean;
}

/**
 * Stories for a postcard letter: the terrain's own and the ones that fit
 * anywhere; the departure's, or the little station's, for those two places.
 */
export function storiesFor(terrain: Terrain, departure: boolean | 'station' = false): Skeleton[] {
  const story = departure === 'station' ? 'station' : departure ? 'departure' : 'stop';
  return SKELETONS.filter((s) => s.story === story && (!s.terrains || s.terrains.includes(terrain)));
}

/** Pack the two weathers into a letter's vars (letters keep plain strings). */
export function skyVars(v: SkyVars): Record<string, string> {
  const out: Record<string, string> = {};
  if (v.hisCond) out.hisCond = v.hisCond;
  if (typeof v.hisTemp === 'number') out.hisTemp = String(Math.round(v.hisTemp));
  if (v.yourCond) out.yourCond = v.yourCond;
  if (typeof v.yourTemp === 'number') out.yourTemp = String(Math.round(v.yourTemp));
  if (v.together) out.together = '1';
  return out;
}

/**
 * The two-skies line for a postcard letter in the given language, or null
 * when not enough is known (no network then, say). The variant is picked
 * from the letter's id so it reads the same every time the box is opened.
 */
export function skyLine(vars: Record<string, string>, lang: 'en' | 'zh', unit: 'C' | 'F', letterId: string): string | null {
  const his = vars.hisCond;
  const yours = vars.yourCond;
  const temp = (c: string | undefined): string => {
    const n = Number(c);
    if (c === undefined || !Number.isFinite(n)) return '';
    return `${Math.round(unit === 'F' ? n * 1.8 + 32 : n)}°`;
  };
  let kind: Skeleton['contrast'];
  if (vars.together === '1') kind = isCondition(yours) ? 'together' : undefined;
  else if (isCondition(his) && isCondition(yours)) kind = skyGroup(his) === skyGroup(yours) ? 'alike' : 'apart';
  else if (isCondition(his)) kind = 'his';
  if (!kind) return null;
  const pool = SKELETONS.filter((s) => s.contrast === kind);
  let h = 0;
  for (let i = 0; i < letterId.length; i++) h = (h * 31 + letterId.charCodeAt(i)) >>> 0;
  const sk = pool[h % pool.length];
  const words = (c: string | undefined): string => (isCondition(c) ? WEATHER_WORDS[c][lang] : '');
  const fill: Record<string, string> = {
    hisWeather: words(his),
    yourWeather: words(yours),
    hisTemp: temp(vars.hisTemp),
    yourTemp: temp(vars.yourTemp),
  };
  return (lang === 'zh' ? sk.zh : sk.en).replace(/\{(\w+)\}/g, (m, k: string) => fill[k] ?? m);
}

export function skeletonsOf(kind: LetterKind): Skeleton[] {
  return SKELETONS.filter((s) => s.kind === kind);
}

/** Moments that fit the land being walked, plus the ones that fit anywhere (and the pack's, once it holds something). */
export function momentsFor(terrain: Terrain, hasBag = false): Skeleton[] {
  return SKELETONS.filter(
    (s) => s.kind === 'moment' && !s.replyTo && !s.id.startsWith('d0.') && (!s.needsBag || hasBag) && (!s.terrains || s.terrains.includes(terrain)),
  );
}

/** Sky letters of one kind. */
export function skyLetterPool(kind: NonNullable<Skeleton['sky']>): string[] {
  return SKELETONS.filter((s) => s.sky === kind).map((s) => s.id);
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
