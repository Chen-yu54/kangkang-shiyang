// utils/api.js —— 数据通道抽象层
//
// 通道口径（团队分工方案 V2.0 六章 + D1 决策）：
//   当前 DATA_CHANNEL = 'local'：只读 data/ 的 A 构建产物，先把页面跑通并冻结 V1.0。
//   扣子（Coze）通道两种形态已预留骨架，切换只改 utils/config.js 的一行常量。
//
// 三条不可违反的约束：
//   1. 所有展示数据必须来自接口或 A 的构建产物，本文件不生成任何内容（验收口径「无写死数据」）
//   2. 通道未配置时显式失败（抛带 code 的错误），不得静默返回假数据
//   3. 错误只在内部流转 code，页面只渲染 i18n 文案，不把英文或技术信息暴露给用户

const config = require('./config');
const dataSource = require('./dataSource');

// 超时口径：列表 / 详情 / 节气 / 埋点 5s，推荐与偏好判定 8s
const TIMEOUT = {
  list: 5000,
  detail: 5000,
  term: 5000,
  chat: 5000,
  recommend: 55000,
  prefs: 8000,
  event: 5000,
};

function createError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: options.url,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: options.timeout || TIMEOUT.list,
      header: Object.assign({ 'content-type': 'application/json' }, options.header || {}),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        reject(createError('HTTP_' + res.statusCode));
      },
      fail() {
        reject(createError('NETWORK_ERROR'));
      },
    });
  });
}

// ─────────────────────────────── 本地通道 ───────────────────────────────

function localList(options) {
  const list = dataSource.getRecipes(options);
  return {
    list,
    total: -1, // -1 表示「未知」，本地通道不编造总数
    channel: 'local',
  };
}

function localTerms() {
  return { list: dataSource.getTerms(), channel: 'local' };
}

function localRecipe(id) {
  return { recipe: dataSource.getRecipeById(id), channel: 'local' };
}

// 个性化推荐降级：取当令菜品，按 offset 轮换取 3 道
// 这不是「个性化推荐」，页面必须明确标注为降级结果，不得冒充推荐依据
function localRecommend(params) {
  const list = dataSource.getRecipes({ term: params.term || '', cuisine: params.cuisine || '' });
  const offset = Number(params.offset) || 0;
  const picked = [];
  // 取不到 3 道时就有几道给几道，不能靠取模把同一道菜重复推荐
  const limit = Math.min(3, list.length);
  for (let i = 0; i < limit; i += 1) {
    picked.push(list[(offset + i) % list.length]);
  }
  return {
    dishes: picked,
    reason: [],
    recallSource: [],
    degraded: true,
    channel: 'local',
  };
}

// ─────────────────────────────── 对外接口 ───────────────────────────────

// 1. 菜品列表（支持 cuisine / term / keyword 筛选）
function getRecipes(options) {
  const query = options || {};
  const params = {
    cuisine: query.cuisine || '',
    term: query.term || '',
    keyword: query.keyword || '',
  };

  if (config.DATA_CHANNEL === 'local') {
    return Promise.resolve(localList(params));
  }

  return sendMessage({ kind: 'recipes', params })
    .then((body) => {
      const rawList = body && Array.isArray(body.list) ? body.list : [];
      const list = dataSource.sanitizeList(rawList);
      list.forEach(dataSource.checkRecipe);
      const total = body && typeof body.total === 'number' ? body.total : list.length;
      return { list, total, channel: config.DATA_CHANNEL };
    })
    .catch(() => localList(params));
}

// 2. 菜品详情
function getRecipeById(id) {
  const target = String(id === undefined || id === null ? '' : id).trim();
  if (!target) return Promise.reject(createError('INVALID_ID'));

  if (config.DATA_CHANNEL === 'local') {
    return Promise.resolve(localRecipe(target));
  }

  return sendMessage({ kind: 'recipe', id: target })
    .then((body) => {
      const raw = body && body.recipe ? body.recipe : null;
      return {
        recipe: raw ? dataSource.sanitizeRecipe(raw) : null,
        channel: config.DATA_CHANNEL,
      };
    })
    .catch(() => localRecipe(target));
}

// 3. 节气列表
function getTerms() {
  if (config.DATA_CHANNEL === 'local') {
    return Promise.resolve(localTerms());
  }

  return sendMessage({ kind: 'terms' })
    .then((body) => ({
      list: body && Array.isArray(body.list) ? body.list.map(dataSource.sanitizeTerm) : dataSource.getTerms(),
      channel: config.DATA_CHANNEL,
    }))
    .catch(() => localTerms());
}

