// 把 miniprogram/data/foodSafety.js 导出成 JSON，供生成 HTML 用。
//
// 为什么单独写这个：HTML 是单文件、零依赖，数据必须内联进去，
// 所以要在构建时把 .js 模块转成纯 JSON 文本。
//
// 用法：node scripts/export-foodsafety.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'miniprogram', 'data', 'foodSafety.js');
const OUT = path.join(ROOT, 'docs', 'foodsafety.data.json');

if (!fs.existsSync(SRC)) {
  console.error('[export-foodsafety] 找不到 ' + SRC);
  process.exit(1);
}

const data = require(SRC);

const dir = path.dirname(OUT);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 2), 'utf8');

const i = data.inspections || {};
const p = data.penalties || {};
console.log('[export-foodsafety] 已输出 → ' + path.relative(ROOT, OUT));
console.log('[export-foodsafety] 抽检 ' + i.batches + ' 批次 / 通告 ' + i.notices + ' 份');
console.log('[export-foodsafety] 问题类型 ' + (i.problems || []).length + ' 类 / 环节 ' + (i.stages || []).length + ' 类');
console.log('[export-foodsafety] 食材 ' + (i.ingredients || []).length + ' 种 / 最新通告 ' + (i.latest || []).length + ' 条');
console.log('[export-foodsafety] 处罚 ' + p.total + ' 条（已归档 ' + p.listed + '，金额 ' + p.amountWan + ' 万元）');
