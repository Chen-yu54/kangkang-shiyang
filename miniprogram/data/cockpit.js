// data/cockpit.js —— 首页「跟着节气吃」驾驶舱的分区数据
//
// 这一块是可点开的分区台：上面一张罗盘卡（节气 + 三个数字 + 三个环），
// 点开后在卡内切五个分区，每个分区换一套数据。
//
// 两条纪律：
//   1. 能从 data/recipes.js、data/terms.js 算出来的，一律现算（标 [实算]）。
//      知识库改了，这里跟着变，不写死。
//   2. 知识库里没有的（人群偏向、食材库分层、图谱关系），集中在下面 SAMPLE 一处，
//      标注 [示例]，替换时只改这一块，页面不用动。

const recipes = require('../data/recipes.js');
const termsRaw = require('../data/terms.js');

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// ——————————————————————————————————————————————
// 知识图谱的坐标：全部在 640 × 620 的方框里算好，WXSS 只管摆位置。
// 不上 canvas 的原因：canvas 是原生组件，层级压在普通节点之上，
// 「点节点看明细」得自己做 hit-test，改一次布局要重算一遍；
// 这里节点最多 33 个、连线 32 条，用绝对定位的 view 反而更稳，bindtap 直接能用。
// ——————————————————————————————————————————————
const MAP = { w: 640, h: 620, cx: 320, cy: 310, r0: 78 };

function pt(r, deg) {
  const a = (deg * Math.PI) / 180;
  return {
    x: Math.round((MAP.cx + r * Math.cos(a)) * 10) / 10,
    y: Math.round((MAP.cy + r * Math.sin(a)) * 10) / 10,
  };
}

// 一条线：给左上角坐标 + 长度 + 角度，WXSS 用 rotate 绕左上角转
function seg(id, x1, y1, x2, y2, tone) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return {
    id,
    x1,
    y1,
    len: Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10,
    deg: Math.round(((Math.atan2(dy, dx) * 180) / Math.PI) * 10) / 10,
    tone,
  };
}


