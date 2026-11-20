// 验证 C 版主题 + 朱砂强调后的对比度。
// 用法：node scripts/check-theme-contrast.js
//
// 为什么要单独跑：把 --color-green 从 #3f7a45 换成 #b5482a 之后，
// 所有「绿底绿字」「浅绿底深绿字」的组合都变了。
// 视觉上看着都对，但白字压朱砂、深朱砂压浅朱砂这类搭配必须实测。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'miniprogram', 'app.wxss');

function loadVars(file) {
  const css = fs.readFileSync(file, 'utf8');
  const out = {};
  const re = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let m;
  while ((m = re.exec(css))) out['--' + m[1]] = m[2];
  return out;
}
const V = loadVars(APP);

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
function ratio(a, b) {
  const x = lum(a);
  const y = lum(b);
  const hi = Math.max(x, y);
  const lo = Math.min(x, y);
  return (hi + 0.05) / (lo + 0.05);
}

// 颜色 Token 组合：主题换过之后必须逐条验
const PAIRS = [
  ['主文字 on 底', '--color-ink', '--color-bg'],
  ['正文 on 底', '--color-ink-2', '--color-bg'],
  ['次文字 on 底', '--color-ink-3', '--color-bg'],
  ['主文字 on 卡', '--color-ink', '--color-card'],
  ['正文 on 卡', '--color-ink-2', '--color-card'],
  ['次文字 on 卡', '--color-ink-3', '--color-card'],
  ['次文字 on 浅底', '--color-ink-3', '--color-bg-soft'],
  ['白字 on 强调', '#FFFFFF', '--color-green'],
  ['白字 on 强调深', '#FFFFFF', '--color-green-deep'],
  ['强调字 on 卡', '--color-green', '--color-card'],
  ['强调字 on 浅强调底', '--color-green-ink', '--color-green-bg'],
  ['强调字 on 浅强调底2', '--color-green-ink', '--color-green-soft'],
  ['强调字 on 底', '--color-green', '--color-bg'],
  ['朱砂 on 卡', '--color-flame', '--color-card'],
  ['朱砂 on 底', '--color-flame', '--color-bg'],
  ['白字 on 朱砂', '#FFFFFF', '--color-flame'],
];

let fail = 0;
console.log('[主题对比度] 阈值 4.5:1');
console.log('');
PAIRS.forEach(([name, fgKey, bgKey]) => {
  const fg = V[fgKey] || fgKey;
  const bg = V[bgKey] || bgKey;
  if (!fg || !bg) {
    console.log('  ??  ' + name + '：变量缺值');
    fail++;
    return;
  }
  const r = ratio(fg, bg);
  const pass = r >= 4.5;
  if (!pass) fail++;
  console.log('  ' + (pass ? '✓' : '✗') + '  ' + name.padEnd(22) + r.toFixed(2) + '   ' + fg + ' on ' + bg);
});

console.log('');
console.log('[语义色] 不参与收敛，仅记录当前值：');
['--color-spring', '--color-summer', '--color-autumn', '--color-winter', '--cuisine-guangfu', '--color-seal', '--color-gold'].forEach((k) => {
  if (V[k]) console.log('  ' + k.padEnd(20) + V[k]);
});

console.log('');
console.log(fail === 0 ? '全部通过' : fail + ' 项未通过');
process.exit(fail === 0 ? 0 : 1);
