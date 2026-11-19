// 从 recipes.js 的 how 文本里解析真实总耗时。
// 用法：node scripts/analyze-recipe-time.js
//
// 背景：difficulty 只表示做法复杂度（快手/慢炖/费工），
// 不代表总耗时——「鸭屎香冷泡」做法极简，但要冷藏 6 小时，
// 结果 difficulty=easy，用户说「半小时」时被推荐出去。这是本脚本要定位的问题。
//
// 注意：正则不能复用带 g 的实例做 test()，lastIndex 会累积导致漏判。

const path = require('path');
const RECIPES = require(path.join(__dirname, '..', 'miniprogram', 'data', 'recipes.js'));

const RE_HOUR = /(\d+(?:\.\d+)?)\s*(?:[-–~至]\s*(\d+(?:\.\d+)?))?\s*(?:个)?小时/;
const RE_MIN = /(\d+)\s*(?:[-–~至]\s*(\d+))?\s*分钟/;
const RE_SEC = /(\d+)\s*秒/;
const RE_HALF = /半小时/;

/**
 * 解析 how 文本里的总耗时（分钟）。
 * 多段时间累加：如「浸2小时，煲1.5小时」= 210 分钟。
 * 解析不出返回 null——不猜。
 */
function parseMinutes(text) {
  const s = String(text || '');
  let total = 0;
  let hit = false;

  // 小时（多段累加，必须用循环 + 非全局副本重建）
  const hours = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(?:[-–~至]\s*(\d+(?:\.\d+)?))?\s*(?:个)?小时/g)];
  hours.forEach((m) => {
    const a = parseFloat(m[1]);
    const b = m[2] ? parseFloat(m[2]) : a;
    total += ((a + b) / 2) * 60;
    hit = true;
  });

  const halfs = [...s.matchAll(/半小时/g)];
  halfs.forEach(() => {
    total += 30;
    hit = true;
  });

  const mins = [...s.matchAll(/(\d+)\s*(?:[-–~至]\s*(\d+))?\s*分钟/g)];
  mins.forEach((m) => {
    const a = parseInt(m[1], 10);
    const b = m[2] ? parseInt(m[2], 10) : a;
    total += (a + b) / 2;
    hit = true;
  });

  const secs = [...s.matchAll(/(\d+)\s*秒/g)];
  secs.forEach((m) => {
    total += parseInt(m[1], 10) / 60;
    hit = true;
  });

  return hit ? Math.round(total) : null;
}

module.exports = { parseMinutes };

if (require.main === module) {
  const buckets = { '≤15 分': 0, '15-30 分': 0, '30-60 分': 0, '1-2 小时': 0, '≥2 小时': 0 };
  const conflict = [];
  let parsed = 0;

  RECIPES.forEach((r) => {
    const t = parseMinutes(r.how);
    if (t === null) return;
    parsed++;
    if (t <= 15) buckets['≤15 分']++;
    else if (t <= 30) buckets['15-30 分']++;
    else if (t <= 60) buckets['30-60 分']++;
    else if (t <= 120) buckets['1-2 小时']++;
    else buckets['≥2 小时']++;

    if (r.difficulty === 'easy' && t > 30) conflict.push({ ...r, t });
  });

  console.log('总条数: ' + RECIPES.length);
  console.log('能解析出耗时: ' + parsed + '（' + ((parsed / RECIPES.length) * 100).toFixed(0) + '%）');
  console.log('解析不出: ' + (RECIPES.length - parsed));
  console.log('');
  console.log('耗时分档:');
  Object.keys(buckets).forEach((k) => console.log('  ' + k.padEnd(10) + String(buckets[k]).padStart(3) + ' 道'));
  console.log('');
  console.log('【矛盾样本】difficulty=easy 但实际耗时 > 30 分钟：' + conflict.length + ' 道');
  conflict
    .sort((a, b) => b.t - a.t)
    .slice(0, 15)
    .forEach((x) => {
      console.log('  ' + String(x.t).padStart(4) + ' 分  ' + x.name);
      console.log('          ' + x.how.slice(0, 66));
    });
}