// 4. 个性化推荐（V2.0）
//    8s 超时 → 退化为「当令 3 道」，返回 degraded=true，页面必须明示降级
function getRecommend(params) {
  const payload = {
    term: (params && params.term) || '',
    cuisine: (params && params.cuisine) || '',
    prefs: (params && params.prefs) || null,
    offset: (params && params.offset) || 0,
  };

  if (config.DATA_CHANNEL === 'local') {
    return Promise.resolve(localRecommend(payload));
  }

  return sendMessage({ kind: 'recommend', params: payload }, { timeout: TIMEOUT.recommend })
    .then((body) => {
      const rawList = body && Array.isArray(body.dishes) ? body.dishes : [];
      const dishes = dataSource.sanitizeList(rawList);
      dishes.forEach(dataSource.checkRecipe);
      return {
        dishes,
        reason: Array.isArray(body && body.reason) ? body.reason : [],
        recallSource: Array.isArray(body && body.recallSource) ? body.recallSource : [],
        degraded: false,
        channel: config.DATA_CHANNEL,
      };
    })
    .catch(() => localRecommend(payload));
}

// 5. 偏好判定（V2.0）
//    本地通道下无法判定：显式失败，页面提示重试，绝不前端自己编画像
function getPreferences(answers) {
  if (config.DATA_CHANNEL === 'local') {
    return Promise.reject(createError('PREFS_SERVICE_NOT_CONNECTED'));
  }

  return sendMessage({ kind: 'prefs', answers: answers || {} }, { timeout: TIMEOUT.prefs })
    .then((body) => ({
      preference: body && body.preference ? body.preference : null,
      version: body && body.version ? body.version : '',
      channel: config.DATA_CHANNEL,
    }));
}

// 6. 埋点上报（静默失败，调用方不感知）
function postEvents(events) {
  const list = Array.isArray(events) ? events : [];
  if (list.length === 0) return Promise.resolve({ ok: true });
  if (!config.API_BASE) return Promise.reject(createError('PROXY_NOT_CONFIGURED'));

  return request({
    url: config.API_BASE + '/events',
    method: 'POST',
    data: { events: list },
    timeout: TIMEOUT.event,
  });
}

// 分享上报：把脱敏后的偏好与推荐结果交给食堂/街道。
// 与 postEvents 的区别：这是业务数据，不是行为埋点，走独立端点、独立同意。
// 未配置代理时直接 reject —— 不能假装发成功，否则界面会误报「已同步」。
function postShare(payload) {
  if (!payload || !payload.districtId || !payload.communityId) {
    return Promise.reject(createError('SHARE_NEED_REGION'));
  }
  if (!config.API_BASE) return Promise.reject(createError('PROXY_NOT_CONFIGURED'));

  return request({
    url: config.API_BASE + '/share',
    method: 'POST',
    data: payload,
    timeout: TIMEOUT.event,
  });
}

// ─────────────────────────────── 扣子通道（占位，待接入） ───────────────────────────────

// payload 结构由 B 的《接口契约 v1.0》定义，此处透传、不做字段假设。
function sendMessage(payload, options) {
  const opts = options || {};
  // 对话只走代理：'coze-direct' 需要把 token 打进包，与前端零密钥红线冲突，已移除
  if (config.DATA_CHANNEL === 'coze-proxy' && config.API_BASE) {
    return requestCozeProxy(payload, opts);
  }
  return Promise.reject(createError('COZE_NOT_CONNECTED'));
}


// —— 工作流调用：云开发 → SCF 代理 → 明确失败（不伪造结果） ——
//
// 通道一「云开发」（推荐）：wx.cloud.callFunction 调云函数 workflow，
//   云函数持 token 转发扣子。不需要域名备案，也不需要 request 白名单。
// 通道二「SCF 代理」：POST {API_BASE}/workflow，E 的转发层。
//
// 前端永远只传「别名 + 参数」，不传长 ID、不持有 token。
function runWorkflow(name, params, options) {
  const opts = options || {};
  if (!name) {
    return Promise.reject(createError('WORKFLOW_NAME_MISSING'));
  }

  const useCloud = !!(config.CLOUD_ENV && typeof wx !== 'undefined' && wx.cloud);
  if (useCloud) {
    return callCloudWorkflow(name, params, opts);
  }
  if (config.DATA_CHANNEL === 'coze-proxy' && config.API_BASE) {
    return callProxyWorkflow(name, params, opts);
  }
  return Promise.reject(createError('WORKFLOW_NOT_CONNECTED'));
}

