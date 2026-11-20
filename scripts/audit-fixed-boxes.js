// 找出可能被大字号撑破的固定尺寸容器。
// 用法：node scripts/audit-fixed-boxes.js
//
// 判断依据：容器写死了 height / max-height，而它里面又有文字。
// 长者模式 1.6 倍下，36rpx 的正文变 57.6rpx，两行就从 126rpx 涨到 202rpx，
// 固定高度区会截断或溢出。min-height 不算问题，那是弹性的。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'miniprogram');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.wxss')) out.push(p);
  }
  return out;
}

const hits = [];

for (const f of walk(ROOT)) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const lines = fs.readFileSync(f, 'utf8').split('\n');

  let selectors = [];
  let inBlock = false;

  lines.forEach((ln, i) => {
    const open = ln.indexOf('{');
    const close = ln.indexOf('}');

    if (open >= 0) {
      selectors = [ln.slice(0, open).trim()];
      inBlock = true;
    }

    if (inBlock) {
      // 只抓固定 height，不抓 min-height
      const m = /(^|[^-])height:\s*([0-9.]+)rpx/.exec(ln);
      if (m) {
        const h = Number(m[2]);
        // 小于 88rpx 的多半是图标、圆点、进度条，不是文字容器
        if (h >= 88) {
          hits.push({
            file: rel,
            line: i + 1,
            h,
            sel: selectors.join(' ').slice(0, 46),
          });
        }
      }
    }

    if (close >= 0) {
      inBlock = false;
    }
  });
}

console.log('=== 固定高度 >= 88rpx 的容器：' + hits.length + ' 处 ===');
console.log('');

// 按文件聚合
const perFile = {};
hits.forEach((h) => {
  perFile[h.file] = perFile[h.file] || [];
  perFile[h.file].push(h);
});

Object.keys(perFile)
  .sort((a, b) => perFile[b].length - perFile[a].length)
  .forEach((f) => {
    console.log('  ' + f + '  （' + perFile[f].length + ' 处）');
    perFile[f].slice(0, 6).forEach((h) => {
      console.log('      L' + String(h.line).padStart(4) + '  height: ' + String(h.h).padStart(3) + 'rpx   ' + h.sel);
    });
  });

console.log('');
console.log('提示：这些不是必须改。只有「容器里有会换行的文字」才需要处理，');
console.log('      图标位、纯图形卡可以保持固定高度。');
