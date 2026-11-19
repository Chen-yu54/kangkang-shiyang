// 探针：对比 thinking 开/关对 deepseek-flash 的影响。
// 用法：$env:PROBE_KEY='sk-xxx'; node scripts/probe-llm-thinking.js
//
// 起因：基础问答用 max_tokens=100 时返回了空字符串，
// 但 usage 显示输出了 100 token —— 全用在思考过程上，正文一个字没剩。
// aiqa 的 maxTokens 是 500/800，若思考占用过多，会出现：
//   ① 回答被截断成空   ② 耗时逼近 60 秒云函数超时   ③ token 成本翻倍
// 这里实测两种模式的耗时与可用性，决定项目里要不要显式关闭思考。

const https = require('https');

const KEY = process.env.PROBE_KEY || '';
const BASE = (process.env.PROBE_BASE || 'https://api.deepseek.com').replace(/\/+$/, '');
const MODEL = process.env.PROBE_MODEL || 'deepseek-flash';
const ENDPOINT = BASE + '/v1/chat/completions';

if (!KEY) {
  console.error('缺少 PROBE_KEY 环境变量');
  process.exit(1);
}

function post(body) {
  return new Promise((resolve) => {
    const url = new URL(ENDPOINT);
    const payload = JSON.stringify(body);
    const t0 = Date.now();
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + KEY,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          let p = null;
          try {
            p = JSON.parse(raw);
          } catch (e) {}
          resolve({ status: res.statusCode, body: p, raw: raw.slice(0, 300), ms: Date.now() - t0 });
        });
      }
    );
    req.setTimeout(60000, () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ status: 0, note: e.message, ms: Date.now() - t0 }));
    req.write(payload);
    req.end();
  });
}

const SYS = '只输出 JSON，不要解释。格式：{"answer":"字符串","dishes":["菜名"]}';
const USER = '半小时能做什么菜？给一道，并说明大概多久。';

function probe(label, extra) {
  const body = Object.assign(
    {
      model: MODEL,
      messages: [
        { role: 'system', content: SYS },
        { role: 'user', content: USER },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 800,
    },
    extra || {}
  );
  return post(body).then((r) => {
    let text = '';
    let jsonOk = false;
    if (r.status === 200 && r.body && r.body.choices && r.body.choices[0]) {
      text = r.body.choices[0].message.content || '';
      try {
        jsonOk = !!JSON.parse(text);
      } catch (e) {}
    }
    const u = (r.body && r.body.usage) || {};
    console.log(
      '  ' +
        label.padEnd(22) +
        (r.status === 200 ? '200' : String(r.status || r.note)).padEnd(6) +
        String(r.ms + 'ms').padEnd(9) +
        ('in ' + (u.prompt_tokens || 0) + ' / out ' + (u.completion_tokens || 0)).padEnd(22) +
        (r.status === 200 ? (jsonOk ? 'JSON ✓' : 'JSON ✗') : '失败')
    );
    if (r.status === 200 && text) {
      console.log('      ' + text.replace(/\s+/g, ' ').slice(0, 100));
    }
    return { ok: r.status === 200 && jsonOk, ms: r.ms, out: u.completion_tokens || 0 };
  });
}

(async () => {
  console.log('');
  console.log('模型 ' + MODEL + '：thinking 开 / 关 对比');
  console.log('  ' + '模式'.padEnd(20) + '状态'.padEnd(6) + '耗时'.padEnd(9) + 'token'.padEnd(22) + '结果');
  console.log('  ' + '-'.repeat(72));

  const a = await probe('默认（不传 thinking）', {});
  const b = await probe('thinking: disabled', { thinking: { type: 'disabled' } });
  const c = await probe('reasoning_effort: low', { reasoning_effort: 'low' });

  console.log('');
  console.log('  结论：');
  const best = [a, b, c].filter((x) => x.ok).sort((x, y) => x.ms - y.ms)[0];
  if (!best) {
    console.log('    三种模式都没拿到合法 JSON，需人工排查。');
  } else {
    console.log('    最快且可用的是上面耗时最短的那行（' + best.ms + ' ms，输出 ' + best.out + ' token）。');
    if (b.ok && a.ok && b.ms < a.ms) {
      console.log('    关闭 thinking 更快，建议 aiqa 显式传 thinking: {type: "disabled"}');
    }
  }
})();
