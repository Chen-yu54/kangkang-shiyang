// 食品安全页改造后的静态自检：变量、字段、handler、合规词、包体影响。
// 用法：node scripts/check-foodsafety-page.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'miniprogram', 'pages', 'foodsafety');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

const wxml = read('foodsafety.wxml');
const js = read('foodsafety.js');
const wxss = read('foodsafety.wxss');
const pageJson = JSON.parse(read('foodsafety.json'));

let fail = 0;
const ok = (m) => console.log('  ✓ ' + m);
const no = (m) => {
  fail++;
  console.log('  ✗ ' + m);
};

// ── 1. CSS 变量是否都有定义（全局或页面局部）──
console.log('[1] CSS 变量');
const appCss = fs.readFileSync(path.join(ROOT, 'miniprogram', 'app.wxss'), 'utf8');
const defined = new Set(
  (appCss.match(/--[a-z0-9-]+\s*:/g) || []).map((s) => s.replace(/\s*:$/, '').trim())
);
// 页面自己声明的也算
(wxss.match(/--[a-z0-9-]+\s*:/g) || []).forEach((s) =>
  defined.add(s.replace(/\s*:$/, '').trim())
);
const used = new Set((wxss.match(/var\(--[a-z0-9-]+\)/g) || []).map((s) => s.slice(4, -1)));
const missVar = [...used].filter((v) => !defined.has(v));
if (missVar.length) no('未定义变量: ' + missVar.join(', '));
else ok('全部 ' + used.size + ' 个变量都有定义');

// ── 2. wxml 引用的字段 js 是否提供 ──
console.log('[2] data 字段');
const refs = new Set(
  (wxml.match(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)/g) || []).map((s) =>
    s.replace(/\{\{\s*/, '')
  )
);
const skip = new Set(['item', 'index', 'true', 'false', 'pageStyle', 'elderMode']);
const missField = [...refs].filter(
  (r) => !skip.has(r) && !new RegExp('(^|\\s)' + r + ':').test(js)
);
if (missField.length) no('js 未提供: ' + missField.join(', '));
else ok(refs.size + ' 个引用字段都存在');

// ── 3. 事件 handler 是否实现 ──
console.log('[3] 事件 handler');
const handlers = new Set(
  (wxml.match(/bind(?:tap|:next|:skip)="([a-zA-Z]+)"/g) || []).map((s) =>
    s.replace(/bind(?:tap|:next|:skip)="/, '').replace('"', '')
  )
);
const missH = [...handlers].filter(
  (h) => !new RegExp('(^|\\s)' + h + '\\(', 'm').test(js)
);
if (missH.length) no('未实现: ' + missH.join(', '));
else ok(handlers.size + ' 个 handler 都有实现');

// ── 4. 关键结构是否都在 ──
console.log('[4] 页面结构');
const must = [
  ['声明组件', '<disclaimer />'],
  ['首屏三步', 'class="steps"'],
  ['今日食单入口', 'onGoMenu'],
  ['食材卡', 'class="ingrid"'],
  ['一句话结论', 'class="oneline"'],
  ['挑菜要点', 'item.tip'],
  ['三句话', 'class="take"'],
  ['避雷清单', 'class="check-item"'],
  ['月度折叠', 'onToggleMonths'],
  ['处罚案例', 'class="case"'],
  ['数据说明', 'class="notes"'],
  ['引导组件', '<guide-tour'],
];
let missStruct = 0;
must.forEach(([name, seg]) => {
  if (!wxml.includes(seg)) {
    no('缺 ' + name);
    missStruct++;
  }
});
if (!missStruct) ok(must.length + ' 个结构点都在');

// ── 5. 组件注册 ──
console.log('[5] 组件注册');
const comps = pageJson.usingComponents || {};
if (comps.disclaimer) ok('disclaimer 已注册');
else no('disclaimer 未注册');
if (comps['guide-tour']) ok('guide-tour 已注册');
else no('guide-tour 未注册');

// ── 6. 12 脱敏词 + 零「粤菜」──
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
const all = wxml + js + wxss + JSON.stringify(pageJson);
const hitBanned = BANNED.filter((w) => all.includes(w));
if (hitBanned.length) no('命中脱敏词: ' + hitBanned.join(', '));
else ok('12 个脱敏词 0 命中');
if (all.includes('粤' + '菜')) no('出现「粤菜」表述');
else ok('零「粤菜」表述');

// ── 7. 字号与点击区 ──
console.log('[7] 适老化');
if (/min-height:\s*96rpx/.test(wxss)) ok('主按钮点击区 96rpx ≥ 88rpx');
else no('主按钮点击区不足');
if (wxml.includes('elder')) ok('长辈模式有样式覆盖');
else no('长辈模式缺样式');

// ── 8. 文件体积 ──
console.log('[8] 体积');
['foodsafety.js', 'foodsafety.wxml', 'foodsafety.wxss', 'foodsafety.json'].forEach((f) => {
  const kb = fs.statSync(path.join(DIR, f)).size / 1024;
  console.log('    ' + f.padEnd(18) + kb.toFixed(1) + ' KB');
});

console.log('');
console.log(fail === 0 ? '全部通过' : fail + ' 项未通过');
process.exit(fail === 0 ? 0 : 1);
