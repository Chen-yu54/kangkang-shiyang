// data/cockpit.js —— 首页「跟着节气吃」驾驶舱的分区数据
//
// 这一块是可点开的分区台：上面一张罗盘卡（节气 + 三个数字 + 三个环），
// 点开后在卡内切五个分区，每个分区换一套数据。
//
// 两条纪律：
//   1. 能从 data/recipes.js、data/terms.js 算出来的，一律现算（标 [实算]）。
//      知识库改了，这里跟着变，不写死。
//   2. 知识库里没有的（体质宜忌、食材库分层、图谱关系），集中在下面 SAMPLE 一处，
//      标注 [示例]，替换时只改这一块，页面不用动。

const recipes = require('../data/recipes.js');
const termsRaw = require('../data/terms.js');

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// ——————————————————————————————————————————————
// [示例] 知识库里没有这三组数据，先用与数据驾驶舱一致的数值占位。
// 换成真实数据时：保持 { name, n } 的形状，max 会自动按最大值算。
// ——————————————————————————————————————————————
const SAMPLE = {
  // 体质「宜」：多标签，不可相加（示例）
  fitGood: [
    { name: '气虚', n: 128 },
    { name: '阳虚', n: 92 },
    { name: '阴虚', n: 71 },
    { name: '湿热', n: 66 },
    { name: '平和', n: 60 },
    { name: '痰湿', n: 49 },
    { name: '气郁', n: 38 },
    { name: '血瘀', n: 28 },
  ],
  // 体质「忌 / 少」（示例）
  fitAvoid: [
    { name: '阳虚', n: 27 },
    { name: '湿热', n: 18 },
    { name: '脾胃虚寒', n: 11 },
    { name: '痛风', n: 9 },
    { name: '痰湿', n: 6 },
  ],
  // 忌口风险标签（示例）
  risk: [
    { name: '高盐偏咸', n: 67 },
    { name: '高脂油腻', n: 53 },
    { name: '性凉偏寒', n: 50 },
    { name: '高嘌呤', n: 49 },
    { name: '含糖升糖', n: 43 },
    { name: '黏滞难化', n: 21 },
  ],
  // 食材库分层（示例）
  library: {
    funnel: [
      { name: '索引条目', n: 291, pct: 100, tone: 'jade' },
      { name: '已建标准卡', n: 222, pct: 76.3, tone: 'jade' },
      { name: '合并同类', n: 42, pct: 14.4, tone: 'gold' },
      { name: '调味料不建卡', n: 22, pct: 7.6, tone: 'ochre' },
      { name: '泛称 / 剔除', n: 5, pct: 1.7, tone: 'stone' },
    ],
    levels: [
      { name: 'L0 索引', note: '291 条', pct: 100 },
      { name: 'L1 标准卡', note: '222 条', pct: 76.3 },
      { name: 'L2 生态档案', note: '建设中', pct: 6, building: true },
    ],
    sources: [
      { name: '方志', n: 63, pct: 21.9 },
      { name: '非遗', n: 49, pct: 17.0 },
      { name: '其他', n: 176, pct: 61.1, dim: true },
    ],
  },
  // 图谱：主料 / 体质节点（示例，菜系与节气是实算的）
  graphIngredients: [
    { name: '猪肉', n: 54 },
    { name: '鸡肉', n: 32 },
    { name: '鸡蛋', n: 32 },
    { name: '排骨', n: 21 },
    { name: '豆腐', n: 20 },
  ],
  graphFits: [
    { name: '气虚', n: 128 },
    { name: '阳虚', n: 92 },
    { name: '阴虚', n: 71 },
    { name: '湿热', n: 66 },
    { name: '平和', n: 60 },
  ],
  graphEdges: 85,
};

function withW(rows, opt) {  const max = Math.max.apply(
    null,
    rows.map((r) => r.n)
  ) || 1;
  return rows.map((r) =>
    Object.assign({}, r, {
      w: Math.round((r.n / max) * 1000) / 10,
      v: opt && opt.unit ? r.n + opt.unit : String(r.n),
    })
  );
}

// 罗盘刻度：画在 264rpx 的方框里，圆心 (132,132)、半径 118。
// 位置按圆心坐标算好，WXSS 只负责把刻度中心对齐——不用 rotate+translate 叠一圈，
// 真机上多层 transform 容易歪。
const COMPASS_SIZE = 264;

function buildTicks(current) {
  const c = COMPASS_SIZE / 2;
  const r = 118;
  const total = termsRaw.length || 24;
  const order = Number(current && (current.termOrder || current.order)) || 0;
  const rows = [];
  for (let i = 0; i < total; i += 1) {
    const deg = (360 / total) * i;
    const rad = ((deg - 90) * Math.PI) / 180;
    rows.push({
      n: i,
      deg,
      x: Math.round((c + r * Math.cos(rad)) * 10) / 10,
      y: Math.round((c + r * Math.sin(rad)) * 10) / 10,
      on: order > 0 && i < order,
      now: order > 0 && i === order - 1,
    });
  }
  return rows;
}

