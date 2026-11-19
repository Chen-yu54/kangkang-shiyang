// 把本工程的 288 道菜转成 cloudfunctions/aiqa/data/recipes.json
//
// 为什么要这个脚本：aiqa 包自带的 recipes.json 只有 49 道示例，且字段格式与本工程不同。
// 直接换文件会踩三个格式差异：
//   cuisine    本工程 "guangfu"        → aiqa 要 "广府"
//   difficulty 本工程 "easy"           → aiqa 要 1 / 2 / 3
//   allergen   本工程 "无" / "虾类过敏忌" → aiqa 要字符串数组
//
// 用法：node scripts/build-aiqa-recipes.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'miniprogram', 'data', 'recipes.js');
const OUT = path.join(ROOT, 'cloudfunctions', 'aiqa', 'data', 'recipes.json');

// 菜系：英文 key → aiqa 用的中文名
const CUISINE_TEXT = {
  guangfu: '广府',
  chaoshan: '潮汕',
  hakka: '客家',
  lingnan_home: '岭南家常',
  other: '其他',
};

// 难度：easy/mid/hard → 1/2/3（aiqa 的排序里直接比较数字）
const DIFFICULTY_NUM = { easy: 1, mid: 2, hard: 3 };

// 致敏原白名单：只有这些词才算过敏原。
// 本工程的 allergen 原文混着疾病名（痛风/糖友/高血压）、处理提示（须吐沙彻底）、
// 人群提示（孕妇/与柿子同食）——这些都不是过敏原，混进来会让 aiqa 的忌口匹配失效。
// AIQA 用这个字段做"忌口 ∩ 食材"的硬过滤，所以必须是**食材名**。
const ALLERGEN_WORDS = [
  '虾', '虾类', '虾仁', '鲜虾',
  '蟹', '蟹类', '螃蟹',
  '贝', '贝类', '蛤', '蚝', '牡蛎', '带子', '扇贝', '花蛤', '薄壳',
  '鱼', '鱼类', '鱼露',
  '蛋', '蛋类', '鸡蛋', '皮蛋', '咸蛋',
  '奶', '牛奶', '乳', '奶酪', '黄油',
  '花生', '花生酱',
  '豆制品', '豆腐', '豆干', '腐竹', '豆浆',
  '坚果', '核桃', '杏仁', '腰果', '芝麻',
  '麸质', '面筋', '小麦',
  '酒精', '酒',
  '禽', '禽类',
];

// 归一化：同物异名合并，避免数据里出现"虾类""虾仁"两种写法导致匹配漏掉
const ALLERGEN_ALIAS = {
  虾类: '虾', 虾仁: '虾', 鲜虾: '虾',
  蟹类: '蟹', 螃蟹: '蟹',
  贝类: '贝', 蛤: '贝', 花蛤: '贝', 薄壳: '贝', 扇贝: '贝',
  牡蛎: '蚝', 带子: '贝',
  鱼类: '鱼', 鱼露: '鱼',
  蛋类: '蛋', 鸡蛋: '蛋', 皮蛋: '蛋', 咸蛋: '蛋',
  牛奶: '奶', 乳: '奶', 奶酪: '奶', 黄油: '奶',
  花生酱: '花生',
  豆腐: '豆制品', 豆干: '豆制品', 腐竹: '豆制品', 豆浆: '豆制品',
  核桃: '坚果', 杏仁: '坚果', 腰果: '坚果', 芝麻: '坚果',
  面筋: '麸质', 小麦: '麸质',
  禽类: '禽',
  酒: '酒精',
};

/**
 * 从原文里提取**真正的过敏原**。
 * 只认白名单里的词，其余（疾病名、处理提示、人群提示）一概丢弃。
 *
 *   「虾类过敏忌」              → ['虾']
 *   「痛风/高尿酸忌；虾类过敏忌」 → ['虾']       ← 疾病名不进
 *   「贝类高嘌呤，痛风/过敏者忌」  → ['贝']
 *   「痛风少食；过敏者忌」        → []           ← 没有具体过敏原
 *   「虾类过敏忌；肠粉升糖快，糖友少」→ ['虾']
 */
function toAllergenArray(raw) {
  const s = String(raw || '').trim();
  if (!s || s === '无' || s === '没有') return [];

  const out = [];
  ALLERGEN_WORDS.forEach((w) => {
    if (s.indexOf(w) < 0) return;
    const norm = ALLERGEN_ALIAS[w] || w;
    if (out.indexOf(norm) < 0) out.push(norm);
  });
  return out;
}

function build() {
  if (!fs.existsSync(SRC)) {
    console.error('[build-aiqa] 找不到 ' + SRC);
    process.exit(1);
  }

  // 数据文件是 module.exports = [...]，用 require 读
  const recipes = require(SRC);

  const out = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    cuisine: CUISINE_TEXT[r.cuisine] || '其他',
    terms: Array.isArray(r.terms) ? r.terms : [],
    mainIngredients: Array.isArray(r.mainIngredients) ? r.mainIngredients : [],
    method: r.method || '其他',
    caution: r.caution || '',
    allergen: toAllergenArray(r.allergen),
    ageSuitable: Array.isArray(r.ageSuitable) && r.ageSuitable.length ? r.ageSuitable : ['成人'],
    costLevel: Number(r.costLevel) || 1,
    difficulty: DIFFICULTY_NUM[r.difficulty] || 2,
    evidence: r.evidence || 'B',
    // 真实耗时（分钟）。aiqa 用它做「半小时能做什么」这类硬过滤，
    // 光看 difficulty 会把「冷泡 6 小时」当成快手菜推出去。
    // timeEstimated=true 表示按做法估的，提示模型别把估计说成确定的分钟数。
    timeMinutes: r.timeMinutes == null ? null : Number(r.timeMinutes),
    timeEstimated: r.timeSource === 'estimated',
  }));

  // 校验：aiqa 的硬过滤完全依赖 mainIngredients 与 allergen，字段缺失等于过滤失效
  const noIng = out.filter((x) => !x.mainIngredients.length).length;
  const noAge = out.filter((x) => !x.ageSuitable.length).length;
  const badCuisine = out.filter((x) => ['广府', '潮汕', '客家', '岭南家常', '其他'].indexOf(x.cuisine) < 0).length;

  const dir = path.dirname(OUT);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');

  const size = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log('[build-aiqa] 输出 ' + out.length + ' 道 → ' + path.relative(ROOT, OUT) + '（' + size + ' KB）');
  console.log('[build-aiqa] 缺主料 ' + noIng + ' 道 / 缺人群 ' + noAge + ' 道 / 菜系异常 ' + badCuisine + ' 道');

  // 分布
  const byCuisine = {};
  out.forEach((x) => { byCuisine[x.cuisine] = (byCuisine[x.cuisine] || 0) + 1; });
  console.log('[build-aiqa] 菜系分布 ' + JSON.stringify(byCuisine));

  const withAllergen = out.filter((x) => x.allergen.length).length;
  console.log('[build-aiqa] 带致敏原标记 ' + withAllergen + ' 道');

  if (noIng > 0) {
    console.log('[build-aiqa] ⚠ 有 ' + noIng + ' 道缺主料，忌口硬过滤对这些菜无效');
  }
}

build();