function callCloudWorkflow(name, params, opts) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'workflow',
      data: { name: String(name), params: params || {} },
      config: { env: config.CLOUD_ENV },
      timeout: opts.timeout || TIMEOUT.recommend,
      success: (res) => {
        const r = res && res.result;
        if (!r || typeof r !== 'object') {
          return reject(createError('WORKFLOW_BAD_RESULT'));
        }
        if (r.status === 'error') {
          const err = createError('WORKFLOW_BUSINESS_ERROR');
          err.bizCode = r.code;
          err.bizMsg = r.message || '';
          return reject(err);
        }
        // 云函数已经把纯文本算好了（text 字段），优先整包回传，
        // 由 pickWorkflowText 逐层取。之前只给 data，遇到 {content_type,data}
        // 这种包装就会取不出文本，白解析一场。
        if (typeof r.text === 'string' && r.text) {
          return resolve({ text: r.text, data: r.data });
        }
        resolve(r.data !== undefined ? r.data : '');
      },
      fail: (e) => {
        const err = createError('WORKFLOW_REQUEST_FAILED');
        err.bizMsg = (e && (e.errMsg || e.message)) || '';
        reject(err);
      },
    });
  });
}

function callProxyWorkflow(name, params, opts) {
  return request({
    url: config.API_BASE + '/workflow',
    method: 'POST',
    data: { name: String(name), params: params || {} },
    timeout: opts.timeout || TIMEOUT.recommend,
  })
    .then((body) => {
      if (body && typeof body === 'object' && body.status === 'error') {
        const err = createError('WORKFLOW_BUSINESS_ERROR');
        err.bizCode = body.code;
        err.bizMsg = body.message || body.msg || '';
        throw err;
      }
      if (body && typeof body === 'object' && body.code !== undefined && Number(body.code) !== 0) {
        const err = createError('WORKFLOW_BUSINESS_ERROR');
        err.bizCode = body.code;
        err.bizMsg = body.msg || body.message || '';
        throw err;
      }
      let data = body && typeof body === 'object' && body.data !== undefined ? body.data : body;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          // 保留原文
        }
      }
      return data;
    })
    .catch((e) => {
      if (e && e.code) throw e;
      throw createError('WORKFLOW_REQUEST_FAILED');
    });
}


// 工作流返回结构各不同，统一取文本。三种形态都要兜住，否则页面空白还看不出错：
//   {content_type:1, data:'<markdown>'} / {output:'...'} / 纯字符串
//
// ⚠ 关键坑：取到的「文本」本身可能还是一层 JSON 字符串。
//   实测云函数把 body.data（未解析的原始串）当 text 返回，
//   于是拿到的是 '{"content_type":1,"data":"<真正的 markdown>"}'，
//   877 个字符全是 JSON 外壳，解析器一个菜名都认不出。
//   所以这里要再剥一层：看到以 { 开头的字符串就尝试解开。
function pickWorkflowText(payload) {
  if (!payload) return '';

  const extract = (node) => {
    let cur = node;
    for (let depth = 0; depth < 4 && cur; depth += 1) {
      if (typeof cur === 'string') return cur;
      if (typeof cur.text === 'string' && cur.text) return cur.text;
      if (typeof cur.output === 'string' && cur.output) return cur.output;
      if (typeof cur.content === 'string' && cur.content) return cur.content;
      if (typeof cur.data === 'string' && cur.data) return cur.data;
      cur = cur.data;
    }
    return '';
  };

  let text = extract(payload);
  if (!text) return '';

  // 再剥一层 JSON 外壳：'{"content_type":1,"data":"..."}' → '...'
  for (let i = 0; i < 3; i += 1) {
    const s = String(text).trim();
    if (!/^[{[{]/.test(s)) break;
    let inner = null;
    try {
      inner = JSON.parse(s);
    } catch (e) {
      break; // 不是合法 JSON，说明这本来就是正文
    }
    const innerText = extract(inner);
    if (!innerText || innerText === text) break;
    text = innerText;
  }
  return text;
}

function requestCozeProxy(payload, options) {
  if (!config.API_BASE) {
    return Promise.reject(createError('PROXY_NOT_CONFIGURED'));
  }
  return request({
    url: config.API_BASE + '/coze/chat',
    method: 'POST',
    data: payload,
    timeout: options.timeout || TIMEOUT.chat,
  }).catch(() => {
    throw createError('PROXY_REQUEST_FAILED');
  });
}

module.exports = {
  TIMEOUT,
  getRecipes,
  getRecipeById,
  getTerms,
  getRecommend,
  getPreferences,
  runWorkflow,
  pickWorkflowText,
  postEvents,
  postShare,
  sendMessage,
};
