// 探针：验证 key 能真正完成一次问答（含 JSON mode）。
// 用法：$env:PROBE_KEY='sk-xxx'; node scripts/probe-llm-chat.js
//
// 为什么要单独测 chat：/models 返回 200 只说明 key 有效，
// 不代表有余额、不代表能出 JSON、不代表模型名对。
// 这三件事任一不满足，云函数上线后都会在真实提问时失败。

const https = require('https');

const KEY = process.env.PROBE_KEY || '';
const BASE = (process.env.PROBE_BASE || 'https://api.deepseek.com').replace(/\/+$/, '');
const MODEL = process.env.PROBE_MODEL || 'deepseek-flash';

if (!KEY) {
  console.error('缺少 PROBE_KEY 环境变量');
  process.exit(1);
}

function post(urlStr, body, key) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const payload = JSON.stringify(body);
    const started = Date.now();
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + key,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            /* 非 JSON */
          }
          resolve({ status: res.statusCode, body: parsed, raw: raw.slice(0, 400), ms: Date.now() - started });
        });
      }
    );
    req.setTimeout(40000, () => req.destroy(new Error('timeout 40s')));
    req.on('error', (e) => resolve({ status: 0, note: e.message, ms: Date.now() - started }));
    req.write(payload);
    req.end();
  });
}

const ENDPOINT = BASE + '/v1/chat/completions';

(async () => {
  console.log('');
  console.log('模型: ' + MODEL);
  console.log('');

  // —— 测 1：纯文本 ——
  console.log('[1] 基础问答');
  const r1 = await post(
    ENDPOINT,
    {
      model: MODEL,
      messages: [{ role: 'user', content: '用一句话说明白灼菜心大概要多久，不要寒暄。' }],
      max_tokens: 100,
    },
    KEY
  );
  if (r1.status === 200 && r1.body && r1.body.choices) {
    const text = r1.body.choices[0].message.content || '';
    console.log('    ✓ 200  ' + r1.ms + ' ms');
    console.log('    回答: ' + text.replace(/\s+/g, ' ').slice(0, 80));
    const u = r1.body.usage || {};
    console.log('    token: 输入 ' + (u.prompt_tokens || 0) + ' / 输出 ' + (u.completion_tokens || 0));
  } else {
    console.log('    ✗ ' + (r1.status || r1.note));
    console.log('    ' + String(r1.raw || '').slice(0, 200));
  }

  // —— 测 2：JSON mode（aiqa 依赖这个）——
  console.log('');
  console.log('[2] JSON mode（项目实际用法）');
  const r2 = await post(
    ENDPOINT,
    {
      model: MODEL,
      messages: [
        { role: 'system', content: '只输出 JSON，不要任何解释。格式：{"answer":"字符串","dishes":["菜名"]}' },
        { role: 'user', content: '半小时能做什么菜？给一道。' },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
    },
    KEY
  );
  if (r2.status === 200 && r2.body && r2.body.choices) {
    const text = r2.body.choices[0].message.content || '';
    let ok = false;
    try {
      const obj = JSON.parse(text);
      ok = !!(obj && obj.answer);
      console.log('    ✓ 200  ' + r2.ms + ' ms  返回合法 JSON');
      console.log('    内容: ' + JSON.stringify(obj).slice(0, 120));
    } catch (e) {
      console.log('    ✗ 返回不是合法 JSON: ' + text.slice(0, 120));
    }
    if (!ok) console.log('    （aiqa 的 parseAnswer 会在这种情况下抛 BAD_JSON 并降级）');
  } else {
    console.log('    ✗ ' + (r2.status || r2.note));
    console.log('    ' + String(r2.raw || '').slice(0, 200));
  }

  // —— 测 3：余额是否充足（用报错信息判断）——
  console.log('');
  console.log('[3] 余额 / 配额');
  if (r1.status === 402 || r2.status === 402) {
    console.log('    ✗ 402：余额不足，需要充值');
  } else if (r1.status === 429 || r2.status === 429) {
    console.log('    ✗ 429：触发限流');
  } else if (r1.status === 200 || r2.status === 200) {
    console.log('    ✓ 能正常调用，说明有可用余额');
  } else {
    console.log('    ? 无法判断');
  }
})();
