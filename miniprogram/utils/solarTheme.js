// utils/solarTheme.js —— 节气驱动主题（「UI 随节气变化」的唯一真源）
//
// 三件事：
//   1. 算当前日期落在哪个节气（用多年公历标准日期，误差 ±1 天，对主题切换足够）
//   2. 提供 24 节气主题色板（accent 组），通过 CSS 变量覆盖全局强调色
//   3. 提供节气海报路径（AI 生成的 24 张水墨横板海报，已压缩进 images/posters）
//
// 接入方式：app.js 的 getFontStyle() 会把 getStyleVars() 拼进 pageStyle，
// 所有页面 onShow 时自动生效，页面代码不需要感知节气。
//
// 色板约束：
//   - deep 色做文字色，对 --color-green-bg 浅底保持 ≥ 4.5:1（沿用 app.wxss 的适老化对比度规则）
//   - accent/soft/bg 只做图形、描边、浅底，不做小号文字色

// 节气气质（aura / gradient / texture），由构建脚本从知识库生成，见 data/termVisual.js
const TERM_VISUAL = require('../data/termVisual.js');

// 节气标准公历日期（多年平均值；真实日期每年浮动 ±1 天，作为主题切换依据足够）
const TERM_DATES = {
  xiaohan: { month: 1, day: 5, name: '小寒' },
  dahan: { month: 1, day: 20, name: '大寒' },
  lichun: { month: 2, day: 4, name: '立春' },
  yushui: { month: 2, day: 19, name: '雨水' },
  jingzhe: { month: 3, day: 5, name: '惊蛰' },
  chunfen: { month: 3, day: 20, name: '春分' },
  qingming: { month: 4, day: 4, name: '清明' },
  guyu: { month: 4, day: 20, name: '谷雨' },
  lixia: { month: 5, day: 5, name: '立夏' },
  xiaoman: { month: 5, day: 21, name: '小满' },
  mangzhong: { month: 6, day: 5, name: '芒种' },
  xiazhi: { month: 6, day: 21, name: '夏至' },
  xiaoshu: { month: 7, day: 7, name: '小暑' },
  dashu: { month: 7, day: 22, name: '大暑' },
  liqiu: { month: 8, day: 7, name: '立秋' },
  chushu: { month: 8, day: 23, name: '处暑' },
  bailu: { month: 9, day: 7, name: '白露' },
  qiufen: { month: 9, day: 23, name: '秋分' },
  hanlu: { month: 10, day: 8, name: '寒露' },
  shuangjiang: { month: 10, day: 23, name: '霜降' },
  lidong: { month: 11, day: 7, name: '立冬' },
  xiaoxue: { month: 11, day: 22, name: '小雪' },
  daxue: { month: 12, day: 7, name: '大雪' },
  dongzhi: { month: 12, day: 21, name: '冬至' },
};

// 跨年顺序：从雨水起按一年内的自然顺序，1 月的两个节气（小寒/大寒）视为「冬至段」
const ORDER = [
  'lichun', 'yushui', 'jingzhe', 'chunfen', 'qingming', 'guyu',
  'lixia', 'xiaoman', 'mangzhong', 'xiazhi', 'xiaoshu', 'dashu',
  'liqiu', 'chushu', 'bailu', 'qiufen', 'hanlu', 'shuangjiang',
  'lidong', 'xiaoxue', 'daxue', 'dongzhi', 'xiaohan', 'dahan',
];

// 24 节气主题色板：
//   accent = 强调主色（图形/描边/选中底）  deep = 文字用深色
//   soft / bg = 浅底两档                    season = 季节（菜单四季分组沿用）
const THEMES = {
  lichun:      { accent: '#5e8a52', deep: '#3d6636', soft: '#e2ecda', bg: '#eef3e6', season: 'spring' },
  yushui:      { accent: '#4f8a72', deep: '#2f6350', soft: '#dbe9e2', bg: '#e9f1ec', season: 'spring' },
  jingzhe:     { accent: '#57844a', deep: '#365c2c', soft: '#e0ebd6', bg: '#edf2e4', season: 'spring' },
  chunfen:     { accent: '#4e8a5e', deep: '#2f6040', soft: '#dcebe0', bg: '#eaf2ec', season: 'spring' },
  qingming:    { accent: '#557f68', deep: '#335646', soft: '#dde9e2', bg: '#ecf1ed', season: 'spring' },
  guyu:        { accent: '#4a7c59', deep: '#2d5539', soft: '#dbe8de', bg: '#e9f1ea', season: 'spring' },
  lixia:       { accent: '#3f7a45', deep: '#27522c', soft: '#d7e7d1', bg: '#e8f1e4', season: 'summer' },
  xiaoman:     { accent: '#4a7f3f', deep: '#2c5426', soft: '#dbe7d2', bg: '#eaf1e2', season: 'summer' },
  mangzhong:   { accent: '#7c8a2e', deep: '#55611c', soft: '#e4e9cd', bg: '#eff2df', season: 'summer' },
  xiazhi:      { accent: '#2f7a52', deep: '#1c5336', soft: '#d2e7dc', bg: '#e6f0ea', season: 'summer' },
  xiaoshu:     { accent: '#3a7a5f', deep: '#235240', soft: '#d6e7de', bg: '#e8f0eb', season: 'summer' },
  dashu:       { accent: '#a85c32', deep: '#6e3a1d', soft: '#ecd7c8', bg: '#f2e6db', season: 'summer' },
  liqiu:       { accent: '#9a6b2f', deep: '#674517', soft: '#ecdbc2', bg: '#f3e9d8', season: 'autumn' },
  chushu:      { accent: '#8a7a3a', deep: '#5c511f', soft: '#e7dfc4', bg: '#f0ebda', season: 'autumn' },
  bailu:       { accent: '#587a8a', deep: '#35525f', soft: '#d9e6ea', bg: '#ebf0f2', season: 'autumn' },
  qiufen:      { accent: '#9a742f', deep: '#674b17', soft: '#ecdfc3', bg: '#f3ecdb', season: 'autumn' },
  hanlu:       { accent: '#44617e', deep: '#2a4258', soft: '#d8e2e8', bg: '#ebf0f3', season: 'autumn' },
  shuangjiang: { accent: '#7a5a3f', deep: '#513a26', soft: '#e6dccd', bg: '#f1eae0', season: 'autumn' },
  lidong:      { accent: '#44617e', deep: '#2a4258', soft: '#d8e2e8', bg: '#ebf0f3', season: 'winter' },
  xiaoxue:     { accent: '#52718a', deep: '#324a5e', soft: '#dbe4ea', bg: '#edf1f4', season: 'winter' },
  daxue:       { accent: '#3f5f7a', deep: '#263e52', soft: '#d6e1e8', bg: '#eaf0f3', season: 'winter' },
  dongzhi:     { accent: '#3a5670', deep: '#22374a', soft: '#d4dfe7', bg: '#e9eef3', season: 'winter' },
  xiaohan:     { accent: '#56657a', deep: '#354356', soft: '#dde1e7', bg: '#eef0f3', season: 'winter' },
  dahan:       { accent: '#445f6e', deep: '#29404b', soft: '#dbe3e7', bg: '#ecf0f2', season: 'winter' },
};

