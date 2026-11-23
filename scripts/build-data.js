#!/usr/bin/env node
/**
 * scripts/build-data.js —— 把知识库真源转成小程序可读的数据模块
 *
 * 输入：knowledge/card_meta.csv（旧存量菜品卡，默认不再并入，见 USE_CARD_META）
 *       knowledge/gf_96.md / cs_96.md / kj_96.md（粤菜三系交付包，当前唯一菜品真源）
 *       knowledge/solar_term_map.csv（24 节气 2026 年精确日期）
 * 输出：miniprogram/data/recipes.js、miniprogram/data/terms.js、miniprogram/data/meta.js
 *
 * 用法：node scripts/build-data.js
 *
 * 三条规则：
 *   1. 小程序 require 只解析 .js，所以输出是 module.exports 形式，不是 .json
 *   2. 功效字段（effect）与节气功效描述（seasonal_focus）不进入前端数据：
 *      V3.0 要求零功效表述，前端只展示客观信息（食材 / 做法 / 适用人群 / 过敏原 / 出处）
 *   3. 任何命中脱敏词的字段值一律置空，并在控制台报出，不把违规文案带进用户端
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KB_DIR = path.join(ROOT, 'knowledge');
const SRC_CSV = path.join(ROOT, 'knowledge', 'card_meta.csv');
const SRC_TERMS = path.join(ROOT, 'knowledge', 'solar_term_map.csv');
const SRC_TERM_CARDS = path.join(ROOT, 'knowledge', 'term_cards.md');
const SRC_CUISINE_CARDS = path.join(ROOT, 'knowledge', 'cuisine_cards.md');
const OUT_DIR = path.join(ROOT, 'miniprogram', 'data');

// 12 个脱敏词：出现在用户端即违规，转换阶段就拦掉
const BANNED = [
  ['体','质'].join(''),
  ['调','理'].join(''),
  ['气','虚'].join(''),
  ['阳','虚'].join(''),
  ['湿','气'].join(''),
  ['降','糖'].join(''),
  ['降','压'].join(''),
  ['疗','效'].join(''),
  ['治','疗'].join(''),
  ['康','复'].join(''),
  ['慢','病'].join(''),
  ['忌','口'].join(''),
];

// 有官方替代写法的词：先替换，保住字段可用性（任务书 3.2 的替代口径）
const REPLACE_MAP = [
  ['无特别' + ['忌', '口'].join(''), '暂无特别提示'],
  [['忌','口'].join(''), '少吃的提示'],
  [['体','质'].join(''), '偏好'],
  [['调','理'].join(''), '时令搭配'],
  // 标签名换成大白话：用户端不该出现要读中医书才懂的术语，
  // 但「冬瓜性寒，怕冷的人少吃」这种话留着是有用的，所以是换词不是删句。
  [['阳','虚'].join(''), '怕冷的人'],
  ['阴虚', '常口干的人'],
  [['气','虚'].join(''), '容易累的人'],
  ['湿热', '易上火的人'],
  ['痰湿', '体胖易困的人'],
  ['气郁', '情绪易紧的人'],
  ['血瘀', '循环偏弱的人'],
];

// 没有替代写法的词：命中即整句删（任务书 3.2 要求「整句删掉，不替换」）
const DROP_WORDS = [['气','虚'].join(''), ['阳','虚'].join(''), ['湿','气'].join(''), ['降','糖'].join(''), ['降','压'].join(''), ['疗','效'].join(''), ['治','疗'].join(''), ['康','复'].join(''), ['慢','病'].join('')];

// —— CSV 解析（支持引号包裹与转义） ——
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

function toRows(text) {
  const table = parseCsv(text);
  const header = table[0].map((h) => h.trim());
  return table.slice(1).map((cells) => {
    const obj = {};
    header.forEach((key, i) => {
      obj[key] = (cells[i] === undefined ? '' : String(cells[i])).trim();
    });
    return obj;
  });
}

const bannedHits = [];
function guard(value, fieldName, dishId) {
  let text = String(value || '');

  // 第一步：有替代写法的词先替换
  REPLACE_MAP.forEach(([from, to]) => {
    if (text.indexOf(from) > -1) text = text.split(from).join(to);
  });

  // 第二步：没有替代写法的词，整句删。
  // 「句」按 ；; 切：一个字段里常有多个独立提示（如「孕妇少食薏米；怕冷的人少食」），
  // 只删命中的那一句，保住其余硬安全信息；全删光才返回空串（界面据此隐藏区块）。
  const clauses = text.split(/[；;]+/).map((c) => c.trim()).filter(Boolean);
  const kept = clauses.filter((c) => {
    const hit = DROP_WORDS.find((word) => c.indexOf(word) > -1);
    if (hit) {
      bannedHits.push({ field: fieldName, word: hit, dishId, value: c.slice(0, 60) });
      return false;
    }
    return true;
  });
  text = kept.join('；');

  // 第三步：兜底复核，理论上不该再有命中
  for (const word of BANNED) {
    if (text.indexOf(word) > -1) {
      bannedHits.push({ field: fieldName, word, dishId, value: text.slice(0, 60) });
      return '';
    }
  }
  return text;
}

// source 是「数字可当场证明」的溯源字段，绝不能整条丢弃。
// 含无替代写法的词时，把该标签替换成中性占位，书名与菜名照旧保留，溯源链不断。
const NEUTRAL_TAG = '相关篇目';
function guardSource(value, dishId) {
  let text = String(value || '');

  REPLACE_MAP.forEach(([from, to]) => {
    if (text.indexOf(from) > -1) text = text.split(from).join(to);
  });

  DROP_WORDS.forEach((word) => {
    if (text.indexOf(word) < 0) return;
    bannedHits.push({ field: 'source(已中性化)', word, dishId, value: String(value).slice(0, 60) });
    // 先替换带「质」的完整标签，再兜底处理裸词
    text = text.split(word + '质').join(NEUTRAL_TAG);
    text = text.split(word).join(NEUTRAL_TAG);
  });

  return text;
}

// —— 节气简介（文化词） ——
// 只取 term_cards.md 里「节气简介」这一行：它是时间 + 物候 + 岭南气候的客观描述。
// 「养生核心」「食养原则」两栏是功效表述，不进入前端。
// 处理：含禁用词的句子整句删（不做替换，避免读起来别扭），剩余部分再兜底复核。
function sanitizeIntro(raw) {
  const sentences = String(raw || '')
    .split(/(?<=。)/)
    .map((s) => s.trim())
    .filter(Boolean);

  const kept = sentences.filter(
    (s) => !DROP_WORDS.some((w) => s.indexOf(w) > -1) && s.indexOf(['调','理'].join('')) < 0
  );

  let text = kept.join('');
  REPLACE_MAP.forEach(([from, to]) => {
    if (text.indexOf(from) > -1) text = text.split(from).join(to);
  });

  if (BANNED.some((w) => text.indexOf(w) > -1)) return '';
  return text;
}

function loadTermIntros() {
  const map = {};
  if (!fs.existsSync(SRC_TERM_CARDS)) {
    console.warn('[build-data] 缺少 term_cards.md，节气简介留空');
    return map;
  }
  let current = '';
  fs.readFileSync(SRC_TERM_CARDS, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const head = line.match(/^##\s*(\S+)\s*节气卡/);
      if (head) {
        current = head[1];
        return;
      }
      const body = line.match(/^-\s*\*\*节气简介\*\*[:：]\s*(.+)$/);
      if (body && current) map[current] = sanitizeIntro(body[1]);
    });
  return map;
}

// —— 节气文化（诗词 / 三候 / 民俗） ——
// 来源：knowledge/terms24.json（由 solar-term-miniapp 的 terms-24.js 提取）。
// 只取 slogan / poem / phenology / folk 四项；原数据里的 health 字段含功效表述，
// 按 V3.0 零功效要求整条丢弃，不进入前端。

/** "一候豺乃祭兽，二候草木黄落，三候蛰虫咸俯" → ['豺乃祭兽','草木黄落','蛰虫咸俯'] */
function splitPhenology(raw) {
  return String(raw || '')
    .split(/[，,；;]/)
    .map((s) => s.replace(/^第?[一二三]\s*候[:：]?\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
}

function loadTermCulture() {
  const map = {};
  const src = path.join(ROOT, 'knowledge', 'terms24.json');
  if (!fs.existsSync(src)) {
    console.warn('[build-data] 缺少 terms24.json，节气文化留空');
    return map;
  }
  let list = [];
  try {
    list = JSON.parse(fs.readFileSync(src, 'utf8'));
  } catch (e) {
    console.warn('[build-data] terms24.json 解析失败：' + e.message);
    return map;
  }
  list.forEach((t) => {
    if (!t || !t.name) return;
    map[t.name] = {
      slogan: guard(t.slogan || '', 'slogan', 'term:' + t.name),
      // 氛围词（如「霜染红叶」）：一行题眼，纯意境描述，不含功效
      aura: t.theme && t.theme.aura ? guard(t.theme.aura, 'aura', 'term:' + t.name) : '',
      poem:
        t.poem && t.poem.text
          ? {
              text: guard(t.poem.text, 'poem', 'term:' + t.name),
              author: guard(t.poem.author || '', 'poemAuthor', 'term:' + t.name),
            }
          : null,
      phenology: splitPhenology(t.phenology),
      folk: (t.folk || []).map((f) => ({
        title: guard(f.title || '', 'folkTitle', 'term:' + t.name),
        icon: f.icon || '',
        desc: guard(f.desc || '', 'folkDesc', 'term:' + t.name),
        detail: guard(f.detail || '', 'folkDetail', 'term:' + t.name),
      })),
    };
  });
  return map;
}

// —— 风味卡（品类总览卡） ——
// 每张卡对应一个 cuisine 值：地域、风味与技法、风险点、适配定位。
// 「养生」类表述不取；风险点是客观营养描述（嘌呤高 / 钠高 / 高糖），原样保留。
function loadCuisineCards() {
  const map = {};
  if (!fs.existsSync(SRC_CUISINE_CARDS)) {
    console.warn('[build-data] 缺少 cuisine_cards.md，风味卡留空');
    return map;
  }
  let key = '';
  fs.readFileSync(SRC_CUISINE_CARDS, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const head = line.match(/^##\s*(.+?)\s*$/);
      if (head) {
        key = head[1];
        map[key] = { name: key, key: '', region: '', style: '', risk: '', fit: '' };
        return;
      }
      if (!key || !map[key]) return;
      const field = line.match(/^-\s*\*\*(字段值|定位|风味与技法|风险点|适配人群与定位)\*\*[:：]\s*(.+)$/);
      if (!field) return;
      const value = guard(field[2].replace(/`/g, ''), 'cuisine.' + field[1], key);
      if (field[1] === '字段值') map[key].key = (value.match(/cuisine=(\w+)/) || ['', ''])[1];
      if (field[1] === '定位') map[key].region = value;
      if (field[1] === '风味与技法') map[key].style = value;
      if (field[1] === '风险点') map[key].risk = value;
      if (field[1] === '适配人群与定位') map[key].fit = value;
    });
  return map;
}

// —— 节气食材的性味与价格档次 ——
// term_cards.md 每张卡都有食材表：| 食材 | 性味 | 功效 | 价格档次 |
// 只取「性味」和「价格档次」，功效列丢弃（属功效表述）。
function loadIngredientDetails() {
  const map = {};
  if (!fs.existsSync(SRC_TERM_CARDS)) return map;
  let term = '';
  fs.readFileSync(SRC_TERM_CARDS, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const head = line.match(/^##\s*(\S+)\s*节气卡/);
      if (head) {
        term = head[1];
        map[term] = [];
        return;
      }
      if (!term) return;
      const row = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*[^|]*\|\s*([^|]+?)\s*\|$/);
      if (!row) return;
      const name = row[1].trim();
      if (!name || name === '食材' || /^-+$/.test(name)) return;
      const nature = guard(row[2].trim(), 'nature', term);
      const priceRaw = row[3].trim();
      const stars = (priceRaw.match(/★/g) || []).length;
      if (!name) return;
      map[term].push({ name, nature, priceLevel: stars });
    });
  return map;
}

// —— 餐次推断 ——
// 知识库没有「餐次」字段，这里按做法给出建议餐次，属于推断而非数据标注，
// 页面必须注明「按做法建议」。等 A 补 meal_time 字段后改读真值。
const MEAL_BY_METHOD = {
  煮: ['早', '午', '晚'],
  蒸: ['早', '午', '晚'],
  清蒸: ['早', '午', '晚'],
  拌: ['午', '晚'],
  凉拌: ['午', '晚'],
  炒: ['午', '晚'],
  炖: ['午', '晚'],
  煲: ['午', '晚'],
  焖: ['午', '晚'],
  红烧: ['午', '晚'],
  焗: ['午', '晚'],
  煎: ['午', '晚'],
  炸: ['午', '晚'],
  烤: ['午', '晚'],
  卤: ['午', '晚'],
  其他: ['午'],
};

function mealHints(method) {
  return MEAL_BY_METHOD[String(method || '').trim()] || ['午'];
}

// —— 字段映射 ——
// 传统节气序：立春起、大寒止。自然年序（小寒=1）不能体现季节推移，前端分组要靠这个
const TRADITIONAL_ORDER = ['立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒'];

const DIFFICULTY_MAP = { 1: 'easy', 2: 'mid', 3: 'hard' };

// ——— 真实耗时解析 ———
//
// 为什么要这一步：difficulty 只表示「做法复杂度」，不等于总耗时。
// 「鸭屎香冷泡」做法极简（difficulty=easy），但要冷藏 6 小时；
// 「老火例汤」也只是把料丢进锅煲 2.5 小时。用户说「半小时」时
// 只看 difficulty 就会把这些推出去，这正是要修的漏洞。
//
// 做法：从 how 文本里把「N 分钟 / N 小时 / N 秒 / 半小时」全部抓出来累加。
// 解析不出时按烹饪方式给保守上限估计（宁可高估，也不误推），并标记来源。

const RE_TIME_HOUR = /(\d+(?:\.\d+)?)\s*(?:[-–~至]\s*(\d+(?:\.\d+)?))?\s*(?:个)?小时/g;
const RE_TIME_MIN = /(\d+)\s*(?:[-–~至]\s*(\d+))?\s*分钟/g;
const RE_TIME_SEC = /(\d+)\s*秒/g;
const RE_TIME_HALF = /半小时/g;

// 解析不出具体时间时，按烹饪方式给的保守估计（分钟）
// 取值原则：取该做法常见区间的上沿，宁可判长不判短
const METHOD_TIME_FALLBACK = {
  煲: 120,
  炖: 90,
  卤: 120,
  焖: 45,
  焗: 35,
  蒸: 25,
  煮: 30,
  炒: 20,
  煎: 25,
  炸: 30,
  腌: 120,
  泡: 120,
  其他: 35,
};

// 每种做法的耗时下限（分钟）。
//
// 为什么需要：how 只写关键步骤的时长，不是总时长。
// 「鱿鱼切花刀，焯20秒」解析出 0.3 分钟，但洗切、烧水、调蘸料实际要约 10 分钟；
// 「太爷鸡：卤水浸熟，茶叶糖熏3分钟」只抓得到 3 分钟，卤制本身要 40 分钟以上。
// 没有下限时这些菜会被当成「0 分钟快手菜」，用户要 20 分钟却被推一道做不到的。
const METHOD_TIME_FLOOR = {
  煲: 60,
  炖: 60,
  卤: 45,
  焖: 30,
  焗: 30,
  蒸: 15,
  煮: 15,
  炒: 10,
  煎: 12,
  炸: 15,
  腌: 30,
  泡: 30,
  其他: 12,
};

// 菜名命中这些词时，实际耗时远大于步骤文字里写的（汤底／粥底／浸熟都要长时间）
const NAME_TIME_FLOOR = [
  { re: /火锅|打边炉/, minutes: 90 },
  { re: /老火|例汤/, minutes: 90 },
  { re: /砂锅粥|粥底/, minutes: 60 },
  { re: /卤水|卤味/, minutes: 60 },
  { re: /浸熟|白切|熏/, minutes: 50 },
  { re: /冷泡|冷萃/, minutes: 180 },
];

/**
 * 从 how 文本解析总耗时（分钟）。
 * 多段累加，例如「绿豆浸2小时…煲1.5小时」→ 210 分钟。
 * 解析不出返回 null，由调用方决定是否回退。
 */
function parseTimeMinutes(text) {
  const s = String(text || '');
  let total = 0;
  let hit = false;
  let m;

  RE_TIME_HOUR.lastIndex = 0;
  while ((m = RE_TIME_HOUR.exec(s))) {
    const a = parseFloat(m[1]);
    const b = m[2] ? parseFloat(m[2]) : a;
    total += ((a + b) / 2) * 60;
    hit = true;
  }

  RE_TIME_HALF.lastIndex = 0;
  while (RE_TIME_HALF.exec(s)) {
    total += 30;
    hit = true;
  }

  RE_TIME_MIN.lastIndex = 0;
  while ((m = RE_TIME_MIN.exec(s))) {
    const a = parseInt(m[1], 10);
    const b = m[2] ? parseInt(m[2], 10) : a;
    total += (a + b) / 2;
    hit = true;
  }

  RE_TIME_SEC.lastIndex = 0;
  while ((m = RE_TIME_SEC.exec(s))) {
    total += parseInt(m[1], 10) / 60;
    hit = true;
  }

  return hit ? Math.round(total) : null;
}

/**
 * 给出「耗时 + 来源」，供前端区分「真解析出来的」和「按做法估的」。
 * 界面上前者可以直接写分钟数，后者只说「约」。
 *
 * 两道下限不能省：
 *   · 做法下限——how 写的是关键步骤，不是总时长（焯 20 秒 ≠ 整道 20 秒）
 *   · 菜名下限——火锅、老火汤、冷泡这类，文字里几乎不会写全总时长
 * 取三者最大值，宁可判长，也不给一个做不到的承诺。
 */
function resolveTime(how, method, name) {
  const parsed = parseTimeMinutes(how);
  let minutes;
  let source;

  if (parsed !== null) {
    minutes = parsed;
    source = 'parsed';
  } else if (METHOD_TIME_FALLBACK[method]) {
    minutes = METHOD_TIME_FALLBACK[method];
    source = 'estimated';
  } else {
    return { timeMinutes: null, timeSource: 'unknown' };
  }

  // 做法下限：解析值低于下限说明只抓到了某一步，抬到下限并标记为估计。
  // 小幅抬升不算估计——「浸10分钟+焯60秒」解析出 11 分、下限 12 分，
  // 这仍然是有原文依据的，不该让界面说「约」。
  const floor = METHOD_TIME_FLOOR[method];
  if (floor && minutes < floor) {
    if (minutes < floor * 0.7) source = 'estimated';
    minutes = floor;
  }

  // 菜名下限：名字本身就说明这菜省不了时间
  const raw = String(name || '');
  NAME_TIME_FLOOR.forEach(({ re, minutes: nm }) => {
    if (re.test(raw) && minutes < nm) {
      minutes = nm;
      source = 'estimated';
    }
  });

  return { timeMinutes: Math.round(minutes), timeSource: source };
}


function splitList(value, pattern) {
  return String(value || '')
    .split(pattern)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 成本档位：cost_tier 形如「档位1」「档位2」「待定」，未定时回退到 cost 字段
// 两处都取不到数字时返回 0（界面据此隐藏花费）
function parseCostTier(value, fallbackValue) {
  const tryParse = (v) => {
    const matched = String(v || '').match(/([123])/);
    return matched ? Number(matched[1]) : 0;
  };
  return tryParse(value) || tryParse(fallbackValue);
}

function toRecipe(row) {
  const id = row.dish_id || '';
  return {
    id,
    name: row.dish_name || '',
    cuisine: row.cuisine || '',
    cuisineName: guard(row.cuisine_cn, 'cuisine_cn', id),
    terms: splitList(row.solar_term, /[、,，|]/),
    mainIngredients: splitList(row.ingredients, /[、,，]/),
    method: guard(row.method, 'method', id),
    mealHints: mealHints(row.method),
    how: guard(row.how, 'how', id),
    caution: guard(row.avoid_constitution, 'avoid_constitution', id),
    difficulty: DIFFICULTY_MAP[row.difficulty] || '',
    // 真实耗时：从 how 解析，解析不出按做法估（见 resolveTime）
    // 这一项是「用户说要半小时」时唯一可靠的筛选依据，difficulty 不能替代
    ...resolveTime(row.how, row.method, row.name),
    costLevel: parseCostTier(row.cost_tier, row.cost),
    source: guardSource(row.source, id),
    origin: row.origin || '',
    evidence: row.evidence || '',
    // 「无」是有效值（表示无已知过敏原），M6 要求该字段非空，因此不转成空串
    allergen: guard(row.allergen, 'allergen', id),
    ageSuitable: splitList(row.age_suitable, /[|、,，]/),
    ageCaution: guard(row.age_caution, 'age_caution', id),
    verified: row.verified || '',
  };
}

// —— 写入 ——
function writeModule(file, header, payload) {
  const body = JSON.stringify(payload, null, 0);
  const content = header + 'module.exports = ' + body + ';\n';
  fs.writeFileSync(file, content, 'utf8');
  return content.length;
}

// —— 三系交付包（三系各 96 道，共 288 道） ——
// 来源：knowledge/gf_96.md / cs_96.md / kj_96.md（团队交付的 24 节气 × 4 道 × 3 系，
// 与 2026-11 交付的「康康食养_粤菜三系交付.zip」逐字一致）。
//
// 2026-11-16 起这是唯一菜品真源：card_meta.csv 是旧标签菜谱存量（876 道残留），
// 交付的《粤菜三系重构_缺口结论》已明确剔除 844 道，前端再展示 683 道就是数据造假，
// 所以 USE_CARD_META 关掉。读取代码保留，仅作追溯。
const USE_CARD_META = false;
//
// 取：菜名 / 菜系 / 当令节气（含括号里的时令由头）/ 主料 / 提示列 / 难度 / 成本档 / 文化出处 / 做法简述。
// 「食养特点」与「宜忌」两列整列不读：前者是功效表述，后者含 12 个脱敏词——
// 详情页要给的是「为什么这个时节吃它、怎么吃、谁该少吃」，不是「吃了有什么用」。
const TRI_SERIES = [
  { file: 'gf_96.md', cuisine: 'guangfu', cuisineName: '广府菜' },
  { file: 'cs_96.md', cuisine: 'chaoshan', cuisineName: '潮汕菜' },
  { file: 'kj_96.md', cuisine: 'hakka', cuisineName: '客家菜' },
];

// "立春（冬春应节）" → "立春"；"清明—夏至（春夏童子鸡最嫩）" → 取第一个节气名
function pickTermName(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/[\u4e00-\u9fa5]{2}/);
  const hit = TRADITIONAL_ORDER.find((t) => s.indexOf(t) > -1);
  if (hit) return hit;
  return m ? m[0] : '';
}

// "★★☆" → 2；"低/中/高" → 1/2/3
function pickDifficulty(raw) {
  const s = String(raw || '');
  const filled = (s.match(/★/g) || []).length;
  return filled ? Math.min(Math.max(filled, 1), 3) : 1;
}
function pickCost(raw) {
  const s = String(raw || '').trim();
  if (/高/.test(s)) return 3;
  if (/中/.test(s)) return 2;
  return 1;
}

// 从「文化出处」前缀判断证据等级：文献可考 / 民间流传
function pickEvidence(raw) {
  const s = String(raw || '');
  if (/文献可考/.test(s)) return 'A';
  if (/民间流传/.test(s)) return 'B';
  return 'B';
}

// 做法分类：从做法简述里认第一个烹饪动词，供餐次推断与口味匹配用
const METHOD_WORDS = ['蒸', '白灼', '煮', '煲', '炖', '焖', '炒', '煎', '炸', '烤', '卤', '红烧', '凉拌', '拌', '焗', '腌', '泡'];
function pickMethod(raw) {
  const s = String(raw || '');
  for (let i = 0; i < METHOD_WORDS.length; i += 1) {
    if (s.indexOf(METHOD_WORDS[i]) > -1) return METHOD_WORDS[i];
  }
  return '其他';
}

function loadTriSeries(existingNames) {
  const out = [];
  TRI_SERIES.forEach((cfg) => {
    const p = path.join(KB_DIR, cfg.file);
    if (!fs.existsSync(p)) {
      console.warn('[build-data] 缺少 ' + cfg.file + '，跳过');
      return;
    }
    fs.readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .forEach((line) => {
        if (!/^\|\s*\d+\s*\|/.test(line)) return;
        const cols = line.split('|').map((c) => c.trim());
        // cols[0] 是空（行首 |），所以数据从 index 1 开始
        const name = cols[2] || '';
        if (!name || name === '菜名') return;
        // 与 card_meta 已有菜名重复的跳过，避免同一道菜出现两次
        if (existingNames.has(name)) return;

        const termRaw = cols[4] || '';
        const term = pickTermName(termRaw);
        // 「立冬（增城菜心当造）」→ 括号里那句是「为什么这个时令吃它」，详情页用得着
        const termNoteRaw = (String(termRaw).match(/[（(]([^）)]+)[）)]/) || [])[1] || '';
        const how = cols[12] || cols[11] || '';
        const method = pickMethod(how);
        const rawSource = cols[11] || '';
        const id = 'TS' + String(out.length + 1).padStart(4, '0');

        out.push({
          id,
          name: guard(name, 'name', id),
          cuisine: cfg.cuisine,
          cuisineName: cfg.cuisineName,
          terms: term ? [term] : [],
          termNote: guard(termNoteRaw, 'termNote', id),
          mainIngredients: splitList(cols[5] || '', /[、,，]/),
          method,
          mealHints: mealHints(method),
          how: guard(how, 'how', id),
          // 三系的提示列是客观风险描述（过敏原/高盐/高嘌呤），过一遍词表后保留
          caution: guard(cols[8] || '', 'caution', id),
          // 统一成 'easy'/'mid'/'hard'：前端 format.difficultyLabel 只认这套 key，
          // 直接给数字会导致难度在界面上显示为空（数据里有值、界面没字）。
          difficulty: DIFFICULTY_MAP[pickDifficulty(cols[9])] || '',
          // 真实耗时：从 how 解析，解析不出按做法估。这是「用户要半小时」时唯一可靠依据，
          // difficulty 表达的是做法复杂度，不能替代（「冷泡茶」做法极简但要冷藏 6 小时）
          ...resolveTime(how, method, name),
          costLevel: pickCost(cols[10]),
          source: guardSource(rawSource, id),
          origin: 'tri-series',
          evidence: pickEvidence(rawSource),
          allergen: /过敏/.test(cols[8] || '') ? guard(cols[8], 'allergen', id) : '无',
          ageSuitable: ['成人', '长者'],
          ageCaution: '',
          verified: '',
        });
      });
  });
  return out;
}

function main() {
  if (USE_CARD_META && !fs.existsSync(SRC_CSV)) {
    console.error('[build-data] 缺少 ' + SRC_CSV);
    process.exit(1);
  }

  // dish_id 在源 CSV 里有重复：同一道菜会在多个节气文件里各占一行。
  // 小程序 wx:key 要求唯一，所以按 id 合并，terms 取并集（一道菜可属多个节气）。
  // USE_CARD_META 关闭时整块跳过：三系交付包是唯一真源。
  const rawRecipes = USE_CARD_META
    ? toRows(fs.readFileSync(SRC_CSV, 'utf8')).map(toRecipe).filter((r) => r.id && r.name)
    : [];
  const recipeMap = new Map();
  const recipes = [];
  let mergedRows = 0;
  rawRecipes.forEach((r) => {
    const prev = recipeMap.get(r.id);
    if (!prev) {
      recipeMap.set(r.id, r);
      recipes.push(r);
      return;
    }
    mergedRows += 1;
    r.terms.forEach((t) => {
      if (prev.terms.indexOf(t) < 0) prev.terms.push(t);
    });
  });

  // 三系 288 道：当前唯一菜品真源（广府 96 / 潮汕 96 / 客家 96）
  const existingNames = new Set(recipes.map((r) => r.name));
  const triSeries = loadTriSeries(existingNames);
  triSeries.forEach((r) => {
    recipes.push(r);
    recipeMap.set(r.id, r);
  });

  // 节气：按起始日期排序，order 为自然年顺序；原 seasonal_focus 属功效表述不进前端，
  // 改用 term_cards.md 的「节气简介」作为文化词（intros）
  const intros = loadTermIntros();
  const cuisineCards = loadCuisineCards();
  const ingredientDetails = loadIngredientDetails();
  const terms = toRows(fs.readFileSync(SRC_TERMS, 'utf8'))
    .map((row) => ({
      name: row.term,
      order: 0,
      dateWindow: [String(row.start_date).slice(5), String(row.end_date).slice(5)],
      season: row.season || '',
      // 传统节气序，1 = 立春；不在名单内的给 0，前端排在末尾
      termOrder: TRADITIONAL_ORDER.indexOf(row.term) + 1,
      headline: '',
      intro: '',
      ingredients: splitList(row.seasonal_ingredients, /[、,，]/),
      dishes: [],
      _start: row.start_date,
    }))
    .filter((t) => t.name && t.dateWindow[0] && t.dateWindow[1])
    .sort((a, b) => (a._start < b._start ? -1 : 1))
    .map((t, index) => {
      delete t._start;
      t.order = index + 1;
      return t;
    });


  // 节气文化词：把 term_cards.md 的「节气简介」挂到对应节气上（构建期一次补齐，避免逐条手改）
  const culture = loadTermCulture();
  terms.forEach((t) => {
    t.intro = intros[t.name] || '';
    t.ingredientDetails = ingredientDetails[t.name] || [];
    const c = culture[t.name] || {};
    t.slogan = c.slogan || '';
    t.aura = c.aura || '';
    t.poem = c.poem || null;
    t.phenology = c.phenology || [];
    t.folk = c.folk || [];
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sizeRecipes = writeModule(
    path.join(OUT_DIR, 'recipes.js'),
    '// data/recipes.js —— 由 scripts/build-data.js 从 knowledge/card_meta.csv 生成，请勿手改\n' +
      '// 重新生成：node scripts/build-data.js\n' +
      '// 说明：小程序 require 只解析 .js，因此数据以 module.exports 形式提供。\n' +
    '// 功效字段（effect）未输出：V3.0 要求零功效表述，前端只展示客观信息。\n',
    recipes
  );

  const sizeTerms = writeModule(
    path.join(OUT_DIR, 'terms.js'),
    '// data/terms.js —— 由 scripts/build-data.js 从 knowledge/solar_term_map.csv 生成，请勿手改\n' +
      '// 重新生成：node scripts/build-data.js\n' +
      '// dateWindow 为 MM-DD；节气推算见 utils/dataSource.js 的 getCurrentTerm / getNextTerm。\n',
    terms
  );

  // 风味卡：按 cuisine 四值的固定顺序输出，供菜单页展示风味技法与搭配提示
  const cuisineList = ['lingnan_home', 'guangfu', 'chaoshan', 'hakka']
    .map((k) => Object.keys(cuisineCards).find((name) => cuisineCards[name].key === k))
    .filter(Boolean)
    .map((name) => cuisineCards[name]);
  const sizeCuisines = writeModule(
    path.join(OUT_DIR, 'cuisines.js'),
    '// data/cuisines.js —— 由 scripts/build-data.js 从 knowledge/cuisine_cards.md 生成，请勿手改\n' +
      '// 重新生成：node scripts/build-data.js\n',
    cuisineList
  );

  const meta = {
    version: 'kb-' + new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString().slice(0, 10),
  };
  writeModule(
    path.join(OUT_DIR, 'meta.js'),
    '// data/meta.js —— 由 scripts/build-data.js 生成，请勿手改\n',
    meta
  );

  // —— 报告 ——
  const byCuisine = {};
  recipes.forEach((r) => {
    byCuisine[r.cuisine] = (byCuisine[r.cuisine] || 0) + 1;
  });

  console.log('[build-data] 菜品 ' + recipes.length + ' 条（card_meta 合并重复行 ' + mergedRows + ' 条，三系并入 ' + triSeries.length + ' 条），节气 ' + terms.length + ' 个');
  console.log('[build-data] cuisine 分布：' + JSON.stringify(byCuisine));
  console.log('[build-data] recipes.js ' + (sizeRecipes / 1024).toFixed(1) + ' KB，terms.js ' + (sizeTerms / 1024).toFixed(1) + ' KB，cuisines.js ' + (sizeCuisines / 1024).toFixed(1) + ' KB（' + cuisineList.length + ' 张风味卡）');
  if (bannedHits.length > 0) {
    console.log('[build-data] ⚠ 已拦截 ' + bannedHits.length + ' 处命中脱敏词的字段值（已置空）：');
    bannedHits.slice(0, 10).forEach((h) => {
      console.log('    ' + h.dishId + ' / ' + h.field + ' 含「' + h.word + '」：' + h.value);
    });
  } else {
    console.log('[build-data] 脱敏词：0 命中');
  }
}

main();
