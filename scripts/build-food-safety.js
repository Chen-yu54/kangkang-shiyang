#!/usr/bin/env node
/**
 * scripts/build-food-safety.js —— 把「食品安全」页要用的两份公开数据表，汇成一个小程序可读的数据模块
 *
 * 输入：knowledge/food-safety/inspections.csv（省局食品抽检通告：不合格批次明细，717 行）
 *       knowledge/food-safety/penalties.csv（省局行政处罚公开：决定书，14 行）
 * 输出：miniprogram/data/foodSafety.js
 *
 * 用法：node scripts/build-food-safety.js
 *
 * 三条规则：
 *   1. 只做汇总，不估、不补、不编：算不出来的（比如合格批次总量）宁可不写，也不给一个好看的数
 *   2. 判罚金额只从决定书原文的「元」里取，取不到就留空，不要用「约」糊过去
 *   3. 主体名称一律不进前端：原文已做 **** 打码，这里只保留案由与法条，避免指向具体商家
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_INSPECT = path.join(ROOT, 'knowledge', 'food-safety', 'inspections.csv');
const SRC_PENALTY = path.join(ROOT, 'knowledge', 'food-safety', 'penalties.csv');
const OUT = path.join(ROOT, 'miniprogram', 'data', 'foodSafety.js');

// —— 最小 CSV 解析：字段里有逗号、换行、引号，不能按行 split ——
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const head = rows.shift().map((h) => h.replace(/^\uFEFF/, '').trim());
  return rows
    .filter((r) => r.some((v) => String(v).trim() !== ''))
    .map((r) => {
      const o = {};
      head.forEach((k, idx) => {
        o[k] = (r[idx] || '').trim();
      });
      return o;
    });
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function parseDate(s) {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec((s || '').trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function isoDate(s) {
  const p = parseDate(s);
  if (!p) return '';
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

// —————————————— 抽查 ——————————————
const inspRows = parseCsv(fs.readFileSync(SRC_INSPECT, 'utf8'));
if (!inspRows.length) throw new Error('抽查表为空');

const batches = inspRows.length;
const noticeMap = new Map();
inspRows.forEach((r) => {
  const no = r.notice_no || '未编号';
  const hit = noticeMap.get(no) || {
    no,
    date: isoDate(r.publish_date),
    title: r.notice_title || '',
    count: 0,
  };
  hit.count += 1;
  noticeMap.set(no, hit);
});
const notices = noticeMap.size;

// 月度：按通告发布日期归月，缺月的补 0，横轴才连得上
const monthCount = new Map();
inspRows.forEach((r) => {
  const p = parseDate(r.publish_date);
  if (!p) return;
  monthCount.set(p.m, (monthCount.get(p.m) || 0) + 1);
});
const monthKeys = Array.from(monthCount.keys()).sort((a, b) => a - b);
const monthMin = monthKeys[0];
const monthMaxKey = monthKeys[monthKeys.length - 1];
const months = [];
for (let m = monthMin; m <= monthMaxKey; m += 1) {
  months.push({ label: `${m}月`, n: monthCount.get(m) || 0 });
}
const monthPeak = Math.max(...months.map((m) => m.n), 1);
months.forEach((m) => {
  m.h = Math.max(4, Math.round((m.n / monthPeak) * 100));
});

// 问题类型：占比按「不合格批次」算，不按通告期数算
const problemOrder = [
  '微生物污染',
  '食品添加剂超范围超限量使用',
  '其他指标',
  '农兽药残留',
  '重金属污染',
  '兽药残留',
  '质量指标',
];
const problemCount = new Map();
inspRows.forEach((r) => {
  const k = r.problem_type || '未归类';
  problemCount.set(k, (problemCount.get(k) || 0) + 1);
});
const problemPeak = Math.max(...Array.from(problemCount.values()), 1);
const problems = Array.from(problemCount.entries())
  .sort((a, b) => {
    const ia = problemOrder.indexOf(a[0]);
    const ib = problemOrder.indexOf(b[0]);
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return b[1] - a[1];
  })
  .map(([name, n], i) => ({
    key: `p${i}`,
    name,
    n,
    pct: round1((n / batches) * 100),
    w: Math.round((n / problemPeak) * 100),
  }));

// 抽样环节
const stageOrder = ['流通', '餐饮', '生产'];
const stageCount = new Map();
inspRows.forEach((r) => {
  const k = r.sample_stage || '未标注';
  stageCount.set(k, (stageCount.get(k) || 0) + 1);
});
const stages = Array.from(stageCount.entries())
  .sort((a, b) => {
    const ia = stageOrder.indexOf(a[0]);
    const ib = stageOrder.indexOf(b[0]);
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return b[1] - a[1];
  })
  .map(([name, n], i) => ({
    key: `s${i}`,
    name,
    n,
    pct: round1((n / batches) * 100),
  }));

// 关键食材：一格可能写「甘草、青橄榄」，拆开各记一次
const ingCount = new Map();
let tagged = 0;
inspRows.forEach((r) => {
  const raw = r['关键食材'] || '';
  if (!raw) return;
  tagged += 1;
  raw
    .split('、')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((name) => {
      ingCount.set(name, (ingCount.get(name) || 0) + 1);
    });
});
const ingredients = Array.from(ingCount.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([name, n]) => ({ name, n }));

const latest = Array.from(noticeMap.values())
  .sort((a, b) => (a.date < b.date ? 1 : -1))
  .slice(0, 3)
  .map((n) => {
    // 通告标题里写着这一期的全部批次数（如「18批次」），本表只收了能对上关键食材的明细，
    // 两个数都露出来，免得读者以为「标题 18 批、这里 16 条」是算错了
    const m = /(\d+)\s*批次/.exec(n.title);
    return {
      no: n.no,
      date: n.date.slice(5).replace('-', '/'),
      title: n.title.replace(/^广东省市场监督管理局关于/, ''),
      declared: m ? Number(m[1]) : 0,
      count: n.count,
    };
  });

// —————————————— 处罚 ——————————————
const penaltyRows = parseCsv(fs.readFileSync(SRC_PENALTY, 'utf8'));
const domainCount = { food: 0, other: 0, pending: 0 };
penaltyRows.forEach((r) => {
  if (r.domain === '食品') domainCount.food += 1;
  else if (r.domain === '非食品') domainCount.other += 1;
  else domainCount.pending += 1;
});

function amountOf(text) {
  const hits = [];
  const re = /([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*元/g;
  let m;
  while ((m = re.exec(text || ''))) {
    const v = Number(m[1].replace(/,/g, ''));
    if (Number.isFinite(v) && v >= 1000) hits.push(v);
  }
  return hits.length ? Math.max(...hits) : 0;
}

// 案由只保留决定书里能直接对上的事实，不替当事人下结论
const CASE_TEXT = {
  'P-4897127': {
    cause: '生产经营标注虚假生产日期的食品',
    basis: '《食品安全法》第三十四条第（十）项',
    tag: '标签日期',
  },
  'P-4892836': {
    cause: '检验检测机构出具不实检验报告',
    basis: '《检验检测机构监督管理办法》第十四条',
    tag: '检验机构',
  },
  'P-4960147': {
    cause: '直播宣称「无添加剂」，与配料表不符',
    basis: '《反不正当竞争法》第九条第一款',
    tag: '虚假宣传',
  },
};

const cases = penaltyRows
  .filter((r) => r.domain === '食品')
  .map((r) => {
    const meta = CASE_TEXT[r.penalty_id] || { cause: r.case_name, basis: '', tag: '食品安全' };
    const amount = amountOf(r.penalty_type);
    const date = isoDate(r.penalty_date) || isoDate(r.publish_date);
    return {
      doc: r.doc_no,
      date,
      cause: meta.cause,
      basis: meta.basis,
      tag: meta.tag,
      amount,
      action: amount ? `罚款 ${amount.toLocaleString('en-US')} 元` : '通报（决定书未列罚款金额）',
    };
  })
  .sort((a, b) => (a.date < b.date ? 1 : -1));

const foodAmount = cases.reduce((sum, c) => sum + (c.amount || 0), 0);
const foodMax = cases.reduce((m, c) => Math.max(m, c.amount || 0), 0);

const out = {
  version: 'fs-2026-11-18',
  scope: {
    region: '广东省',
    from: '2026-01',
    to: '2026-11',
    organ: '广东省市场监督管理局',
    inspectedNote: '只统计通告里的不合格批次，不含合格批次总量，因此不计算「合格率」。',
    penaltyNote: '处罚数据为决定书机器抽取，原文标注「待核验」。',
  },
  inspections: {
    batches,
    notices,
    months,
    problems,
    stages,
    ingredients,
    tagged,
    unmatched: batches - tagged,
    latest,
  },
  penalties: {
    total: penaltyRows.length,
    food: domainCount.food,
    other: domainCount.other,
    pending: domainCount.pending,
    amount: foodAmount,
    amountWan: round1(foodAmount / 10000),
    amountMax: foodMax,
    amountMaxWan: round1(foodMax / 10000),
    cases,
  },
};

const banner = `// data/foodSafety.js —— 由 scripts/build-food-safety.js 生成，请勿手改
// 源：knowledge/food-safety/inspections.csv（${batches} 行）、penalties.csv（${penaltyRows.length} 行）
`;
fs.writeFileSync(OUT, `${banner}module.exports = ${JSON.stringify(out, null, 2)};\n`);

console.log(
  `written data/foodSafety.js | 抽查 ${batches} 批 / ${notices} 期 · 问题 ${problems.length} 类 · 食材 ${ingredients.length} 个 · 食品类处罚 ${domainCount.food} 起 / ${out.penalties.amountWan} 万`
);
