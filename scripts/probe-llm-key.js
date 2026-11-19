// 探针：验证 LLM_API_KEY 属于哪个平台、能否调用、有哪些模型可用。
// 用法：$env:PROBE_KEY='sk-xxx'; node scripts/probe-llm-key.js
//
// 不打印 key 本身，只报告验证结果。
// 依次试几家 OpenAI 兼容平台，第一个返回 200 的就是它所属的平台。

const https = require('https');

const KEY = process.env.PROBE_KEY || '';
if (!KEY) {
  console.error('缺少 PROBE_KEY 环境变量');
  process.exit(1);
}

const CANDIDATES = [
  { name: 'DeepSeek', base: 'https://api.deepseek.com' },
  { name: '硅基流动', base: 'https://api.siliconflow.cn/v1' },
  { name: '智谱 GLM', base: 'https://open.bigmodel.cn/api/paas/v4' },
  { name: '月之暗面 Kimi', base: 'https://api.moonshot.cn/v1' },
  { name: 'OpenAI', base: 'https://api.openai.com/v1' },
];

function get(urlStr, key, timeout) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch (e) {
      return resolve({ ok: false, status: 0, note: 'URL 不合法' });
    }
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          let body = null;
          try {
            body = JSON.parse(raw);
          } catch (e) {
            /* 非 JSON */
          }
          resolve({
            ok: res.statusCode === 200,
            status: res.statusCode,
            body,
            raw: raw.slice(0, 300),
          });
        });
      }
    );
    req.setTimeout(timeout || 12000, () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (e) => resolve({ ok: false, status: 0, note: e.message }));
    req.end();
  });
}

(async () => {
  console.log('');
  console.log('探测 key 所属平台（依次试探 /models 接口）');
  console.log('');

  let hit = null;
  for (const c of CANDIDATES) {
    const r = await get(c.base.replace(/\/+$/, '') + '/models', KEY);
    const label =
      r.ok ? '✓ 200 可用' : r.status ? '✗ HTTP ' + r.status : '✗ ' + (r.note || '连接失败');
    console.log('  ' + c.name.padEnd(16) + label);
    if (r.ok && !hit) {
      hit = { ...c, body: r.body };
    }
  }

  console.log('');
  if (!hit) {
    console.log('  结论：这个 key 在以上平台都没通过验证。');
    console.log('  可能是：平台不在列表里 / key 已失效 / key 复制不完整 / 需要额外 header。');
    return;
  }

  console.log('  结论：属于【' + hit.name + '】，Base URL = ' + hit.base);
  console.log('');

  // 列出可用模型
  const ids = (hit.body && hit.body.data) || [];
  if (ids.length) {
    console.log('  可用模型（' + ids.length + ' 个）：');
    ids
      .map((m) => m.id)
      .filter(Boolean)
      .sort()
      .forEach((id) => console.log('    ' + id));
  } else {
    console.log('  /models 未返回模型列表，需手动到控制台查。');
  }
})();
