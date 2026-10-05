import type { Route } from '../core/types';

/**
 * The first route: out of London and down to the sea. Real places, rough
 * walking distances between them. Terrain tells the scene what to draw;
 * notes are what the wanderer says on arrival.
 */
export const TO_THE_SEA: Route = {
  id: 'to-the-sea-v1',
  name: 'To the Sea',
  nameZh: '走向海',
  places: [
    { id: 'london', name: 'London', region: 'England', terrain: 'city', lat: 51.51, lon: -0.13, note: 'Boots laced. Off we go.' , zh: { name: '伦敦', region: '英格兰', note: '鞋带系好。出发。' } },
    { id: 'richmond', name: 'Richmond Park', region: 'London', terrain: 'forest', lat: 51.44, lon: -0.27, note: 'Deer in the bracken. They let me pass.' , zh: { name: '里士满公园', region: '伦敦', note: '蕨丛里有鹿。它们让我过去了。' } },
    { id: 'box-hill', name: 'Box Hill', region: 'Surrey', terrain: 'hills', lat: 51.25, lon: -0.31, note: 'Up on the chalk, the whole valley below.' , zh: { name: '博克斯山', region: '萨里', note: '站在白垩山上，整条山谷在脚下。' } },
    { id: 'leith-hill', name: 'Leith Hill', region: 'Surrey', terrain: 'forest', lat: 51.18, lon: -0.37, note: 'A tower in the woods. On a clear day you can see the Channel.' , zh: { name: '利斯山', region: '萨里', note: '林子里有座塔。天晴时能望见海峡。' } },
    { id: 'horsham', name: 'Horsham', region: 'West Sussex', terrain: 'plain', lat: 51.06, lon: -0.33, note: 'Market day. I bought an apple.' , zh: { name: '霍舍姆', region: '西萨塞克斯', note: '赶集的日子。我买了一个苹果。' } },
    { id: 'devils-dyke', name: "Devil's Dyke", region: 'South Downs', terrain: 'hills', lat: 50.88, lon: -0.21, note: 'The Downs roll like a green sea. The real one is close now.' , zh: { name: '魔鬼堤', region: '南唐斯', note: '丘陵像绿色的海在起伏。真正的海就快到了。' } },
    { id: 'brighton', name: 'Brighton', region: 'East Sussex', terrain: 'coast', lat: 50.82, lon: -0.14, note: 'The sea. I sat on the pebbles until the light went.' , zh: { name: '布莱顿', region: '东萨塞克斯', note: '海。我在卵石滩上坐到天黑。' } },
    { id: 'seven-sisters', name: 'Seven Sisters', region: 'East Sussex', terrain: 'coast', lat: 50.75, lon: 0.15, note: 'White cliffs, grey water, a long way down.' , zh: { name: '七姐妹白崖', region: '东萨塞克斯', note: '白色的崖，灰色的水，往下看很深。' } },
  ],
  legs: [
    { km: 13, terrain: 'city' },
    { km: 30, terrain: 'plain' },
    { km: 12, terrain: 'hills' },
    { km: 22, terrain: 'forest' },
    { km: 30, terrain: 'plain' },
    { km: 12, terrain: 'hills' },
    { km: 25, terrain: 'coast' },
  ],
};