function build(current) {
  const list = (Array.isArray(recipes) ? recipes : []).slice();
  const total = list.length || 1;
  const termName = (current && current.name) || '';

  // —— 节气视图 ——
  const perTerm = {};
  const covered = new Set();
  let ingredientCount = 0;
  let lowCost = 0;
  let cared = 0;

  list.forEach((d) => {
    (d.terms || []).forEach((t) => {
      perTerm[t] = (perTerm[t] || 0) + 1;
      covered.add(t);
    });
    ingredientCount += (d.mainIngredients || []).length;
    if (d.costLevel <= 2) lowCost += 1;
    if (d.caution && String(d.caution).trim()) cared += 1;
  });

  const avgIng = Math.round((ingredientCount / total) * 10) / 10;

  const cells = termsRaw.map((t) => ({
    name: t.name,
    n: perTerm[t.name] || 0,
    cur: t.name === termName,
  }));

  const term = {
    metrics: [
      { v: total, u: '道', label: '菜品总量' },
      { v: termsRaw.length * 3, u: '格', label: '节气 × 菜系' },
      { v: covered.size + '/' + termsRaw.length, u: '', label: '节气覆盖' },
      { v: avgIng, u: '种', label: '平均主料 / 道' },
      { v: pct(lowCost, total), u: '%', label: '大众价位占比' },
      { v: pct(cared, total), u: '%', label: '忌口提示覆盖' },
    ],
    cells,
    covered: covered.size,
    termTotal: termsRaw.length,
    ticks: buildTicks(current),
    note: `${termsRaw.length} 个节气里 ${covered.size} 个已有当令菜，每个节气三菜系各 4 道，格位没有空缺。`,
  };

  // —— 菜系对照（实算）——
  const CU = [
    { key: 'chaoshan', name: '潮汕' },
    { key: 'guangfu', name: '广府' },
    { key: 'hakka', name: '客家' },
  ];
  const cuisineList = CU.map((c) => {
    const arr = list.filter((d) => d.cuisine === c.key);
    const low = arr.filter((d) => d.costLevel === 1).length;
    const mid = arr.filter((d) => d.costLevel === 2).length;
    const high = arr.filter((d) => d.costLevel === 3).length;
    const hard = arr.filter((d) => d.difficulty === 'hard').length;
    const caution = arr.filter((d) => d.caution && String(d.caution).trim()).length;
    return {
      name: c.name,
      n: arr.length,
      low,
      mid,
      high,
      lowPct: pct(low, arr.length),
      midPct: pct(mid, arr.length),
      highPct: pct(high, arr.length),
      highShare: pct(high, arr.length),
      hard,
      caution,
    };
  });

  const chaoshanHigh = cuisineList[0].highShare;
  const hakkaHigh = cuisineList[2].highShare;
  const ratio = hakkaHigh ? Math.round((chaoshanHigh / hakkaHigh) * 10) / 10 : 0;

  const cuisine = {
    list: cuisineList,
    note:
      `潮汕高成本占 ${chaoshanHigh}%，是客家的 ${ratio} 倍；` +
      `三系各 ${cuisineList[0].n} 道，合计 ${cuisineList.reduce((s, c) => s + c.n, 0)} 道。` +
      '一句话：吃好选潮汕、吃省选客家、求稳选广府。',
  };

  // —— 体质适配（示例）——
  const fit = {
    sample: true,
    good: withW(SAMPLE.fitGood, { unit: ' 道' }),
    avoid: withW(SAMPLE.fitAvoid, { unit: ' 道' }),
    risk: withW(SAMPLE.risk, { unit: ' 道' }),
    note: '宜为多标签，不可相加；忌与宜同轴对照，同一道菜可能两边都出现。',
  };

  // —— 知识图谱（计数实算，节点示例）——
  const graph = {
    sample: true,
    core: { name: '岭南食养库', sub: total + ' 道' },
    rings: [
      { name: '菜系', n: cuisineList.length },
      { name: '节气', n: termsRaw.length },
      { name: '主料', n: 291 },
      { name: '体质', n: 9 },
    ],
    ingredients: withW(SAMPLE.graphIngredients, { unit: ' 道' }),
    fits: withW(SAMPLE.graphFits, { unit: ' 道' }),
    edges: SAMPLE.graphEdges,
    note: `核心节点 1 个、菜系 ${cuisineList.length} 个、节气 ${termsRaw.length} 个，主料与体质节点为示例；边的含义是「菜系—节气—菜品—主料—体质」的归属关系。`,
  };

  // —— 食材深库（示例）——
  const lib = SAMPLE.library;
  const library = {
    sample: true,
    funnel: lib.funnel.map((f) => Object.assign({}, f, { w: Math.max(f.pct * 0.92, 8) })),
    levels: lib.levels,
    sources: lib.sources,
    note: '291 条索引 = 已建卡 222 + 合并 42 + 调味料 22 + 泛称与剔除 5。把建卡率讲成一个减法过程，比一个孤立百分比可信。',
  };

  return {
    tabs: [
      { key: 'term', name: '节气视图', cap: `${termsRaw.length} 个节气 × 3 菜系，每格 4 道` },
      { key: 'cuisine', name: '菜系对照', cap: '潮汕 / 广府 / 客家 的结构与成本' },
      { key: 'fit', name: '体质适配', cap: '九种体质宜忌与忌口风险' },
      { key: 'graph', name: '知识图谱', cap: '节气 — 菜系 — 菜品 — 主料 — 体质' },
      { key: 'library', name: '食材深库', cap: '主料索引到标准卡的减法过程' },
    ],
    term,
    cuisine,
    fit,
    graph,
    library,
  };
}

module.exports = { build };
