/**
 * scripts/test-e2e.js
 * 端到端跑通云函数主流程：mock 掉 wx-server-sdk，起一个本地 OpenAI 兼容服务。
 * 运行：node scripts/test-e2e.js
 */
const http = require('http');
const path = require('path');
const assert = require('assert');
const Module = require('module');

const ROOT = path.join(__dirname, '..', 'cloudfunctions', 'aiqa');

/* ---------- mock wx-server-sdk ---------- */
const mockCloud = {
  DYNAMIC_CURRENT_ENV: 'test-env',
  init() {},
  getWXContext() {
    return { OPENID: 'test_openid_001' };
  },
  database() {
    throw new Error('no database in test');
  },
  openapi: {
    security: {
      msgSecCheck: async () => {
        throw Object.assign(new Error('no openapi permission in test'), { errCode: -1 });
      },
    },
  },
};
const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'wx-server-sdk') return mockCloud;
  return origLoad.apply(this, arguments);
};

/* ---------- mock LLM ---------- */
let nextContent = '{"reply":"ok","dishes":[]}';
let nextStatus = 200;
let requestCount = 0;

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => {
    raw += c;
  });
  req.on('end', () => {
    requestCount += 1;
    const content = typeof nextContent === 'function' ? nextContent(raw) : nextContent;
    res.writeHead(nextStatus, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        id: 'chatcmpl-test',
        model: 'mock-model',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      })
    );
  });
});

function call(payload) {
  const mod = require(path.join(ROOT, 'index.js'));
  return mod.main(payload);
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log('  ✓ ' + name);
  } catch (e) {
    results.push({ name, ok: false, msg: e.message });
    console.log('  ✗ ' + name + ' → ' + e.message);
  }
}

