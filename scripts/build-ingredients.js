// 把《岭南食材主料知识库 v0.2》解析成小程序可用数据。
//
// 输入：knowledge/ingredients_kb_v0.2.md（291 条索引 + 222 张标准卡）
// 输出：
//   miniprogram/data/ingredientsIndex.js   —— 291 条轻量索引（名称/类型/批次）
//   miniprogram/data/ingredients.js        —— 222 张标准卡（溯源主数据）
//
// 两个输出分开的理由：菜谱详情页只需要「这道菜的主料在不在库里」，
// 几百条完整卡全塞进去会让首屏变慢。索引先加载，点开某样主料再取卡。
//
// ⚠️ 合规处理：标准卡的「食用注意」里含大量疾病名（痛风/糖尿病/甲亢…）。
//    这些不在 12 个脱敏词表里，但直接展示属于医疗暗示。这里在**数据层**就过滤掉，
//    只保留可执行建议（少喝浓汤 / 甲功异常少吃 → 后者也去掉），不留给前端补救。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'knowledge', 'ingredients_kb_v0.2.md');
// ── 合规过滤开关 ──────────────────────────────────────────────
// false（当前）：知识库**原样**输出。疾病名与「祛湿/降火」这类词保留。
//   团队决定：先用原资料的表述，不做改写。
// true：开启过滤。命中疾病名或功效词的整句丢弃，只留选购/处理/火候。
//   ⚠️ 提审前如果被问到「功效承诺」（微信审核 A3 条），把这个改成 true
//      重新跑一次 node scripts/build-ingredients.js 即可，页面代码不用动。
const STRICT_COMPLIANCE = false;

// 输出到**分包**：食材库 200+ KB，放主包会挤爆（主包上限 2048 KB，当时余量只剩 305）。
// 主包不 require 任何食材数据，只在 dish 页给一个跳转入口。
const DATA_DIR = path.join(ROOT, 'miniprogram', 'packageIngredient', 'data');
const RECIPES = path.join(ROOT, 'miniprogram', 'data', 'recipes.js');

