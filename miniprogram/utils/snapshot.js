// utils/snapshot.js —— 数据快照统计（方法说明页用；首页仪表盘另走 utils/kbStats.js）
//
// 为什么要在产品里算一遍而不是写死：
//   1. 赛道二明确要求「无夸大结论」。写死的数字一旦与知识库不同步，
//      评委打开小程序就能对上反证；实时计算则永远和当前数据一致。
//   2. A 侧扩容（乙 264 道）落地后，这里不需要改一行代码，数字自动更新。
//
// 口径说明：
//   - 节气覆盖只统计 24 个具体节气，不含「全年通用」这类桶
//   - 覆盖达标线取 L0 过审线「每节气 ≥4 道」
//   - 风味占比只算潮汕 + 客家，这是本项目治理主张的核心证据，单独算、如实显示

const dataSource = require('./dataSource');

const GENERAL_TERM = '全年通用';
const COVER_MIN = 4;

function build() {
  const all = dataSource.getRecipes({}) || [];
  const total = all.length;

  const termCount = {};
  all.forEach((dish) => {
    (dish.terms || []).forEach((name) => {
      if (!name) return;
      termCount[name] = (termCount[name] || 0) + 1;
    });
  });

  const termKeys = Object.keys(termCount).filter((name) => name !== GENERAL_TERM);
  const covered = termKeys.filter((name) => termCount[name] >= COVER_MIN).length;

  const minority = all.filter(
    (dish) => dish.cuisine === 'chaoshan' || dish.cuisine === 'hakka'
  ).length;

  const withImage = all.filter((dish) => !!dish.image).length;

  // 版本标签形如「kb-2026-11-06 · 2026-11-06」，日期与版本号重复，显示时去掉后半段
  let version = dataSource.getDataVersionLabel ? dataSource.getDataVersionLabel() : '';
  const parts = String(version).split(' · ');
  if (parts.length === 2 && parts[0].indexOf(parts[1]) > -1) version = parts[0];

  return {
    total,
    withImage,
    termTotal: termKeys.length,
    termCovered: covered,
    general: termCount[GENERAL_TERM] || 0,
    minority,
    // 保留一位小数：1.9% 这种数字如果四舍五入成 2% 就成了夸大
    minorityPct: total ? Math.round((minority / total) * 1000) / 10 : 0,
    version,
  };
}

// 必填字段完整率：一条菜品 12 个核心字段是否都有值（M3 结构合规的可复算近似）
const CORE_FIELDS = [
  'name',
  'cuisine',
  'mainIngredients',
  'method',
  'how',
  'caution',
  'difficulty',
  'costLevel',
  'source',
  'origin',
  'evidence',
  'allergen',
];

function fieldStats() {
  const all = dataSource.getRecipes({}) || [];
  if (!all.length) return { total: 0, complete: 0, completePct: 0, allergenPct: 0 };

  const isFilled = (value) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  };

  let complete = 0;
  let allergen = 0;
  all.forEach((dish) => {
    if (CORE_FIELDS.every((key) => isFilled(dish[key]))) complete += 1;
    if (isFilled(dish.allergen)) allergen += 1;
  });

  return {
    total: all.length,
    complete,
    completePct: Math.round((complete / all.length) * 1000) / 10,
    allergen,
    allergenPct: Math.round((allergen / all.length) * 1000) / 10,
  };
}

module.exports = {
  build,
  fieldStats,
  CORE_FIELDS,
};
