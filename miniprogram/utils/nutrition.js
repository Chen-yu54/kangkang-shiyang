// utils/nutrition.js —— 食养推荐内核（本地规则兜底）
//
// 职责：把问卷答案变成「推荐菜 + 可复算的推荐步骤」。
//
// 两条硬约束（合规，不要改）：
//   1. 只有 q5（口味偏好）和 q6（回避项）参与筛选。
//      q1–q4（怕冷怕热 / 出汗 / 口干 / 排便）是身体感受，只用作答记录与展示，
//      一旦拿它去筛菜，就等于用身体感受推菜品，属健康判断，越界。
//   2. 每一步都基于真实计算：召回条数、过滤条数、命中理由全部来自实际数据，
//      不做「看起来像推理」的装饰文本。数字可当场复算。
//
// 数据来源：miniprogram/data/recipes.js（构建产物，419 条）
//   匹配依据 = 菜名 + 主料 + 做法简述 里出现的关键词。
//   知识库没有结构化的成分表与口味标签，所以界面必须写明「按关键词匹配，不是成分表判定」。

const recipes = require('../data/recipes.js');
const terms = require('../data/terms.js');

// 回避项 → 关键词。a7「都不回避」不产生任何过滤。
// exclude：命中的词若只是更长词的一部分，则不算命中。
// 典型用例：「鸡肉」用「鸡」，但「鸡蛋」「鸡精」不算鸡肉，否则番茄炒蛋会被误判。
const AVOID_RULES = {
  a1: { label: '海鲜', words: ['虾', '蟹', '贝', '蚝', '鱼', '鱿', '蚬', '螺', '海参', '花甲', '蛤'] },
  a2: { label: '牛肉', words: ['牛肉', '牛腩', '牛腱', '牛筋', '肥牛', '牛'] },
  a3: { label: '鸡蛋', words: ['蛋'] },
  a4: { label: '豆制品', words: ['豆腐', '豆干', '腐竹', '豆皮', '豆浆'] },
  a5: { label: '牛奶', words: ['牛奶', '芝士', '奶酪', '奶油', '炼乳'] },
  a6: { label: '鸡肉', words: ['鸡肉', '鸡胸', '鸡腿', '鸡翅', '鸡爪', '鸡块', '土鸡', '老鸡', '走地鸡', '鸡'] },
};

// 口味偏好 → 命中的做法关键词。a6「没有特别偏好」不参与加权。
const TASTE_RULES = {
  a1: { label: '清淡', methods: ['蒸', '白灼', '煮', '汆', '凉拌', '清炒'] },
  a2: { label: '咸香', methods: ['卤', '红烧', '煎', '焖', '焗', '酱'] },
  a3: { label: '酸甜', methods: ['糖醋', '番茄', '酸甜', '酸'] },
  a4: { label: '辣', methods: ['辣', '花椒', '辣椒'] },
  a5: { label: '喜欢喝汤', methods: ['汤', '煲', '炖'] },
};

// 前四题的选项标签（与 i18n 的 preftest.qN.aM 一一对应，此处只为拼装接口入参）
const Q_LABEL = {
  q1: { a1: '怕冷', a2: '怕热', a3: '正常', a4: '冷热都怕', unsure: '不清楚' },
  q2: { a1: '容易出汗', a2: '很少出汗', a3: '正常', a4: '晚上睡觉出汗', unsure: '不清楚' },
  q3: { a1: '经常口干', a2: '很少口干', a3: '正常', a4: '口苦', unsure: '不清楚' },
  q4: { a1: '偏软不成形', a2: '偏干硬', a3: '正常', a4: '时干时稀', unsure: '不清楚' },
};
const ALL_YEAR = '全年通用';
const DEFAULT_LIMIT = 3;
// 当令菜不足时补全年通用菜，避免「推荐 0 道」
const BACKFILL_LIMIT = 24;

function asArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  return v ? [v] : [];
}

// 把一条菜谱的可匹配文本拼起来（菜名 + 主料 + 做法）
function haystackOf(dish) {
  const parts = [dish.name || '', dish.mainIngredients || '', dish.how || '', dish.method || ''];
  return parts.join(' ').toLowerCase();
}

