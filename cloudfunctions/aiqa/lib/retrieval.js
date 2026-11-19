/**
 * lib/retrieval.js
 * 两段式检索：硬过滤（不可绕过） + 候选排序（取前 30）
 * 纯函数，无外部依赖，方便单测。
 */
const rules = require('../data/rules.json');

const MAX_CANDIDATES = 30;

/* ---------------- 基础工具 ---------------- */

function toArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string') {
    return v
      .split(/[,，、;；|\/\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [v];
}

function normCuisine(v) {
  if (!v) return '';
  const key = String(v).toLowerCase();
  return rules.cuisineAlias[key] || String(v);
}

// 把少吃标签展开成食材关键词集合
function expandTaboos(taboos) {
  const banned = new Set();
  toArray(taboos).forEach((t) => {
    const words = rules.tabooExpand[t];
    if (words && words.length) {
      words.forEach((w) => banned.add(w));
    } else if (t && t.length <= 6) {
      banned.add(t);
    }
  });
  return banned;
}

// 判断单个食材是否命中少吃词
function hitBanned(text, banned) {
  if (!text) return false;
  const s = String(text);
  let hit = false;
  banned.forEach((w) => {
    if (!hit && w && s.indexOf(w) >= 0) hit = true;
  });
  return hit;
}

// 单道菜是否整体命中少吃（主料 + 过敏原 + 菜名）
function recipeHitsTaboo(recipe, banned) {
  if (!banned || banned.size === 0) return false;
  const pool = []
    .concat(toArray(recipe.mainIngredients))
    .concat(toArray(recipe.allergen))
    .concat([recipe.name || '']);
  return pool.some((item) => hitBanned(item, banned));
}

function ageMatch(recipe, ageGroup) {
  const list = toArray(recipe.ageSuitable);
  if (!list.length) return true; // 数据缺失时放行，避免整库被过滤
  if (!ageGroup) return true;
  return list.some((a) => String(a).indexOf(ageGroup) >= 0 || ageGroup.indexOf(String(a)) >= 0);
}

function evidenceOk(recipe) {
  const e = String(recipe.evidence || '').trim().toUpperCase();
  if (!e) return true;
  return e.charAt(0) !== 'C'; // C 级不进主推荐
}

/* ---------------- 第一段：硬过滤 ---------------- */

function hardFilter(recipes, profile, maxMinutes) {
  const banned = expandTaboos(profile && profile.taboos);
  const ageGroup = (profile && profile.ageGroup) || '';
  const kept = [];
  let droppedEvidence = 0;
  let droppedAge = 0;
  let droppedTaboo = 0;
  let droppedTime = 0;

  (recipes || []).forEach((r) => {
    if (!r || !r.id || !r.name) return;
    if (!evidenceOk(r)) {
      droppedEvidence += 1;
      return;
    }
    if (!ageMatch(r, ageGroup)) {
      droppedAge += 1;
      return;
    }
    if (recipeHitsTaboo(r, banned)) {
      droppedTaboo += 1;
      return;
    }
    // 时间硬过滤：用户说了「半小时」，超时的菜直接不进候选。
    // 旧版只有 evidence/age/taboo 三道，没有时间，于是「冷泡 6 小时」这种
    // difficulty 很低但耗时长久的菜会被推给问「半小时能做什么」的人。
    // 耗时未知（null）也排除——宁可少推，也不给一个无法兑现的承诺。
    if (maxMinutes != null) {
      if (r.timeMinutes == null || r.timeMinutes > maxMinutes) {
        droppedTime += 1;
        return;
      }
    }
    kept.push(r);
  });

  return {
    kept,
    stats: {
      total: (recipes || []).length,
      kept: kept.length,
      droppedEvidence,
      droppedAge,
      droppedTaboo,
      droppedTime,
      timeLimit: maxMinutes == null ? null : maxMinutes,
      tabooCount: banned.size,
    },
  };
}

/**
 * 从用户原话里解析时间上限（分钟）。没有时间意图时返回 null。
 *
 * 为什么从 question 解析而不是从 profile：profile 只有年龄组和回避项，
 * 时间诉求是随问题临时出现的（「今天赶时间」「半小时能做什么」）。
 */
function parseTimeLimit(question) {
  const q = String(question || '');
  if (!q) return null;

  // 明确说法
  if (/半小时/.test(q)) return 40;
  if (/一个?小时|1\s*小时/.test(q)) return 75;
  if (/两个小时|2\s*小时/.test(q)) return 135;

  const m = q.match(/(\d+)\s*(?:分钟|分)/);
  if (m) {
    const n = parseInt(m[1], 10);
    // 5～240 分钟视为有效约束；其余多半不是时间诉求（如「三分钟热度」）
    if (n >= 5 && n <= 240) return n + 5;
  }

  // 模糊说法
  if (/快手|快速|赶时间|来不及|没时间|简单点|简单做|越简单越好/.test(q)) return 25;
  if (/不着急|慢慢做|有时间|周末做/.test(q)) return null;

  return null;
}

/* ---------------- 第二段：排序 ---------------- */

// 从自然语言问题里抽关键词（简单切词 + 已知食材命中）
const COMMON_FOOD_WORDS = [
  '鸡', '鸭', '鱼', '虾', '蟹', '牛', '猪', '羊', '排骨', '豆腐', '蛋', '菜', '汤',
  '粥', '饭', '面', '粉', '蒸', '炒', '炖', '焖', '煲', '凉拌', '甜品', '糖水',
  '西兰花', '萝卜', '冬瓜', '南瓜', '莲藕', '山药', '玉米', '番茄', '茄子', '苦瓜',
];

function extractQuestionTerms(question) {
  const q = String(question || '');
  const terms = new Set();
  COMMON_FOOD_WORDS.forEach((w) => {
    if (q.indexOf(w) >= 0) terms.add(w);
  });
  // 口味/做法类词
  Object.keys(rules.flavorAlias).forEach((flavor) => {
    if (q.indexOf(flavor) >= 0) {
      (rules.flavorAlias[flavor] || []).forEach((w) => terms.add(w));
    }
  });
  return terms;
}

function termHit(recipe, currentTerm) {
  const list = toArray(recipe.terms);
  if (!currentTerm || !list.length) return false;
  return list.some((t) => String(t).indexOf(currentTerm) >= 0);
}

function buildFavoriteProfile(recipes, favoriteIds) {
  const ids = toArray(favoriteIds).slice(0, 20);
  const idSet = new Set(ids);
  const favCuisines = new Set();
  const favIngredients = new Set();
  (recipes || []).forEach((r) => {
    if (!idSet.has(r.id)) return;
    if (r.cuisine) favCuisines.add(normCuisine(r.cuisine));
    toArray(r.mainIngredients).forEach((i) => favIngredients.add(i));
  });
  return { ids: idSet, cuisines: favCuisines, ingredients: favIngredients };
}

function scoreRecipe(recipe, ctx) {
  let score = 0;
  const reasons = [];
  const cuisine = normCuisine(recipe.cuisine);

  // 菜系命中收藏/偏好
  if (ctx.favCuisines.has(cuisine)) {
    score += 3;
    reasons.push('收藏菜系');
  } else if (ctx.prefCuisines.has(cuisine)) {
    score += 3;
    reasons.push('口味偏好');
  }

  // 主料命中问题关键词
  const ingredients = toArray(recipe.mainIngredients);
  if (ingredients.some((i) => Array.from(ctx.questionTerms).some((w) => String(i).indexOf(w) >= 0))) {
    score += 3;
    reasons.push('主料匹配');
  }

  // 当令节气
  if (termHit(recipe, ctx.currentTerm)) {
    score += 2;
    reasons.push('当令');
  }

  // 与收藏菜的主料相似
  if (ingredients.some((i) => ctx.favIngredients.has(i))) {
    score += 2;
    reasons.push('与收藏相近');
  }

  // 成本档接近（默认 2 档为中）
  const cost = Number(recipe.costLevel || 2);
  if (Math.abs(cost - (ctx.prefCost || 2)) <= 1) score += 1;

  // 难度低优先
  const diff = Number(recipe.difficulty || 2);
  if (diff <= 2) score += 1;

  return { score, reasons };
}

function buildCandidates(profile, question, allRecipes) {
  const p = profile || {};
  const recipes = allRecipes || require('../data/recipes.json');

  // 时间诉求从原话解析（profile 里没有这一项）
  const maxMinutes = parseTimeLimit(question);
  const { kept, stats } = hardFilter(recipes, p, maxMinutes);
  if (!kept.length) {
    return { candidates: [], filtered: stats, fallback: [] };
  }

  const fav = buildFavoriteProfile(recipes, p.favoriteIds);
  const prefCuisines = new Set();
  toArray(p.preferences).forEach((pref) => {
    Object.keys(rules.flavorAlias).forEach((flavor) => {
      if (String(pref).indexOf(flavor) >= 0) prefCuisines.add(flavor);
    });
  });
  toArray(p.favoriteCuisines).forEach((c) => prefCuisines.add(normCuisine(c)));

  const ctx = {
    favCuisines: fav.cuisines,
    favIngredients: fav.ingredients,
    prefCuisines,
    questionTerms: extractQuestionTerms(question),
    currentTerm: p.currentTerm || '',
    prefCost: 2,
  };

  const scored = kept.map((r) => {
    const { score, reasons } = scoreRecipe(r, ctx);
    return { r, score, reasons };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.r.id).localeCompare(String(b.r.id));
  });

  const candidates = scored.slice(0, MAX_CANDIDATES).map((x) => x.r);

  // 降级用：当令菜 3 道
  const seasonal = kept
    .filter((r) => termHit(r, ctx.currentTerm))
    .slice(0, 3);

  return {
    candidates,
    filtered: stats,
    fallback: seasonal.length ? seasonal : kept.slice(0, 3),
  };
}

module.exports = {
  toArray,
  normCuisine,
  expandTaboos,
  hitBanned,
  recipeHitsTaboo,
  hardFilter,
  parseTimeLimit,
  buildCandidates,
  extractQuestionTerms,
  termHit,
  MAX_CANDIDATES,
};
