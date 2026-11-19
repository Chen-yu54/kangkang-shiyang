/**
 * scripts/test-core.js
 * 不依赖微信环境的核心逻辑自测：硬过滤 / 排序 / 输出校验 / 降级。
 * 运行：node scripts/test-core.js
 */
const assert = require('assert');
const path = require('path');

const root = path.join(__dirname, '..', 'cloudfunctions', 'aiqa');
const recipes = require(path.join(root, 'data', 'recipes.json'));
const { buildCandidates, hardFilter, expandTaboos } = require(path.join(root, 'lib', 'retrieval'));
const { buildMessages } = require(path.join(root, 'lib', 'prompt'));
const { validateAnswer } = require(path.join(root, 'lib', 'guard'));
const { parseAnswer } = require(path.join(root, 'lib', 'llm'));

let pass = 0;
const fails = [];

function check(name, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ✓ ' + name);
  } catch (e) {
    fails.push(name + ' → ' + e.message);
    console.log('  ✗ ' + name + ' → ' + e.message);
  }
}

function hasTaboo(list, words) {
  return list.some((r) => {
    const pool = [].concat(r.mainIngredients || [], r.allergen || [], [r.name || '']).join('|');
    return words.some((w) => pool.indexOf(w) >= 0);
  });
}

console.log('\n[1] 硬过滤');
const seafoodWords = ['虾', '蟹', '贝', '蚝', '蛤', '鱿鱼', '紫菜', '海带', '鱼'];

check('忌口海鲜后，候选池不出现任何海鲜食材', () => {
  const { candidates } = buildCandidates({ taboos: ['海鲜'], ageGroup: '成人', currentTerm: '立冬' }, '今天吃什么', recipes);
  assert(candidates.length > 0, '候选为空');
  const bad = candidates.filter((r) => hasTaboo([r], seafoodWords));
  assert.strictEqual(bad.length, 0, '出现海鲜：' + bad.map((x) => x.name).join(','));
});

check('忌口牛肉后，牛肉丸被排除，且不误伤「牛奶」', () => {
  const words = Array.from(expandTaboos(['牛肉']));
  const { candidates } = buildCandidates({ taboos: ['牛肉'], ageGroup: '成人' }, '喝什么汤', recipes);
  const bad = candidates.filter((r) => hasTaboo([r], words));
  assert.strictEqual(bad.length, 0, '出现牛肉：' + bad.map((x) => x.name).join(','));
  // 「牛奶」不应被「牛肉」忌口误杀
  assert(candidates.some((r) => (r.mainIngredients || []).indexOf('牛奶') >= 0), '牛奶被误伤');
});

check('证据 C 级不进候选池', () => {
  const { candidates } = buildCandidates({ taboos: [], ageGroup: '成人' }, '鱼生', recipes);
  assert(!candidates.some((r) => r.id === 'SD0001'), '顺德鱼生（C级）不应出现');
});

check('长者人群过滤掉仅成人的菜', () => {
  const { candidates } = buildCandidates({ taboos: [], ageGroup: '长者' }, '吃什么', recipes);
  const bad = candidates.filter((r) => (r.ageSuitable || []).indexOf('长者') < 0);
  assert.strictEqual(bad.length, 0, '出现仅成人菜：' + bad.map((x) => x.name).join(','));
});

check('忌口过多时返回空候选（触发 NO_CANDIDATE）', () => {
  const all = ['海鲜', '牛肉', '羊肉', '猪肉', '鸡肉', '鸭肉', '蛋', '奶', '花生', '坚果', '芒果', '香菜', '辛辣', '油腻', '生冷', '酒', '麸质', '豆制品', '菌菇', '高嘌呤', '高糖', '高盐'];
  const { candidates } = buildCandidates({ taboos: all, ageGroup: '长者' }, '吃什么', recipes);
  assert(Array.isArray(candidates));
});

console.log('\n[2] 候选排序');
check('候选数量不超过 30', () => {
  const { candidates } = buildCandidates({ taboos: [], ageGroup: '成人' }, '今天吃什么', recipes);
  assert(candidates.length <= 30, '候选 ' + candidates.length + ' 超过 30');
});

check('当令节气命中排在前面', () => {
  const { candidates } = buildCandidates(
    { taboos: [], ageGroup: '成人', currentTerm: '立冬' },
    '今天吃什么',
    recipes
  );
  const first5 = candidates.slice(0, 5);
  const hasSeasonal = first5.some((r) => (r.terms || []).indexOf('立冬') >= 0);
  assert(hasSeasonal, '前 5 条没有立冬当令菜：' + first5.map((x) => x.name).join(','));
});

check('收藏菜系参与加权', () => {
  const { candidates } = buildCandidates(
    { taboos: [], ageGroup: '成人', favoriteIds: ['TS0001', 'TS0004'], currentTerm: '立冬' },
    '今天吃什么',
    recipes
  );
  const top5 = candidates.slice(0, 5);
  assert(top5.some((r) => r.cuisine === '潮汕'), '前 5 条没有潮汕菜');
});

console.log('\n[3] 输出校验');
const cand = buildCandidates({ taboos: ['海鲜'], ageGroup: '成人', currentTerm: '立冬' }, '今天吃什么', recipes);
const ctx = { candidates: cand.candidates, fallback: cand.fallback, profile: { taboos: ['海鲜'], currentTerm: '立冬' } };