// ── 别名映射：菜谱里写的主料名 → 知识库标准名 ──
// 只做**确凿同义**映射（姜=生姜、瘦肉=猪肉），不猜、不把不同食材合并。
const ALIAS = {
  // 姜属
  姜: '生姜', 姜丝: '生姜', 姜片: '生姜', 姜末: '生姜', 姜汁: '生姜', 沙姜: '沙姜',
  // 葱蒜类（无标准卡，但归到同名，避免落到「未命中」里）
  蒜: '蒜苗', 蒜蓉: '蒜苗', 蒜头: '蒜苗', 大蒜: '蒜苗',
  // 猪属
  瘦肉: '猪肉', 猪肉馅: '猪肉', 猪肉末: '猪肉', 瘦肉末: '猪肉', 五花肉: '猪肉',
  火腩: '猪肉', 烧肉: '猪肉', 叉烧: '猪肉', 猪腩: '猪肉', 里脊: '猪肉',
  // 鸡属
  走地鸡: '鸡肉', 整鸡: '鸡肉', 鸡腿: '鸡肉', 鸡翅: '鸡肉', 鸡块: '鸡肉', 三黄鸡: '鸡肉',
  // 牛属
  牛腩: '牛肉', 牛腱: '牛肉', 肥牛: '牛肉', 牛肉末: '牛肉', 牛丸: '牛肉',
  // 羊属
  羊肉片: '羊肉', 羊腩: '羊肉',
  // 鸭属
  鸭: '鸭肉', 老鸭: '鸭肉', 鸭腿: '鸭肉',
  // 水产
  鲜虾: '虾', 虾仁: '虾', 河虾: '虾', 虾皮: '虾皮', 虾米: '虾皮', 虾滑: '虾',
  鲩鱼: '鱼', 鲈鱼: '鲈鱼', 黄鱼: '鱼', 鳙鱼: '鱼', 鱼片: '鱼', 鲜鱼: '鱼',
  // 蛋
  蛋: '鸡蛋', 蛋清: '鸡蛋', 蛋黄: '鸡蛋', 鹌鹑蛋: '鹌鹑蛋',
  // 豆制品
  豆干: '豆干', 豆腐皮: '豆腐皮', 腐竹: '腐竹', 油豆腐: '豆腐', 豆泡: '豆腐',
  // 米面
  米: '大米', 米饭: '大米', 粘米粉: '大米', 米粉: '面', 面条: '面', 挂面: '面',
  糯米粉: '糯米粉', 面粉: '面粉', 荞麦面: '荞麦面',
  // 蔬菜同物异名
  青瓜: '黄瓜', 黄瓜丝: '黄瓜', 胜瓜: '丝瓜', 瓠瓜: '瓠子瓜', 蒲瓜: '瓠子瓜',
  通心菜: '空心菜', 红薯叶: '番薯叶', 番薯: '红薯', 地瓜: '红薯',
  荸荠: '马蹄', 慈姑: '马蹄',
  鲜笋: '春笋', 竹笋: '竹笋', 冬笋: '春笋',
  芥兰: '芥蓝', 菜芯: '菜心', 小白菜: '青菜', 上海青: '油菜',
  番茄: '番茄', 西红柿: '番茄',
  土豆: '土豆', 马铃薯: '土豆', 薯仔: '土豆',
  包菜: '包菜', 卷心菜: '包菜',
  // 干货/菌菇
  冬菇: '香菇', 鲜香菇: '香菇', 干香菇: '香菇', 花菇: '香菇', 蘑菇: '蘑菇',
  白木耳: '银耳', 木耳: '银耳',
  // 其他
  桂圆肉: '桂圆', 龙眼: '龙眼', 枣: '红枣', 蜜枣: '红枣', 大枣: '红枣',
  板栗: '栗子', 栗: '栗子',
  白果: '白果', 银杏: '白果',
  淮山: '山药', 铁棍山药: '山药',
  薏仁: '薏米', 薏苡仁: '薏米',
  红豆: '赤小豆',
  // 部位/加工变体（确凿同物）
  猪前腿肉: '猪肉', 猪梅肉: '猪肉', 猪颈肉: '猪肉', 猪肉滑: '猪肉',
  腊肠: '腊肉', 腊鸭: '腊肉', 腊味: '腊肉',
  鸡胸肉: '鸡肉', 鸡腿肉: '鸡肉', 鸡骨架: '鸡肉',
  牛骨: '牛肉', 牛筋: '牛肉', 牛百叶: '牛肉',
  虾干: '虾皮', 虾子: '虾皮',
  鲮鱼: '鱼', 鲩鱼肉: '鱼', 鱼头: '鱼', 鱼骨: '鱼',
  鸡蛋液: '鸡蛋', 蛋液: '鸡蛋',
  马铃薯粉: '土豆',
  肉末: '猪肉', 肉碎: '猪肉', 肉丝: '猪肉', 肉片: '猪肉',
  鲜荷叶: '荷叶', 干荷叶: '荷叶',
  丝苗米: '大米', 香米: '大米', 珍珠米: '大米',
  白米: '大米', 糙米: '大米',
  生菜叶: '生菜', 苦瓜片: '苦瓜', 冬瓜件: '冬瓜',
};

// ── 不做溯源的辅料：调味、增香、液体。这些没有「食品安全档案」的意义，
//    进「未命中」统计会掩盖真正缺档的主料，所以单列。
const SKIP = [
  '盐', '生抽', '老抽', '酱油', '豉油', '蚝油', '糖', '冰糖', '白糖', '红糖', '片糖',
  '米酒', '料酒', '花雕酒', '白酒', '红酒', '酒酿',
  '油', '花生油', '菜籽油', '香油', '芝麻油', '猪油', '黄油', '橄榄油',
  '水', '清水', '温水', '开水', '热水', '高汤', '上汤', '汤底',
  '淀粉', '生粉', '粟粉', '面粉用',
  '醋', '陈醋', '米醋', '白醋', '香醋',
  '胡椒', '白胡椒', '黑胡椒', '胡椒粉', '花椒', '花椒盐', '椒盐',
  '辣椒', '干辣椒', '剁椒', '辣椒酱', '蒜蓉辣酱', '豆瓣酱', '甜面酱', '酱料',
  '孜然', '小茴香', '茴香', '八角', '桂皮', '香叶', '丁香', '肉桂',
  '咖喱', '卤料', '五香粉', '十三香',
  '鸡精', '味精', '鸡粉', '味极鲜',
  '葱', '葱花', '葱白', '大葱', '小葱', '香菜', '芫荽',
  '鱼露', '虾酱', '豆豉', '腐乳',
  '陈皮丝', '柠檬叶', '香茅',
  '糖醋汁', '照烧汁', '汤汁',
  '芹菜粒', '蒜末', '姜葱', '各种蔬菜', '素菜', '当季绿叶菜', '配菜',
  '粗盐', '海盐', '岩盐', '南乳', '沙茶酱', '牛骨汤', '猪骨汤', '鸡汤', '鱼汤',
  '腐乳酱', '柱侯酱', '海鲜酱', 'XO酱', '辣椒豉油', '蒸鱼豉油',
  '生粉水', '淀粉水', '蛋清液',
  '头抽', '双璜生抽', '喼汁', '浙醋', '甜醋', '添丁甜醋', '沙姜粉',
];

