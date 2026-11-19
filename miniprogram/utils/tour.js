// utils/tour.js —— 登录后的功能引导：四页九站
//
// 写作口径：
//   · 每站只说「这一块是干什么的」+「怎么用」，一句一屏，不解释机制
//   · target 是页面里真实存在的节点 id，引导按它量位置，不写死坐标
//   · 顺序跟用户实际会走的路一致：先认节气与当令菜 → 新增的数据与对话入口
//     → 专属推荐 → 食品安全 → 我的
//   · 带 act:'intro' 的一站会先跳一次康康对话页做自我介绍，退回来接着讲悬浮球；
//     其余站都落在 tabBar 页，跨页只走 switchTab
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
    page: 'index',
    target: '#dash',
    title: '节气数据',
    desc: '点卡片进入「节气数据」：罗盘、菜系对照、人群偏向、知识图谱、食材深库五个分区。',
  },
  {
    page: 'index',
    target: '#tour-msg',
    fixed: true,
    act: 'intro',
    title: '康康来消息了',
    desc: '咦，有人发来一条消息过来，快去看看吧！',
    nextText: '去看看',
  },
  {
    page: 'index',
    target: '#tour-fab',
    fixed: true,
    title: '随时找康康',
    desc: '以后想找我，点这里就行。挑菜、问节气，随时来聊。',
  },
  {
    page: 'menu',
    target: '#tour-quiz',
    title: '专属推荐',
    desc: '答 6 道口味小题，再点生成，就有一份按你口味排的今日食单。',
  },
  {
    page: 'foodsafety',
    target: '#tour-foodsafety',
    title: '食品安全',
    desc: '汇总近年抽检不合格批次与处罚案例，数据取自省局通告。',
  },
  {
    page: 'mine',
    target: '#tour-profile',
    title: '我的',
    desc: '收藏、字号、长辈模式和隐私开关，都收在这一页。',
  },
];

// tab 页路径表：引导跨页只走 switchTab，四页统一从这里取，
// 不在各页面里硬编码三选一，新增 tab 时只改这一处。
const TAB_URL = {
  index: '/pages/index/index',
  menu: '/pages/menu/menu',
  foodsafety: '/pages/foodsafety/foodsafety',
  mine: '/pages/mine/mine',
};

function tabUrlOf(page) {
  return TAB_URL[page] || '/pages/index/index';
}

// —— 两个确认弹窗：跳过要问一声，走完要送一程 ——
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

// 八站走完：不弹「完成了」这种废话，给一句实在的话，再把人送去首页
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

module.exports.tabUrlOf = tabUrlOf;
module.exports.skipConfirm = skipConfirm;
module.exports.finishConfirm = finishConfirm;
