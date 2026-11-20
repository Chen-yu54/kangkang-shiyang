// 审计全工程的字号与字体族使用情况。
// 用法：node scripts/audit-type-scale.js
//
// 背景：字号缩放只覆盖 5 个 CSS 变量（--font-base/title/btn/subtitle/caption），
// 由 app.js 的 getFontStyle() 注入 page-meta。凡是写死 font-size: NNrpx 的地方，
// 用户切到大字体或长者模式时都不会跟着放大 —— 一页里两套字号各说各话。
//
// 这个脚本把「不参与缩放」的地方全列出来，作为整改清单。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'miniprogram');
const VARIABLES = new Set([
  '--font-base',
  '--font-title',
  '--font-btn',
  '--font-subtitle',
  '--font-caption',
  '--font-micro',
  '--font-tiny',
  '--font-display',
  '--font-icon',
  '--font-serif',
  '--font-sans',
  '--font-heading',
]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.wxss')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const hardcoded = [];
const byVar = {};
let varCount = 0;

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((ln, i) => {
    // font-size 用变量的
    const vm = /font-size:\s*var\((--font-[a-z-]+)\)/.exec(ln);
    if (vm) {
      varCount++;
      byVar[vm[1]] = (byVar[vm[1]] || 0) + 1;
      return;
    }
    // font-size 写死数字的
    const hm = /font-size:\s*([0-9.]+)rpx/.exec(ln);
    if (hm) {
      hardcoded.push({ file: rel, line: i + 1, size: Number(hm[1]), text: ln.trim() });
    }
  });
}

console.log('=== 字号使用情况 ===');
console.log('  走变量（参与缩放）: ' + varCount + ' 处');
Object.keys(byVar)
  .sort((a, b) => byVar[b] - byVar[a])
  .forEach((k) => {
    const scaled = ['--font-base', '--font-title', '--font-btn', '--font-subtitle', '--font-caption', '--font-micro', '--font-tiny'].indexOf(k) >= 0;
    console.log('    ' + k.padEnd(18) + String(byVar[k]).padStart(4) + ' 处' + (scaled ? '' : '   ← 不随缩放变'));
  });
console.log('');
console.log('  写死数字（不参与缩放）: ' + hardcoded.length + ' 处');

// 按文件聚合
const perFile = {};
hardcoded.forEach((h) => {
  perFile[h.file] = perFile[h.file] || { n: 0, sizes: new Set() };
  perFile[h.file].n++;
  perFile[h.file].sizes.add(h.size);
});

const sorted = Object.keys(perFile).sort((a, b) => perFile[b].n - perFile[a].n);
console.log('');
console.log('=== 按文件（前 20）===');
sorted.slice(0, 20).forEach((f) => {
  const s = [...perFile[f].sizes].sort((a, b) => a - b).join('/');
  console.log('  ' + String(perFile[f].n).padStart(3) + ' 处  ' + f.padEnd(44) + s + 'rpx');
});

// 按字号聚合，看看哪些尺寸最该改成变量
const perSize = {};
hardcoded.forEach((h) => {
  perSize[h.size] = (perSize[h.size] || 0) + 1;
});
console.log('');
console.log('=== 按字号 ===');
Object.keys(perSize)
  .map(Number)
  .sort((a, b) => a - b)
  .forEach((s) => {
    const hint = s === 24 ? '（极小标，可不缩放）' : s === 56 ? '（数据大字）' : s === 76 ? '（长辈页头）' : '';
    console.log('  ' + String(s).padStart(4) + 'rpx  ' + String(perSize[s]).padStart(4) + ' 处' + hint);
  });

// 字体族检查
console.log('');
console.log('=== 字体族 ===');
const fam = {};
files.forEach((f) => {
  const c = fs.readFileSync(f, 'utf8');
  const re = /font-family:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(c))) {
    const v = m[1].trim();
    fam[v] = (fam[v] || 0) + 1;
  }
});
Object.keys(fam)
  .sort((a, b) => fam[b] - fam[a])
  .forEach((k) => console.log('  ' + String(fam[k]).padStart(4) + ' 处  ' + k.slice(0, 60)));
