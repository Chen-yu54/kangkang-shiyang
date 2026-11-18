// cloudfunctions/workflow/index.js —— 扣子工作流转发（运行在微信云开发）
//
// 为什么要有这一层：
//   扣子 API 要 Authorization: Bearer <token>，而小程序包是可解包的。
//   token 一旦写进前端就等于公开，别人能直接刷你的工作流额度。
//   这个云函数持 token（环境变量），前端只传「别名 + 参数」，包里没有任何凭证。
//
// 三个必须守住的点（都对应真实故障）：
//   1. 平台业务错误是 HTTP 200 + body.code !== 0，只判状态码会把失败当成功；
//   2. 返回值 body.data 是 JSON 字符串，要二次 parse；
//   3. 返回结构有三种（{content_type,data} / {output} / 纯字符串），统一用 pickText 兜。
//
// 零第三方依赖：用 Node 原生 https，不需要 npm install（云函数环境可能装不上包）。

const https = require('https');

const COZE_API = 'api.coze.cn';
const COZE_PATH = '/v1/workflow/run';
// 实测工作流耗时 17–22s（波动大），所以上游给到 50s，留出冷启动余量。
// 注意：微信云函数总超时默认 20s，必须在控制台改成 60s，否则这里再大也没用。
const REQUEST_TIMEOUT = 50000;

// 别名 → workflow_id。前端只传别名，长 ID 不进小程序包。
// 四个 ID 由 B 提供（见《字段表》）；三、四已于 2026-11-17 实测确认用途。
const WORKFLOWS = {
  qnaire: '7666310500133765163',
  seasonal_recipe: '7666385885823516682',
  // 调研统计简报：空参数可跑，返回 {output:'<markdown>'}
  survey_brief: '7666376707049947142',
  // 报告：必填 report_type + month，返回 {district_report, personal_report}
  weekly_report: '7666377322421354515',
};

// 返回结构兼容：三种形态取文本，取不到就返回空串（由前端决定降级）
function pickText(out) {
  if (!out) return '';
  if (typeof out === 'string') return out;
  if (typeof out.data === 'string') return out.data;
  if (typeof out.output === 'string') return out.output;
  if (out.data && typeof out.data.content === 'string') return out.data.content;
  return '';
}

function postJson(host, path, headers, payload) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const req = https.request(
      {
        hostname: host,
        path,
        method: 'POST',
        headers: Object.assign(
          {
            'Content-Type': 'application/json',
            'Content-Length': body.length,
          },
          headers
        ),
        timeout: REQUEST_TIMEOUT,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            text: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('UPSTREAM_TIMEOUT'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.main = async (event) => {
  const name = event && event.name;
  const params = (event && event.params) || {};

  const workflowId = WORKFLOWS[name];
  if (!workflowId) {
    return { status: 'error', code: 'UNKNOWN_WORKFLOW', message: '未知的工作流别名：' + (name || '(空)') };
  }

  const token = process.env.COZE_TOKEN;
  if (!token) {
    // 没配 token 就明确报错，不伪造结果
    return { status: 'error', code: 'TOKEN_MISSING', message: '云函数环境变量 COZE_TOKEN 未配置' };
  }

  let upstream;
  try {
    upstream = await postJson(
      COZE_API,
      COZE_PATH,
      { Authorization: 'Bearer ' + token },
      { workflow_id: workflowId, parameters: params }
    );
  } catch (e) {
    return { status: 'error', code: 'UPSTREAM_FAILED', message: String(e && e.message ? e.message : e) };
  }

  let body = null;
  try {
    body = JSON.parse(upstream.text);
  } catch (e) {
    return {
      status: 'error',
      code: 'UPSTREAM_NOT_JSON',
      message: '上游返回非 JSON（HTTP ' + upstream.statusCode + '）',
      raw: String(upstream.text || '').slice(0, 200),
    };
  }

  // 平台业务错误：HTTP 200 也可能是失败，必须看 code
  if (body.code !== undefined && Number(body.code) !== 0) {
    return {
      status: 'error',
      code: body.code,
      message: body.msg || body.message || '工作流返回错误',
    };
  }
  if (upstream.statusCode !== 200) {
    return { status: 'error', code: 'HTTP_' + upstream.statusCode, message: '上游状态码异常' };
  }

  // data 可能是 JSON 字符串，解析成功就用对象，失败就把原文交给前端
  let data = body.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      // 保持字符串：调用方可能只需要文本
    }
  }

  return {
    status: 'success',
    data,
    // 注意：这里必须用**解析后**的 data。
    // 之前写的是 body.data（未解析的原始串），于是 text 变成
    // '{"content_type":1,"data":"<真正的 markdown>"}' —— 一整串 JSON 外壳，
    // 前端拿它当正文解析，一个菜名都认不出。
    text: pickText(data),
  };
};
