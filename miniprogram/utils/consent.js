// 数据分享同意 —— 与行为埋点（track.js）是**两件不同的事**，不能共用开关。
//
// 为什么必须分开：
//   ① 行为埋点只记录「点了什么」，不关联个人归属；
//   ② 分享给食堂/街道，是「把谁、在哪个社区、偏好什么」交出去，
//      影响面大得多，必须单独一次知情同意，且随时可撤回。
//   微信审核（checklists A6）要求：采集前告知、可撤回、拒绝不影响功能。
//
// 硬约束：
//   · 未同意 → 主流程照常可用，只是不上报任何分享数据；
//   · 撤回 → 立即停止，并清空未发出的队列；
//   · 上报内容必须过 sanitize()，只出白名单字段，昵称/手机号/openid 一律不出。

const KEY = 'shareConsent';
// 隐私说明的版本号。条款一改就升版本，旧同意自动失效、需要重新确认。
const CONSENT_VERSION = '1.0';

// 允许上报的字段白名单。加字段必须走这里，不许在别处临时拼。
const ALLOWED_FIELDS = [
  'districtId',
  'communityId',
  'termName', // 当前节气，用于聚合统计，不含位置信息
  'taste', // 口味偏好（问卷选项）
  'avoid', // 想少吃的（问卷选项）
  'dishes', // 推荐的菜名列表
  'adopted', // 是否收藏/采纳
  'answeredAt', // 问卷作答时间（精确到天）
];

function safeRead() {
  let raw = null;
  try {
    raw = wx.getStorageSync(KEY);
  } catch (e) {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') {
    return { granted: false, districtId: '', communityId: '', at: 0, version: '' };
  }
  return {
    granted: raw.granted === true,
    districtId: String(raw.districtId || ''),
    communityId: String(raw.communityId || ''),
    at: Number(raw.at) || 0,
    version: String(raw.version || ''),
  };
}

/** 是否已同意，且同意的是当前这一版条款 */
function isGranted() {
  const s = safeRead();
  return s.granted === true && s.version === CONSENT_VERSION;
}

function current() {
  return safeRead();
}

/**
 * 记录同意。必须同时选好街道与社区——只说「同意」但不知道归哪个社区，
 * 数据发出去也没法用，等于白拿用户授权。
 * @returns {{ok:boolean, reason?:string}}
 */
function grant(options) {
  const o = options || {};
  const districtId = String(o.districtId || '');
  const communityId = String(o.communityId || '');
  if (!districtId || !communityId) {
    return { ok: false, reason: 'NEED_REGION' };
  }
  try {
    wx.setStorageSync(KEY, {
      granted: true,
      districtId,
      communityId,
      at: Date.now(),
      version: CONSENT_VERSION,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'STORAGE_FAILED' };
  }
}

/** 撤回：立即停止上报，并清掉未发出的队列（不保留退出后的数据） */
function revoke() {
  try {
    wx.setStorageSync(KEY, {
      granted: false,
      districtId: '',
      communityId: '',
      at: Date.now(),
      version: CONSENT_VERSION,
    });
    // 队列清空，避免「撤回了但上一次的还在路上」
    wx.removeStorageSync('shareQueue');
  } catch (e) {
    /* 存储失败时静默，不影响页面 */
  }
}

/**
 * 脱敏：只保留白名单字段。
 * 任何不在白名单里的键（昵称、手机号、openid、头像…）全部丢掉，不做「顺手带上」。
 */
function sanitize(raw) {
  const src = raw || {};
  const out = {};
  ALLOWED_FIELDS.forEach((k) => {
    if (src[k] === undefined || src[k] === null) return;
    const v = src[k];
    if (Array.isArray(v)) {
      out[k] = v.slice(0, 20).map((x) => String(x).slice(0, 40));
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else {
      out[k] = String(v).slice(0, 200);
    }
  });

  // 归属信息只认本地存的，不接受调用方临时传——
  // 否则某个页面传错就能把数据挂到别的社区去。
  const s = safeRead();
  out.districtId = s.districtId;
  out.communityId = s.communityId;

  // 时间只到天，不保留精确到秒的行为轨迹
  const d = new Date();
  out.day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');

  return out;
}

/**
 * 提交一条分享记录。未同意时直接返回 skipped，不发任何请求。
 * @returns {Promise<{sent:boolean, reason?:string}>}
 */
function submit(raw) {
  if (!isGranted()) {
    return Promise.resolve({ sent: false, reason: 'NOT_GRANTED' });
  }
  const payload = sanitize(raw);
  if (!payload.districtId || !payload.communityId) {
    return Promise.resolve({ sent: false, reason: 'NO_REGION' });
  }

  // 延迟 require，避免 consent 与 api 互相依赖
  let api = null;
  try {
    api = require('./api');
  } catch (e) {
    return Promise.resolve({ sent: false, reason: 'API_UNAVAILABLE' });
  }
  if (!api || typeof api.postShare !== 'function') {
    return Promise.resolve({ sent: false, reason: 'API_UNAVAILABLE' });
  }

  return api
    .postShare(payload)
    .then(() => ({ sent: true }))
    .catch(() => ({ sent: false, reason: 'SEND_FAILED' }));
}

module.exports = {
  KEY,
  CONSENT_VERSION,
  ALLOWED_FIELDS,
  isGranted,
  current,
  grant,
  revoke,
  sanitize,
  submit,
};
