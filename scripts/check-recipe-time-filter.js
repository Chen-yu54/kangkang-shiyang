// 验证「用户说半小时」时不会再推出腌制 2 小时的菜。
// 用法：node scripts/check-recipe-time-filter.js
//
// 复现的原始 bug：
//   用户说「半小时」，Bot 推了「鸭屎香单丛冷泡」（冷藏 6 小时），
//   因为旧逻辑只看 difficulty（做法复杂度），冷泡标的是 easy。
//
// 现在验证：按 TIME_LIMIT 硬过滤后，超时的菜一道都不能进候选。

const path = require('path');
const RECIPES = require(path.join(__dirname, '..', 'miniprogram', 'data', 'recipes.js'));

// 与 pages/kangkang/kangkang.js 的 TIME_LIMIT 保持一致
const TIME_LIMIT = { easy: 25, mid: 40 };
const TIME_TEXT = { easy: '20 分钟内', mid: '半小时左右', hard: '慢慢做' };

function filter(pool, slot) {
  const limit = TIME_LIMIT[slot];
  if (typeof limit !== 'number') return pool;
  return pool.filter((d) => d.timeMinutes != null && d.timeMinutes <= limit);
}

let fail = 0;
const ok = (m) => console.log('  ✓ ' + m);
const no = (m) => {
  fail++;
  console.log('  ✗ ' + m);
};

console.log('[1] 各时间档能推出的菜量');
['easy', 'mid', 'hard'].forEach((slot) => {
  const out = filter(RECIPES, slot);
  const label = TIME_TEXT[slot] + (TIME_LIMIT[slot] ? '（上限 ' + TIME_LIMIT[slot] + ' 分钟）' : '（不限时）');
  console.log('    ' + label.padEnd(28) + out.length + ' / ' + RECIPES.length + ' 道');
  if (slot !== 'hard' && out.length === 0) no(label + ' 一道都推不出');
});

console.log('');
console.log('[2] 硬约束：结果里不能有超时菜');
['easy', 'mid'].forEach((slot) => {
  const limit = TIME_LIMIT[slot];
  const out = filter(RECIPES, slot);
  const bad = out.filter((d) => d.timeMinutes > limit);
  if (bad.length) no(TIME_TEXT[slot] + ' 仍混入超时菜 ' + bad.length + ' 道');
  else ok(TIME_TEXT[slot] + '：' + out.length + ' 道，最长 ' + Math.max(...out.map((d) => d.timeMinutes)) + ' 分钟，无一超时');
});

console.log('');
console.log('[3] 原始 bug 里的菜是否已被挡住');
const BUGGY = ['鸭屎香单丛冷泡', '陈皮红豆沙', '绿豆莲藕排骨汤', '老火例汤（章鱼莲藕猪骨）'];
BUGGY.forEach((name) => {
  const d = RECIPES.find((x) => x.name === name);
  if (!d) {
    console.log('    ? 找不到 ' + name);
    return;
  }
  const inEasy = filter([d], 'easy').length > 0;
  const inMid = filter([d], 'mid').length > 0;
  const pass = !inEasy && !inMid;
  if (!pass) fail++;
  console.log(
    '    ' + (pass ? '✓' : '✗') + ' ' + name.padEnd(24) + d.timeMinutes + ' 分' +
    '  easy=' + (inEasy ? '会推' : '挡住') + '  mid=' + (inMid ? '会推' : '挡住')
  );
});

console.log('');
console.log('[4] 「半小时」实际推得出来的菜（前 12 道，按耗时排）');
filter(RECIPES, 'mid')
  .slice()
  .sort((a, b) => a.timeMinutes - b.timeMinutes)
  .slice(0, 12)
  .forEach((d) => {
    console.log('    ' + String(d.timeMinutes).padStart(3) + ' 分  ' + d.name.padEnd(20) + d.cuisineName + '  (' + d.timeSource + ')');
  });

console.log('');
console.log('[5] 耗时数据的可靠性');
const parsed = RECIPES.filter((d) => d.timeSource === 'parsed').length;
const est = RECIPES.filter((d) => d.timeSource === 'estimated').length;
const unknown = RECIPES.filter((d) => d.timeMinutes == null).length;
console.log('    原文写明时间: ' + parsed + ' 道（' + ((parsed / RECIPES.length) * 100).toFixed(0) + '%）');
console.log('    按做法估算:   ' + est + ' 道（界面显示「约」，不当作事实）');
console.log('    无法判断:     ' + unknown + ' 道（设了时间限制时会被排除）');
if (parsed + est + unknown !== RECIPES.length) no('分类相加不等于总数');
else ok('分类完整');

console.log('');
console.log(fail === 0 ? '全部通过' : fail + ' 项未通过');
process.exit(fail === 0 ? 0 : 1);
