// utils/tour.js —— 登录后的功能引导：三页五站
//
// 写作口径：
//   · 每站只说「这一块是干什么的」+「怎么用」，一句一屏不解释机制
//   · target 是页面里真实存在的节点 id，引导按它量位置，不写死坐标
//   · 顺序跟用户实际会走的路一致：先看今天什么节气 → 懂节气文化 → 再看当令菜 → 专属推荐 → 最后「我的」
module.exports.STEPS = [
  {
    page: 'index',
    target: '#tour-hero',
    title: '今天是什么节气',
    desc: '封面是当天的节气海报，点一下能看到这个节气的由来。',
  },
  {
    page: 'index',
    target: '#tour-culture',
    title: '节气文化',
    desc: '「立冬的讲究」点开，能看到三候、食俗和当令食材。',
  },
  {
    page: 'index',
    target: '#tour-showcase',
    title: '当令菜',
    desc: '广府、潮汕、客家各挑一道当令菜，会自动轮播，点菜名看做法。',
  },
  {
    page: 'menu',
    target: '#tour-quiz',
    title: '专属推荐',
    desc: '答 6 道口味小题，再点生成，就有一份按你口味排的今日食单。',
  },
  {
    page: 'mine',
    target: '#tour-profile',
    title: '我的',
    desc: '收藏、字号、长辈模式和隐私开关，都收在这一页。',
  },
];

// —— 两个确认弹窗：跳过要问一声，走完要送一程 ——
//
// 为什么跳过要确认：一点就没了，而这一遍只讲一次；
// 问一句顺带告诉用户「以后在哪还能看」，比直接消失友好。
const i18n = require('./i18n');

function skipConfirm(onDone) {
  wx.showModal({
    title: i18n.t('tour.skipTitle'),
    content: i18n.t('tour.skipContent'),
    confirmText: i18n.t('tour.skipConfirm'),
    cancelText: i18n.t('tour.skipCancel'),
    confirmColor: '#b5482a',
    success(res) {
      if (res.confirm && typeof onDone === 'function') onDone();
    },
  });
}

// 五站走完：不弹「完成了」这种废话，给一句实在的话，再把人送去首页
function finishConfirm() {
  wx.showModal({
    title: i18n.t('tour.finishTitle'),
    content: i18n.t('tour.finishContent'),
    confirmText: i18n.t('tour.finishConfirm'),
    cancelText: i18n.t('tour.finishCancel'),
    confirmColor: '#b5482a',
    success(res) {
      if (res.confirm) wx.switchTab({ url: '/pages/index/index' });
    },
  });
}

module.exports.skipConfirm = skipConfirm;
module.exports.finishConfirm = finishConfirm;