/** Out of Tokyo, along the Shonan coast and up into the hot-spring hills. */
export const TO_THE_HOT_SPRINGS: Route = {
  id: 'tokyo-hot-springs-v1',
  name: 'To the Hot Springs',
  nameZh: '去泡温泉',
  places: [
    { id: 'tokyo', name: 'Tokyo', region: 'Japan', terrain: 'city', lat: 35.68, lon: 139.69, note: 'The city hums behind me. I take the river road south.' , zh: { name: '东京', region: '日本', note: '城市在身后嗡嗡作响。我沿着河往南走。' } },
    { id: 'kamakura', name: 'Kamakura', region: 'Kanagawa', terrain: 'hills', lat: 35.32, lon: 139.55, note: 'Old temples in the trees, salt in the air.' , zh: { name: '镰仓', region: '神奈川', note: '树林里的老寺，空气里有盐味。' } },
    { id: 'enoshima', name: 'Enoshima', region: 'Kanagawa', terrain: 'coast', lat: 35.3, lon: 139.48, note: 'An island at the end of a bridge. The sea, at last.' , zh: { name: '江之岛', region: '神奈川', note: '桥尽头的一座岛。终于看见海了。' } },
    { id: 'odawara', name: 'Odawara', region: 'Kanagawa', terrain: 'city', lat: 35.26, lon: 139.15, note: 'A castle by the station. I ate a fish cake on the steps.' , zh: { name: '小田原', region: '神奈川', note: '车站旁有座城。我坐在台阶上吃了块鱼板。' } },
    { id: 'hakone-yumoto', name: 'Hakone-Yumoto', region: 'Kanagawa', terrain: 'mountain', lat: 35.23, lon: 139.11, note: 'Steam rising off the river. Everyone walks slowly here.' , zh: { name: '箱根汤本', region: '神奈川', note: '河面上冒着热气。这里的人都走得慢。' } },
    { id: 'lake-ashi', name: 'Lake Ashi', region: 'Hakone', terrain: 'lake', lat: 35.2, lon: 139.03, note: 'A red gate standing in the water, Fuji behind the clouds.' , zh: { name: '芦之湖', region: '箱根', note: '一座红色的鸟居立在水里，富士山躲在云后。' } },
    { id: 'atami', name: 'Atami', region: 'Shizuoka', terrain: 'coast', lat: 35.1, lon: 139.07, note: 'Down to the warm sea. Feet in the water, journey done.' , zh: { name: '热海', region: '静冈', note: '走到暖暖的海边。脚泡在水里，这一程走完了。' } },
  ],
  legs: [
    { km: 50, terrain: 'plain' },
    { km: 8, terrain: 'coast' },
    { km: 35, terrain: 'coast' },
    { km: 8, terrain: 'hills' },
    { km: 14, terrain: 'mountain' },
    { km: 20, terrain: 'mountain' },
  ],
};

/** Down the Seine from Paris to the chalk cliffs of Normandy. */
export const DOWN_THE_SEINE: Route = {
  id: 'paris-seine-v1',
  name: 'Down the Seine',
  nameZh: '顺着塞纳河',
  places: [
    { id: 'paris', name: 'Paris', region: 'France', terrain: 'city', lat: 48.86, lon: 2.35, note: 'Bread for the road. The river will show me the way.' , zh: { name: '巴黎', region: '法国', note: '带上路上吃的面包。河会给我指路。' } },
    { id: 'giverny', name: 'Giverny', region: 'Normandy', terrain: 'plain', lat: 49.08, lon: 1.53, note: 'Lily ponds. I stood on the green bridge for a long time.' , zh: { name: '吉维尼', region: '诺曼底', note: '睡莲池。我在绿色的桥上站了很久。' } },
    { id: 'rouen', name: 'Rouen', region: 'Normandy', terrain: 'hills', lat: 49.44, lon: 1.1, note: 'A cathedral in every light, like the painter said.' , zh: { name: '鲁昂', region: '诺曼底', note: '每一种光里都有一座大教堂，画家没说错。' } },
    { id: 'honfleur', name: 'Honfleur', region: 'Normandy', terrain: 'coast', lat: 49.42, lon: 0.23, note: 'Slate houses leaning over the old harbour.' , zh: { name: '翁弗勒尔', region: '诺曼底', note: '石板瓦的房子探身望着老港。' } },
    { id: 'etretat', name: 'Étretat', region: 'Normandy', terrain: 'coast', lat: 49.71, lon: 0.2, note: 'White arches standing in the sea. Journey done.' , zh: { name: '埃特勒塔', region: '诺曼底', note: '白色的拱门站在海里。这一程走完了。' } },
  ],
  legs: [
    { km: 75, terrain: 'plain' },
    { km: 65, terrain: 'hills' },
    { km: 90, terrain: 'forest' },
    { km: 45, terrain: 'coast' },
  ],
};

