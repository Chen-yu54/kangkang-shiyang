// utils/format.js —— 纯函数格式化：难度 / 成本 / 日期 / 文本兜底
//
// 铁律（任务书 12 节）：任何字段都不得把 null / undefined / 空串直接透给视图层，
//   本文件的每个函数都必须返回可渲染的字符串，取不到值时返回空串或明确文案。

const i18n = require('./i18n');

// 难度枚举 → 文案 key（任务书 5 节：easy | mid | hard）
const DIFFICULTY_KEY = {
  easy: 'format.difficulty.easy',
  mid: 'format.difficulty.mid',
  hard: 'format.difficulty.hard',
};

// 成本档 → 文案（任务书 5 节：costLevel 1 | 2 | 3）
// 原先显示 ¥/¥¥/¥¥¥，用户反馈符号太抽象，改成直白的词
const COST_TEXT = {
  1: '便宜',
  2: '适中',
  3: '偏贵',
};

// 来源类型 → 文案 key（card_meta.csv 的 origin 字段）
const ORIGIN_KEY = {
  existing: 'origin.existing',
  classic: 'origin.classic',
  ai: 'origin.ai',
};

// 风味 → emoji 占位
// 知识库的 card_meta.csv 没有图片字段，所以所有菜品卡目前都走占位；
// 换成真实图片后，emoji 只在加载失败时出现。
const CUISINE_EMOJI = {
  lingnan_home: '🍲',
  guangfu: '🥟',
  chaoshan: '🍜',
  hakka: '🍚',
  other: '🍽️',
};

function cuisineEmoji(cuisine) {
  return CUISINE_EMOJI[text(cuisine)] || '🍽️';
}

// 安全的字符串化：null / undefined / 纯空白 一律回落到 fallback
function text(value, fallback) {
  if (value === null || value === undefined) return fallback || '';
  const s = String(value).trim();
  return s || (fallback || '');
}

// 难度文案。未知枚举值返回空串（调用方据此隐藏整块，而不是显示原始英文枚举）
function difficultyLabel(value) {
  const key = DIFFICULTY_KEY[text(value)];
  return key ? i18n.t(key) : '';
}

// 成本档文案。非法值返回空串
function costLabel(value) {
  const n = Number(value);
  return COST_TEXT[n] || '';
}

// 日期展示：把 ISO 串或 YYYY-MM-DD 统一成 YYYY-MM-DD；取不到返回空串
function dateLabel(value) {
  const s = text(value);
  if (!s) return '';
  const matched = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return matched ? matched[0] : '';
}

// 来源类型文案：existing 已有菜式 / classic 典籍药膳 / ai AI 推荐
function originLabel(origin) {
  const key = ORIGIN_KEY[text(origin)];
  return key ? i18n.t(key) : '';
}

// 限制类文案净化：知识库里写的是「油炸偏高脂，高血脂少」「偏咸，高血压/肾病限盐」
// 这类给营养师看的表述，直接出现在 C 端详情页过于敏感。
// 策略：按片段拆分，命中敏感词的片段整段不显示（只提炼出「慎食/建议少吃」的建议），
// 客观口味描述（偏咸/油炸偏高脂）和孕妇等硬安全提示原样保留。
//   「油炸偏高脂，高血脂少」          → 「油炸偏高脂，建议少吃」
//   「偏咸，高血压/肾病限盐」         → 「偏咸，建议少吃」
//   「高嘌呤高胆固醇，孕妇忌」        → 「高嘌呤高胆固醇，孕妇忌」（不含敏感词，原样保留）
const SENSITIVE_WORDS = /(高血压|高血脂|高血糖|糖尿病|糖友|肾病|肾友|痛风|高尿酸|高胆固醇血症|脂肪肝|痔疮)/;

function softenCaution(value) {
  const s = text(value);
  if (!s) return '';
  if (!SENSITIVE_WORDS.test(s)) return s;

  const clauses = s
    .split(/[；;]+/)
    .map((clause) => {
      if (!SENSITIVE_WORDS.test(clause)) return clause.trim();
      const kept = [];
      let forbid = false;
      let less = false;
      clause.split(/[\/、，,]+/).forEach((seg) => {
        const part = seg.trim();
        if (!part) return;
        if (SENSITIVE_WORDS.test(part)) {
          if (/(忌|勿|不可)/.test(part)) forbid = true;
          else if (/(少|限|减|适量|控制)/.test(part)) less = true;
          return; // 命中敏感词的片段整段不显示
        }
        kept.push(part);
      });
      let out = kept.join('，');
      if (forbid) out = out ? out + '，慎食' : '慎食';
      else if (less) out = out ? out + '，建议少吃' : '建议少吃';
      else if (!out) out = '建议适量';
      return out;
    })
    .filter(Boolean);

  // 多个分句会洗出相同的「建议少吃」，全局去重
  const deduped = [];
  clauses.forEach((c) => {
    if (deduped.indexOf(c) === -1) deduped.push(c);
  });
  return deduped.join('；');
}

module.exports = {
  text,
  difficultyLabel,
  costLabel,
  originLabel,
  softenCaution,
  cuisineEmoji,
  dateLabel,
};
