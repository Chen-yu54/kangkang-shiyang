#!/usr/bin/env node
// scripts/check-workflow.js —— 工作流联调自检（三段式，按顺序跑能省一半排查时间）
//
// 用法：
//   # ① 平台侧直连（先排除 token / workflow_id / 网络问题）
//   set COZE_TOKEN=pat_xxx
//   node scripts/check-workflow.js --id=7666385885823516682 --params={"term":"立冬"}
//
//   # ② 前端入参映射（不联网，只看问卷答案会变成什么参数）
//   node scripts/check-workflow.js --params-check
//
//   # ③ 云函数逻辑（本地模拟 event，仍需 COZE_TOKEN）
//   node scripts/check-workflow.js --cloud --name=seasonal_recipe --params={"term":"立冬"}
//
// 设计约束：
//   · 零第三方依赖（Node 原生 https），你的环境装不上包
//   · token 只从环境变量读，不写文件、不回显
//   · 只做只读验证，不改任何数据

const https = require('https');
const path = require('path');

const COZE_HOST = 'api.coze.cn';
const COZE_PATH = '/v1/workflow/run';

// 别名 → workflow_id（与 cloudfunctions/workflow/index.js 保持一致）
const WORKFLOWS = {
  qnaire: '7666310500133765163',
  seasonal_recipe: '7666385885823516682',
  unknown3: '7666376707049947142',
  unknown4: '7666377322421354515',
};

function parseArgs(argv) {
  const out = { _: [] };
  argv.slice(2).forEach((a) => {
    if (a.startsWith('--')) {
      const body = a.slice(2);
      const eq = body.indexOf('=');
      if (eq > -1) out[body.slice(0, eq)] = body.slice(eq + 1);
      else out[body] = true;
    } else {
      out._.push(a);
    }
  });
  return out;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

// 三种返回形态取文本（与前端 pickWorkflowText 同逻辑）
function pickText(out) {
  if (!out) return '';
  if (typeof out === 'string') return out;
  if (typeof out.data === 'string') return out.data;
  if (typeof out.output === 'string') return out.output;
  if (out.data && typeof out.data.content === 'string') return out.data.content;
  return '';
}

function postJson(host, reqPath, headers, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const req = https.request(
      {
        hostname: host,
        path: reqPath,
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json', 'Content-Length': body.length },
          headers
        ),
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode, text: Buffer.concat(chunks).toString('utf8') })
        );
      }
    );
    req.on('timeout', () => req.destroy(new Error('请求超时（' + timeoutMs + 'ms）')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function hr(title) {
  console.log('\n' + '─'.repeat(58));
  console.log(title);
  console.log('─'.repeat(58));
}

// ① 平台侧直连
async function checkPlatform(args) {
  const token = process.env.COZE_TOKEN || process.env.COZE_API_TOKEN || '';
  if (!token) {
    hr('① 平台侧直连');
    console.log('✗ 没有找到 token。先设置环境变量：');
    console.log('    PowerShell:  $env:COZE_TOKEN="pat_xxx"');
    console.log('    CMD:         set COZE_TOKEN=pat_xxx');
    console.log('\n  token 在扣子控制台获取：');
    console.log('    个人访问令牌 → https://www.coze.cn/open/oauth/pats');
    return false;
  }

  const workflowId = args.id || WORKFLOWS[args.name] || WORKFLOWS.seasonal_recipe;
  const params = args.params ? safeJson(args.params) : {};
  if (args.params && params === null) {
    console.log('✗ --params 不是合法 JSON，收到：' + args.params);
    return false;
  }

  hr('① 平台侧直连');
  console.log('  endpoint : https://' + COZE_HOST + COZE_PATH);
  console.log('  workflow : ' + workflowId);
  console.log('  params   : ' + JSON.stringify(params));
  console.log('  token    : ' + token.slice(0, 6) + '…（已脱敏，长度 ' + token.length + '）');
  console.log('  请求中…');

  const started = Date.now();
  let res;
  try {
    res = await postJson(
      COZE_HOST,
      COZE_PATH,
      { Authorization: 'Bearer ' + token },
      { workflow_id: workflowId, parameters: params },
      30000
    );
  } catch (e) {
    console.log('\n✗ 网络层失败：' + e.message);
    console.log('  排查：① 本机能否访问 api.coze.cn ② 公司网络/代理是否拦截');
    return false;
  }
  const cost = Date.now() - started;

  console.log('  HTTP ' + res.statusCode + '（' + cost + 'ms）');
  console.log('  原始响应长度：' + res.text.length + ' 字节');

  const body = safeJson(res.text);
  if (!body) {
    console.log('\n✗ 响应不是 JSON，前 300 字符：');
    console.log('  ' + res.text.slice(0, 300));
    return false;
  }

  console.log('  code : ' + body.code);
  console.log('  msg  : ' + (body.msg || body.message || '（无）'));

  if (body.code !== undefined && Number(body.code) !== 0) {
    console.log('\n✗ 平台侧业务错误（这就是「HTTP 200 也可能是失败」的坑）');
    const hints = {
      4100: '鉴权失败：token 无效/过期/无该工作流权限',
      4000: '参数错误：入参字段名必须与工作流开始节点一致',
      4001: '工作流不存在或未发布',
    };
    if (hints[body.code]) console.log('  提示：' + hints[body.code]);
    return false;
  }

  let data = body.data;
  const rawType = typeof data;
  if (rawType === 'string') {
    const parsed = safeJson(data);
    console.log('\n  data 是字符串（' + data.length + ' 字节）' + (parsed ? '，可二次 parse ✓' : '，但不是 JSON'));
    if (parsed) data = parsed;
  }

  const textOut = pickText(body.data);
  console.log('\n✓ 平台侧通了');
  console.log('  data 类型 : ' + rawType);
  if (textOut) console.log('  文本输出  : ' + String(textOut).slice(0, 200));
  if (rawType === 'object' && data) {
    const keys = Array.isArray(data) ? '（数组，' + data.length + ' 项）' : Object.keys(data).join(', ');
    console.log('  data 结构 : ' + keys);
    console.log('  结构化预览: ' + JSON.stringify(data).slice(0, 300));
  }
  return true;
}

// ② 前端入参映射
function checkParamsMapping() {
  hr('② 前端入参映射（不联网）');
  global.wx = global.wx || { getStorageSync: () => null, setStorageSync: () => {} };
  let nutrition;
  try {
    nutrition = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'nutrition.js'));
  } catch (e) {
    console.log('✗ 加载 nutrition.js 失败：' + e.message);
    return false;
  }

  const cases = [
    ['完整作答', { q1: 'a1', q2: 'a2', q3: 'a3', q4: 'a2', q5: ['a1', 'a5'], q6: ['a1', 'a5'] }],
    ['全部不清楚 + 都不回避', { q1: 'unsure', q2: 'unsure', q3: 'unsure', q4: 'unsure', q5: ['a6'], q6: ['a7'] }],
    ['未作答', {}],
  ];

  cases.forEach(([label, answers]) => {
    const p = nutrition.toWorkflowParams(answers);
    console.log('\n  [' + label + ']');
    console.log('    user_physique    : ' + (p.user_physique || '（空）'));
    console.log('    user_preferences : ' + (p.user_preferences || '（空）'));
    console.log('    user_taboos      : ' + (p.user_taboos || '（空）'));
    console.log('    USER_INPUT       : ' + p.USER_INPUT);
    console.log('    CONVERSATION_NAME: ' + (p.CONVERSATION_NAME || '（未配置，需 B 提供固定值）'));
  });

  console.log('\n  ⚠ 字段表要求 3 个必填字段（user_physique / user_preferences / user_taboos），');
  console.log('    但参考文档说工作流二收的是 {term}。两者只能有一个对，需 B 确认。');
  return true;
}

