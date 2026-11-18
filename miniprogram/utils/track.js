// utils/track.js —— 埋点上报（团队分工方案 8.3 六类事件 + 9 节上报规矩）
//
// 六类事件：
//   page_view        { page, term?, ts }
//   dish_click       { dishId, from, ts }
//   cuisine_filter   { cuisine, term?, ts }
//   solar_term_view  { term, ts }
//   favorite         { dishId, action, from, ts }
//   share            { type, dishId?, channel, ts }
//
// 三条硬规矩：
//   1. 默认不采集。隐私协议与用户同意就绪前一律不上报（团队分工方案 8.3、11 章风险表）
//   2. 上报不阻塞任何交互：失败静默，事件留在本地队列，队列上限 50 条防膨胀
//   3. 只采匿名标识，不采姓名、手机号、位置

const config = require('./config');
const api = require('./api');

const QUEUE_KEY = 'trackQueue';
const CONSENT_KEY = 'trackConsent';
const MAX_QUEUE = 50;

// —— 同意管理 ——

// 默认 false：未拿到同意就不采。这是合规默认值，不是可选项。
function hasConsent() {
  return wx.getStorageSync(CONSENT_KEY) === true;
}

function setConsent(value) {
  const granted = value === true;
  wx.setStorageSync(CONSENT_KEY, granted);
  if (granted) {
    flush();
    return;
  }
  // 撤回同意：立即停止上报，并清空尚未发出的事件（不保留退出后的行为数据）
  wx.setStorageSync(QUEUE_KEY, []);
}

// —— 本地队列 ——

function getQueue() {
  const queue = wx.getStorageSync(QUEUE_KEY);
  return Array.isArray(queue) ? queue : [];
}

function saveQueue(queue) {
  const trimmed = queue.slice(-MAX_QUEUE);
  wx.setStorageSync(QUEUE_KEY, trimmed);
}

// —— 上报 ——

let flushing = false;

function flush() {
  // 三个前置条件任一不满足就不发：未同意、域名未就绪、已有一次上报在途
  if (!hasConsent() || !config.API_BASE || flushing) return;

  const queue = getQueue();
  if (queue.length === 0) return;

  flushing = true;
  api
    .postEvents(queue)
    .then(() => {
      saveQueue([]);
    })
    .catch(() => {
      // 静默失败：事件留在队列里等下次，不打扰用户，不弹任何提示
    })
    .then(() => {
      flushing = false;
    });
}

// —— 事件入口 ——

function track(name, payload) {
  if (!hasConsent()) return;
  const queue = getQueue();
  queue.push(Object.assign({ name, ts: Date.now() }, payload || {}));
  saveQueue(queue);
  flush();
}

function pageView(page, extra) {
  track('page_view', Object.assign({ page }, extra || {}));
}

// from 取值：home | cuisine | search | favorite | recommend | solarterm
// 说明：solarterm 为按建议新增的来源值（节气页是进详情的必经路径），待 E 在事件表确认。
function dishClick(dishId, from) {
  if (!dishId) return;
  track('dish_click', { dishId, from: from || '' });
}

function cuisineFilter(cuisine, term) {
  track('cuisine_filter', { cuisine: cuisine || '', term: term || '' });
}

function solarTermView(term) {
  if (!term) return;
  track('solar_term_view', { term });
}

// action: 'add' | 'remove'；from 同 dish_click，为按建议新增的归因字段，待 E 确认
function favoriteEvent(dishId, action, from) {
  if (!dishId) return;
  track('favorite', { dishId, action: action || '', from: from || '' });
}

// type: 'dish' | 'longimage' | 'app'；channel: 'menu' | 'button'
function share(type, channel, dishId) {
  const payload = { type: type || '', channel: channel || '' };
  if (dishId) payload.dishId = dishId;
  track('share', payload);
}

module.exports = {
  hasConsent,
  setConsent,
  flush,
  track,
  pageView,
  dishClick,
  cuisineFilter,
  solarTermView,
  favoriteEvent,
  share,
};