// 给每套色板注入 slug：styleVarsOf 要按 slug 去 termVisual 取渐变气质
Object.keys(THEMES).forEach((slug) => {
  THEMES[slug].slug = slug;
});

// 中文名 → slug（data 里的节气字段用中文，按名取主题）
const NAME_TO_SLUG = {};
Object.keys(TERM_DATES).forEach((slug) => {
  NAME_TO_SLUG[TERM_DATES[slug].name] = slug;
});

// 按日期找当前节气：把 24 个节点转成 MMDD 数字，取「不大于今天」的最大节点。
// 小寒/大寒是 1 月的节点，1/1-1/4 没有任何节点不大于今天 → 落在上一年的冬至段。
function calcTermSlug(date) {
  const cur = (date.getMonth() + 1) * 100 + date.getDate();
  let best = '';
  let bestKey = -1;
  for (let i = 0; i < ORDER.length; i++) {
    const t = TERM_DATES[ORDER[i]];
    const key = t.month * 100 + t.day;
    if (key <= cur && key > bestKey) {
      bestKey = key;
      best = ORDER[i];
    }
  }
  return best || 'dongzhi';
}

// 对外：当前节气完整信息
function getTermInfo(date) {
  const now = date || new Date();
  const slug = calcTermSlug(now);
  const meta = TERM_DATES[slug];
  const theme = THEMES[slug];
  const isTermDay = now.getMonth() + 1 === meta.month && now.getDate() === meta.day;
  return {
    slug,
    name: meta.name,
    season: theme.season,
    poster: `/images/posters/${slug}.jpg`,
    dateText: `${meta.month}月${meta.day}日`,
    isTermDay,
    theme,
  };
}

// 中文节气名 → 主题（termCard / 详情页按名取海报与色）
function getThemeByName(name) {
  const slug = NAME_TO_SLUG[name];
  if (!slug) return null;
  return {
    slug,
    name,
    season: THEMES[slug].season,
    poster: `/images/posters/${slug}.jpg`,
    theme: THEMES[slug],
  };
}

// CSS 变量串：拼进 pageStyle，覆盖全局强调色（--color-green 系）
// 品牌棕 --color-brand 保持不动（按钮描边等品牌识别位不随节气漂移），
// 节气变化落在「强调色 + 浅底 + 渐变气质」上，感知明显且不破坏对比度规则。
//
// 渐变只给「大面积背景」用（文化卡、海报兜底），不能拿来压白字——
// 实测 24 套 primary 里有 9 套白字对比度 < 4.5（立夏 2.37 / 小满 2.90 / 雨水 3.40…）。
function styleVarsOf(theme) {
  const t = theme || THEMES.lidong;
  const vars = [
    `--color-green:${t.accent}`,
    `--color-green-deep:${t.deep}`,
    `--color-green-soft:${t.soft}`,
    `--color-green-bg:${t.bg}`,
    `--color-green-ink:${t.deep}`,
  ];
  // 节气气质：渐变起止色 + 纹理标识（termVisual.js 为唯一来源）
  const visual = TERM_VISUAL[t.slug];
  if (visual && visual.gradient && visual.gradient.length === 2) {
    vars.push(`--term-grad-from:${visual.gradient[0]}`);
    vars.push(`--term-grad-to:${visual.gradient[1]}`);
  }
  return vars.join(';') + ';';
}

function getStyleVars(date) {
  return styleVarsOf(getTermInfo(date).theme);
}

module.exports = {
  getTermInfo,
  getThemeByName,
  getStyleVars,
  styleVarsOf,
  THEMES,
  TERM_DATES,
};
