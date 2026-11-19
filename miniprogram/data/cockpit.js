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
// 知识图谱：640 × 660 的设计坐标系，三层椭圆导轨 + 38 节点 + 85 条边。
// 与《康康食养_数据驾驶舱_v1.html》的 03 知识图谱同构：
//   核心 1 → 内圈 3 菜系 → 中圈 5 主料 / 5 偏好 → 外圈 24 节气；
//   72 条「节气—菜系」弧线持续流动，点任意节点高亮它的邻接关系。
// 坐标在这里一次算好：小程序用 canvas 2D 画，预览用 SVG 画，共用同一份数据。
// ——————————————————————————————————————————————
const MAP = { w: 640, h: 760, cx: 320, cy: 380, r0: 78 };
const G_RINGS = [
  { rx: 120, ry: 148 }, // 内圈：3 菜系
  { rx: 196, ry: 228 }, // 中圈：5 主料 + 5 偏好
  { rx: 284, ry: 330 }, // 外圈：24 节气
];

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

// —— 图谱布局：38 个实体、85 条关系 ——
// 三层椭圆从内到外是「菜系 / 主料·偏好 / 节气」，与参考 HTML 同构。
// 每个节气连 3 个菜系（72 条），用向心 Q 弧线，避免 72 条直线在中心糊成一团。
const CU_DEG = [90, 210, 330];
const round1 = (v) => Math.round(v * 10) / 10;

// [示例] 中圈 10 个节点的说明文案，沿用数据驾驶舱 v1 的口径
const INNER_DESC = {
  猪肉: '全库第一高频主料（445 卡口径），价档 2，替代品为鸡肉、牛肉、豆制品。',
  鸡肉: '清远麻鸡为地理标志；去皮鸡胸高蛋白低脂，长者宜去骨撕丝。',
  鸡蛋: '最便宜的优质蛋白，常作参考蛋白；长者宜全熟，防沙门氏菌。',
  排骨: '汤鲜肉嫩；注意「骨汤补钙」是误会，补的主要是脂肪与嘌呤。',
  豆腐: '加工类主料代表，植物蛋白来源；加工类生态分原料产地与加工地两段。',
  怕冷: '全库第一适配偏向，但夏季可选少、冬季多，冷热不均。',
  怕热: '同时是最大「宜」与最大「忌」——辨证的典型矛盾点。',
  容易出汗: '集中在滋阴润燥类，如响螺、花胶、石斛、麦冬入馔。',
  经常口干: '宜清热祛湿（苦瓜、薏米、冬瓜），忌温补厚味。',
  冷热都怕: '不偏不倚的日常菜，是「不知道吃什么」时的默认解。',
};

