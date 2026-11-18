// 扣子 Bot 对话转发 —— 云函数 aichat
//
// ⚠️ 与 cloudfunctions/workflow 不是一回事，别混：
//    workflow  → POST /v1/workflow/run   **同步**，一次请求即返回结果
//    aichat    → POST /v3/chat            **异步**，只返回 chat_id，必须三跳才拿到回复
//
// 三跳流程（少一步都拿不到内容）：
//    ① POST /v3/chat                      → chat_id + conversation_id，status=in_progress
//    ② GET  /v3/chat/retrieve             → 轮询到 status ∈ {completed, failed, canceled, requires_action}
//    ③ GET  /v3/chat/message/list         → 过滤 role=assistant && type=answer
//
// 最常踩的坑：直接读 ① 的响应体，那里**没有消息内容**，永远是空的。
//
// 零第三方依赖：只用 Node 原生 https，与 workflow 云函数同风格。
// 密钥只从环境变量取，前端包里没有任何凭证。

const https = require('https');

const TOKEN = process.env.COZE_TOKEN;
const BOT_ID = process.env.COZE_BOT_ID;

const API_HOST = 'api.coze.cn';
const REQUEST_TIMEOUT = 12000; // 单次 HTTP 请求
const POLL_INTERVAL = 1200; // 轮询间隔
const POLL_MAX = 18; // 最多轮询次数（≈22 秒）
const BOT_FINISHED = ['completed', 'failed', 'canceled', 'requires_action'];

function createError(code, message) {
  const e = new Error(message || code);
  e.code = code;
  return e;
}

/** 发一个 HTTPS 请求，返回解析后的 JSON */
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      Authorization: 'Bearer ' + TOKEN,
      'Content-Type': 'application/json',
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(
      { hostname: API_HOST, path: path, method: method, headers: headers, timeout: REQUEST_TIMEOUT },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (e) {
            return reject(createError('UPSTREAM_NOT_JSON', '上游返回非 JSON：' + raw.slice(0, 120)));
          }
          // 扣子的业务错误走 HTTP 200 + code !== 0，只看状态码会把失败当成功
          if (json && json.code !== undefined && json.code !== 0) {
            return reject(
              createError('UPSTREAM_CODE_' + json.code, json.msg || '上游返回错误')
            );
          }
          resolve(json);
        });
      }
    );
    req.on('error', (e) => reject(createError('UPSTREAM_FAILED', e.message)));
    req.on('timeout', () => {
      req.destroy();
      reject(createError('UPSTREAM_TIMEOUT', '请求扣子超时'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** ① 发起一轮对话 */
function startChat(userId, question) {
  return request('POST', '/v3/chat', {
    bot_id: BOT_ID,
    user_id: userId,
    stream: false,
    auto_save_history: true,
    additional_messages: [{ role: 'user', content: question, content_type: 'text' }],
  }).then((r) => (r && r.data) || r);
}

/** ② 轮询到终态 */
function waitFinished(chat, round) {
  const n = round || 0;
  if (!chat || !chat.id) return Promise.reject(createError('BAD_CHAT', '未拿到 chat_id'));
  if (BOT_FINISHED.indexOf(chat.status) > -1) return Promise.resolve(chat);
  if (n >= POLL_MAX) {
    return Promise.reject(createError('UPSTREAM_TIMEOUT', 'Bot 处理超时，未在限定时间内返回'));
  }
  const path =
    '/v3/chat/retrieve?conversation_id=' +
    encodeURIComponent(chat.conversation_id || '') +
    '&chat_id=' +
    encodeURIComponent(chat.id);
  return sleep(POLL_INTERVAL)
    .then(() => request('GET', path))
    .then((r) => waitFinished((r && r.data) || r, n + 1));
}

/** ③ 取回复内容 */
function fetchAnswer(chat) {
  const path =
    '/v3/chat/message/list?conversation_id=' +
    encodeURIComponent(chat.conversation_id || '') +
    '&chat_id=' +
    encodeURIComponent(chat.id);
  return request('GET', path).then((r) => {
    const data = (r && r.data) || r;
    const list = Array.isArray(data) ? data : data && data.data ? data.data : [];
    const answers = (list || [])
      .filter((m) => m && m.role === 'assistant' && m.type === 'answer' && m.content)
      .map((m) => String(m.content));
    return answers.join('\n').trim();
  });
}

/**
 * 入口。
 * 入参：{ question: string, userId: string, conversationId?: string }
 * 返回：{ status, reply, conversationId, chatId, usage? } 或 { status:'error', code, message }
 *
 * userId 由前端生成的匿名 id（不是 openid），只用于扣子侧区分会话，不携带身份信息。
 */
exports.main = async (event) => {
  const e = event || {};
  const question = String(e.question || '').trim();
  const userId = String(e.userId || '').trim() || 'anonymous';

  if (!question) {
    return { status: 'error', code: 'EMPTY_QUESTION', message: '问题不能为空' };
  }
  if (question.length > 500) {
    return { status: 'error', code: 'QUESTION_TOO_LONG', message: '问题过长，请控制在 500 字以内' };
  }
  if (!TOKEN) {
    return {
      status: 'error',
      code: 'TOKEN_MISSING',
      message: '云函数环境变量 COZE_TOKEN 未配置',
    };
  }
  if (!BOT_ID) {
    return {
      status: 'error',
      code: 'BOT_MISSING',
      message: '云函数环境变量 COZE_BOT_ID 未配置（需要在扣子建 Bot 并填入 Bot ID）',
    };
  }

  try {
    const chat = await startChat(userId, question);
    const done = await waitFinished(chat, 0);

    if (done.status === 'failed') {
      return {
        status: 'error',
        code: 'BOT_FAILED',
        message: (done.last_error && done.last_error.msg) || 'Bot 处理失败',
      };
    }
    if (done.status === 'requires_action') {
      return { status: 'error', code: 'BOT_REQUIRES_ACTION', message: 'Bot 需要额外操作，当前版本不支持' };
    }

    const reply = await fetchAnswer(done);
    if (!reply) {
      return { status: 'error', code: 'EMPTY_REPLY', message: 'Bot 返回了空内容' };
    }

    return {
      status: 'success',
      reply,
      conversationId: done.conversation_id || '',
      chatId: done.id || '',
      usage: done.usage || null,
    };
  } catch (err) {
    return {
      status: 'error',
      code: (err && err.code) || 'UNKNOWN',
      message: String((err && err.message) || err),
    };
  }
};
