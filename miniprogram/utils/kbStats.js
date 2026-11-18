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
  // 民俗序号从立春起算（terms.js 里的 termOrder：立春 1 … 立冬 19），
  // 数组顺序是从小寒起的，直接用会得到「第 21 个节气」这种与常识不符的说法
  const termOrder = Number(current && (current.termOrder || current.order)) || 0;
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

  // 24 段刻度的坐标不在这里算了：驾驶舱的罗盘在 data/cockpit.js 里按自己的尺寸重算，
  // 这一层只负责「当前节气走到第几段」和三个环的百分比。

  return {
    term: {
      name: termName,
      order: termOrder,
      total: termTotal,
      progress: pct(termOrder, termTotal), // 水波涨到一年里的这个位置
    },
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
        subParams: { done: home, total: list.length },
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