// 该菜谱命中的回避关键词（返回命中的词，用于在步骤里给出理由）
// 「鸡」这种单字容易误伤「鸡蛋」「鸡精」，所以命中后要回看上下文：
// 若该字后面紧跟「蛋」或「精」，视为非鸡肉，继续找下一处。
const FALSE_AFTER = { 鸡: ['蛋', '精'], 牛: ['奶', '油', '骨'] };

function hitWord(text, word) {
  let from = 0;
  for (;;) {
    const at = text.indexOf(word, from);
    if (at < 0) return '';
    const next = text.charAt(at + word.length);
    const falseTails = FALSE_AFTER[word];
    if (!falseTails || falseTails.indexOf(next) < 0) return word;
    from = at + 1;
  }
}

function matchedAvoidWords(dish, avoidKeys) {
  const text = haystackOf(dish);
  const hits = [];
  avoidKeys.forEach((key) => {
    const rule = AVOID_RULES[key];
    if (!rule) return;
    for (let i = 0; i < rule.words.length; i += 1) {
      const w = hitWord(text, rule.words[i].toLowerCase());
      if (w) {
        hits.push({ key, label: rule.label, word: rule.words[i] });
        return;
      }
    }
  });
  return hits;
}

// 该菜谱命中的口味做法
function matchedTaste(dish, tasteKeys) {
  const text = haystackOf(dish);
  const hits = [];
  tasteKeys.forEach((key) => {
    const rule = TASTE_RULES[key];
    if (!rule) return;
    const hit = rule.methods.filter((m) => text.indexOf(m.toLowerCase()) > -1);
    if (hit.length) hits.push({ key, label: rule.label, method: hit[0] });
  });
  return hits;
}

function labelsOf(keys, rules) {
  return keys
    .map((k) => (rules[k] ? rules[k].label : ''))
    .filter(Boolean);
}

/**
 * 生成推荐。
 * @param {object} answers 问卷答案：{ q5: ['a1','a5'], q6: ['a1'] , q1..q4 可有可无 }
 * @param {object} opts { termName, limit }
 * @returns {object} { dishes, steps, note, answered, termName, counts }
 */