/** North along the Hudson from New York into the Catskills. */
export const UP_THE_HUDSON: Route = {
  id: 'hudson-v1',
  name: 'Up the Hudson',
  nameZh: '哈德逊河上游',
  places: [
    { id: 'new-york', name: 'New York', region: 'United States', terrain: 'city', lat: 40.71, lon: -74.01, note: 'Out through the steam and the sirens. The river points north.' , zh: { name: '纽约', region: '美国', note: '穿过蒸汽和警笛声出城。河指向北方。' } },
    { id: 'tarrytown', name: 'Tarrytown', region: 'New York', terrain: 'forest', lat: 41.08, lon: -73.86, note: 'Headless horsemen on the signs. I kept my hat on.' , zh: { name: '塔里敦', region: '纽约州', note: '路牌上画着无头骑士。我把帽子按紧了。' } },
    { id: 'cold-spring', name: 'Cold Spring', region: 'New York', terrain: 'hills', lat: 41.42, lon: -73.95, note: 'The river squeezed between mountains. A freight train went by for ten minutes.' , zh: { name: '冷泉镇', region: '纽约州', note: '河被山夹得很窄。一列货车开了十分钟。' } },
    { id: 'hyde-park', name: 'Hyde Park', region: 'New York', terrain: 'plain', lat: 41.79, lon: -73.93, note: 'Apple stands by the road. I had two.' , zh: { name: '海德公园镇', region: '纽约州', note: '路边有卖苹果的摊子。我吃了两个。' } },
    { id: 'rhinebeck', name: 'Rhinebeck', region: 'New York', terrain: 'plain', lat: 41.93, lon: -73.91, note: 'A town with a bandstand. Someone was practising the trumpet.' , zh: { name: '莱茵贝克', region: '纽约州', note: '有个带乐台的小镇。有人在练小号。' } },
    { id: 'woodstock', name: 'Woodstock', region: 'Catskills', terrain: 'mountain', lat: 42.04, lon: -74.12, note: 'Up into the Catskills. Mist in the trees, a dog on every porch.' , zh: { name: '伍德斯托克', region: '卡茨基尔', note: '进了卡茨基尔山。树里有雾，每家门廊上都有条狗。' } },
  ],
  legs: [
    { km: 42, terrain: 'city' },
    { km: 40, terrain: 'forest' },
    { km: 45, terrain: 'hills' },
    { km: 18, terrain: 'plain' },
    { km: 30, terrain: 'forest' },
  ],
};

/** Down the coast from San Francisco to Big Sur. */
export const PACIFIC_COAST: Route = {
  id: 'pacific-coast-v1',
  name: 'Down the Pacific Coast',
  nameZh: '太平洋海岸',
  places: [
    { id: 'san-francisco', name: 'San Francisco', region: 'California', terrain: 'city', lat: 37.77, lon: -122.42, note: 'Fog on the bridge, sun on the hills. Both at once.' , zh: { name: '旧金山', region: '加利福尼亚', note: '桥上是雾，山上是太阳。两样一起有。' } },
    { id: 'half-moon-bay', name: 'Half Moon Bay', region: 'California', terrain: 'coast', lat: 37.46, lon: -122.43, note: 'Pumpkin fields running down to the surf.' , zh: { name: '半月湾', region: '加利福尼亚', note: '南瓜田一直铺到浪边。' } },
    { id: 'santa-cruz', name: 'Santa Cruz', region: 'California', terrain: 'coast', lat: 36.97, lon: -122.03, note: 'A wooden roller coaster rattling over the beach.' , zh: { name: '圣克鲁斯', region: '加利福尼亚', note: '木头过山车在海滩上哐当哐当。' } },
    { id: 'monterey', name: 'Monterey', region: 'California', terrain: 'coast', lat: 36.6, lon: -121.89, note: 'Sea otters floating on their backs, cracking shells.' , zh: { name: '蒙特雷', region: '加利福尼亚', note: '海獭仰面漂着，在敲贝壳。' } },
    { id: 'big-sur', name: 'Big Sur', region: 'California', terrain: 'mountain', lat: 36.27, lon: -121.81, note: 'Cliffs falling straight into the ocean. I walked slowly on purpose.' , zh: { name: '大苏尔', region: '加利福尼亚', note: '悬崖直直地落进海里。我故意走得很慢。' } },
  ],
  legs: [
    { km: 45, terrain: 'coast' },
    { km: 75, terrain: 'coast' },
    { km: 70, terrain: 'coast' },
    { km: 45, terrain: 'mountain' },
  ],
};