// ——————————————————————————————————————————————
// [示例] 知识库里没有这三组数据，先用与数据驾驶舱一致的数值占位。
// 换成真实数据时：保持 { name, n } 的形状，max 会自动按最大值算。
// ——————————————————————————————————————————————
const SAMPLE = {
  // 人群自述「偏向」：直接用问卷 Q1–Q4 的选项措辞，不用中医证型名。
  // 多标签，不可相加（示例）
  fitGood: [
    { name: '怕冷', n: 128 },
    { name: '怕热', n: 92 },
    { name: '容易出汗', n: 71 },
    { name: '经常口干', n: 66 },
    { name: '冷热都怕', n: 60 },
    { name: '很少出汗', n: 49 },
    { name: '偏干硬', n: 38 },
    { name: '时干时稀', n: 28 },
  ],
  // 「想少吃」的（示例）
  fitAvoid: [
    { name: '海鲜', n: 27 },
    { name: '牛肉', n: 18 },
    { name: '鸡蛋', n: 11 },
    { name: '牛奶', n: 9 },
    { name: '豆制品', n: 6 },
  ],
  // 少吃提示标签（示例）
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
  // 图谱：主料 / 偏向节点（示例，菜系与节气是实算的）
  graphIngredients: [
    { name: '猪肉', n: 54 },
    { name: '鸡肉', n: 32 },
    { name: '鸡蛋', n: 32 },
    { name: '排骨', n: 21 },
    { name: '豆腐', n: 20 },
  ],
  graphFits: [
    { name: '怕冷', n: 128 },
    { name: '怕热', n: 92 },
    { name: '容易出汗', n: 71 },
    { name: '经常口干', n: 66 },
    { name: '冷热都怕', n: 60 },
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

// —— 图谱布局 ——
// 三层：内圈 3 个菜系（实算道数）→ 中圈 5 个主料（示例）→ 外圈 24 个节气点。
// 24 个节气每 15° 一个，每 3 个标一次名，正好避开「每个都标会糊成一片」。
const CU_DEG = [200, 340, 90];
const CU_R = 176;
const TERM_R = 244;
const TERM_LBL_R = 272;

function buildGraphMap(cuisineList, termName, total, perTerm) {
  const nodes = [];
  const labels = [];
  const links = [];
  const detail = {};

  const edge = (id, deg, tx, ty, tone) => {
    const a = (deg * Math.PI) / 180;
    return seg(
      id,
      Math.round((MAP.cx + MAP.r0 * Math.cos(a)) * 10) / 10,
      Math.round((MAP.cy + MAP.r0 * Math.sin(a)) * 10) / 10,
      tx,
      ty,
      tone
    );
  };

  nodes.push({ id: 'core', type: 'core', name: '岭南食养库', sub: total + ' 道', x: MAP.cx, y: MAP.cy });
  detail.core = {
    name: '岭南食养库',
    sub: total + ' 道',
    rows: [
      { k: '结构', v: termsRaw.length + ' 节气 × 3 菜系 × 4 道' },
      { k: '关系边', v: SAMPLE.graphEdges + ' 条（节气—菜系—菜品—主料）' },
    ],
  };

  cuisineList.forEach((c, i) => {
    const deg = CU_DEG[i];
    const p = pt(CU_R, deg);
    const id = 'cu-' + i;
    nodes.push({ id, type: 'cu', name: c.name + '菜', sub: c.n + ' 道', x: p.x, y: p.y });
    links.push(edge('l-' + id, deg, p.x, p.y, 'cu'));
    detail[id] = {
      name: c.name + '菜',
      sub: c.n + ' 道',
      rows: [
        { k: '成本结构', v: '低 ' + c.low + ' · 中 ' + c.mid + ' · 高 ' + c.high },
        { k: '★★★ 难度', v: c.hard + ' 道' },
        { k: '少吃提示', v: c.caution + ' 道' },
      ],
    };
  });

  const termTotal = termsRaw.length || 24;
  // 数组是小寒起排的，星图要从立春（index 2）起算：立春在正上方，顺时针走完一年
  const start = termsRaw.findIndex((x) => x.name === '立春');
  const base = start > 0 ? start : 0;
  termsRaw.forEach((item, i) => {
    const order = (i - base + termTotal) % termTotal;
    const deg = -90 + (360 / termTotal) * order;
    const p = pt(TERM_R, deg);
    const now = item.name === termName;
    const id = 't-' + i;
    nodes.push({ id, type: now ? 'now' : 'term', dot: true, x: p.x, y: p.y });
    links.push(edge('l-' + id, deg, p.x, p.y, now ? 'now' : 'term'));
    // 每 3 个标一次名，正好落在立春/春分/立夏/夏至/立秋/秋分/立冬/冬至
    if (order % 3 === 0) {
      const lp = pt(TERM_LBL_R, deg);
      labels.push({ id: 'lb-' + i, x: lp.x, y: lp.y, text: item.name, now });
    }
    detail[id] = {
      name: item.name,
      sub: now ? '当前节气' : '第 ' + (order + 1) + ' 个节气',
      rows: [{ k: '当令菜', v: (perTerm[item.name] || 0) + ' 道（3 菜系 × 4 道）' }],
    };
  });

  return {
    w: MAP.w,
    h: MAP.h,
    nodes,
    labels,
    links,
    detail,
    legend: [
      { name: '菜系', n: cuisineList.length },
      { name: '节气', n: termTotal },
    ],
  };
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
      { v: pct(cared, total), u: '%', label: '少吃提示覆盖' },
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

  // —— 人群偏向（示例）——
  const fit = {
    sample: true,
    good: withW(SAMPLE.fitGood, { unit: ' 道' }),
    avoid: withW(SAMPLE.fitAvoid, { unit: ' 道' }),
    risk: withW(SAMPLE.risk, { unit: ' 道' }),
    note: '宜为多标签，不可相加；忌与宜同轴对照，同一道菜可能两边都出现。',
  };

  // —— 知识图谱（骨架实算，主料示例）——
  const graph = {
    sample: true,
    core: { name: '岭南食养库', sub: total + ' 道' },
    map: buildGraphMap(cuisineList, termName, total, perTerm),
    ingredients: withW(SAMPLE.graphIngredients, { unit: ' 道' }),
    fits: withW(SAMPLE.graphFits, { unit: ' 道' }),
    edges: SAMPLE.graphEdges,
    note:
      '图的骨架全是实算：核心 1 个、菜系 3 个、节气 ' +
      termsRaw.length +
      ' 个、关系边 ' +
      SAMPLE.graphEdges +
      ' 条。手机上不塞 24 个节气名——只标 8 个大节气，其余留点；点任一节点，下面换成它的明细。',
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
      { key: 'fit', name: '人群偏向', cap: '问卷选项分布与少吃提示' },
      { key: 'graph', name: '知识图谱', cap: '节气 — 菜系 — 菜品 — 主料 — 偏好' },
      { key: 'library', name: '食材深库', cap: '主料索引到标准卡的减法过程' },
    ],
    term,
    cuisine,
    fit,
    graph,
    library,
  };
}

module.exports = { build, buildTicks };
