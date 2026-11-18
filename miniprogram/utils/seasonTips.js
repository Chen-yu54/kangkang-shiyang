// 当令小贴士 —— 食养页底部常驻的小方法。
//
// 为什么要有这个：
//   模型返回里带的 tips 只有「工作流调通」时才存在，本地推演路径下底部是空的。
//   但「这个节气该怎么挑、怎么存、怎么下锅」这类内容本来就能从知识库推出来，
//   不该依赖网络。
//
// 口径纪律（和全站一致）：
//   只写「挑 / 存 / 火候 / 时令搭配」，不写任何功效性表述。
//   写不出具体内容的季节就不硬凑，宁少不多。

const SEASON_LINE = {
  春: '口味由厚转清，芽苗与叶菜正当时',
  夏: '汤水、瓜类与豆类为主，清淡易入口',
  秋: '由清淡转厚润，根茎与果实类上桌',
  冬: '热食、炖煮与腌腊，讲究一锅热气',
};

// 按季节给挑选与储存的通用规则。所有条目都是「怎么看 / 怎么放」，可现场验证。
const PICK_STORE = {
  春: [
    { title: '挑芽苗', text: '叶片挺括、切口不发黑的嫩；发黄出水的不挑' },
    { title: '存叶菜', text: '厨房纸包住再装袋，冷藏两三天内吃完' },
  ],
  夏: [
    { title: '挑瓜类', text: '表皮硬实、掂着压手；瓜蒂新鲜不干缩' },
    { title: '存豆类', text: '焯水后过凉沥干再冷冻，比直接冷藏耐放' },
  ],
  秋: [
    { title: '挑根茎', text: '表皮完整无软斑，手感沉实不空心' },
    { title: '存果实', text: '阴凉通风摊开，别堆叠，避免相互催熟' },
  ],
  冬: [
    { title: '挑腊味', text: '干爽不粘手、肥膘透亮；有哈喇味的不买' },
    { title: '存干货', text: '密封避光，梅雨天取出复晒一次' },
  ],
};

// 火候提示：与季节主线配套，都是能照做的操作。
const HEAT = {
  春: '快炒保脆，绿叶菜下锅到起锅不超过两分钟',
  夏: '汤水先大火滚开再转小火，出锅前才调味',
  秋: '炖煮水量一次加足，中途加水会让肉质发柴',
  冬: '炖菜先大火沸再转小火慢煨，腊味蒸前用温水略洗去浮尘',
};

function seasonOf(term) {
  const s = term && term.season ? String(term.season) : '';
  return SEASON_LINE[s] ? s : '';
}

/**
 * 生成当令小贴士。
 * @param {object} term 节气对象（含 season / ingredients / folk）
 * @returns {{title:string, text:string}[]} 最多 4 条；取不到就返回空数组，不编内容
 */
function build(term) {
  const tips = [];
  const season = seasonOf(term);

  // ① 时令主线 + 当令食材（食材来自知识库，不现编）
  const ing = (term && term.ingredients) || [];
  if (season) {
    const names = ing.slice(0, 4).join('、');
    tips.push({
      title: '这个节气',
      text: SEASON_LINE[season] + (names ? '；当下当令的有 ' + names : ''),
    });
  } else if (ing.length) {
    tips.push({ title: '当下当令', text: ing.slice(0, 5).join('、') });
  }

  // ② 食俗里的小方法：知识库 folk 条目本身带 desc，直接引用，不二次加工
  const folk = (term && term.folk) || [];
  if (folk.length && folk[0].title && folk[0].desc) {
    tips.push({
      title: folk[0].title,
      text: folk[0].desc,
    });
  }

  // ③ 挑与存
  (PICK_STORE[season] || []).forEach((item) => tips.push(item));

  // ④ 火候
  if (HEAT[season]) {
    tips.push({ title: '火候', text: HEAT[season] });
  }

  return tips.slice(0, 4);
}

module.exports = { build, SEASON_LINE, seasonOf };
