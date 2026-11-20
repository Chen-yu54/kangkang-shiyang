// 诊断：完整跑一遍 solarterm 页面的 onLoad + onTapTerm，看详情数据是否齐全。
// 用法：node scripts/diagnose-solarterm.js
//
// 为什么要这么测：单个 utils 都正常，但页面把十几个 utils 串起来，
// 任何一环抛异常都会让 setData 中断，表现就是「点了没反应」。

const path = require('path');

// ── mock 小程序运行环境 ──
const storage = {};
global.wx = {
  getStorageSync: (k) => storage[k] || '',
  setStorageSync: (k, v) => {
    storage[k] = v;
  },
  getStorageInfoSync: () => ({ keys: Object.keys(storage) }),
  request: () => {},
  cloud: null,
  navigateTo: () => {},
  getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2 }),
  createSelectorQuery: () => ({ select: () => ({ boundingClientRect: () => ({ exec: () => {} }) }) }),
};
global.getApp = () => ({
  globalData: {},
  getFontStyle: () => '',
  getElderMode: () => false,
});

const PAGE = path.join(__dirname, '..', 'miniprogram', 'pages', 'solarterm', 'solarterm.js');

let captured = null;
global.Page = (o) => {
  captured = o;
};
global.Component = () => {};

require(PAGE);
if (!captured) {
  console.error('未能捕获 Page 定义');
  process.exit(1);
}

// 给页面实例接上 setData
const page = captured;
page.data = JSON.parse(JSON.stringify(page.data || {}));
const setDataLog = [];
page.setData = function (d, cb) {
  Object.keys(d).forEach((k) => {
    page.data[k] = d[k];
    setDataLog.push(k);
  });
  if (typeof cb === 'function') cb();
};

(async () => {
  console.log('');
  console.log('[1] onLoad');
  try {
    page.onLoad({ term: encodeURIComponent('立冬') });
    console.log('    setData 写入的键: ' + setDataLog.join(', '));
    console.log('    status: ' + page.data.status);
  } catch (e) {
    console.log('    ✗ 抛异常: ' + e.message);
    console.log(e.stack.split('\n').slice(0, 4).join('\n'));
    process.exit(1);
  }

  // loadTerms 是异步的，等它跑完
  await new Promise((r) => setTimeout(r, 800));
  console.log('');
  console.log('[2] loadTerms 之后');
  console.log('    status: ' + page.data.status);
  console.log('    terms: ' + (page.data.terms || []).length + ' 条');
  console.log('    view: ' + page.data.view);
  console.log('    detail: ' + (page.data.detail ? page.data.detail.name : 'null'));

  // 如果 pendingTerm 没自动展开，手动模拟一次点击
  if (page.data.view !== 'detail') {
    console.log('');
    console.log('[3] view 仍是 list，手动触发 onTapTerm');
  } else {
    console.log('');
    console.log('[3] pendingTerm 已自动展开详情');
  }

  setDataLog.length = 0;
  try {
    page.onTapTerm({ detail: { name: '立冬' } });
  } catch (e) {
    console.log('    ✗ onTapTerm 抛异常: ' + e.message);
    console.log(e.stack.split('\n').slice(0, 5).join('\n'));
    process.exit(1);
  }

  console.log('    setData 写入: ' + setDataLog.join(', '));
  console.log('');
  console.log('[4] 详情数据完整性');
  const d = page.data.detail;
  if (!d) {
    console.log('    ✗ detail 为 null —— 详情区整块不会渲染');
  } else {
    ['name', 'intro', 'slogan', 'aura', 'windowText'].forEach((k) => {
      const v = d[k];
      console.log('    ' + (v ? '✓' : '✗') + ' ' + k.padEnd(14) + String(v || '').slice(0, 34));
    });
    ['poem', 'phenologyList', 'folk', 'ingredientDetails'].forEach((k) => {
      const v = d[k];
      const n = Array.isArray(v) ? v.length : v ? 1 : 0;
      console.log('    ' + (n ? '✓' : '✗') + ' ' + k.padEnd(14) + n + ' 项');
    });
  }

  await new Promise((r) => setTimeout(r, 500));
  console.log('');
  console.log('[5] 其他状态');
  console.log('    view:        ' + page.data.view);
  console.log('    bg:          ' + (page.data.bg ? '有（style ' + String(page.data.bg.style).length + ' 字符）' : 'null'));
  console.log('    health:      ' + (page.data.health ? '有' : 'null'));
  console.log('    detailPoster:' + (page.data.detailPoster || '空'));
  console.log('    dishStatus:  ' + page.data.dishStatus);
  console.log('    dishes:      ' + (page.data.dishes || []).length + ' 道');

  const ok = d && d.intro && page.data.view === 'detail';
  console.log('');
  console.log(ok ? '结论：详情数据齐全，页面应该能正常显示' : '结论：详情加载有问题，看上面标 ✗ 的项');
})();