// 12 个脱敏词：项目红线，**任何情况下**都过滤（不随 STRICT_COMPLIANCE 开关变）。
// 知识库原样含「气虚」「降压」这类词，直接进包会触发全端扫描。
const BAN_12 = ['体质', '调理', '气虚', '阳虚', '湿气', '降糖', '降压',
  '疗效', '治疗', '康复', '慢病', '忌口'];

// 疾病名 / 诊疗指向词：命中即整段丢弃，不做部分保留。
// 与 miniprogram/utils/format.js 的 SENSITIVE_WORDS 同源，另外补了几个本库高频词。
const MEDICAL_WORDS = [
  '高血压', '高血脂', '高血糖', '糖尿病', '糖尿病人', '糖友', '肾病', '肾友',
  '痛风', '高尿酸', '高胆固醇', '脂肪肝', '痔疮', '甲亢', '甲减', '甲状腺',
  '冠心病', '中风', '癌', '炎', '病人', '患者', '术后', '孕妇忌', '遵医嘱',
];

// 功效表述词：知识库里「祛湿」「利水」「健脾」「清热」这类词密度很高，
// 原样上界面就是功效承诺（合规红线：只写口感、食材、时令逻辑）。
// 例外：句子明确写了「传统认为 / 民间说法」，那是民俗记载，可以保留。
const EFFECT_WORDS = [
  '祛湿', '除湿', '利水', '利湿', '清热', '降火', '去火', '润燥', '养血', '补气',
  '健脾', '安神', '滋阴', '壮阳', '解毒', '化痰', '止咳', '明目', '通便', '消肿',
  '活血', '补血', '补肾', '益气', '温中', '散寒', '开胃', '祛风', '降脂', '降糖',
  '降压', '消炎', '杀菌', '养颜', '抗衰', '提高免疫', '增强免疫',
];

// 出现这些字样，说明是在描述民俗而不是做承诺
const FOLK_MARKERS = ['传统认为', '传统上', '民间认为', '民间相传', '俗称', '老一辈'];

// 保留这些「动作性」词：它们本身是建议，不是病症
const KEEP_ACTIONS = ['少喝', '少吃', '少食', '适量', '控量', '注意', '避免', '不宜', '慎'];

function hasMedical(s) {
  return MEDICAL_WORDS.some((w) => s.indexOf(w) > -1);
}

// 是不是功效表述。
// 说明：原本想给「传统认为 XX」开豁免（那是民俗记载不是承诺），
// 但目标用户是长者，不会去分辨「传统认为」和「有效」的区别。
// 界面上只要出现这类词就有被理解为功效承诺的风险，所以一律过滤。
function hasEffect(s) {
  const t = String(s || '');
  return EFFECT_WORDS.some((w) => t.indexOf(w) > -1);
}

// 一段话要不要丢：疾病名 / 功效表述 任一命中即丢
function shouldDrop(s) {
  // ① 12 脱敏词是项目红线，不看开关，命中即丢
  if (BAN_12.some((w) => s.indexOf(w) > -1)) return true;
  // ② 开关关闭时其余原样保留（疾病名 / 功效词都不动）
  if (!STRICT_COMPLIANCE) return false;
  return hasMedical(s) || hasEffect(s);
}

/**
 * 通用文本过滤：按分句切开，命中疾病名的分句整段丢弃，其余保留。
 * 用于 caution 之外的字段（营养特点 / 产地 / 选购 / 质量指标都会夹带疾病名）。
 */