function buildGraphMap(cuisineList, termName, total, perTerm) {
  const { cx, cy } = MAP;
  const nodes = [];
  const labels = [];
  const links = [];
  const detail = {};
  const pos = {};
  const add = (n) => { nodes.push(n); pos[n.id] = n; };

  // 核心
  add({ id: 'core', kind: 'core', label: '岭南食养库', sub: total + ' 道', x: cx, y: cy, r: 62 });
  detail.core = {
    name: '岭南食养库',
    sub: total + ' 道',
    desc: total + ' 道 = 3 菜系 × 96 道；24 节气 × 3 菜系 = 72 格，每格 4 道，无空缺。',
    rows: [
      { k: '结构', v: termsRaw.length + ' 节气 × 3 菜系 × 4 道' },
      { k: '关系边', v: '85 条（3 主线 + 72 节气—菜系 + 10 实体）' },
    ],
  };

  // 内圈：3 菜系
  cuisineList.forEach((c, i) => {
    const a = (CU_DEG[i] * Math.PI) / 180;
    const x = round1(cx + G_RINGS[0].rx * Math.cos(a));
    const y = round1(cy + G_RINGS[0].ry * Math.sin(a));
    const id = 'cu-' + i;
    add({ id, kind: 'cuisine', label: c.name, sub: c.n + ' 道', x, y, r: 36 });
    links.push({ id: 'l-' + id, s: 'core', t: id, dashed: false, tone: 'cu', x1: cx, y1: cy, x2: x, y2: y });
    detail[id] = {
      name: c.name + '菜',
      sub: c.n + ' 道',
      desc: '三系各 ' + c.n + ' 道。点它可高亮与 24 个节气的全部连线。',
      rows: [
        { k: '成本结构', v: '低 ' + c.low + ' · 中 ' + c.mid + ' · 高 ' + c.high },
        { k: '★★★ 难度', v: c.hard + ' 道' },
        { k: '少吃提示', v: c.caution + ' 道' },
      ],
    };
  });

  // 外圈：24 节气（立春起算，正上方顺时针）
  const termTotal = termsRaw.length || 24;
  const start = termsRaw.findIndex((x) => x.name === '立春');
  const base = start > 0 ? start : 0;
  termsRaw.forEach((item, i) => {
    const order = (i - base + termTotal) % termTotal;
    const deg = -90 + (360 / termTotal) * order;
    const a = (deg * Math.PI) / 180;
    const x = round1(cx + G_RINGS[2].rx * Math.cos(a));
    const y = round1(cy + G_RINGS[2].ry * Math.sin(a));
    const cur = item.name === termName;
    const id = 't-' + i;
    add({ id, kind: 'term', label: item.name, sub: (perTerm[item.name] || 0) + ' 道', x, y, r: cur ? 9 : 5, cur });
    if (order % 3 === 0) {
      // 只标 8 个大节气；左右两端把文字吸到内侧，避免出界
      let lx = round1(cx + (G_RINGS[2].rx + 26) * Math.cos(a));
      let ly = round1(cy + (G_RINGS[2].ry + 26) * Math.sin(a));
      let anchor = 'middle';
      // 左右两端把文字吸到点的内侧并上抬，避免出界、压住节点
      if (lx < cx - 230) { lx = round1(x + 14); ly = round1(y - 12); anchor = 'start'; }
      else if (lx > cx + 230) { lx = round1(x - 14); ly = round1(y - 12); anchor = 'end'; }
      labels.push({ id: 'lb-' + i, x: lx, y: ly, text: item.name, now: cur, anchor });
    }
    detail[id] = {
      name: item.name,
      sub: cur ? '当前节气 · 第 ' + (order + 1) + ' / ' + termTotal : '第 ' + (order + 1) + ' 个节气',
      desc: cur
        ? '当前节气：' + item.name + '。三菜系各 4 道，共 ' + (perTerm[item.name] || 0) + ' 道可点。'
        : item.name + '：3 菜系各 4 道，共 ' + (perTerm[item.name] || 0) + ' 道可点。',
      rows: [{ k: '当令菜', v: (perTerm[item.name] || 0) + ' 道（3 菜系 × 4 道）' }],
    };
  });

  // 中圈：5 主料 + 5 偏好（示例）
  const INNER = SAMPLE.graphIngredients
    .map((x) => ({ name: x.name, n: x.n, kind: 'ing' }))
    .concat(SAMPLE.graphFits.map((x) => ({ name: x.name, n: x.n, kind: 'fit' })));
  INNER.forEach((n, i) => {
    const a = ((i * 36 + 36) * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const x = round1(cx + G_RINGS[1].rx * ca);
    const y = round1(cy + G_RINGS[1].ry * sa);
    const id = 'n-' + i;
    // 名字挂到圆外侧：沿半径再走 28，左右两侧按方向对齐，不压导轨也不挤在一起
    let anchor = 'middle';
    if (ca > 0.45) anchor = 'start';
    else if (ca < -0.45) anchor = 'end';
    const lx = round1(x + 28 * ca);
    const ly = round1(y + 28 * sa);
    add({ id, kind: n.kind, label: n.name, sub: n.n + ' 道', x, y, r: 15, lx, ly, anchor });
    links.push({ id: 'l-' + id, s: 'core', t: id, dashed: false, tone: n.kind, x1: cx, y1: cy, x2: x, y2: y });
    detail[id] = {
      name: n.name,
      sub: n.n + ' 道 · ' + (n.kind === 'ing' ? '主料节点' : '偏好节点'),
      desc: INNER_DESC[n.name] || '点任意节点可高亮它的邻接关系。',
      rows: [{ k: '出现道数', v: n.n + ' 道（示例口径）' }],
    };
  });

  // 72 条节气 → 菜系：向心 Q 弧线
  termsRaw.forEach((item, i) => {
    const t = pos['t-' + i];
    cuisineList.forEach((c, j) => {
      const cu = pos['cu-' + j];
      const mx = (t.x + cu.x) / 2;
      const my = (t.y + cu.y) / 2;
      links.push({
        id: 'lt-' + i + '-' + j,
        s: t.id,
        t: cu.id,
        dashed: true,
        tone: 'term',
        x1: t.x, y1: t.y,
        x2: cu.x, y2: cu.y,
        qx: round1(mx * 0.66 + cx * 0.34),
        qy: round1(my * 0.66 + cy * 0.34),
      });
    });
  });

  // 邻接表：点一个节点，只留它和它的邻居
  const near = {};
  nodes.forEach((n) => { near[n.id] = [n.id]; });
  links.forEach((l) => {
    if (near[l.s].indexOf(l.t) < 0) near[l.s].push(l.t);
    if (near[l.t].indexOf(l.s) < 0) near[l.t].push(l.s);
  });

  return {
    w: MAP.w, h: MAP.h, cx, cy,
    guides: G_RINGS,
    nodes, labels, links, detail, near,
    legend: [
      { name: '核心', n: 1 },
      { name: '菜系', n: cuisineList.length },
      { name: '主料', n: 5 },
      { name: '偏好', n: 5 },
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

  // —— 知识图谱：38 实体 / 85 边，点节点高亮邻接 ——
  const graph = {
    sample: true,
    core: { name: '岭南食养库', sub: total + ' 道' },
    map: buildGraphMap(cuisineList, termName, total, perTerm),
    ingredients: withW(SAMPLE.graphIngredients, { unit: ' 道' }),
    fits: withW(SAMPLE.graphFits, { unit: ' 道' }),
    edges: 0,
    note:
      '38 个实体 · 85 条关系，与数据驾驶舱 v1 同构：核心连 3 菜系、10 个主料 / 偏好节点，' +
      '24 节气各连 3 菜系（72 条弧线持续流动）。点任意节点，只留它的邻接关系并换成该实体档案；' +
      '节气与菜系是实算，主料与偏好标「示例」。',
  };
  graph.edges = graph.map.links.length;

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
