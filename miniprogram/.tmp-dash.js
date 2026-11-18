let cfg = null;
const store = {};
global.wx = {
  getStorageSync: (k) => store[k],
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: () => {},
  stopPullDownRefresh: () => {},
  createIntersectionObserver: () => ({
    relativeToViewport() { return this; },
    observe() { return this; },
    disconnect() {},
  }),
  showToast: () => {}, navigateTo: () => {}, switchTab: () => {}, pageScrollTo: () => {},
};
global.getApp = () => ({
  globalData: { tour: null, autoRunGen: false },
  getFontStyle: () => '',
  getElderMode: () => false,
  getTermInfo: () => ({ name: '立冬', poster: '', dateText: '11月18日' }),
  tourStateOf: () => ({ visible: false, step: null, index: 0, total: 0 }),
  getUser: () => ({}),
});
global.getCurrentPages = () => [{}];
global.Page = (c) => { cfg = c; };
require(process.cwd() + '/pages/index/index.js');

const page = Object.assign({}, cfg, {
  data: JSON.parse(JSON.stringify(cfg.data)),
  setData(p, cb) {
    Object.keys(p).forEach((k) => {
      if (k.indexOf('.') > -1) {
        const [a, b] = k.split('.');
        this.data[a] = this.data[a] || {};
        this.data[a][b] = p[k];
      } else this.data[k] = p[k];
    });
    if (cb) cb();
  },
});
page.onLoad();
setTimeout(() => {
  const s = page.data.stats;
  console.log('status:', page.data.status);
  console.log('heroNum:', page.data.heroNum, '| dataVersion:', page.data.dataVersion);
  console.log('total:', s.total, 'columns:', s.terms.length, 'cells/col:', s.terms[0].cells.length);
  console.log('legend:', s.cuisines.map((c) => c.name + c.count + '(d' + c.idx + ')').join(' '));
  console.log('metrics:', s.ingredients, s.methods, s.tips);
  console.log('checks:', s.checks.map((c) => c.label + ' ' + c.text).join(' | '));
  console.log('copy keys ok:', ['snapHeroUnit','snapHeroSub','snapLegendNote','snapIngredient','snapMethod','snapTip','snapNote','snapLive'].every((k) => !!page.data.copy[k]));
  // 模拟进视野
  page.setData({ dashOn: true });
  page.countUp();
  setTimeout(() => {
    console.log('after countUp heroNum:', page.data.heroNum);
    process.exit(0);
  }, 1200);
}, 1500);