function scrubText(text, maxLen) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const parts = raw.split(/[；;。，,]/).map((x) => x.trim()).filter(Boolean);
  const kept = [];
  parts.forEach((p) => {
    if (shouldDrop(p)) return;
    if (p.length < 2) return;
    kept.push(p);
  });
  const joined = kept.join('，');
  return cut(polish(joined), maxLen || 200);
}

/**
 * 过滤食用注意：按分号/句号切段，含疾病名的段整段丢弃；
 * 纯动作建议（少喝浓汤、切小炖软）保留。
 */
function filterCaution(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const parts = raw.split(/[；;。]/).map((x) => x.trim()).filter(Boolean);
  const kept = [];
  parts.forEach((p) => {
    if (shouldDrop(p)) return; // 含病症描述或功效表述，整段不要
    if (p.length < 4) return;
    kept.push(p);
  });
  // 去重后拼接；超过 3 条只留前 3 条，避免卡片过长
  const uniq = [];
  kept.forEach((p) => { if (uniq.indexOf(p) < 0) uniq.push(p); });
  return polish(uniq.slice(0, 3).join('；'));
}

// 产地/菜系/状态前缀：不改变食材本身，运行时剥掉再查
const PREFIXES = ['客家', '潮汕', '广府', '岭南', '增城', '台山', '新会', '顺德',
  '新鲜', '鲜', '干', '土', '本地', '走地', '自家', '手打', '现磨'];

// ── 解析索引表 ────────────────────────────────────────────────
function parseIndex(lines) {
  const rows = [];
  lines.forEach((line) => {
    // | 1 | 猪肉 | 54 | 动物性 | A |
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([A-C])\s*\|/);
    if (!m) return;
    rows.push({
      no: Number(m[1]),
      name: m[2].trim(),
      dishes: Number(m[3]),
      type: m[4].trim(),
      batch: m[5],
    });
  });
  return rows;
}

// ── 解析标准卡 ────────────────────────────────────────────────
// 每张卡形如：
//   ### ING-A01 猪肉
//   **一句话**：……
//   | 项目 | 内容 |
//   |---|---|
//   | 食材身份 | …… |
function parseCards(lines) {
  const cards = [];
  let cur = null;
  let inTable = false;

  const flush = () => {
    if (cur && cur.name) cards.push(cur);
    cur = null;
    inTable = false;
  };

  lines.forEach((line) => {
    const head = line.match(/^###\s+(ING-[A-C]\d+)\s+(.+?)\s*$/);
    if (head) {
      flush();
      cur = { id: head[1], name: head[2].trim(), fields: {} };
      return;
    }
    if (!cur) return;

    // 一句话
    const one = line.match(/^\*\*一句话\*\*[：:]\s*(.+?)\s*$/);
    if (one) {
      cur.oneLine = one[1].trim();
      return;
    }

    // 表格分隔行跳过
    if (/^\|\s*-+/.test(line)) { inTable = true; return; }
    if (/^\|\s*项目\s*\|/.test(line)) { inTable = true; return; }

    if (inTable) {
      const row = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*$/);
      if (row) {
        const key = row[1].trim();
        const val = row[2].trim();
        if (key && key !== '项目' && val) cur.fields[key] = val;
      } else if (line.trim() === '' || !line.startsWith('|')) {
        inTable = false;
      }
    }
  });
  flush();
  return cards;
}

// 截断到指定长度，避免单卡过长撑爆包体；截断处补省略号，不假装完整

// ── 语言清洗 ──────────────────────────────────────────────────
// 知识库原文偏书面（「可食部为肌肉与脂肪，骨不计」「理化：…」），
// 直接搬上界面像在看检测报告。这里做**保守**改写：
//   · 只换说法、不删信息；
//   · 不动专有名词与标准号；
//   · 拿不准的一律保持原样。

