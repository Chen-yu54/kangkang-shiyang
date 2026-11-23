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

// —— 模型输出的拆包 ——
// Bot 侧设了结构化输出（{"reply":…,"dishes":[…],"followups":[…]})，
// 云函数把整段原始内容原样当 reply 传回来。气泡里绝不能出现花括号，
// 所以在这里统一取一次：要说的那句话、提到的菜、可以接着点的问题。
function unfence(text) {
  return String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function unescapeSeg(seg) {
  try {
    return JSON.parse('"' + seg + '"');
  } catch (e) {
    return String(seg)
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}

// 菜名 / 追问都可能是字符串，也可能是 {name:…} 这类对象，统一成字符串数组
function pickList(list, max) {
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => (typeof x === 'string' ? x : (x && (x.name || x.title || x.dish)) || ''))
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, max || 4);
}

/**
 * 把模型回复拆成 { reply, dishes, followups }。
 * 普通文本原样返回；结构化输出取出 reply；JSON 被截断时至少捞回 reply。
 */
function normalize(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return { reply: '', dishes: [], followups: [] };

  const body = unfence(text);
  let obj = null;
  if (body.charAt(0) === '{') {
    try {
      obj = JSON.parse(body);
    } catch (e) {
      obj = null;
    }
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    // JSON 被截断：正文和菜名能捞多少捞多少，别把半截花括号给用户
    const m = body.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const dm = body.match(/"dishes"\s*:\s*\[([^\]]*)\]/);
    const dishes = dm
      ? pickList((dm[1].match(/"((?:[^"\\]|\\.)*)"/g) || []).map((x) => unescapeSeg(x.slice(1, -1))), 3)
      : [];
    if (m) {
      const reply = unescapeSeg(m[1]).trim();
      if (reply) return { reply, dishes, followups: [] };
    }
    return { reply: text, dishes: [], followups: [] };
  }

  const reply = typeof obj.reply === 'string' ? obj.reply.trim() : '';
  const dishes = pickList(obj.dishes, 3);
  const followups = pickList(obj.followups, 4);

  // 结构里没有正文字段：说明这不是给对话用的结构，别吞掉内容
  if (!reply && !dishes.length) return { reply: text, dishes, followups: [] };

  return {
    reply: reply || '给你挑了几道当令菜，点开看看。',
    dishes,
    followups,
  };
}

/**
 * 问一句。
 * @param {string} question 用户输入
 * @param {object} [opts] { conversationId, context }
 *   context 是首轮背景（节气、口味档案、回答口径）；有 conversationId 之后
 *   云函数不再注入，靠会话本身续接上下文。
 * @returns {Promise<{reply:string, conversationId:string, dishes:string[], followups:string[]}>}
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
        context: String(o.context || '').slice(0, 400),
      },
      // 云函数内部要轮询 Bot，前端等久一点
      config: { env: cfg.CLOUD_ENV },
      success: (res) => {
        const r = (res && res.result) || {};
        if (r.status === 'success' && r.reply) {
          const n = normalize(r.reply);
          resolve({
            reply: n.reply,
            dishes: n.dishes,
            followups: n.followups,
            conversationId: r.conversationId || '',
          });
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
  normalize,
  userId,
  readHistory,
  saveHistory,
  appendHistory,
  clearHistory,
  cloudReady,
  MAX_HISTORY,
};
