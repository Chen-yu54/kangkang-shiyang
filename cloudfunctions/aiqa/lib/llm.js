/**
 * lib/llm.js
 * OpenAI 兼容 /v1/chat/completions，Node 原生 https，零第三方依赖。
 * 与现有 cloudfunctions/workflow 同风格：
 *  - 上游可能 HTTP 200 但 body.error 非空 → 必须看 body
 *  - content 可能是带 ```json 的字符串 → 先剥壳
 *  - 解析失败抛 BAD_JSON，由上层降级，不伪造答案
 */
const https = require('https');
const http = require('http');

const DEFAULT_BASE = 'https://api.deepseek.com';
// 模型名会随平台迭代淘汰：DeepSeek 的 deepseek-chat / deepseek-reasoner
// 已于 2026-07-24 停用，现役是 deepseek-flash 与 deepseek-v4-pro。
// 所以这里只是给一个能跑通的默认值，正式部署请用环境变量 LLM_MODEL 显式指定，
// 上线前调 GET /models 核对当前平台实际可用的模型名。
const DEFAULT_MODEL = 'deepseek-flash';

function stripFence(text) {
  let s = String(text || '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }
  // 兜底：截取第一个 { 到最后一个 }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return s.trim();
}

function parseAnswer(content) {
  const cleaned = stripFence(content);
  try {
    const obj = JSON.parse(cleaned);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('not object');
    return obj;
  } catch (e) {
    const err = new Error('模型输出不是合法 JSON');
    err.code = 'BAD_JSON';
    err.raw = String(content || '').slice(0, 500);
    throw err;
  }
}

function buildUrl(base) {
  let b = String(base || DEFAULT_BASE).replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(b)) return b;
  if (!/\/v\d+$/.test(b)) b += '/v1';
  return b + '/chat/completions';
}

function postJSON(urlStr, body, opt) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch (e) {
      const err = new Error('LLM_BASE_URL 不合法');
      err.code = 'UPSTREAM_FAILED';
      return reject(err);
    }
    const isHttps = url.protocol === 'https:';
    const payload = JSON.stringify(body);
    const req = (isHttps ? https : http).request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (opt.key || ''),
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            /* 保持 null */
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const err = new Error(
              '上游 HTTP ' + res.statusCode + '：' + String((parsed && (parsed.error && parsed.error.message)) || raw).slice(0, 200)
            );
            err.code = 'UPSTREAM_FAILED';
            err.status = res.statusCode;
            err.body = parsed;
            return reject(err);
          }
          if (!parsed) {
            const err = new Error('上游返回非 JSON');
            err.code = 'BAD_JSON';
            return reject(err);
          }
          if (parsed.error) {
            const err = new Error('上游 error：' + String(parsed.error.message || JSON.stringify(parsed.error)).slice(0, 200));
            err.code = 'UPSTREAM_FAILED';
            err.body = parsed;
            return reject(err);
          }
          resolve(parsed);
        });
      }
    );

    req.setTimeout(Number(opt.timeout || 25000), () => {
      const err = new Error('上游请求超时');
      err.code = 'UPSTREAM_FAILED';
      req.destroy(err);
    });
    req.on('error', (e) => {
      if (!e.code || e.code === 'ECONNRESET') e.code = 'UPSTREAM_FAILED';
      reject(e);
    });
    req.write(payload);
    req.end();
  });
}

/**
 * @param {Array} messages
 * @param {Object} opt { key, base, model, timeout, temperature, maxTokens, jsonMode }
 * @returns {Promise<Object>} 解析后的业务 JSON
 */
async function chat(messages, opt) {
  const o = opt || {};
  if (!o.key) {
    const err = new Error('未配置 LLM_API_KEY');
    err.code = 'LLM_KEY_MISSING';
    throw err;
  }
  const url = buildUrl(o.base);
  const baseBody = {
    model: o.model || DEFAULT_MODEL,
    messages,
    temperature: typeof o.temperature === 'number' ? o.temperature : 0.3,
    max_tokens: Number(o.maxTokens || 800),
  };

  // DeepSeek 的 deepseek-flash 默认开思考模式，实测：
  //   开  → 1543 ms，输出 195 token
  //   关  →  831 ms，输出  71 token
  // 快 46%、省 64%，而且 max_tokens 偏小时思考会吃掉全部额度、正文返回空。
  // 这一页要的是结构化 JSON，不需要推理过程，所以默认关闭。
  // thinking 是 DeepSeek 特有参数，其他厂商传了会 400，因此下面按两级降级重试。
  const withExtras = (extras) => Object.assign({}, baseBody, extras);
  const isUnsupported = (e, pattern) =>
    e &&
    e.status === 400 &&
    pattern.test(
      String((e.body && e.body.error && e.body.error.message) || e.message)
    );

  let parsed;
  try {
    parsed = await postJSON(
      url,
      withExtras({ response_format: { type: 'json_object' }, thinking: { type: 'disabled' } }),
      o
    );
  } catch (e) {
    // 第一级：厂商不认 thinking → 去掉它，保留 JSON mode
    if (isUnsupported(e, /thinking|reasoning|unsupported|invalid|unknown/i)) {
      try {
        parsed = await postJSON(url, withExtras({ response_format: { type: 'json_object' } }), o);
      } catch (e2) {
        // 第二级：厂商不认 response_format → 两个都去掉，靠 prompt 约束格式
        if (!isUnsupported(e2, /response_format|json_object|unsupported|invalid/i)) throw e2;
        parsed = await postJSON(url, baseBody, o);
      }
    } else if (isUnsupported(e, /response_format|json_object|unsupported|invalid/i)) {
      parsed = await postJSON(url, withExtras({ thinking: { type: 'disabled' } }), o);
    } else {
      throw e;
    }
  }

  const choice = parsed && parsed.choices && parsed.choices[0];
  const content = choice && choice.message && choice.message.content;
  if (!content) {
    const err = new Error('上游未返回内容');
    err.code = 'BAD_JSON';
    throw err;
  }
  const answer = parseAnswer(content);
  answer.__usage = parsed.usage || null;
  answer.__model = parsed.model || baseBody.model;
  return answer;
}

module.exports = { chat, parseAnswer, stripFence, buildUrl, DEFAULT_BASE, DEFAULT_MODEL };
