// 扣子 Bot 链路验证 —— 三步走（chat → retrieve 轮询 → message/list）
//
// 用法（token 只从环境变量取，不写进任何文件）：
//   PowerShell:  $env:COZE_TOKEN = 'pat_xxx'; node scripts/check-bot.js
//   CMD:         set COZE_TOKEN=pat_xxx && node scripts/check-bot.js
//
// 可选环境变量：
//   COZE_BOT_ID   不填则用云函数里的默认值
//   TEST_QUESTION 不填则用「今天吃什么好」
//
// 这个脚本验证的是**平台侧能不能通**，与小程序无关。
// 平台通了但小程序不通，说明问题在云函数部署或环境变量。
//
// ⚠️ Bot 不需要单独的 token，与调工作流用的是**同一个 PAT**。
//    但 PAT 的权限点必须勾对，否则报 4101：
//      v3/chat                → chat
//      v3/chat/retrieve       → getChat
//      v3/chat/message/list   → listMessage
//      v1/workflow/run        → run
//    而且权限点属于「工作空间级」，生成令牌时必须同时选定 Bot 所在的工作空间。
//    PAT 有效期最长 30 天，过期不可续期，只能重建。

const https = require('https');

const TOKEN = process.env.COZE_TOKEN || '';
const BOT_ID = process.env.COZE_BOT_ID || '7709769802239475721';
const QUESTION = process.env.TEST_QUESTION || '今天吃什么好';
const USER_ID = 'check-bot-' + Date.now().toString(36);

const API_HOST = 'api.coze.cn';
const POLL_INTERVAL = 1200;
const POLL_MAX = 20;
const FINISHED = ['completed', 'failed', 'canceled', 'requires_action'];

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      Authorization: 'Bearer ' + TOKEN,
      'Content-Type': 'application/json',
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(
      { hostname: API_HOST, path, method, headers, timeout: 15000 },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (e) {
            return reject(new Error('返回非 JSON：' + raw.slice(0, 200)));
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

async function main() {
  console.log('=== 扣子 Bot 链路验证 ===');
  console.log('  Bot ID   : ' + BOT_ID + '（' + String(BOT_ID).length + ' 位）');
  console.log('  问题     : ' + QUESTION);
  console.log('  匿名 uid : ' + USER_ID);

  if (!TOKEN) {
    console.log('');
    console.log('  ✗ 未提供 COZE_TOKEN');
    console.log('    PowerShell:  $env:COZE_TOKEN = "pat_xxx"; node scripts/check-bot.js');
    process.exit(1);
  }

  const t0 = Date.now();

  // ── 第一跳：发起对话 ──
  console.log('');
  console.log('--- ① POST /v3/chat ---');
  let chat;
  try {
    const r = await request('POST', '/v3/chat', {
      bot_id: BOT_ID,
      user_id: USER_ID,
      stream: false,
      auto_save_history: true,
      additional_messages: [{ role: 'user', content: QUESTION, content_type: 'text' }],
    });

    if (r.status !== 200) {
      console.log('  ✗ HTTP ' + r.status);
      console.log('  ' + JSON.stringify(r.json).slice(0, 300));
      process.exit(1);
    }

    const j = r.json;
    if (j.code !== undefined && j.code !== 0) {
      console.log('  ✗ 业务错误 code=' + j.code + '  ' + (j.msg || ''));
      if (j.code === 4100) console.log('    → token 无效、已过期，或没授权这个 Bot');
      if (j.code === 4101) console.log('    → token 没勾 chat / getChat / listMessage 权限，或没绑定该 Bot 所在的工作空间');
      if (j.code === 4200) console.log('    → Bot 未发布（扣子后台点「发布」，发布时选 Bot as API）');
      if (j.code === 4000) console.log('    → 参数缺失，检查 bot_id');
      if (j.code === 4160) console.log('    → Authorization 少了 Bearer 前缀');
      process.exit(1);
    }

    chat = j.data || j;
    console.log('  ✓ chat_id         = ' + chat.id);
    console.log('  ✓ conversation_id = ' + chat.conversation_id);
    console.log('  ✓ status          = ' + chat.status);
  } catch (e) {
    console.log('  ✗ ' + e.message);
    process.exit(1);
  }

  // ── 第二跳：轮询到终态 ──
  console.log('');
  console.log('--- ② GET /v3/chat/retrieve（轮询）---');
  let round = 0;
  let done = chat;
  while (FINISHED.indexOf(done.status) < 0 && round < POLL_MAX) {
    await sleep(POLL_INTERVAL);
    round += 1;
    try {
      const r = await request(
        'GET',
        '/v3/chat/retrieve?conversation_id=' + encodeURIComponent(chat.conversation_id) + '&chat_id=' + encodeURIComponent(chat.id)
      );
      done = (r.json && r.json.data) || r.json;
      console.log('  第 ' + round + ' 次: status=' + done.status);
    } catch (e) {
      console.log('  第 ' + round + ' 次失败: ' + e.message);
    }
  }

  if (FINISHED.indexOf(done.status) < 0) {
    console.log('  ✗ 轮询 ' + POLL_MAX + ' 次仍未结束（' + done.status + '）');
    process.exit(1);
  }
  if (done.status === 'failed') {
    console.log('  ✗ Bot 处理失败: ' + JSON.stringify(done.last_error || {}).slice(0, 200));
    process.exit(1);
  }
  console.log('  ✓ 终态 = ' + done.status + '（用了 ' + round + ' 次轮询）');

  // ── 第三跳：取消息 ──
  console.log('');
  console.log('--- ③ GET /v3/chat/message/list ---');
  let reply = '';
  try {
    const r = await request(
      'GET',
      '/v3/chat/message/list?conversation_id=' + encodeURIComponent(chat.conversation_id) + '&chat_id=' + encodeURIComponent(chat.id)
    );
    const data = (r.json && r.json.data) || [];
    const list = Array.isArray(data) ? data : [];
    const answers = list.filter((m) => m && m.role === 'assistant' && m.type === 'answer' && m.content);
    console.log('  消息条数: ' + list.length + '，其中 answer ' + answers.length + ' 条');
    reply = answers.map((m) => String(m.content)).join('\n').trim();
  } catch (e) {
    console.log('  ✗ ' + e.message);
    process.exit(1);
  }

  if (!reply) {
    console.log('  ✗ 没有取到回复内容');
    process.exit(1);
  }

  const ms = Date.now() - t0;
  console.log('');
  console.log('=== 结果 ===');
  console.log('  ✓ 链路通了，总耗时 ' + ms + ' ms');
  console.log('');
  console.log('  回复前 300 字：');
  console.log('  ' + reply.slice(0, 300).replace(/\n/g, '\n  '));
  console.log('');
  console.log('  下一步：');
  console.log('    1. 右键 cloudfunctions/aichat → 上传并部署');
  console.log('    2. 云开发控制台 → aichat → 配置 → 环境变量 COZE_TOKEN = 同一个 token');
  console.log('    3. 超时改 60 秒（三跳 + 轮询最多 22 秒，默认 20 秒不够）');
  console.log('    4. 小程序内首页 → 康康对话 → 发一句话');
}

main().catch((e) => {
  console.log('  未捕获错误: ' + e.message);
  process.exit(1);
});
