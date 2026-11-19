// 契约测试：用 mock 的云环境跑一次 aiqa.main()，验证返回结构能被前端直接消费。
// 用法：$env:PROBE_KEY='sk-xxx'; node scripts/test-aiqa-contract.js
//
// 为什么要有这一层：
//   之前只测了 llm.chat() 能否出 JSON，那只覆盖中间一环。
//   真正决定「qa 页面能不能接通」的是 main() 的返回结构——
//   前端读 res.reply / res.dishes，云函数若返回嵌套的 {answer:{...}} 就全空。
//
// mock 范围：wx-server-sdk（数据库、openid、内容安全）全部打桩，
//   只让真实的 llm / retrieval / prompt / guard 跑起来。

const path = require('path');
const Module = require('module');

const KEY = process.env.PROBE_KEY || '';
if (!KEY) {
  console.error('缺少 PROBE_KEY 环境变量');
  process.exit(1);
}

const CF = path.join(__dirname, '..', 'cloudfunctions', 'aiqa');

// ── 打桩 wx-server-sdk ──
const store = {}; // 假数据库：集合名 -> { docId: data }
const fakeDB = {
  collection(name) {
    const col = (store[name] = store[name] || {});
    return {
      doc(id) {
        return {
          get: async () => {
            if (!col[id]) {
              const e = new Error('document not exist');
              e.errCode = -1;
              throw e;
            }
            return { data: col[id] };
          },
          update: async ({ data }) => {
            col[id] = Object.assign({}, col[id], data);
            return { stats: { updated: 1 } };
          },
          set: async ({ data }) => {
            col[id] = Object.assign({ _id: id }, data);
            return { stats: { created: 1 } };
          },
        };
      },
      add: async ({ data }) => {
        const id = data._id || 'auto_' + Object.keys(col).length;
        col[id] = Object.assign({ _id: id }, data);
        return { _id: id };
      },
    };
  },
};

const fakeSdk = {
  init() {},
  DYNAMIC_CURRENT_ENV: 'fake-env',
  database: () => fakeDB,
  getWXContext: () => ({ OPENID: 'test-openid-0001', APPID: 'wxtest' }),
  openapi: {
    security: {
      msgSecCheck: async () => ({ errCode: 0 }),
    },
  },
};

// 拦截 require('wx-server-sdk')
const origResolve = Module._resolveFilename;
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return fakeSdk;
  return origLoad.apply(this, arguments);
};

process.env.LLM_API_KEY = KEY;
process.env.LLM_MODEL = process.env.PROBE_MODEL || 'deepseek-flash';
process.env.LLM_BASE_URL = process.env.PROBE_BASE || 'https://api.deepseek.com';
process.env.QA_DAILY_LIMIT = '30';

const aiqa = require(path.join(CF, 'index.js'));

const CASES = [
  {
    name: '正常提问（带时间约束）',
    event: {
      question: '我只有半小时，想做个简单点的菜',
      profile: { ageGroup: '成人', taboos: [] },
    },
  },
  {
    name: '空问题',
    event: { question: '', profile: {} },
  },
  {
    name: '限制 20 分钟',
    event: {
      question: '20 分钟内能做什么快手菜',
      profile: { ageGroup: '成人', taboos: [] },
    },
  },
];

function checkShape(r) {
  const errs = [];
  if (!r || typeof r !== 'object') return ['返回不是对象'];
  if (r.status === 'ok') {
    if (typeof r.reply !== 'string' || !r.reply) errs.push('缺 reply（前端 res.reply 会是空）');
    if (!Array.isArray(r.dishes)) errs.push('dishes 不是数组（前端 .map 会崩）');
    else {
      r.dishes.forEach((d, i) => {
        if (!d || !d.id) errs.push('dishes[' + i + '] 缺 id');
        if (d && typeof d.name !== 'undefined' && typeof d.name !== 'string') {
          errs.push('dishes[' + i + '].name 类型异常');
        }
      });
    }
    if (!Array.isArray(r.followups)) errs.push('followups 不是数组');
    if (!Array.isArray(r.sources)) errs.push('sources 不是数组');
  } else {
    if (!r.code) errs.push('错误返回缺 code（前端无法映射文案）');
  }
  return errs;
}

(async () => {
  console.log('');
  console.log('契约测试：aiqa.main() 返回结构 vs 前端消费方式');
  console.log('模型 ' + process.env.LLM_MODEL);
  console.log('');

  let fail = 0;
  for (const c of CASES) {
    const t0 = Date.now();
    let r;
    try {
      r = await aiqa.main(c.event, {});
    } catch (e) {
      console.log('  ✗ ' + c.name + ' 抛异常: ' + e.message);
      fail++;
      continue;
    }
    const ms = Date.now() - t0;
    const errs = checkShape(r);

    console.log('  [' + c.name + ']  ' + ms + ' ms');
    console.log('    status: ' + r.status + (r.code ? '  code: ' + r.code : ''));

    if (r.status === 'ok') {
      console.log('    reply: ' + String(r.reply).replace(/\s+/g, ' ').slice(0, 90));
      console.log(
        '    dishes: ' +
          r.dishes
            .map((d) => (d.name || d.id) + (d.reason ? '(' + String(d.reason).slice(0, 14) + '…)' : ''))
            .join(' / ')
      );
      if (r.meta && r.meta.filtered) {
        const f = r.meta.filtered;
        console.log(
          '    filtered: total=' + f.total + ' kept=' + f.kept + ' droppedTime=' + (f.droppedTime || 0) + ' timeLimit=' + f.timeLimit
        );
      }
    } else {
      console.log('    message: ' + r.message);
    }

    if (errs.length) {
      errs.forEach((e) => console.log('    ✗ ' + e));
      fail++;
    } else {
      console.log('    结构 ✓');
    }
    console.log('');
  }

  console.log(fail === 0 ? '全部通过：qa 页面可以接通' : fail + ' 项有问题');
  process.exit(fail === 0 ? 0 : 1);
})();
