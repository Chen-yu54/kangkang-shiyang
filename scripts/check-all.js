// 扣子链路体检 —— 一条命令测完两条路
//
// 用法：
//   PowerShell:  $env:COZE_TOKEN = 'pat_xxx'; node scripts/check-all.js
//   CMD:         set COZE_TOKEN=pat_xxx && node scripts/check-all.js
//
// 可选：
//   COZE_BOT_ID    不填用云函数里的默认值
//   SKIP_SLOW=1    跳过耗时的工作流调用，只验 token 与 Bot
//
// 测什么（三层，逐层缩小范围）：
//   ① token 本身有没有效、够不够权限
//   ② 工作流：POST /v1/workflow/run（同步，一次返回）
//   ③ Bot：POST /v3/chat → 轮询 → message/list（异步三跳）
//
// 不测什么：
//   云函数是否部署、小程序能否调用——那要开发者工具，脚本碰不到。
//   三层都通了但小程序不通，问题一定在云函数部署或环境变量。

const https = require('https');

const TOKEN = process.env.COZE_TOKEN || process.env.COZE_API_TOKEN || '';
const BOT_ID = process.env.COZE_BOT_ID || '7709769802239475721';
const SKIP_SLOW = process.env.SKIP_SLOW === '1';

const API_HOST = 'api.coze.cn';

// 四条工作流：前两条必测，后两条要必填参数，只在拿到参数时测
const WF_RECOMMEND = { alias: 'seasonal_recipe', id: '7666385885823516682' };
const WF_SURVEY = { alias: 'survey_brief', id: '7666376707049947142' };

const RECOMMEND_PARAMS = {
  user_physique: '怕冷',
  user_preferences: '清淡',
  user_taboos: '海鲜',
};

const FINISHED = ['completed', 'failed', 'canceled', 'requires_action'];
const POLL_INTERVAL = 1200;
const POLL_MAX = 18;

const results = [];

// ─────────────────────────── HTTP ───────────────────────────

