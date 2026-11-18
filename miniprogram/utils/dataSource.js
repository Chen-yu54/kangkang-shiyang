// utils/dataSource.js —— 只读数据源（A 的构建产物）
//
// 数据文件：data/recipes.json、data/terms.json、data/meta.json
//
// 铁律（团队分工方案 13.1 / 旧版任务书 5 节）：
//   1. data/ 是 A 的构建产物，前端只读，禁止手改、禁止另造兜底假数据
//   2. 文件为空时返回空集合，由页面走空态，不伪造任何菜品 / 节气
//   3. 任何字段都不得把 null / undefined 透给视图层（验收口径：无 undefined 暴露）
//   4. 节气名白名单从 terms.json 运行时派生，不在代码里硬编码 24 个节气名
//
// 说明：本文件只做「结构 + 枚举」校验，不做文案关键词校验。
//   12 个脱敏词的扫描必须由仓库外的工具执行，词表不得进源码，否则扫描自身就会命中。

const i18n = require('./i18n');
// 风味卡图片映射（C 的风味卡填充）：按菜名查菜品图（图在分包 packageDishes/dishes/），
// 查不到返回空串，视图层据此走 emoji 占位块
const dishImages = require('./dishImages');

// 数据文件是 js 模块而非 json：
//   微信小程序的 require 只解析 .js，require('../data/xxx.json') 会直接抛
//   "module 'data/xxx.json.js' is not defined"（实测 lib 3.17.6）。
// 字段结构不变，A 的流水线只需把 JSON 包成 module.exports = <JSON>。
const recipesRaw = require('../data/recipes.js');
const termsRaw = require('../data/terms.js');
const metaRaw = require('../data/meta.js');

// 契约枚举（对应 knowledge/card_meta.csv）
// cuisine 五值：lingnan_home 岭南家常 / guangfu 广府 / chaoshan 潮汕 / hakka 客家 / other 其他
const CUISINES = ['lingnan_home', 'guangfu', 'chaoshan', 'hakka', 'other'];
// 正常产物只有 easy/mid/hard；同时放开 1/2/3，避免旧产物残留数字时报错
const DIFFICULTIES = ['easy', 'mid', 'hard', 1, 2, 3, '1', '2', '3'];
// 0 = 成本待补（源数据写「档位待补」），不是错误值
const COST_LEVELS = [0, 1, 2, 3];
// 来源类型：已有菜式 / 典籍药膳 / AI 推荐
// 'tri-series' = 团队三系交付包的 288 道（广府/潮汕/客家各 96）
const ORIGINS = ['existing', 'classic', 'ai', 'tri-series'];
// 证据等级；C 级不进主推荐池
const EVIDENCE_LEVELS = ['A', 'B', 'C'];
// 兼容保留：旧数据可能带置信标签
const CONFIDENCE_LABELS = ['文献可考', '民间流传'];

// 菜品必填字段（对齐 card_meta.csv 的实际可渲染字段）
// allergen 为 M6 安全硬指标（学龄段致敏原漏报率必须为 0），缺失必须报出来
const REQUIRED_FIELDS = [
  'id',
  'name',
  'cuisine',
  'cuisineName',
  'terms',
  'mainIngredients',
  'method',
  'difficulty',
  'source',
  'origin',
  'evidence',
  'allergen',
];

