/**
 * utils/qa.js
 * AI 问答请求封装 + 本地历史。前端零密钥，只走 wx.cloud.callFunction。
 */
const config = require('./config');
const profileUtil = require('./profile');

const HISTORY_KEY = 'qaHistory';
const HISTORY_MAX = 20;

const ERROR_TEXT = {
  QA_DISABLED: '问答未开通',
  LLM_KEY_MISSING: '问答未开通，请先在云函数配置 Key',
  EMPTY_QUESTION: '先输入想问的问题',
  UPSTREAM_FAILED: '网络有点慢，稍后再试',
  BAD_JSON: '回答出了点问题，先看当令菜',
  CONTENT_BLOCKED: '这个问题换个说法再试试',
  RATE_LIMITED: '今天问得有点多，明天再来',
  NO_CANDIDATE: '按当前少吃没筛到合适的菜，试试放宽一个少吃',
  NETWORK_ERROR: '网络连接失败，请检查网络',
  UNKNOWN: '出了点问题，稍后再试',
};

function enabled() {
  return !!config.QA_ENABLED;
}

function errorText(code) {
  return ERROR_TEXT[code] || ERROR_TEXT.UNKNOWN;
}

/**
 * 发起一次问答
 * @param {string} question
 * @param {Array} history [{role:'user'|'assistant', content:string}]
 * @returns {Promise<Object>} 云函数成功返回体
 */
function ask(question, history) {
  return new Promise((resolve, reject) => {
    if (!enabled()) {
      return reject({ code: 'QA_DISABLED', message: errorText('QA_DISABLED') });
    }
    const q = String(question || '').trim();
    if (!q) {
      return reject({ code: 'EMPTY_QUESTION', message: errorText('EMPTY_QUESTION') });
    }
    wx.cloud.callFunction({
      name: config.QA_FUNCTION || 'aiqa',
      data: {
        question: q.slice(0, 300),
        profile: profileUtil.build(),
        history: (history || []).slice(-6),
      },
      success(res) {
        const r = (res && res.result) || {};
        if (r.status === 'ok') return resolve(r);
        return reject({ code: r.code || 'UNKNOWN', message: r.message || errorText(r.code) });
      },
      fail() {
        reject({ code: 'NETWORK_ERROR', message: errorText('NETWORK_ERROR') });
      },
    });
  });
}

/* ---------- 本地历史（只存本地，不上传） ---------- */
function loadHistory() {
  try {
    const list = wx.getStorageSync(HISTORY_KEY);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveHistory(list) {
  try {
    wx.setStorageSync(HISTORY_KEY, (list || []).slice(-HISTORY_MAX));
  } catch (e) {
    /* ignore */
  }
}

function clearHistory() {
  try {
    wx.removeStorageSync(HISTORY_KEY);
  } catch (e) {
    /* ignore */
  }
}

module.exports = { ask, enabled, errorText, loadHistory, saveHistory, clearHistory, HISTORY_MAX };
