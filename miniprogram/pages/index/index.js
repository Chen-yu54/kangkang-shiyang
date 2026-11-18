// pages/index/index.js —— 推荐（一级 Tab 页）
//
// 主区是「时令菜品」：只看当令、不看口味，展示牌轮播当前节气的当令菜。
// 口味测试 → 推演 → 专属食单是另一条链路，归「专属推荐」tab 的今日食单，
// 两套菜单不混——这里不做问卷门槛，也不引用推演记录。
// 次区只剩两块：节气文化（三候 / 食俗 / 当令食材）与搜菜名，层级低于主区。
// 按菜系逛的三联卡已撤：三系水彩图改为无照片菜品的托底图（components/dishMedia）。

const api = require('../../utils/api');
const dataSource = require('../../utils/dataSource');
const dishImages = require('../../utils/dishImages');
const format = require('../../utils/format');
const share = require('../../utils/share');
const kbStats = require('../../utils/kbStats');
const track = require('../../utils/track');
const i18n = require('../../utils/i18n');

const t = i18n.t;

// 展示牌一屏一道菜：菜名 + 菜系 + 一段做法（原做法文字挤在 296rpx 横滑卡里读不完）
// 图可能来自两处：接口返回的卡片自带 image；推演结果只给 dish（知识库原对象），
// 需要用 dishImages 按菜名补图，查不到就返回空串，视图层走风味签占位。
function toCard(dish) {
  return {
    id: dish.id,
    name: dish.name,
    cuisineName: dish.cuisineName || '',
    how: dish.how || '',
    subText: [dish.cuisineName, dish.how].filter(Boolean).join(' · '),
    cuisine: dish.cuisine,
    image: dish.image || dishImages.imageForName(dish.name),
  };
}

// 展示牌最多轮三道：多了一屏滚不完，也失去「当令主推」的挑选感
const SHOWCASE_MAX = 3;