// ③ 云函数逻辑（本地模拟 event）
async function checkCloud(args) {
  hr('③ 云函数逻辑（本地模拟 event）');
  const name = args.name || 'seasonal_recipe';
  const params = args.params ? safeJson(args.params) : {};
  if (args.params && params === null) {
    console.log('✗ --params 不是合法 JSON');
    return false;
  }
  if (!process.env.COZE_TOKEN) {
    console.log('✗ 需要 COZE_TOKEN 环境变量（云函数在线上是从环境变量读的）');
    return false;
  }

  console.log('  event: ' + JSON.stringify({ name, params }));
  let fn;
  try {
    fn = require(path.join(__dirname, '..', 'cloudfunctions', 'workflow', 'index.js'));
  } catch (e) {
    console.log('✗ 加载云函数失败：' + e.message);
    return false;
  }

  const result = await fn.main({ name, params });
  console.log('\n  返回: ' + JSON.stringify(result).slice(0, 400));
  if (result.status === 'success') {
    console.log('\n✓ 云函数逻辑通过（真上线时把这段逻辑放到云端）');
    return true;
  }
  console.log('\n✗ 云函数返回错误：' + result.code + ' — ' + result.message);
  return false;
}

(async () => {
  const args = parseArgs(process.argv);

  if (args['params-check']) {
    checkParamsMapping();
    return;
  }

  console.log('工作流联调自检');
  console.log('  别名表：' + Object.keys(WORKFLOWS).join(' / '));

  let ok = true;
  if (args.cloud) {
    ok = (await checkCloud(args)) && ok;
  } else {
    ok = (await checkPlatform(args)) && ok;
  }

  console.log('\n' + '─'.repeat(58));
  if (ok) {
    console.log('结论：通过。下一步可以进小程序验证（云函数部署后 callFunction）。');
  } else {
    console.log('结论：未通过。按上面的提示逐条排查，不要跳过 ①。');
    process.exitCode = 1;
  }
})();