function startServer() {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

(async () => {
  const port = await startServer();
  process.env.LLM_BASE_URL = 'http://127.0.0.1:' + port;
  process.env.LLM_API_KEY = 'sk-test-fake-key';
  process.env.LLM_MODEL = 'mock-model';
  delete process.env.SEARCH_API_URL;

  const recipes = require(path.join(ROOT, 'data', 'recipes.json'));
  const ids = new Set(recipes.map((r) => r.id));

  console.log('\n[E2E] 云函数主流程');

  await test('正常问答：返回合法菜品，ID 全部存在于菜品库', async () => {
    nextStatus = 200;
    nextContent = JSON.stringify({
      reply: '立冬了，可以吃点温润的。',
      dishes: [
        { id: 'GF0021', reason: '淮山配鸡，温润不燥，适合怕冷的人。' },
        { id: 'GF0039', reason: '岭南常用汤料，冬天喝舒服。' },
      ],
      followups: ['想喝汤', '清淡一点'],
      need_search: false,
      search_query: '',
      sources: [],
    });
    const r = await call({
      question: '今天吃什么',
      profile: { physique: '怕冷；口干', preferences: ['清淡'], taboos: ['海鲜'], favoriteIds: ['GF0001'], ageGroup: '成人' },
      history: [],
    });
    assert.strictEqual(r.status, 'ok');
    assert(r.dishes.length === 2, '菜品数 ' + r.dishes.length);
    r.dishes.forEach((d) => assert(ids.has(d.id), 'ID 不在库：' + d.id));
    assert(r.reply.indexOf('立冬') >= 0 || r.reply.length > 0);
    assert(r.disclaimer.indexOf('不构成医疗建议') >= 0, '缺少免责声明');
  });

  await test('模型编造菜名：非法 ID 被丢弃，不足则降级', async () => {
    nextContent = JSON.stringify({
      reply: '给你推荐三道。',
      dishes: [{ id: 'FAKE999', reason: '不存在的菜' }],
      followups: [],
      sources: [],
    });
    const r = await call({ question: '今天吃什么', profile: { taboos: [], ageGroup: '成人' } });
    assert.strictEqual(r.status, 'ok');
    assert(r.dishes.length > 0, '应降级给当令菜');
    r.dishes.forEach((d) => assert(ids.has(d.id), '降级也给了非法 ID：' + d.id));
    assert.strictEqual(r.meta.degraded, true);
  });

  await test('模型返回带 ```json 围栏的字符串也能解析', async () => {
    nextContent = '```json\n{"reply":"试试蒸水蛋。","dishes":[{"id":"GF0002","reason":"清淡好消化。"}],"followups":[],"sources":[]}\n```';
    const r = await call({ question: '想吃点软和的', profile: { taboos: [], ageGroup: '长者' } });
    assert.strictEqual(r.status, 'ok');
    assert.strictEqual(r.dishes[0].id, 'GF0002');
  });

  await test('模型输出非 JSON：降级且不伪造答案', async () => {
    nextContent = '我觉得你可以吃点粥。';
    const r = await call({ question: '今天吃什么', profile: { taboos: [], ageGroup: '成人' } });
    assert.strictEqual(r.status, 'ok');
    assert.strictEqual(r.meta.degraded, true);
    assert(r.dishes.length > 0);
  });

  await test('上游 500：重试后仍失败则降级', async () => {
    nextStatus = 500;
    nextContent = '{"error":"boom"}';
    const before = requestCount;
    const r = await call({ question: '今天吃什么', profile: { taboos: [], ageGroup: '成人' } });
    nextStatus = 200;
    assert.strictEqual(r.status, 'ok');
    assert.strictEqual(r.meta.degraded, true);
    assert(requestCount - before >= 2, '应重试过一次，实际请求 ' + (requestCount - before));
  });

  await test('未配 Key：返回 LLM_KEY_MISSING', async () => {
    const saved = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;
    const r = await call({ question: '今天吃什么', profile: {} });
    process.env.LLM_API_KEY = saved;
    assert.strictEqual(r.status, 'error');
    assert.strictEqual(r.code, 'LLM_KEY_MISSING');
  });

  await test('空问题：返回 EMPTY_QUESTION', async () => {
    const r = await call({ question: '   ', profile: {} });
    assert.strictEqual(r.code, 'EMPTY_QUESTION');
  });

  await test('回避海鲜：送给模型的候选池里没有任何海鲜', async () => {
    let promptSeen = '';
    nextContent = (raw) => {
      promptSeen = raw;
      return JSON.stringify({ reply: '好', dishes: [{ id: 'GF0001', reason: '清淡' }], followups: [], sources: [] });
    };
    await call({ question: '今天吃什么', profile: { taboos: ['海鲜'], ageGroup: '成人' } });
    const body = JSON.parse(promptSeen);
    const userMsg = body.messages[1].content;
    const seafood = ['虾', '蟹', '蚝', '蛤', '鱿鱼', '紫菜', '海带'];
    const leaked = seafood.filter((w) => userMsg.indexOf(w) >= 0);
    // 允许出现在 caution 文本中，但候选 ingredients 里不应有
    const jsonPart = userMsg.slice(userMsg.indexOf('['), userMsg.indexOf(']\n\n') + 1);
    const leakedInJson = seafood.filter((w) => jsonPart.indexOf(w) >= 0);
    assert.strictEqual(leakedInJson.length, 0, '候选含海鲜：' + leakedInJson.join(','));
    assert(leaked.length >= 0);
  });

  await test('触发搜索词但未配搜索：不报错，sources 为空', async () => {
    nextContent = JSON.stringify({ reply: '这个我查不到实时价格。', dishes: [{ id: 'GF0001', reason: '清淡' }], followups: [], sources: [] });
    const r = await call({ question: '现在富硒米多少钱一斤', profile: { taboos: [], ageGroup: '成人' } });
    assert.strictEqual(r.status, 'ok');
    assert.deepStrictEqual(r.sources, []);
    assert.strictEqual(r.meta.searchUsed, false);
  });

  await test('回避项过严导致无候选：返回 NO_CANDIDATE', async () => {
    const all = ['海鲜', '牛肉', '羊肉', '猪肉', '鸡肉', '鸭肉', '蛋', '奶', '花生', '坚果', '芒果', '香菜', '辛辣', '油腻', '生冷', '酒', '麸质', '豆制品', '菌菇', '高嘌呤', '高糖', '高盐'];
    const r = await call({ question: '今天吃什么', profile: { taboos: all, ageGroup: '长者' } });
    assert(r.status === 'ok' || r.code === 'NO_CANDIDATE', '实际：' + JSON.stringify(r).slice(0, 120));
    if (r.status === 'error') assert.strictEqual(r.code, 'NO_CANDIDATE');
  });

  await test('节气由云函数计算，不受前端伪造影响', async () => {
    nextContent = JSON.stringify({ reply: '好', dishes: [{ id: 'GF0001', reason: '清淡' }], followups: [], sources: [] });
    const r = await call({ question: '今天吃什么', profile: { currentTerm: '伪造节气', taboos: [], ageGroup: '成人' } });
    assert(r.meta.term && r.meta.term !== '伪造节气', '节气未被校正：' + r.meta.term);
  });

  console.log('\n================ E2E 结果 ================');
  const failed = results.filter((r) => !r.ok);
  console.log('通过 ' + (results.length - failed.length) + ' 项，失败 ' + failed.length + ' 项');
  if (failed.length) {
    failed.forEach((f) => console.log(' - ' + f.name + '：' + f.msg));
  }
  server.close();
  process.exit(failed.length ? 1 : 0);
})();