check('非法菜品 ID 被丢弃', () => {
  const r = validateAnswer(
    { reply: '试试这几道。', dishes: [{ id: 'FAKE001', reason: '编的' }, { id: 'GF0001', reason: '清淡当令' }] },
    ctx
  );
  assert.strictEqual(r.dishes.length, 1);
  assert.strictEqual(r.dishes[0].id, 'GF0001');
  assert(r.flags.droppedInvalid === 1);
});

check('模型给出候选池外的 ID 被丢弃', () => {
  const r = validateAnswer({ reply: '可以吃虾。', dishes: [{ id: 'GF0028', reason: '白灼虾' }] }, ctx);
  assert(!r.dishes.some((d) => d.id === 'GF0028'), '白灼虾应被拦截');
  assert(r.flags.droppedInvalid === 1);
});

check('候选池混入忌口菜时，二次校验仍能拦住（双保险）', () => {
  // 模拟上游过滤失效：候选池里带着白灼虾，但 profile 忌口海鲜
  const leaky = { candidates: recipes, fallback: [], profile: { taboos: ['海鲜'], currentTerm: '立冬' } };
  const r = validateAnswer(
    { reply: '可以吃虾。', dishes: [{ id: 'GF0028', reason: '白灼虾' }, { id: 'GF0001', reason: '清淡' }] },
    leaky
  );
  assert(!r.dishes.some((d) => d.id === 'GF0028'), '白灼虾应被二次校验拦截');
  assert.strictEqual(r.flags.droppedTaboo.length, 1);
});

check('禁用词命中后 reply 被替换为安全话术', () => {
  const r = validateAnswer({ reply: '这个可以治疗高血压，还能降糖。', dishes: [{ id: 'GF0001', reason: '清淡' }] }, ctx);
  assert(r.flags.blocked === true);
  assert(r.reply.indexOf('治疗') < 0, '仍包含禁用词');
  assert(r.reply.indexOf('医疗建议') >= 0);
});

check('reply 超长被截断到 300 字', () => {
  const long = '好'.repeat(500);
  const r = validateAnswer({ reply: long, dishes: [{ id: 'GF0001', reason: '清淡' }] }, ctx);
  assert(r.reply.length <= 300, '实际 ' + r.reply.length);
});

check('reason 超长被截断到 40 字', () => {
  const r = validateAnswer({ reply: 'ok', dishes: [{ id: 'GF0001', reason: '好'.repeat(100) }] }, ctx);
  assert(r.dishes[0].reason.length <= 40, '实际 ' + r.dishes[0].reason.length);
});

check('非 http 来源被过滤', () => {
  const r = validateAnswer(
    { reply: 'ok', dishes: [{ id: 'GF0001', reason: 'x' }], sources: [{ title: 'a', url: 'ftp://x' }, { title: 'b', url: 'https://ok.com' }] },
    ctx
  );
  assert.strictEqual(r.sources.length, 1);
  assert.strictEqual(r.sources[0].url, 'https://ok.com');
});

check('推荐为空时降级为当令菜', () => {
  const r = validateAnswer({ reply: '', dishes: [] }, ctx);
  assert.strictEqual(r.flags.degraded, true);
  assert(r.dishes.length > 0, '降级没有给菜');
  assert(r.dishes.length <= 3);
});

check('模型返回非 JSON 时降级而不是编答案', () => {
  const r = validateAnswer('这不是 JSON', ctx);
  assert.strictEqual(r.flags.degraded, true);
  assert(r.dishes.length > 0);
});

check('带 ```json 围栏的返回能正确解析', () => {
  const obj = parseAnswer('```json\n{"reply":"ok","dishes":[]}\n```');
  assert.strictEqual(obj.reply, 'ok');
});

console.log('\n[4] Prompt 组装');
check('候选字段被压缩、不含 evidence 等冗余字段', () => {
  const msgs = buildMessages({
    question: '今天吃什么',
    profile: { physique: '怕冷', preferences: ['清淡'], taboos: ['海鲜'], ageGroup: '长者', currentTerm: '立冬', elderMode: true },
    candidates: cand.candidates,
    web: [],
    history: [{ role: 'user', content: '你好' }],
  });
  assert.strictEqual(msgs.length, 2);
  assert(msgs[0].content.indexOf('长者模式已开启') >= 0, '长者模式未生效');
  assert(msgs[1].content.indexOf('忌口：海鲜') >= 0, '忌口未注入');
  assert(msgs[1].content.indexOf('evidence') < 0, '候选含冗余字段');
  assert(msgs[1].content.length < 12000, 'prompt 过长：' + msgs[1].content.length);
});

check('候选序列化后 token 量在预算内（粗估 <4000 tokens）', () => {
  const msgs = buildMessages({ question: 'q', profile: {}, candidates: cand.candidates, web: [], history: [] });
  const approx = Math.ceil((msgs[0].content.length + msgs[1].content.length) / 1.6);
  assert(approx < 4000, '粗估 ' + approx + ' tokens');
});

console.log('\n================ 结果 ================');
console.log('通过 ' + pass + ' 项，失败 ' + fails.length + ' 项');
if (fails.length) {
  fails.forEach((f) => console.log(' - ' + f));
  process.exit(1);
}
console.log('全部通过 ✅');