/** Out of Melbourne along the Great Ocean Road. */
export const GREAT_OCEAN: Route = {
  id: 'great-ocean-v1',
  name: 'The Great Ocean Road',
  nameZh: '大洋路',
  places: [
    { id: 'melbourne', name: 'Melbourne', region: 'Australia', terrain: 'city', lat: -37.81, lon: 144.96, note: 'Trams and laneways. Coffee for the road.' , zh: { name: '墨尔本', region: '澳大利亚', note: '电车和小巷。带杯咖啡上路。' } },
    { id: 'geelong', name: 'Geelong', region: 'Victoria', terrain: 'plain', lat: -38.15, lon: 144.36, note: 'A long flat walk. Sheep, then more sheep.' , zh: { name: '吉朗', region: '维多利亚', note: '一段又长又平的路。羊，然后还是羊。' } },
    { id: 'torquay', name: 'Torquay', region: 'Victoria', terrain: 'coast', lat: -38.33, lon: 144.32, note: 'Surfboards on every car. The ocean, loud.' , zh: { name: '托基', region: '维多利亚', note: '每辆车上都有冲浪板。海很响。' } },
    { id: 'lorne', name: 'Lorne', region: 'Victoria', terrain: 'coast', lat: -38.54, lon: 143.98, note: 'Cockatoos screaming in the gums above the beach.' , zh: { name: '洛恩', region: '维多利亚', note: '海滩上方的桉树里，凤头鹦鹉在尖叫。' } },
    { id: 'apollo-bay', name: 'Apollo Bay', region: 'Victoria', terrain: 'forest', lat: -38.76, lon: 143.67, note: 'Tree ferns and a koala asleep in a fork.' , zh: { name: '阿波罗湾', region: '维多利亚', note: '树蕨，还有一只睡在树杈上的考拉。' } },
    { id: 'twelve-apostles', name: 'Twelve Apostles', region: 'Victoria', terrain: 'coast', lat: -38.66, lon: 143.1, note: 'Stone towers standing in the surf. Journey done.' , zh: { name: '十二使徒岩', region: '维多利亚', note: '石柱站在浪里。这一程走完了。' } },
  ],
  legs: [
    { km: 75, terrain: 'plain' },
    { km: 25, terrain: 'coast' },
    { km: 45, terrain: 'coast' },
    { km: 45, terrain: 'forest' },
    { km: 90, terrain: 'coast' },
  ],
};

/** From Shanghai through the water towns to West Lake and the hills beyond. */
export const JIANGNAN_WATERS: Route = {
  id: 'jiangnan-v1',
  name: 'Jiangnan Waters',
  nameZh: '江南水乡',
  places: [
    { id: 'shanghai', name: 'Shanghai', region: 'China', terrain: 'city', lat: 31.23, lon: 121.47, note: 'Left the towers behind before the breakfast stalls opened.' , zh: { name: '上海', region: '中国', note: '趁早点摊还没开，把高楼留在了身后。' } },
    { id: 'zhujiajiao', name: 'Zhujiajiao', region: 'Shanghai', terrain: 'lake', lat: 31.11, lon: 121.05, note: 'Stone bridges and a boatman singing to nobody.' , zh: { name: '朱家角', region: '上海', note: '石桥，还有一个对着空气唱歌的船夫。' } },
    { id: 'suzhou', name: 'Suzhou', region: 'Jiangsu', terrain: 'city', lat: 31.3, lon: 120.62, note: 'Gardens within gardens. I lost an hour in one.' , zh: { name: '苏州', region: '江苏', note: '园子里还有园子。我在一个里面丢了一个钟头。' } },
    { id: 'taihu', name: 'Lake Tai', region: 'Jiangsu', terrain: 'lake', lat: 31.2, lon: 120.3, note: 'A lake like a sea, fishing boats at the edge of sight.' , zh: { name: '太湖', region: '江苏', note: '湖像海一样，渔船在视线尽头。' } },
    { id: 'hangzhou', name: 'West Lake', region: 'Hangzhou', terrain: 'lake', lat: 30.25, lon: 120.14, note: 'Willows, a causeway, tea in a paper cup.' , zh: { name: '西湖', region: '杭州', note: '柳树，长堤，纸杯里的茶。' } },
    { id: 'moganshan', name: 'Moganshan', region: 'Zhejiang', terrain: 'mountain', lat: 30.6, lon: 119.86, note: 'Bamboo to the top of the hill. Quiet enough to hear it grow.' , zh: { name: '莫干山', region: '浙江', note: '竹子一直长到山顶。安静得能听见它在长。' } },
  ],
  legs: [
    { km: 48, terrain: 'plain' },
    { km: 55, terrain: 'lake' },
    { km: 35, terrain: 'plain' },
    { km: 130, terrain: 'lake' },
    { km: 60, terrain: 'hills' },
  ],
};

export const ROUTES: Route[] = [TO_THE_SEA, TO_THE_HOT_SPRINGS, DOWN_THE_SEINE, UP_THE_HUDSON, PACIFIC_COAST, GREAT_OCEAN, JIANGNAN_WATERS];

export function routeById(id: string): Route | undefined {
  return ROUTES.find((r) => r.id === id);
}
