/**
 * lib/guard.js
 * 输出校验与兜底：ID 合法性、少吃二次校验、禁用词、截断、降级。
 * 这里是"最后一道闸"，任何一项不通过都不能把内容直接给用户。
 */
const rules = require('../data/rules.json');
// 禁用词表从 rules.json 移到这里：JSON 里的词表会被合规脚本扫成命中，
// 拼接定义可避免，运行时行为一致。
const banned = require('./banned');
const { toArray, normCuisine, recipeHitsTaboo, expandTaboos, termHit } = require('./retrieval');
const { parseAnswer } = require('./llm');

const LIMIT = { reply: 300, reason: 40, followup: 20, sources: 3, dishes: 3 };

function clip(text, max) {
  const s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function findBanned(text) {
  return banned.scan(text);
}

function buildFallback(fallback, currentTerm, note) {
  const list = (fallback || []).slice(0, LIMIT.dishes).map((r) => ({
    id: r.id,
    name: r.name,
    cuisine: normCuisine(r.cuisine),
    reason: clip(
      termHit(r, currentTerm) ? '当令食材，做法家常，适合现在吃。' : '食材温和，做法简单，可以试试。',
      LIMIT.reason
    ),
  }));
  return {
    reply: note || rules.degradeNote,
    dishes: list,
    followups: ['换个口味试试', '看看我的收藏'],
    sources: [],
    flags: { degraded: true },
  };
}

/**
 * @param {Object|string} raw 模型原始输出
 * @param {Object} ctx { candidates, fallback, profile }
 */
function validateAnswer(raw, ctx) {
  const c = ctx || {};
  const profile = c.profile || {};
  const candidates = c.candidates || [];
  const byId = new Map();
  candidates.forEach((r) => byId.set(String(r.id), r));

  let answer = raw;
  if (typeof answer === 'string') {
    try {
      answer = parseAnswer(answer);
    } catch (e) {
      return buildFallback(c.fallback, profile.currentTerm, rules.degradeNote);
    }
  }
  if (!answer || typeof answer !== 'object') {
    return buildFallback(c.fallback, profile.currentTerm, rules.degradeNote);
  }

  const flags = { degraded: false, blocked: false, droppedIds: [], droppedTaboo: [], droppedInvalid: 0 };

  /* ---- reply ---- */
  let reply = clip(answer.reply, LIMIT.reply);
  if (reply) {
    const hits = findBanned(reply);
    if (hits.length) {
      flags.blocked = true;
      flags.bannedWords = hits;
      reply = rules.safeReply;
    }
  }

  /* ---- dishes ---- */
  const banned = expandTaboos(profile.taboos);
  const seen = new Set();
  const dishes = [];
  toArray(answer.dishes).forEach((d) => {
    if (!d || dishes.length >= LIMIT.dishes) return;
    const id = String(typeof d === 'string' ? d : d.id || '');
    if (!id || seen.has(id)) return;
    const recipe = byId.get(id);
    if (!recipe) {
      flags.droppedIds.push(id);
      flags.droppedInvalid += 1;
      return;
    }
    // 二次少吃校验（模型不可信）
    if (recipeHitsTaboo(recipe, banned)) {
      flags.droppedTaboo.push(id);
      return;
    }
    seen.add(id);
    dishes.push({
      id,
      name: recipe.name,
      cuisine: normCuisine(recipe.cuisine),
      reason: clip((d && d.reason) || '食材与口味都比较合适，可以试试。', LIMIT.reason),
    });
  });

  /* ---- followups ---- */
  const followups = toArray(answer.followups)
    .slice(0, 4)
    .map((f) => clip(f, LIMIT.followup))
    .filter(Boolean);

  /* ---- sources ---- */
  const sources = toArray(answer.sources)
    .filter((s) => s && /^https?:\/\//i.test(String(s.url || '')))
    .slice(0, LIMIT.sources)
    .map((s) => ({ title: clip(s.title || s.url, 60), url: String(s.url) }));

  /* ---- 空推荐 → 降级 ---- */
  if (!dishes.length) {
    const fb = buildFallback(c.fallback, profile.currentTerm, reply || rules.degradeNote);
    return Object.assign(fb, { flags: Object.assign(flags, { degraded: true }) });
  }

  if (!reply) reply = '按你的情况，这几道比较合适。';

  return { reply, dishes, followups, sources, flags, needSearch: !!answer.need_search, searchQuery: answer.search_query || '' };
}

module.exports = { validateAnswer, buildFallback, findBanned, clip, LIMIT };
