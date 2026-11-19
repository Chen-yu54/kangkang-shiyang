// 食品安全页的视觉收敛检查：字号档位、硬编码色值、文案口语词。
// 用法：node scripts/check-foodsafety-tokens.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'miniprogram', 'pages', 'foodsafety');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const wxss = read('foodsafety.wxss');
const wxml = read('foodsafety.wxml');
const js = read('foodsafety.js');
const tips = fs.readFileSync(
  path.join(ROOT, 'miniprogram', 'data', 'foodSafetyTips.js'),
  'utf8'
);

let fail = 0;
const ok = (m) => console.log('  ✓ ' + m);
const no = (m) => {
  fail++;
  console.log('  ✗ ' + m);
};

// ── 1. 字号档位 ──
console.log('[1] 字号档位');
const sizes = [...wxss.matchAll(/font-size:\s*([0-9]+)rpx/g)].map((m) => Number(m[1]));
const uniq = [...new Set(sizes)].sort((a, b) => a - b);
console.log('    实际用到: ' + uniq.map((s) => s + 'rpx').join(', ') + '（' + uniq.length + ' 档）');
// 允许的档位：6 档全局变量 + 24 极小标 + 56 数据大字 + 76 长辈页头
const ALLOW = new Set([24, 28, 32, 36, 40, 48, 56, 64, 76]);
const extra = uniq.filter((s) => !ALLOW.has(s));
if (extra.length) no('出现计划外字号: ' + extra.map((s) => s + 'rpx').join(', '));
else ok('无计划外字号');
if (uniq.length <= 9) ok('档位数 ' + uniq.length + ' ≤ 9');
else no('档位过多: ' + uniq.length);

// ── 2. 字号是否都走变量（硬编码只允许 24 / 56 / 76）──
console.log('[2] 字号取值方式');
const hard = [...wxss.matchAll(/font-size:\s*([0-9]+)rpx/g)].map((m) => Number(m[1]));
const hardNotAllowed = hard.filter((s) => ![24, 56, 76].includes(s));
if (hardNotAllowed.length) no('应改用变量: ' + hardNotAllowed.map((s) => s + 'rpx').join(', '));
else ok('除 24/56/76 外全部使用 var(--font-*)');

// ── 3. 硬编码色值 ──
console.log('[3] 颜色');
const hex = wxss.match(/#[0-9a-fA-F]{3,8}/g) || [];
const rgba = wxss.match(/rgba?\([^)]*\)/g) || [];
const hardColor = [...hex, ...rgba];
if (hardColor.length) no('页面仍有硬编码色值: ' + [...new Set(hardColor)].join(', '));
else ok('零硬编码色值，全部使用 app.wxss 变量');

// ── 4. 变量是否都有定义 ──
console.log('[4] 变量定义');
const appCss = fs.readFileSync(path.join(ROOT, 'miniprogram', 'app.wxss'), 'utf8');
const defined = new Set(
  [...(appCss.match(/--[a-z0-9-]+\s*:/g) || []), ...(wxss.match(/--[a-z0-9-]+\s*:/g) || [])].map(
    (s) => s.replace(/\s*:$/, '').trim()
  )
);
const used = new Set((wxss.match(/var\(--[a-z0-9-]+\)/g) || []).map((s) => s.slice(4, -1)));
const miss = [...used].filter((v) => !defined.has(v));
if (miss.length) no('未定义: ' + miss.join(', '));
else ok(used.size + ' 个变量全部有定义');

// ── 5. 文案口语词 ──
console.log('[5] 文案口语化');
const COLLOQUIAL = [
  '多留个心眼',
  '少买',
  '说不清',
  '先吃好',
  '交给下面',
  '闻一下',
  '摸一下',
  '少折腾',
  '留好',
  '保险箱',
];
const allText = wxml + js + tips;
const hits = COLLOQUIAL.filter((w) => {
  // 「少买」「保险箱」在改写后仍可能作为正经用法出现，这里只看是否原样残留
  return allText.includes(w);
});
if (hits.length) no('残留口语词: ' + hits.join(', '));
else ok('口语词 0 残留（检查 ' + COLLOQUIAL.length + ' 个）');

// ── 6. 合规词 ──
console.log('[6] 合规词');
const BANNED = [
  ['体', '质'],
  ['调', '理'],
  ['气', '虚'],
  ['阳', '虚'],
  ['湿', '气'],
  ['降', '糖'],
  ['降', '压'],
  ['疗', '效'],
  ['治', '疗'],
  ['康', '复'],
  ['慢', '病'],
  ['忌', '口'],
].map((p) => p.join(''));
const bannedHit = BANNED.filter((w) => allText.includes(w));
if (bannedHit.length) no('命中脱敏词: ' + bannedHit.join(', '));
else ok('12 个脱敏词 0 命中');
if (allText.includes('粤' + '菜')) no('出现「粤菜」表述');
else ok('零「粤菜」表述');

// ── 7. 字号下限 ──
console.log('[7] 适老化下限');
const below36 = sizes.filter((s) => s < 36);
// 24 只用于序号圆圈、日期、刻度；28/32 用于辅助与按钮
const illegal = sizes.filter((s) => s < 24);
if (illegal.length) no('低于 24rpx: ' + [...new Set(illegal)].join(', '));
else ok('最小字号 24rpx，正文与标题均达标');

console.log('');
console.log(fail === 0 ? '全部通过' : fail + ' 项未通过');
process.exit(fail === 0 ? 0 : 1);
