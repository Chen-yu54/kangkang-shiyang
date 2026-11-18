// utils/kbStats.js —— 首页「跟着节气吃」仪表盘的计算口径
//
// 口径变了：不再堆「我们有多少道菜 / 多少 A 级依据」，改说「你能得到什么」。
// 所有数字仍从 data/ 现算，知识库变了仪表盘自己跟着变，不写死、不估计。
//
// 主球：外圈 24 段＝24 个节气，水位＝当前节气走到一年里的哪一段。
// 三个小球：不空档 / 不费事 / 顾得上，都是用户能直接感知的好处。

const recipes = require('../data/recipes.js');
const termsRaw = require('../data/terms.js');

function pct(part, all) {
  if (!all) return 0;
  return Math.round((part / all) * 1000) / 10;
}

function build(current) {
  const list = Array.isArray(recipes) ? recipes : [];
  const termTotal = termsRaw.length; // 24
  const termOrder = Number(current && current.order) || 0;
  const termName = (current && current.name) || '';

  // 有当令菜的节气数、出现过的餐次、家常难度占比、适老与少吃提示标注覆盖
  const covered = new Set();
  const meals = new Set();
  let home = 0;
  let care = 0;
  let ingredientCount = 0;

  list.forEach((d) => {
    (d.terms || []).forEach((t) => covered.add(t));
    (d.mealHints || []).forEach((m) => meals.add(m));
    if (d.difficulty !== 'hard') home += 1;
    const hasCaution = !!(d.caution && String(d.caution).trim());
    const hasAge = !!(d.ageSuitable && d.ageSuitable.length);
    if (hasCaution && hasAge) care += 1;
    ingredientCount += (d.mainIngredients || []).length;
  });

  const avgIngredients = list.length ? Math.round((ingredientCount / list.length) * 10) / 10 : 0;

  // 24 段刻度：用圆心坐标算位置，不靠 rotate+translate 排一圈（真机 transform 叠加容易歪）
  // 圆心 (190, 190)、半径 178，0 度在正上方，单位 rpx，与 .gauge-ring 的 380rpx 对齐
  // 半径比球半径（150）大 28rpx，刻度才不会贴着球边糊成一片
  const ticks = [];
  for (let i = 0; i < termTotal; i += 1) {
    const deg = (360 / termTotal) * i;
    const rad = ((deg - 90) * Math.PI) / 180;
    ticks.push({
      n: i,
      deg,
      x: Math.round((190 + 178 * Math.cos(rad)) * 10) / 10,
      y: Math.round((190 + 178 * Math.sin(rad)) * 10) / 10,
      on: termOrder > 0 && i < termOrder,
      now: termOrder > 0 && i === termOrder - 1,
    });
  }

  return {
    term: {
      name: termName,
      order: termOrder,
      total: termTotal,
      progress: pct(termOrder, termTotal), // 水波涨到一年里的这个位置
    },
    ticks,
    avgIngredients,
    mealCount: meals.size,
    coveredTerms: covered.size,
    perTerm: covered.size ? Math.round(list.length / covered.size) : 0,
    promises: [
      {
        key: 'allterm',
        labelKey: 'snapshot.miniAllTermLabel',
        subKey: 'snapshot.miniAllTermSub',
        subParams: { done: covered.size, total: termTotal },
        pct: pct(covered.size, termTotal),
        text: Math.round(pct(covered.size, termTotal)) + '%',
      },
      {
        key: 'easy',
        labelKey: 'snapshot.miniEasyLabel',
        subKey: 'snapshot.miniEasySub',
        subParams: { count: Math.round(avgIngredients) },
        pct: pct(home, list.length),
        text: Math.round(pct(home, list.length)) + '%',
      },
      {
        key: 'care',
        labelKey: 'snapshot.miniCareLabel',
        subKey: 'snapshot.miniCareSub',
        subParams: { done: care, total: list.length },
        pct: pct(care, list.length),
        text: Math.round(pct(care, list.length)) + '%',
      },
    ],
  };
}

module.exports = { build };
