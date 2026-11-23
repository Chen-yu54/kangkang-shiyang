// utils/tipPush.js —— 节气提醒的内容与开关
//
// 只做两件事：给一条当令提示的文案、记住用户有没有点过「不再提示」。
// 什么时候显示、显示成什么样，由 pages/kangkang 自己决定：
//   · 用户正聊着、正在等回复 → 不显示；
//   · 对话静止一会儿 → 在聊天页浮一条提示，不插进消息流；
//   · 提示上可以点「不再提示」，之后不再出现。
//
// 不在其它页面弹窗，也不申请订阅消息：小程序没有后台驻留能力，
// 「完全没打开小程序时推送」做不到，这里只处理用户在页面内空闲的情形。

const termTips = require('../data/termTips');
const termHealth = require('../data/termHealth');
const dataSource = require('./dataSource');

const OFF_KEY = 'tipPushOff';
const IDX_KEY = 'tipPushIdx';

function isOff() {
  try {
    return !!wx.getStorageSync(OFF_KEY);
  } catch (e) {
    return false;
  }
}

function setOff(off) {
  try {
    wx.setStorageSync(OFF_KEY, !!off);
  } catch (e) {
    // 存不下只是下次还会再提，不影响使用
  }
}

// 一轮里轮着用，别每次都同一句
function pickText() {
  let term = null;
  try {
    term = dataSource.getCurrentTerm();
  } catch (e) {
    term = null;
  }
  if (!term) return '';

  const pool = [];
  const tips = termTips.getTips(term.name) || [];
  tips.forEach((t) => {
    if (t && t.text) pool.push(term.name + '挑菜 · ' + t.title + '：' + t.text + '。');
  });

  const health = termHealth.getHealth(term.name) || {};
  const live = (health.items || []).filter((x) => x && x.k === '起居')[0];
  if (live && live.v) pool.push(term.name + '起居 · ' + live.v);
  if (health.climate) pool.push(term.name + '这几天' + health.climate + '，出门记得添件衣服。');

  if (!pool.length) return '';

  let i = 0;
  try {
    i = Number(wx.getStorageSync(IDX_KEY)) || 0;
  } catch (e) {
    i = 0;
  }
  const text = pool[i % pool.length];
  try {
    wx.setStorageSync(IDX_KEY, i + 1);
  } catch (e) {
    // 忽略
  }
  return text;
}

module.exports = {
  pickText,
  isOff,
  setOff,
};
