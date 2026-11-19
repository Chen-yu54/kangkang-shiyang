// 食品安全页的配色可读性检查：把 wxss 里「文字色 / 底色」的搭配抽出来算对比度。
// 用法：node scripts/check-foodsafety-contrast.js
//
// 为什么单独校验：这一页的配色从「墨绿为主」改成「暖色为主」，
// 金棕（--color-gold #b8863b）在米黄底上只有 2.84:1，不能做文字，
// 只能做条形图形。靠肉眼看不出来，必须算。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WXSS = path.join(ROOT, 'miniprogram', 'pages', 'foodsafety', 'foodsafety.wxss');
const APPCSS = path.join(ROOT, 'miniprogram', 'app.wxss');

// ── 取变量实际值 ──
function loadVars(file) {
  const css = fs.readFileSync(file, 'utf8');
  const out = {};
  const re = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let m;
  while ((m = re.exec(css))) out['--' + m[1]] = m[2];
  return out;
}
const VARS = Object.assign(loadVars(APPCSS), loadVars(WXSS));

// 页面默认底色
const PAGE_BG = VARS['--color-bg'] || '#f7f0e1';
const CARD_BG = VARS['--color-card'] || '#fbf7ea';

// ── 对比度 ──
function toRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16) / 255);
}
function lum(hex) {
  const [r, g, b] = toRgb(hex).map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(fg, bg) {
  const a = lum(fg);
  const b = lum(bg);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

// ── 逐条列「元素 / 字色 / 底色」——手写声明，改样式时同步这里 ──
// 底为 null 表示落在页面底色（--color-bg）上
const PAIRS = [
  ['head-kicker', '--color-ink-2', '--color-border-hair'],
  ['hero-kicker', '--color-flame', '--color-card'],
  ['hero-title', '--color-ink', '--color-card'],
  ['hero-text', '--color-ink-2', '--color-card'],
  ['step-t', '--color-ink', '--color-border-hair'],
  ['step-d', '--color-ink-3', '--color-border-hair'],
  ['hero-cta', '--color-on-brand', '--color-flame'],
  ['hero-sub', '--color-ink-3', '--color-card'],
  ['sec-no', '--color-on-brand', '--color-flame'],
  ['sec-title', '--color-ink', null],
  ['sec-intro', '--color-ink-2', null],
  ['sec-foot', '--color-ink-3', null],
  ['subhead', '--color-ink', null],
  ['oneline-t', '--color-flame', '--color-card'],
  ['oneline-b', '--color-ink', '--color-card'],
  ['ov-num', '--color-ink', '--color-card'],
  ['ov-label', '--color-ink-3', '--color-card'],
  ['bar-name', '--color-ink-2', null],
  ['bar-val', '--color-ink-3', null],
  ['chip', '--color-ink-2', '--color-card'],
  ['chip-n', '--color-ink-3', '--color-card'],
  ['ing-name', '--color-ink', '--color-card'],
  ['ing-n', '--color-flame', '--color-card'],
  ['ing-tip', '--color-ink-2', '--color-card'],
  ['fold-title', '--color-ink-2', '--color-card'],
  ['fold-note', '--color-ink-3', '--color-card'],
  ['take-n', '--color-flame', '--color-card'],
  ['take-t', '--color-ink', '--color-card'],
  ['take-d', '--color-ink-2', '--color-card'],
  ['check-no', '--color-on-brand', '--color-flame'],
  ['check-t', '--color-ink', '--color-card'],
  ['check-d', '--color-ink-2', '--color-card'],
  ['notice-no', '--color-ink-3', '--color-card'],
  ['notice-title', '--color-ink', '--color-card'],
  ['notice-count', '--color-flame', '--color-card'],
  ['case-doc', '--color-ink-3', '--color-card'],
  ['case-amount', '--color-flame', '--color-card'],
  ['case-cause', '--color-ink', '--color-card'],
  ['case-k', '--color-ink-3', '--color-card'],
  ['case-v', '--color-ink-2', '--color-card'],
  ['case-tag', '--color-flame', '--color-card'],
  ['case-date', '--color-ink-3', '--color-card'],
  ['notes-title', '--color-ink', '--color-card'],
  ['notes-item', '--color-ink-2', '--color-card'],
];

// 只做图形、不做文字的色（不算对比度）
const GRAPHIC_ONLY = ['--color-gold'];

console.log('[配色可读性] 阈值 4.5:1（正文），3:1（≥24px 大字）');
console.log('');

let fail = 0;
PAIRS.forEach(([name, fgKey, bgKey]) => {
  const fg = VARS[fgKey];
  const bg = bgKey ? VARS[bgKey] : PAGE_BG;
  if (!fg || !bg) {
    console.log('  ??  ' + name + '：变量缺值 ' + fgKey + ' / ' + (bgKey || 'page-bg'));
    fail++;
    return;
  }
  const r = ratio(fg, bg);
  const pass = r >= 4.5;
  if (!pass) fail++;
  console.log(
    '  ' + (pass ? '✓' : '✗') + '  ' + name.padEnd(16) + r.toFixed(2) + '   ' + fg + ' on ' + bg
  );
});

console.log('');
console.log('[仅图形色] 不参与文字对比度：');
GRAPHIC_ONLY.forEach((k) => {
  if (VARS[k]) {
    console.log('  ' + k + ' = ' + VARS[k] + '（在米黄底 ' + ratio(VARS[k], PAGE_BG).toFixed(2) + ':1，用于条形）');
  }
});

// 绿色是否已全部撤出
const css = fs.readFileSync(WXSS, 'utf8');
console.log('');
if (/--color-green/.test(css)) {
  console.log('  ✗ 仍有 --color-green，与「暖色为主」的口径不符');
  fail++;
} else {
  console.log('  ✓ 已无 --color-green，配色全部落在暖色区间');
}

console.log('');
console.log(fail === 0 ? '全部通过' : fail + ' 项未通过');
process.exit(fail === 0 ? 0 : 1);