function request(method, path, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(
      { hostname: API_HOST, path, method, headers, timeout: timeoutMs || 15000 },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (e) {
            return reject(new Error('返回非 JSON：' + raw.slice(0, 150)));
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on('error', (e) => reject(new Error('网络错误：' + e.message)));
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    if (payload) req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 把上游业务错误码翻成能照着做的一句话 */
function explainCode(code) {
  const c = String(code);
  if (c === '4100') return 'token 无效或已过期';
  if (c === '4101') return 'token 缺权限点，或没绑定工作空间';
  if (c === '4160') return 'Authorization 少了 Bearer 前缀';
  if (c === '4200') return '资源未发布（工作流/Bot 要发布）';
  if (c === '4000') return '参数缺失或 ID 不对';
  if (c === '4001') return '参数格式错误';
  return '上游返回 ' + c;
}

function record(name, ok, ms, detail) {
  results.push({ name, ok, ms, detail });
  const mark = ok === true ? '✓' : ok === 'skip' ? '○' : '✗';
  const time = ms ? String(ms).padStart(6) + ' ms' : '        ';
  console.log('  ' + mark + ' ' + name.padEnd(26) + time + '   ' + (detail || ''));
}

// ─────────────────────── ① token 自检 ───────────────────────

async function checkToken() {
  console.log('');
  console.log('① token 自检');
  if (!TOKEN) {
    record('token', false, 0, '未提供 COZE_TOKEN');
    return false;
  }
  console.log('  token: ' + TOKEN.slice(0, 8) + '…' + TOKEN.slice(-4) + '（' + TOKEN.length + ' 字符）');

  // 扣子没有「查 token 信息」的公开接口，用一个最轻的调用试探：
  // 故意传空 workflow_id，能返回 4000（参数错误）说明认证已过，返回 4100/4101 说明认证没过。
  try {
    const r = await request('POST', '/v1/workflow/run', { workflow_id: '', parameters: {} }, 15000);
    const code = r.json && r.json.code;
    if (code === 4000 || code === 4001) {
      record('认证', true, 0, '通过（探针返回参数错误，说明 token 本身有效）');
      return true;
    }
    if (code === 4100 || code === 4101) {
      record('认证', false, 0, explainCode(code));
      return false;
    }
    record('认证', true, 0, '通过（返回 code=' + code + '）');
    return true;
  } catch (e) {
    record('认证', false, 0, e.message);
    return false;
  }
}

// ──────────────────── ② 工作流（同步） ────────────────────

function pickText(out) {
  if (!out) return '';
  if (typeof out === 'string') return out;
  if (typeof out.data === 'string') return out.data;
  if (typeof out.output === 'string') return out.output;
  if (out.data && typeof out.data.content === 'string') return out.data.content;
  return '';
}

async function checkWorkflow(wf, params, label, required) {
  if (SKIP_SLOW && required) {
    record(label, 'skip', 0, 'SKIP_SLOW=1 已跳过');
    return;
  }
  const t0 = Date.now();
  try {
    const r = await request('POST', '/v1/workflow/run', { workflow_id: wf.id, parameters: params }, 55000);
    const ms = Date.now() - t0;
    const j = r.json || {};

    if (j.code !== 0) {
      record(label, false, ms, explainCode(j.code) + (j.msg ? '：' + String(j.msg).slice(0, 60) : ''));
      return;
    }

    let data = j.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { /* 保持字符串 */ }
    }
    const text = pickText(data);
    const len = String(text).length;

    if (!len) {
      record(label, false, ms, '返回 code=0 但正文为空');
      return;
    }
    record(label, true, ms, '正文 ' + len + ' 字符');
  } catch (e) {
    record(label, false, Date.now() - t0, e.message);
  }
}

// ──────────────────── ③ Bot（异步三跳） ────────────────────

async function checkBot() {
  const label = 'Bot 对话（三跳）';
  const t0 = Date.now();
  const uid = 'check-all-' + Date.now().toString(36);

  try {
    // 第一跳
    const r1 = await request('POST', '/v3/chat', {
      bot_id: BOT_ID,
      user_id: uid,
      stream: false,
      auto_save_history: true,
      additional_messages: [{ role: 'user', content: '今天吃什么好', content_type: 'text' }],
    }, 15000);

    const j1 = r1.json || {};
    if (j1.code !== undefined && j1.code !== 0) {
      record(label, false, Date.now() - t0, explainCode(j1.code) + '（第一跳）');
      return;
    }
    let chat = j1.data || j1;
    if (!chat || !chat.id) {
      record(label, false, Date.now() - t0, '第一跳没拿到 chat_id');
      return;
    }

    // 第二跳：轮询
    let round = 0;
    let done = chat;
    while (FINISHED.indexOf(done.status) < 0 && round < POLL_MAX) {
      await sleep(POLL_INTERVAL);
      round += 1;
      try {
        const r2 = await request(
          'GET',
          '/v3/chat/retrieve?conversation_id=' + encodeURIComponent(chat.conversation_id) + '&chat_id=' + encodeURIComponent(chat.id)
        , null, 15000);
        done = (r2.json && r2.json.data) || r2.json || done;
      } catch (e) {
        // 单次轮询失败不中断，继续下一轮
      }
    }

    if (FINISHED.indexOf(done.status) < 0) {
      record(label, false, Date.now() - t0, '轮询 ' + POLL_MAX + ' 次仍未结束（status=' + done.status + '）');
      return;
    }
    if (done.status === 'failed') {
      record(label, false, Date.now() - t0, 'Bot 处理失败');
      return;
    }

    // 第三跳：取消息
    const r3 = await request(
      'GET',
      '/v3/chat/message/list?conversation_id=' + encodeURIComponent(chat.conversation_id) + '&chat_id=' + encodeURIComponent(chat.id)
    , null, 15000);
    const list = (r3.json && r3.json.data) || [];
    const answers = (Array.isArray(list) ? list : []).filter(
      (m) => m && m.role === 'assistant' && m.type === 'answer' && m.content
    );
    const text = answers.map((m) => String(m.content)).join('\n').trim();

    if (!text) {
      record(label, false, Date.now() - t0, '三跳都通了但没取到回复内容');
      return;
    }
    record(label, true, Date.now() - t0, '回复 ' + text.length + ' 字符，轮询 ' + round + ' 次');
  } catch (e) {
    record(label, false, Date.now() - t0, e.message);
  }
}

// ─────────────────────────── 主流程 ───────────────────────────

async function main() {
  console.log('');
  console.log('══════════ 扣子链路体检 ══════════');

  const ok = await checkToken();
  if (!ok) {
    console.log('');
    console.log('  token 没过，后面两项没有意义，先去解决认证：');
    console.log('    ① 扣子 → API & SDK → 授权 → 个人访问令牌 → 添加');
    console.log('    ② 勾 run / chat / getChat / listMessage');
    console.log('    ③ 访问工作空间必须选中 Bot 所在空间');
    summarize();
    return;
  }

  console.log('');
  console.log('② 工作流（同步）');
  await checkWorkflow(WF_RECOMMEND, RECOMMEND_PARAMS, '工作流 · 当令菜推荐', true);
  await checkWorkflow(WF_SURVEY, {}, '工作流 · 调研简报', false);

  console.log('');
  console.log('③ Bot（异步三跳）');
  await checkBot();

  summarize();
}

function summarize() {
  console.log('');
  console.log('────────── 结论 ──────────');
  const pass = results.filter((r) => r.ok === true).length;
  const fail = results.filter((r) => r.ok === false).length;
  const skip = results.filter((r) => r.ok === 'skip').length;

  console.log('  通过 ' + pass + ' 项 / 失败 ' + fail + ' 项 / 跳过 ' + skip + ' 项');

  const failed = results.filter((r) => r.ok === false);
  if (failed.length) {
    console.log('');
    console.log('  失败项：');
    failed.forEach((r) => console.log('    ✗ ' + r.name + '：' + (r.detail || '')));
    console.log('');
    console.log('  下一步对照：');
    console.log('    「token 无效或已过期」      → 重新生成（PAT 最长 30 天，不可续期）');
    console.log('    「缺权限点 / 没绑工作空间」  → 重建令牌，勾 run+chat+getChat+listMessage，选对空间');
    console.log('    「资源未发布」              → 扣子后台点发布；Bot 发布时选 Bot as API');
    console.log('    「轮询 N 次仍未结束」        → Bot 太慢，换模型或简化流程');
  } else {
    console.log('');
    console.log('  ✓ 平台侧两条链路都通了。');
    console.log('');
    console.log('  如果小程序里还是报「扣子无响应」，问题不在平台，在下面两处：');
    console.log('    1. 云函数是否部署：右键 cloudfunctions/aichat 与 workflow → 上传并部署');
    console.log('    2. 云函数环境变量：COZE_TOKEN 是否填了、超时是否改成 60 秒');
  }
  console.log('');
}

main().catch((e) => {
  console.log('未捕获错误：' + e.message);
  process.exit(1);
});
