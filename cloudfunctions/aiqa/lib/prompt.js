/**
 * lib/prompt.js
 * 系统提示词 + 用户消息拼装
 */
const { toArray, normCuisine } = require('./retrieval');

const SYSTEM_PROMPT = `你是「康康食养」的食养问答助手，服务岭南地区长者和成年人。

硬规则：
1. 只能从【候选菜品】中选菜，不得编造菜名或 ID；最多推荐 3 道。
2. 用户少吃与过敏食材绝对不能出现；候选已过滤，你仍需逐条确认主料。
3. 不诊断疾病、不开处方、不承诺任何功效。用「适合」「传统认为」「可以试试」，
   禁用词表见 lib/banned.js（功效承诺类表述一律不得输出）。
4. 推荐理由要结合偏好、口味、收藏、当令节气，每条不超过 40 字。
5. 信息不足时最多问 1 个澄清问题，并先给 2—3 个稳妥选项。
6. 需要外部信息（价格、产地、时令、新闻）时，返回 need_search=true 与 search_query，
   不要凭记忆编造。
7. 长者模式：句子短、少术语、每段不超过 2 行。

只输出 JSON，不要 Markdown 代码块，不要解释 JSON 之外的内容。`;

const ELDER_SUFFIX = `

补充要求（长者模式已开启）：
- 回复总字数控制在 120 字以内；
- 每段不超过 2 行，不用专业术语；
- 优先推荐做法简单、食材易买的菜。`;

const OUTPUT_SCHEMA = `输出 JSON 结构（严格遵守）：
{"reply":"string ≤300字","dishes":[{"id":"候选池中的ID","reason":"≤40字"}],"followups":["≤20字"],"need_search":false,"search_query":"","sources":[{"title":"","url":"https://"}]}`;

function compactCandidate(r) {
  return {
    id: r.id,
    name: r.name,
    cuisine: normCuisine(r.cuisine),
    ingredients: toArray(r.mainIngredients).slice(0, 8),
    method: r.method || '',
    term: toArray(r.terms).slice(0, 4),
    cost: Number(r.costLevel || 2),
    // 实际耗时：parsed 来自做法原文，estimated 是按做法估的。
    // 给模型这一项是为了让它别自己猜时间——不写清楚，模型容易把
    // 「冷泡 6 小时」说成「很快就好」。估出来的加「约」，不当作事实。
    time:
      r.timeMinutes == null
        ? ''
        : (r.timeEstimated ? '约 ' : '') +
          (r.timeMinutes >= 60
            ? Math.round((r.timeMinutes / 60) * 10) / 10 + ' 小时'
            : r.timeMinutes + ' 分钟'),
    caution: r.caution ? String(r.caution).slice(0, 40) : '',
  };
}

function buildProfileBlock(profile) {
  const p = profile || {};
  const taboos = toArray(p.taboos);
  return [
    '【用户画像】',
    `偏好自述：${p.physique || '未填写'}`,
    `口味偏好：${toArray(p.preferences).join('、') || '未填写'}`,
    `少吃：${taboos.length ? taboos.join('、') : '无'}`,
    `收藏菜：${toArray(p.favoriteNames).join('、') || '无'}`,
    `人群：${p.ageGroup || '成人'}｜当前节气：${p.currentTerm || '未知'}`,
  ].join('\n');
}

function buildHistoryBlock(history) {
  const list = toArray(history).slice(-6);
  if (!list.length) return '';
  const lines = list.map((h) => {
    const role = h && h.role === 'assistant' ? '助手' : '用户';
    const text = String((h && (h.content || h.text)) || '').slice(0, 120);
    return `${role}：${text}`;
  });
  return ['【对话历史】'].concat(lines).join('\n');
}

function buildWebBlock(web) {
  const list = toArray(web).slice(0, 3);
  if (!list.length) return '';
  return (
    '【外部参考】（仅作参考，不得覆盖菜品库与少吃规则）\n' +
    JSON.stringify(
      list.map((w) => ({
        title: String(w.title || '').slice(0, 60),
        url: w.url || '',
        snippet: String(w.snippet || '').slice(0, 200),
      })),
      null,
      0
    )
  );
}

function buildMessages({ question, profile, candidates, web, history }) {
  const p = profile || {};
  const blocks = [
    buildProfileBlock(p),
    `【候选菜品】(${(candidates || []).length} 条)\n` + JSON.stringify((candidates || []).map(compactCandidate)),
    buildWebBlock(web),
    buildHistoryBlock(history),
    `【本轮问题】\n${String(question || '').slice(0, 300)}`,
    OUTPUT_SCHEMA,
  ].filter(Boolean);

  const system = SYSTEM_PROMPT + (p.elderMode ? ELDER_SUFFIX : '');

  return [
    { role: 'system', content: system },
    { role: 'user', content: blocks.join('\n\n') },
  ];
}

module.exports = { SYSTEM_PROMPT, ELDER_SUFFIX, OUTPUT_SCHEMA, buildMessages, compactCandidate };