const REPLACE_RULES = [
  [/可食部为/g, '能吃的是'],
  [/可食部/g, '可吃部分'],
  [/，骨不计/g, ''],
  [/骨不计/g, ''],
  [/（别名([^）]+)）/g, '，又叫$1'],
  [/\(别名([^)]+)\)/g, '，又叫$1'],
  [/理化：/g, '理化指标：'],
  [/感官：/g, '看外观：'],
  [/安全：/g, '安全指标：'],
  [/微生物：/g, '微生物指标：'],
  [/采样：/g, '取样：'],
  [/判定：/g, '按此判定：'],
  [/方法：/g, '检测方法：'],
  [/全年供应/g, '四季都有'],
  [/主产/g, '主要产自'],
  [/为地理标志/g, '是国家地理标志产品'],
  // ⚠️ 这里**不能**用单字全局替换。把「宜」换成「适合」，
  //    「最便宜的优质蛋白」会变成「最便适合的优质蛋白」——比原文更难读。
  //    只做多字、语义明确的替换。
  [/亦可/g, '也可以'],
  [/切勿/g, '不要'],
  [/勿食/g, '不要吃'],
  [/忌食/g, '不宜吃'],
  [/忌用/g, '不宜用'],
  [/适宜/g, '适合'],
  [/宜多食/g, '可以多吃'],
  [/宜少食/g, '可以少吃'],
];

function polish(s) {
  let t = String(s || '');
  if (!t) return '';
  // 先把制表符/多空格压平
  t = t.replace(/\s+/g, ' ').trim();
  REPLACE_RULES.forEach(([re, to]) => { t = t.replace(re, to); });
  // 连续标点收敛
  t = t.replace(/，{2,}/g, '，').replace(/。{2,}/g, '。').replace(/；{2,}/g, '；');
  t = t.replace(/^[，、；。\s]+/, '').replace(/[，、；\s]+$/, '');
  return t;
}

function cut(s, n) {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.length <= n ? t : t.slice(0, n) + '…';
}

