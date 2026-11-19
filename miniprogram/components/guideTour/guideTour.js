// components/guideTour —— 登录后的全屏功能引导（稍暗底 + 亮圈 + 一张说明卡）
//
// 和「写在登录页上的三段说明」的区别：这张卡片会跟着真实界面走。
//   ① 整屏压暗，只把当前要讲的那一块用亮圈圈出来（亮圈位置按真实节点量出来）
//   ② 说明卡贴在亮圈旁边，一句话说清这一块是干什么的
//   ③ 三页五个点，点「下一步」换位置；「跳过」随时退出
//
// 两个实现要点：
//   1. 遮罩用四块实心 view 围出窗口，不用 box-shadow 做「洞」——
//      实心块能可靠地吃掉点击，也避免不同机型上阴影渲染不一致
//   2. 目标节点可能不在当前视野（首页往下滚才有的文化卡），先量再滚再量，
//      量不到就退化成居中说明卡，绝不让引导卡住
const i18n = require('../../utils/i18n');

const STEP_QUERY_RETRY = 4;

Component({
  properties: {
    visible: { type: Boolean, value: false },
    step: { type: Object, value: null },
    index: { type: Number, value: 0 },
    total: { type: Number, value: 1 },
  },

  data: {
    hole: null, // 亮圈位置（px）
    tip: null, // 说明卡位置（px）
    nextText: '下一步',
    doneText: '知道了',
    skipText: '跳过',
  },

  attached() {
    this.setData({
      nextText: i18n.t('guide.next'),
      doneText: i18n.t('guide.done'),
      skipText: i18n.t('guide.skip'),
    });
  },

  observers: {
    'visible, step': function onStep(visible, step) {
      if (!visible || !step) {
        this.setData({ hole: null, tip: null });
        return;
      }
      // 带入场动画的浮层（顶部消息条）等它落定再量，亮圈才贴得准
      if (step.fixed) {
        setTimeout(() => this.measure(true, 0), 320);
      } else {
        this.measure(true, 0);
      }
    },
  },

  methods: {
    measure(canScroll, tries) {
      if (!this.data.visible) return;
      const step = this.data.step;
      if (!step || !step.target) return;

      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const winW = win.windowWidth;
      const winH = win.windowHeight;

      const query = wx.createSelectorQuery();
      query.select(step.target).boundingClientRect();
      query.selectViewport().scrollOffset();

      query.exec((res) => {
        const rect = res && res[0];
        const scroll = res && res[1];

        // 节点还没渲染出来（首页数据在请求中）：等一会儿再量，最多几次
        if (!rect) {
          if (tries < STEP_QUERY_RETRY) {
            setTimeout(() => this.measure(canScroll, tries + 1), 240);
          } else {
            this.fallback(winW, winH);
          }
          return;
        }

        // 目标不在视野里：先滚过去，再量一次
        // fixed 浮层（顶部消息条、右下角悬浮球）不跟着页面滚，跳过这一步
        const outOfView = !step.fixed && (rect.top < 96 || rect.bottom > winH - 120);
        if (outOfView && canScroll) {
          const base = scroll ? scroll.scrollTop || 0 : 0;
          const target = Math.max(0, base + rect.top - 130);
          wx.pageScrollTo({ scrollTop: target, duration: 0 });
          setTimeout(() => this.measure(false, tries + 1), 200);
          return;
        }

        this.place(rect, winW, winH);
      });
    },

    place(rect, winW, winH) {
      const pad = 8;
      const left = Math.max(12, rect.left - pad);
      const top = Math.max(56, rect.top - pad);
      const w = Math.min(winW - 24, rect.width + pad * 2);
      // 太高的目标只圈上沿，说明卡才有地方放
      const maxH = Math.round(winH * 0.55);
      const h = Math.min(rect.height + pad * 2, maxH);
      const bottom = top + h;

      // 说明卡：默认贴在亮圈下方；下方放不下就翻到上方
      const tipW = winW - 48;
      const tipH = 176;
      const tipTop = bottom + 76 + tipH < winH ? bottom + 16 : Math.max(72, top - tipH - 16);

      this.setData({
        hole: { left, top, w, h, bottom, right: left + w },
        tip: { left: 24, top: tipTop, width: tipW },
      });
    },

    // 量不到节点：不亮圈，只把说明卡放到屏幕中间，引导照样能走完
    fallback(winW, winH) {
      this.setData({
        hole: null,
        tip: { left: 24, top: Math.round(winH / 2 - 110), width: winW - 48 },
      });
    },

    onNext() {
      this.triggerEvent('next');
    },

    onSkip() {
      this.triggerEvent('skip');
    },

    noop() {},
  },
});