Page({
  data: {
    pageStyle: '',
    status: 'loading',
    showcase: [], // 节气推荐展示牌：当前节气的三道当令菜
    showcaseIndex: 0,
    dataVersion: '',
    stats: null, // 跟着节气吃：主水球 + 三个好处小球，全部实时算
    dashOn: false, // 水波从 0 涨起来、刻度依次点亮，进视野才播
    banner: null,
    termName: '',
    termPoster: '',
    sealText: '',
    elderMode: false,
    copy: {},
    termCulture: null, // 节气文化摘要：slogan / 诗句（三候 / 食俗 / 食材在节气详情页）
    cultureTitle: '', // 「立冬的讲究」——节气名在视图里拼，避免模板里做字符串拼接
    // 登录后的功能引导（跨 tab，进度存在 app.globalData.tour）
    tourVisible: false,
    tourStep: null,
    tourIndex: 0,
    tourTotal: 0,
  },

  onLoad() {
    this.setData({
      copy: {
        searchPlaceholder: t('home.searchPlaceholder'),
        askTitle: t('home.askTitle'),
        askSub: t('home.askSub'),
        chatTitle: t('home.chatTitle'),
        chatSub: t('home.chatSub'),
        sectionDishes: t('home.sectionDishes'),
        sectionCulture: t('home.sectionCulture'),
        seeAll: t('home.seeAll'),
        empty: t('home.empty'),
        error: t('home.error'),
        retry: t('common.retry'),
        dataVersion: t('common.dataVersion'),
        snapshotTitle: t('snapshot.title'),
        snapLive: t('snapshot.live'),
        snapAsOf: t('snapshot.asOf'),
        snapLine1Unit: t('snapshot.line1Unit'),
        snapLine1Sub: t('snapshot.line1Sub'),
        snapLine2Unit: t('snapshot.line2Unit'),
        snapLine2Sub: t('snapshot.line2Sub'),
        snapLine3Unit: t('snapshot.line3Unit'),
        snapLine3Sub: t('snapshot.line3Sub'),
        snapNote: t('snapshot.note'),
        aiTag: t('common.aiGenerated'),
        // —— 杂志化新增
        heroKicker: t('home.heroKicker'),
        heroAiNote: t('home.heroAiNote'),
        leadKicker: t('home.leadKicker'),
        noCulture: t('home.noCulture'),
        noDishes: t('home.noDishes'),
        cultureTag: t('home.cultureTag'),
        cultureOpenSub: t('home.cultureOpenSub'),
        cultureOpen: t('home.cultureOpen'),
        noSnapshot: t('home.noSnapshot'),
      },
    });
    this.applyTermTheme();
    this.loadData();
    track.pageView('index');
  },

  // 仪表盘在页面下半截，等它滚进视野再起动画；否则用户滑到时已经播完了
  onReady() {
    this.watchDash();
  },

  watchDash() {
    if (this._dashWatched) return;
    this._dashWatched = true;

    const start = () => {
      if (this.data.dashOn) return;
      this.setData({ dashOn: true });
    };

    // 低版本或取不到节点时，直接在两秒后起动画，宁可早点也别一直不动
    if (!wx.createIntersectionObserver) {
      setTimeout(start, 1200);
      return;
    }
    try {
      this._dashObs = wx.createIntersectionObserver(this, { thresholds: [0.15] });
      this._dashObs
        .relativeToViewport({ bottom: -60 })
        .observe('#dash', () => {
          start();
          this._dashObs.disconnect();
        });
    } catch (err) {
      setTimeout(start, 1200);
    }
  },

  onShow() {
    const app = getApp();
    this.setData({
      pageStyle: app.getFontStyle(),
      elderMode: app.getElderMode ? app.getElderMode() : false,
    });
    // 从引导里切回本页（或首次登录落回首页）时，按当前进度决定是否亮起引导
    this.syncTour();

    // 节气跨边界（如 11/7 立冬）后回首页要换海报；若当令菜列表也过期就整体重载。
    // 两者都取自 dataSource.getCurrentTerm()，口径一致，不会来回抖动。
    const info = app.getTermInfo();
    this.applyTermTheme();
    if (this.data.termName && info.name && info.name !== this.data.termName) {
      this.loadData();
    }
  },

  onPullDownRefresh() {
    this.loadData();
  },

  loadData() {
    this.setData({ status: 'loading' });

    // 首页只展示「当令菜品」，不带节气筛选会返回全部 400+ 条
    const current = dataSource.getCurrentTerm();
    const termName = current ? current.name : '';

    Promise.all([api.getRecipes({ term: termName }), api.getTerms()])
      .then((results) => {
        const recipes = results[0];
        const list = (recipes.list || []).map(toCard);

        // 编辑荐语：取自当前节气数据的 poem（知识库字段）
        const poem = current && current.poem && current.poem.text ? current.poem : null;

        // 节气推荐展示牌：当前节气三系各一道（广府/潮汕/客家）。
        // 数据按菜系排序，直接 slice(0,3) 永远只出广府，三系定位就立不住。
        const showcase = ['guangfu', 'chaoshan', 'hakka']
          .map((key) => list.find((d) => d.cuisine === key))
          .filter(Boolean)
          .slice(0, SHOWCASE_MAX)
          .map((d, i) =>
            Object.assign({}, d, { idxText: i + 1 < 10 ? '0' + (i + 1) : String(i + 1) })
          );

        // 仪表盘：当前节气决定主球水位，三个小球说「你能得到什么」
        const stats = kbStats.build(current);
        stats.term.posText = i18n.tpl('snapshot.termPos', {
          order: stats.term.order,
          total: stats.term.total,
        });
        stats.promises = stats.promises.map((p) => ({
          key: p.key,
          label: t(p.labelKey),
          sub: p.subParams ? i18n.tpl(p.subKey, p.subParams) : t(p.subKey),
          pct: p.pct,
          text: p.text,
        }));

        this.setData({
          status: list.length > 0 ? 'ready' : 'empty',
          showcase,
          showcaseIndex: 0,
          termName,
          termCulture: this.buildTermCulture(current, poem),
          cultureTitle: termName
            ? i18n.tpl('home.cultureOpenTitle', { name: termName })
            : t('home.sectionCulture'),
          // 展示只留日期：完整版本号是「kb-2026-11-18 · 2026-11-18」，日期出现两遍
          dataVersion: (dataSource.getDataVersionLabel().split('·').pop() || '').trim(),
          // 跟着节气吃：全部按当前知识库实时算，扩容后自动更新，不写死任何数字
          stats,
          banner: this.buildBanner(),
        });
      })
      .catch(() => {
        this.setData({ status: 'error' });
      })
      .then(() => {
        wx.stopPullDownRefresh();
      });
  },

  onRetry() {
    this.loadData();
  },

  // 当前节气海报 + 日期角标；与 pageStyle 的主题色同源（utils/solarTheme.js）
  // 印章只打日期，节气名交给海报书法字，避免同一信息重复三遍
  applyTermTheme() {
    // 这个方法被 onLoad 和 onShow 都会调用，作用域里没有 app，必须自己取
    const app = getApp();
    const info = app.getTermInfo();
    this.setData({
      termPoster: info.poster,
      sealText: (info.dateText || '').replace('月', '.').replace('日', ''),
    });
  },

  // 节气 banner：当前节气 + 距下一节气天数
  // 天数由日期窗口确定性推算（不是人工填的数字），可在控制台当场复算
  buildBanner() {
    const current = dataSource.getCurrentTerm();
    const next = dataSource.getNextTerm();
    if (!current && !next) return null;

    const hint =
      next && next.days > 0
        ? i18n.tpl('home.daysToNext', { name: next.term.name, days: next.days })
        : current
          ? i18n.tpl('home.daysToNextEnd', { name: current.name })
          : '';

    return {
      name: current ? current.name : next ? next.term.name : '',
      // 标题优先用知识库 headline，缺省退到 slogan（如立冬「万物收藏也」）；
      // 不再退到节气名——海报上已有书法字，重复会糊在一起
      headline: current ? current.headline || current.slogan || '' : '',
      hint,
    };
  },

  // 节气文化摘要：slogan / 诗句 / 三候 / 食俗 / 当令食材。
  // 诗句并进卡片顶部当引子——原来它单独占一屏下拉，与文化卡说的是同一件事。
  buildTermCulture(current, poem) {
    if (!current) return null;
    return {
      slogan: current.headline || current.slogan || '',
      poem: poem && poem.text ? { text: poem.text, author: poem.author || '' } : null,
      phenology: (current.phenology || []).slice(0, 3),
      folk: (current.folk || []).slice(0, 2).map((f) => ({
        title: f.title || '',
        icon: f.icon || '',
        desc: f.desc || '',
      })),
      ingredients: (current.ingredients || []).slice(0, 8),
    };
  },

  onTapDish(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    track.dishClick(id, 'home');
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  // 节气文化卡 → 节气详情页（solarterm 支持 ?term= 直接进详情，省一次列表点击）
  // 问问康康：对话式问卷页
  // 康康对话：连扣子 Bot 的自由问答
  onTapAiChat() {
    wx.navigateTo({ url: '/pages/aichat/aichat' });
  },

  onTapAgent() {
    wx.navigateTo({ url: '/pages/agent/agent' });
  },

  onTapTermDetail() {
    const name = this.data.termName;
    if (!name) return;
    wx.navigateTo({
      url: '/pages/solarterm/solarterm?term=' + encodeURIComponent(name),
      fail: () => {
        // 详情页打不开时退到列表页，不要让点击变成死操作
        wx.navigateTo({ url: '/pages/solarterm/solarterm' });
      },
    });
  },

  onTapMenu() {
    wx.switchTab({ url: '/pages/menu/menu' });
  },

  // 展示牌轮播：只用来点亮刻度，不回写 swiper 的 current，避免打断动画
  onShowcaseChange(e) {
    const idx = e.detail.current;
    if (idx !== this.data.showcaseIndex) this.setData({ showcaseIndex: idx });
  },

  // 节气海报点击：带当前节气名直达详情，直接看到节气文化板块
  onTapTerm() {
    const name = this.data.termName || '';
    const q = name ? '?term=' + encodeURIComponent(name) : '';
    wx.navigateTo({ url: '/pages/solarterm/solarterm' + q });
  },

  onTapSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  },

  // —— 功能引导 ——
  // 本站点是否在本页由 app 判断；不在本页时遮罩不显示，页面照常用
  syncTour() {
    const app = getApp();
    if (!app.tourStateOf) return;
    const st = app.tourStateOf('index');
    this.setData({
      tourVisible: st.visible,
      tourStep: st.step,
      tourIndex: st.index,
      tourTotal: st.total,
    });
  },

  onTourNext() {
    const app = getApp();
    const st = app.nextTour ? app.nextTour() : null;
    this.setData({ tourVisible: false });
    if (!st) {
      require('../../utils/tour').finishConfirm();
      return;
    }
    // 下一站在别的 tab：切过去，目标页 onShow 时接着亮
    if (st.step && st.step.page !== 'index') {
      wx.switchTab({
        url: st.step.page === 'menu' ? '/pages/menu/menu' : '/pages/mine/mine',
      });
      return;
    }
    this.setData({
      tourVisible: st.visible,
      tourStep: st.step,
      tourIndex: st.index,
      tourTotal: st.total,
    });
  },

  onTourSkip() {
    const app = getApp();
    const self = this;
    require('../../utils/tour').skipConfirm(() => {
      if (app.endTour) app.endTour();
      self.setData({ tourVisible: false });
    });
  },

  onShareAppMessage() {
    track.share('app', 'menu');
    return share.messageForApp();
  },
});