function build() {
  if (!fs.existsSync(SRC)) {
    console.error('[build-ingredients] 找不到 ' + SRC);
    process.exit(1);
  }
  const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
  const index = parseIndex(lines);
  const cards = parseCards(lines);

  // ── 标准卡 → 前端结构 ──
  const out = cards.map((c) => {
    const f = c.fields;
    return {
      id: c.id,
      name: c.name,
      oneLine: scrubText(c.oneLine, 60),
      // 身份：只留「别名 + 类别」，部位列表太长
      identity: scrubText(f['食材身份'], 90),
      // 产地与生态：保留地域与季节点，生态指标是「可追溯」的关键
      origin: scrubText(f['产地与生态'], 180),
      // 质量指标：感官 + 安全，这是「食品安全」的正面回答
      quality: scrubText(f['质量指标'], 200),
      // 营养：只留一句概括
      nutrition: scrubText(f['营养特点'], 120),
      // 选购要点：含口诀，最实用
      select: scrubText(f['选购要点'], 160),
      // 处理与吃法
      cook: scrubText(f['处理与吃法'], 160),
      // 食用注意：专门过滤（口径更严）
      caution: filterCaution(f['食用注意']),
      // 价格与替代
      price: scrubText(f['价格与替代'], 100),
      // 检测与判定：保留方法与判定标准（GB 号），这是可核验的证据
      inspect: scrubText(f['检测与判定'], 200),
      // 依据：只留标准号清单，页脚展示
      basis: scrubText(f['依据'], 140),
    };
  });

  // ── 索引 → 轻量结构（供菜谱页快速判断有没有卡）──
  const cardByName = {};
  out.forEach((c) => { cardByName[c.name] = c.id; });

  const indexOut = index.map((r) => ({
    no: r.no,
    name: r.name,
    type: r.type,
    batch: r.batch,
    dishes: r.dishes,
    // 有没有标准卡：没有的话界面只说「暂无档案」，不编内容
    cardId: cardByName[r.name] || '',
  }));

  const banner = '// 由 scripts/build-ingredients.js 从 knowledge/ingredients_kb_v0.2.md 生成，请勿手改\n';

  fs.writeFileSync(
    path.join(DATA_DIR, 'ingredients.js'),
    banner + 'module.exports = ' + JSON.stringify(out) + ';\n',
    'utf8'
  );

  // ── 主料名 → 卡片 id 的查找表（含别名），随索引一起产出 ──
  // 菜谱页拿主料名直接查这张表，不需要在前端跑匹配逻辑。
  const lookup = {};
  out.forEach((c) => { lookup[c.name] = c.id; });
  Object.keys(ALIAS).forEach((from) => {
    const target = ALIAS[from];
    if (lookup[target] && !lookup[from]) lookup[from] = lookup[target];
  });

  // 产地/菜系/状态前缀**不在构建期展开**——那会让 lookup 从 33 KB 涨到 180 KB，
  // 主包吃不下。改成导出前缀列表，由 utils/ingredient.js 在运行时剥离。

  fs.writeFileSync(
    path.join(DATA_DIR, 'ingredientsIndex.js'),
    banner +
      '// lookup: 主料名（含别名）→ 标准卡 id；取不到就是没有档案\n' +
      'const INDEX = ' + JSON.stringify(indexOut) + ';\n' +
      'const LOOKUP = ' + JSON.stringify(lookup) + ';\n' +
      'const SKIP = ' + JSON.stringify(SKIP) + ';\n' +
      '// 产地/菜系/状态前缀，运行时剥掉再查（不在构建期展开，否则表会涨 5 倍）\n' +
      'const PREFIXES = ' + JSON.stringify(PREFIXES) + ';\n' +
      'module.exports = { INDEX: INDEX, LOOKUP: LOOKUP, SKIP: SKIP, PREFIXES: PREFIXES };\n',
    'utf8'
  );

  const sizeA = (fs.statSync(path.join(DATA_DIR, 'ingredients.js')).size / 1024).toFixed(1);
  const sizeB = (fs.statSync(path.join(DATA_DIR, 'ingredientsIndex.js')).size / 1024).toFixed(1);
  const withCard = indexOut.filter((r) => r.cardId).length;

  console.log('[build-ingredients] 索引 ' + indexOut.length + ' 条，标准卡 ' + out.length + ' 张');
  console.log('[build-ingredients] 索引中有卡的 ' + withCard + ' 条 / 无卡 ' + (indexOut.length - withCard) + ' 条');
  console.log('[build-ingredients] 别名 ' + Object.keys(ALIAS).length + ' 条，辅料跳过 ' + SKIP.length + ' 条');
  console.log('[build-ingredients] ingredients.js ' + sizeA + ' KB，ingredientsIndex.js ' + sizeB + ' KB');

  // ── 覆盖率：拿真实菜谱跑一遍，看主料能溯源多少 ──
  try {
    const recipes = require(RECIPES);
    const skipSet = {};
    SKIP.forEach((s) => { skipSet[s] = true; });
    let total = 0, skipped = 0, hit = 0;
    const miss = {};
    recipes.forEach((r) => {
      (r.mainIngredients || []).forEach((m) => {
        const name = String(m).trim();
        if (!name) return;
        if (skipSet[name]) { skipped++; return; }
        total++;
        if (lookup[name]) hit++;
        else miss[name] = (miss[name] || 0) + 1;
      });
    });
    const pct = total ? ((hit / total) * 100).toFixed(1) : '0.0';
    console.log(
      '[build-ingredients] 覆盖：需溯源主料 ' + total + ' 次，命中 ' + hit +
      '  (' + pct + '%)，辅料跳过 ' + skipped + ' 次，未命中 ' + Object.keys(miss).length + ' 种'
    );
    const top = Object.entries(miss).sort((a, b) => b[1] - a[1]).slice(0, 12);
    if (top.length) {
      console.log('[build-ingredients] 主要缺口：' + top.map(([k, v]) => k + '×' + v).join('  '));
    }
  } catch (e) {
    console.log('[build-ingredients] 覆盖率统计跳过：' + e.message);
  }

  // 抽查：确认疾病名没有漏出去
  const banned = ['痛风', '糖尿病', '甲亢', '高血压', '高血脂', '肾病', '患者', '病人'];
  const leaks = [];
  out.forEach((c) => {
    const all = [c.oneLine, c.identity, c.origin, c.quality, c.nutrition, c.select, c.cook, c.caution, c.price, c.inspect, c.basis].join(' ');
    banned.forEach((w) => { if (all.indexOf(w) > -1) leaks.push(c.name + ':' + w); });
  });
  if (leaks.length) {
    console.log('[build-ingredients] ⚠ 仍有医疗词 ' + leaks.length + ' 处：' + leaks.slice(0, 10).join(', '));
  } else {
    console.log('[build-ingredients] ✓ 医疗词 0 残留');
  }
}

build();