function toStr(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toStrList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(toStr).filter(Boolean);
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

// 是否为合法的 MM-DD
function isMonthDay(value) {
  return /^\d{2}-\d{2}$/.test(value);
}

// 节气白名单：从 terms.json 派生，不在代码里写死节气名
const TERM_NAMES = (Array.isArray(termsRaw) ? termsRaw : [])
  .map((item) => toStr(item && item.name))
  .filter(Boolean);

// 不属于单个节气的合法取值：「全年通用」类菜品出现在菜系页与搜索页，不进节气筛选
const SPECIAL_TERMS = ['全年通用'];

// terms 数据未到位时不拦截，避免把「数据还没到」误判成「数据是脏的」
function isKnownTerm(name) {
  const target = toStr(name);
  if (!target) return false;
  if (SPECIAL_TERMS.indexOf(target) > -1) return true;
  if (TERM_NAMES.length === 0) return true;
  return TERM_NAMES.indexOf(target) > -1;
}

// 把一条菜品规整成「视图层可安全渲染」的形状
// 注意：功效字段（effect）不进入前端——V3.0 要求零功效表述，只展示客观信息
function sanitizeRecipe(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const costLevel = Number(src.costLevel);
  return {
    id: toStr(src.id),
    name: toStr(src.name),
    cuisine: toStr(src.cuisine),
    cuisineName: toStr(src.cuisineName),
    terms: toStrList(src.terms),
    mainIngredients: toStrList(src.mainIngredients),
    method: toStr(src.method),
    how: toStr(src.how),
    caution: toStr(src.caution),
    difficulty: toStr(src.difficulty),
    costLevel: COST_LEVELS.indexOf(costLevel) > -1 ? costLevel : 0,
    source: toStr(src.source),
    origin: toStr(src.origin),
    evidence: toStr(src.evidence),
    // allergen 保留「无」这个有效值：M6 要求字段非空，不能用空串表示「无过敏原」
    allergen: toStr(src.allergen),
    ageSuitable: toStrList(src.ageSuitable),
    ageCaution: toStr(src.ageCaution),
    verified: toStr(src.verified),
    // 风味卡图片：本地静态资源路径，无图菜返回空串（前端有 emoji 占位兜底）
    image: dishImages.imageForName(src.name),
  };
}

function sanitizeList(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList.map(sanitizeRecipe);
}

// 把一条节气规整成可渲染形状
function sanitizeTerm(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const dateWindow = toStrList(src.dateWindow).filter(isMonthDay);
  const poem = src.poem && typeof src.poem === 'object' ? src.poem : null;
  return {
    name: toStr(src.name),
    order: Number(src.order) || 0,
    dateWindow,
    // 起止窗口的展示串；数据缺失时为空，视图层据此隐藏
    windowText: dateWindow.length === 2 ? dateWindow[0] + ' – ' + dateWindow[1] : '',
    season: toStr(src.season),
    headline: toStr(src.headline),
    ingredients: toStrList(src.ingredients),
    dishes: toStrList(src.dishes),
    // —— 节气文化（构建产物里的文化字段，之前漏透传导致整块不显示） ——
    termOrder: Number(src.termOrder) || 0,
    intro: toStr(src.intro),
    slogan: toStr(src.slogan),
    aura: toStr(src.aura),
    poem: poem && poem.text ? { text: toStr(poem.text), author: toStr(poem.author) } : null,
    phenology: toStrList(src.phenology),
    folk: Array.isArray(src.folk)
      ? src.folk.map((f) => ({
          title: toStr(f && f.title),
          icon: toStr(f && f.icon),
          desc: toStr(f && f.desc),
          detail: toStr(f && f.detail),
        }))
      : [],
    ingredientDetails: Array.isArray(src.ingredientDetails)
      ? src.ingredientDetails.map((x) => ({
          name: toStr(x && x.name),
          nature: toStr(x && x.nature),
          priceLevel: Number(x && x.priceLevel) || 0,
        }))
      : [],
  };
}

// 开发期校验：只 console.warn 留痕，不丢数据、不改展示。
// 理由：字段缺失应「整块隐藏」，丢数据会让用户看到更少内容。
const warned = {};
function warnOnce(key, message) {
  if (warned[key]) return;
  warned[key] = true;
  console.warn('[dataSource] ' + message);
}

function checkRecipe(recipe) {
  const problems = [];
  REQUIRED_FIELDS.forEach((field) => {
    const value = recipe[field];
    const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
    if (isEmpty) problems.push(field);
  });
  if (recipe.cuisine && CUISINES.indexOf(recipe.cuisine) < 0) problems.push('cuisine=' + recipe.cuisine);
  if (recipe.difficulty && DIFFICULTIES.indexOf(recipe.difficulty) < 0) problems.push('difficulty=' + recipe.difficulty);
  if (recipe.costLevel && COST_LEVELS.indexOf(recipe.costLevel) < 0) problems.push('costLevel=' + recipe.costLevel);
  if (recipe.origin && ORIGINS.indexOf(recipe.origin) < 0) problems.push('origin=' + recipe.origin);
  if (recipe.evidence && EVIDENCE_LEVELS.indexOf(recipe.evidence) < 0) problems.push('evidence=' + recipe.evidence);
  recipe.terms.forEach((name) => {
    if (!isKnownTerm(name)) problems.push('term=' + name);
  });
  return problems;
}

// 汇总式校验：逐条打日志会把控制台刷满，这里按字段聚合，只报「哪个字段缺多少条」
function reportProblems(list) {
  const summary = {};
  let invalid = 0;
  list.forEach((recipe) => {
    const problems = checkRecipe(recipe);
    if (problems.length === 0) return;
    invalid += 1;
    problems.forEach((problem) => {
      const field = problem.split('=')[0];
      summary[field] = (summary[field] || 0) + 1;
    });
  });
  Object.keys(summary).forEach((field) => {
    warnOnce('agg:' + field, '字段「' + field + '」缺失或异常 ' + summary[field] + ' 条（共 ' + list.length + ' 条，问题条目 ' + invalid + ' 条）');
  });
  return summary;
}

// 按菜系 / 节气 / 关键词筛选。空参数表示不筛选。
// 关键词匹配范围：菜名 + 主料（团队分工方案 6.3 D3「菜名 / 食材关键词」）
function getRecipes(options) {
  const opts = options || {};
  const cuisine = toStr(opts.cuisine);
  const term = toStr(opts.term);
  const keyword = toStr(opts.keyword).toLowerCase();
  const list = sanitizeList(recipesRaw).filter((recipe) => {
    if (cuisine && recipe.cuisine !== cuisine) return false;
    if (term && recipe.terms.indexOf(term) < 0) return false;
    if (keyword) {
      const haystack = [recipe.name].concat(recipe.mainIngredients).join(' ').toLowerCase();
      if (haystack.indexOf(keyword) < 0) return false;
    }
    return true;
  });
  reportProblems(list);
  return list;
}

function getRecipeById(id) {
  const target = toStr(id);
  if (!target) return null;
  const found = getRecipes({}).filter((recipe) => recipe.id === target)[0];
  return found || null;
}

function getTerms() {
  if (!Array.isArray(termsRaw)) return [];
  return termsRaw
    .map(sanitizeTerm)
    .filter((term) => term.name)
    .sort((a, b) => a.order - b.order);
}

function getTerm(name) {
  const target = toStr(name);
  if (!target) return null;
  const found = getTerms().filter((term) => term.name === target)[0];
  return found || null;
}

// —— 节气推算 ——
// 数据里只有 MM-DD，没有年份。所有跨年判断都以传入日期所在年份为基准，
// 起始日早于今天时顺延到次年，保证「小寒 / 大寒 / 立春」这类跨年窗口不会算错。

function todayMonthDay(today) {
  const d = today instanceof Date ? today : new Date();
  return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function startOfDay(today) {
  const d = today instanceof Date ? today : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// 当前所处节气。今天不落在任何窗口内时返回 null。
function getCurrentTerm(today) {
  const monthDay = todayMonthDay(today);
  const terms = getTerms().filter((term) => term.dateWindow.length === 2);
  for (let i = 0; i < terms.length; i += 1) {
    const start = terms[i].dateWindow[0];
    const end = terms[i].dateWindow[1];
    // MM-DD 等长，可直接字符串比较
    const inWindow = start <= end ? monthDay >= start && monthDay <= end : monthDay >= start || monthDay <= end;
    if (inWindow) return terms[i];
  }
  return null;
}

// 距下一个节气起始日的天数。返回 { term, days }；无数据时返回 null。
function getNextTerm(today) {
  const terms = getTerms().filter((term) => term.dateWindow.length === 2);
  if (terms.length === 0) return null;

  const base = startOfDay(today);
  let best = null;
  terms.forEach((term) => {
    const parts = term.dateWindow[0].split('-');
    const month = Number(parts[0]) - 1;
    const day = Number(parts[1]);
    let target = new Date(base.getFullYear(), month, day);
    if (target.getTime() < base.getTime()) {
      target = new Date(base.getFullYear() + 1, month, day);
    }
    const days = Math.round((target.getTime() - base.getTime()) / 86400000);
    if (best === null || days < best.days) best = { term, days };
  });
  return best;
}

// 数据版本标签（「数字可证明」的落地点）
function getDataVersionLabel() {
  const src = metaRaw && typeof metaRaw === 'object' ? metaRaw : {};
  const version = toStr(src.version);
  const generatedAt = toStr(src.generatedAt);
  if (!version) return i18n.t('meta.notGenerated');
  return generatedAt ? version + ' · ' + generatedAt : version;
}

function isDataAvailable() {
  return getRecipes({}).length > 0;
}

// 数据元信息：生成页/依据区要显示版本号与总条数，只读不加工
function getMeta() {
  const src = metaRaw && typeof metaRaw === 'object' ? metaRaw : {};
  return {
    version: toStr(src.version),
    generatedAt: toStr(src.generatedAt),
    total: (getRecipes({}) || []).length,
    label: getDataVersionLabel(),
  };
}

module.exports = {
  CUISINES,
  DIFFICULTIES,
  COST_LEVELS,
  ORIGINS,
  EVIDENCE_LEVELS,
  CONFIDENCE_LABELS,
  REQUIRED_FIELDS,
  TERM_NAMES,
  sanitizeRecipe,
  sanitizeTerm,
  sanitizeList,
  checkRecipe,
  getRecipes,
  getRecipeById,
  getTerms,
  getTerm,
  getCurrentTerm,
  getNextTerm,
  getDataVersionLabel,
  getMeta,
  isDataAvailable,
  isKnownTerm,
};