function buildRecommendation(answers, opts) {
  const a = answers && typeof answers === 'object' ? answers : {};
  const o = opts || {};
  const limit = o.limit || DEFAULT_LIMIT;

  const tasteKeys = asArray(a.q5);
  const avoidKeys = asArray(a.q6).filter((k) => k !== 'a7'); // a7 = 都不回避
  const answered = tasteKeys.length > 0 || avoidKeys.length > 0;

  // 当前节气：调用方没给就自己算
  let termName = o.termName || '';
  if (!termName) {
    const cur = require('./dataSource').getCurrentTerm();
    termName = cur ? cur.name : '';
  }

  // ① 召回：当令菜优先，不足再补全年通用
  const seasonal = recipes.filter((r) => (r.terms || []).indexOf(termName) > -1);
  const yearRound = recipes.filter(
    (r) => (r.terms || []).indexOf(ALL_YEAR) > -1 && seasonal.indexOf(r) < 0
  );
  const recalled = seasonal.concat(yearRound.slice(0, BACKFILL_LIMIT));

  // 当令菜 id 集合：排序时给「当令」加权，也用来在结果上标记来源
  const seasonalNames = {};
  seasonal.forEach((r) => { seasonalNames[r.id] = true; });

  // ② 按回避项过滤
  const removed = [];
  const kept = [];
  recalled.forEach((dish) => {
    const hits = avoidKeys.length ? matchedAvoidWords(dish, avoidKeys) : [];
    if (hits.length) removed.push({ dish, hits });
    else kept.push(dish);
  });

  // ③ 按口味加权排序。分层规则：
  //   当令菜 +10，命中口味做法 +2/项。
  //   加这一层是因为当令菜可能只有 4 道，光靠口味加权会被补位的通用菜挤掉，
  //   那「本节气推荐」就名不副实了。
  const scored = kept.map((dish, index) => {
    const hits = tasteKeys.length ? matchedTaste(dish, tasteKeys) : [];
    const seasonalBonus = seasonalNames[dish.id] ? 10 : 0;
    return { dish, hits, score: seasonalBonus + hits.length * 2, index };
  });
  scored.sort((x, y) => (y.score - x.score) || (x.index - y.index));

  const picked = scored.slice(0, limit);

  // ④ 步骤：每一步的数字都来自上面的真实计算，可直接复算。
  //    写法刻意用「先看…再…然后…」的思考口吻，不用函数日志那种「召回 / 过滤 / 排序」，
  //    读起来像有人在替你挑菜；但每个数字都是真算出来的，不做假动作。
  const steps = [];
  steps.push({
    no: 1,
    kind: 'term',
    title: '正在读取节气',
    lines: ['当前节气：' + (termName || '当令')],
    count: null,
  });
  steps.push({
    no: 2,
    kind: 'input',
    title: '正在整理你的口味',
    lines: answered
      ? [
          '口味：' + (labelsOf(tasteKeys, TASTE_RULES).join('、') || '没特别说'),
          '不吃：' + (labelsOf(avoidKeys, AVOID_RULES).join('、') || '没有'),
          '冷热 / 出汗 / 口干 / 排便 4 题仅记录，不参与挑菜',
        ]
      : ['还没作答，只按当令挑'],
    count: null,
  });
  steps.push({
    no: 3,
    kind: 'recall',
    title: '正在检索知识库',
    lines: [
      '「' + (termName || '当令') + '」当令 ' + seasonal.length + ' 道',
      yearRound.length
        ? '「' + ALL_YEAR + '」再补 ' + Math.min(yearRound.length, BACKFILL_LIMIT) + ' 道'
        : '',
    ].filter(Boolean),
    count: recalled.length,
  });
  if (avoidKeys.length) {
    const reasons = removed.slice(0, 3).map((x) => {
      const why = x.hits.map((h) => h.word).join('、');
      return '「' + x.dish.name + '」含' + why + '，划掉';
    });
    steps.push({
      no: steps.length + 1,
      kind: 'filter',
      title: '正在剔除不要的',
      lines: (reasons.length ? reasons : ['看了 ' + recalled.length + ' 道，没有踩到你说的那些，一道没划'])
        .concat(removed.length > 3 ? ['还有 ' + (removed.length - 3) + ' 道同理划掉'] : [])
        .concat(removed.length ? ['剩 ' + kept.length + ' 道'] : []),
      count: kept.length,
    });
  }
  if (tasteKeys.length) {
    // 只列真正命中口味做法的菜。score>0 里混着「当令 +10」的加分项，
    // 按 score 筛会列出没命中口味的菜，出现「柿子饼是的，往前提」这种空话。
    const hits3 = scored.filter((x) => x.hits.length > 0).slice(0, 3);
    const whySet = hits3.map((x) => x.hits.map((h) => h.method).join('、'));
    // 命中理由全一样时合并成一行，别把「命中汤，往前提」重复三遍
    const sameWhy = whySet.length > 1 && whySet.every((w) => w === whySet[0]);
    const top = sameWhy
      ? ['「' + hits3.map((x) => x.dish.name).join('」「') + '」都命中「' + whySet[0] + '」，往前提']
      : hits3.map((x) => '「' + x.dish.name + '」命中「' + whySet[hits3.indexOf(x)] + '」，往前提');
    steps.push({
      no: steps.length + 1,
      kind: 'rank',
      title: '正在按口味排序',
      lines: top.length
        ? top
        : ['没找到明显的' + labelsOf(tasteKeys, TASTE_RULES).join('、') + '，按原顺序排'],
      count: kept.length,
    });
  }
  const seasonalPicked = picked.filter((x) => seasonalNames[x.dish.id]).length;
  steps.push({
    no: steps.length + 1,
    kind: 'result',
    title: '正在生成食单',
    lines: [
      '在 ' + recalled.length + ' 道里按当令与口味排好' +
        (seasonalPicked ? '，其中 ' + seasonalPicked + ' 道是当令菜' : ''),
    ],
    count: picked.length,
  });
  return {
    dishes: picked.map((x) => ({
      dish: x.dish,
      score: x.score,
      hits: x.hits,
      // 标出这条是不是当令菜：补位的全年通用菜不能冒充「本节气推荐」
      isSeasonal: !!seasonalNames[x.dish.id],
    })),
    steps,
    answered,
    termName,
    counts: {
      recalled: recalled.length,
      seasonal: seasonal.length,
      kept: kept.length,
      removed: removed.length,
      picked: picked.length,
    },
    // 匹配口径必须随结果一起展示，不能只写在注释里
    note: '匹配依据是菜名、主料与做法里的关键词，不是成分表判定；结果只作选菜参考。',
  };
}

