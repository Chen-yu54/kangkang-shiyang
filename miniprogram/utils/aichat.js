// 扣子 Bot 对话调用封装
//
// 与 utils/api.js 的分工：
//   api.runWorkflow() → 工作流（同步，出结构化菜谱）
//   aichat.ask()      → Bot 对话（异步三跳，出自由文本）
//
// 三个约定：
//   ① 前端只传问题与匿名 id，不碰 token、不传 openid；
//   ② 云函数未配置 Bot 时明确返回 BOT_MISSING，界面如实提示，不伪装成"正在思考"；
//   ③ 对话历史只存在本机，不上传、不同步。

const cfg = require('./config');

const HISTORY_KEY = 'aichatHistory';
const USER_KEY = 'aichatUserId';
const MAX_HISTORY = 40; // 本地最多留 40 条（20 轮）

/** 匿名 id：随机生成后存在本机，只用于扣子侧区分会话，不含任何身份信息 */
function userId() {
  let id = '';
  try {
    id = wx.getStorageSync(USER_KEY) || '';
  } catch (e) {
    id = '';
  }
  if (id) return id;

  // 时间戳 + 随机串，够区分会话即可
  const rand = Math.random().toString(36).slice(2, 10);
  id = 'anon-' + Date.now().toString(36) + '-' + rand;
  try {
    wx.setStorageSync(USER_KEY, id);
  } catch (e) { /* 存不下也不影响本次调用 */ }
  return id;
}

function readHistory() {
  try {
    const v = wx.getStorageSync(HISTORY_KEY);
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function saveHistory(list) {
  try {
    wx.setStorageSync(HISTORY_KEY, list.slice(-MAX_HISTORY));
  } catch (e) { /* 存不下就只保留内存里的 */ }
}

function appendHistory(msg) {
  const list = readHistory();
  list.push(Object.assign({ at: Date.now() }, msg));
  saveHistory(list);
}

function clearHistory() {
  try {
    wx.removeStorageSync(HISTORY_KEY);
  } catch (e) { /* 忽略 */ }
}

/** 云开发是否可用（不可用就不发请求，直接告诉用户） */
function cloudReady() {
  return !!(cfg.CLOUD_ENV && typeof wx !== 'undefined' && wx.cloud);
}

/**
 * 问一句。
 * @param {string} question 用户输入
 * @param {object} [opts] { conversationId }
 * @returns {Promise<{reply:string, conversationId:string}>}
 */
function ask(question, opts) {
  const q = String(question || '').trim();
  if (!q) return Promise.reject({ code: 'EMPTY_QUESTION', message: '问题不能为空' });
  if (!cloudReady()) {
    return Promise.reject({ code: 'CLOUD_NOT_READY', message: '云开发未开通，对话功能不可用' });
  }

  const o = opts || {};
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'aichat',
      data: {
        question: q,
        userId: userId(),
        conversationId: o.conversationId || '',
      },
      // 云函数内部要轮询 Bot，前端等久一点
      config: { env: cfg.CLOUD_ENV },
      success: (res) => {
        const r = (res && res.result) || {};
        if (r.status === 'success' && r.reply) {
          resolve({ reply: r.reply, conversationId: r.conversationId || '' });
          return;
        }
        reject({ code: r.code || 'UNKNOWN', message: r.message || '' });
      },
      fail: (e) => {
        const msg = String((e && (e.errMsg || e.message)) || '');
        // 云函数没部署时是 -501000，单独给个能照着做的码
        const code = msg.indexOf('-501000') > -1 ? 'FUNCTION_NOT_DEPLOYED' : 'NETWORK_ERROR';
        reject({ code: code, message: msg });
      },
    });
  });
}

/** 把错误码翻成用户能看懂的一句话 */
function explain(err) {
  const code = String((err && err.code) || '');
  const raw = String((err && err.message) || '');
  if (code === 'BOT_MISSING') {
    return '对话功能还没接通：需要在扣子建一个 Bot，把 Bot ID 填到云函数环境变量 COZE_BOT_ID。';
  }
  if (code === 'TOKEN_MISSING') {
    return '对话功能还没接通：云函数环境变量 COZE_TOKEN 未配置。';
  }
  if (code === 'FUNCTION_NOT_DEPLOYED') {
    return '云函数还没上传部署，右键 cloudfunctions/aichat 上传即可。';
  }
  if (code === 'CLOUD_NOT_READY') {
    return '云开发未开通，对话功能不可用。其他功能不受影响。';
  }
  if (code === 'UPSTREAM_TIMEOUT' || code === 'NETWORK_ERROR') {
    return '这次没等到回复，可能是网络或 Bot 处理较慢。可以再问一次。';
  }
  if (code === 'EMPTY_QUESTION') return '先输入一句话再发送。';
  if (code === 'QUESTION_TOO_LONG') return '问题太长了，精简到 500 字以内。';
  return '这次没成功' + (raw ? '：' + raw : '，可以再试一次。');
}

module.exports = {
  ask,
  explain,
  userId,
  readHistory,
  saveHistory,
  appendHistory,
  clearHistory,
  cloudReady,
  MAX_HISTORY,
};
