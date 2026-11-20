// utils/daypart.js —— 一天六时辰：问候语 + 饮食建议 + 时段视觉（色彩/图标）
// 与节气主题（solarTheme.js）正交：节气管「一年」，本模块管「一天」。
// 纯数据模块，无 wx API，方便单测；视觉落地在 pages/index 的问候条。

// 时段划分（按本地人作息与饮食场景）：
//   清晨 05-09  早茶   上午 09-11  茶歇   正午 11-14  午饭/例汤
//   午后 14-18  下午茶 傍晚 18-21  晚饭/煲汤 深夜 21-05  糖水/休息
const PARTS = [
  {
    key: 'dawn',
    from: 5, to: 9,
    greetKey: 'daypart.dawn.greet',   // 早上好
    tipKey: 'daypart.dawn.tip',       // 一盅两件，叹早茶正当时
    icon: 'sunrise',                  // 日出：半轮 + 光芒旋转
    // 问候条渐变（起 → 止），暖橙晨曦
    fromColor: '#dd9e77',
    toColor: '#c07e5c',
    textColor: '#fbf1e8',
  },
  {
    key: 'morning',
    from: 9, to: 11,
    greetKey: 'daypart.morning.greet', // 上午好
    tipKey: 'daypart.morning.tip',     // 茶歇时分，饮啖茶食件点心
    icon: 'sun',
    fromColor: '#d3ab6e',
    toColor: '#b78d52',
    textColor: '#fbf5ea',
  },
  {
    key: 'noon',
    from: 11, to: 14,
    greetKey: 'daypart.noon.greet',    // 中午好
    tipKey: 'daypart.noon.tip',        // 饭前一碗例汤，是老规矩
    icon: 'sun',
    fromColor: '#c99c5e',
    toColor: '#a87f47',
    textColor: '#fbf3e6',
  },
  {
    key: 'afternoon',
    from: 14, to: 18,
    greetKey: 'daypart.afternoon.greet', // 下午好
    tipKey: 'daypart.afternoon.tip',     // 三点三，来碗糖水歇一歇
    icon: 'sunlow',                      // 偏西的太阳：位置下移
    fromColor: '#c69079',
    toColor: '#a2735f',
    textColor: '#faf0eb',
  },
  {
    key: 'evening',
    from: 18, to: 21,
    greetKey: 'daypart.evening.greet', // 晚上好
    tipKey: 'daypart.evening.tip',     // 今晚煲咩汤？看看当令菜
    icon: 'lantern',                   // 灯笼：暖光呼吸
    fromColor: '#6e5560',
    toColor: '#473c48',
    textColor: '#f4eaea',
  },
  {
    key: 'night',
    from: 21, to: 29, // 21 点 ~ 次日 05 点（24+5），统一用 24h+ 表达跨零点
    greetKey: 'daypart.night.greet',   // 夜深了
    tipKey: 'daypart.night.tip',       // 早点休息，明早一盅两件
    icon: 'moon',                      // 月亮 + 星星闪烁
    fromColor: '#2e3852',
    toColor: '#1c2338',
    textColor: '#dfe4f2',
  },
];

// hour: 0-23。深夜段用 21-29 表达跨零点，命中判断时把 0-5 点 +24。
function partForHour(hour) {
  const h = Number.isFinite(hour) ? hour : new Date().getHours();
  const h2 = h < 5 ? h + 24 : h;
  for (let i = 0; i < PARTS.length; i += 1) {
    if (h2 >= PARTS[i].from && h2 < PARTS[i].to) return PARTS[i];
  }
  return PARTS[PARTS.length - 1];
}

// 当前时辰对象（含渐变 style，直接塞给 wxss 用）
function current(date) {
  const d = date instanceof Date ? date : new Date();
  const part = partForHour(d.getHours());
  return Object.assign({}, part, {
    style: `background-image: linear-gradient(120deg, ${part.fromColor} 0%, ${part.toColor} 100%); color: ${part.textColor};`,
  });
}

module.exports = { PARTS, partForHour, current };