// 供生成页展示「本次诉求」用：把 a1/a6 这类键翻成人话
function tasteLabels(keys) {
  return labelsOf(asArray(keys), TASTE_RULES);
}

function avoidLabels(keys) {
  return labelsOf(asArray(keys).filter((k) => k !== 'a7'), AVOID_RULES);
}

// —— 答案 → 工作流二入参（来源：团队《字段表》） ——
// 字段名 user_physique / user_preferences / user_taboos 是接口契约的一部分，
// 由扣子工作流按 key 取值，前端不能改名。界面与注释里一律不用它们对应的中文说法。
//
//   user_physique    ← 前 4 题（冷热 / 出汗 / 口干 / 排便）的作答，按「；」拼接
//   user_preferences ← 第 5 题（口味偏好）多选，按「、」拼接
//   user_taboos      ← 第 6 题（回避项）多选，排除「都不回避」
//   USER_INPUT       ← 一句自然语言，供工作流做语义补充
//   CONVERSATION_NAME← 字段表标注的 default 固定值
function toWorkflowParams(answers, options) {
  const a = answers && typeof answers === 'object' ? answers : {};
  const o = options || {};

  const pick = (key, count, rules) => {
    const v = a[key];
    return (Array.isArray(v) ? v : v ? [v] : [])
      .map((k) => (rules[k] || {}).label)
      .filter(Boolean)
      .slice(0, count);
  };

  // 前四题各只有 3–4 个固定选项，直接按 key 取中文标签
  const q1 = (a.q1 && (Q_LABEL.q1[a.q1] || '')) || '';
  const q2 = (a.q2 && (Q_LABEL.q2[a.q2] || '')) || '';
  const q3 = (a.q3 && (Q_LABEL.q3[a.q3] || '')) || '';
  const q4 = (a.q4 && (Q_LABEL.q4[a.q4] || '')) || '';

  const physique = [q1, q2, q3, q4].filter(Boolean).join('；');
  // 四题都选「不清楚」时不必重复四遍，合并成一次。
  // 注意：空数组的 every() 恒为 true，必须先判长度，
  // 否则「未作答」会被误判成「不清楚」并传给工作流。
  const physiqueParts = [q1, q2, q3, q4].filter(Boolean);
  const physiqueText =
    physiqueParts.length > 0 && physiqueParts.every((x) => x === '不清楚') ? '不清楚' : physique;
  const prefs = pick('q5', 6, TASTE_RULES);
  const taboos = asArray(a.q6)
    .filter((k) => k !== 'a7')
    .map((k) => (AVOID_RULES[k] || {}).label)
    .filter(Boolean);

  // USER_INPUT：把三项拼成一句人话，避免把结构化字段直接丢给语义层
  const parts = [];
  if (prefs.length) parts.push('口味偏' + prefs.join('、'));
  if (taboos.length) parts.push(taboos.join('、') + '不吃');
  const input = parts.length ? '我想' + parts.join('，') : '帮我按当令挑几道';

  const cfg = require('./config');
  return {
    user_physique: physiqueText,
    user_preferences: prefs.join('、'),
    user_taboos: taboos.join('、'),
    CONVERSATION_NAME: o.conversationName || cfg.WORKFLOW_CONVERSATION_NAME || '',
    USER_INPUT: input,
  };
}

module.exports = {
  buildRecommendation,
  toWorkflowParams,
  Q_LABEL,
  AVOID_RULES,
  TASTE_RULES,
  matchedAvoidWords,
  matchedTaste,
  tasteLabels,
  avoidLabels,
};
