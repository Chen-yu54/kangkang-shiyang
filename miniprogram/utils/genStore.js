// utils/genStore.js —— 「推演过没有」的唯一凭据
//
// 为什么需要这一层：三道菜只能来自推演，不能由列表页提前算好摆出来。
// 之前推荐页在用户没做问卷、没进生成页时就用 nutrition.buildRecommendation
// 现算三道上桌，等于「没推演也有菜单」，和「先问卷、再推演、后出菜」的链路
// 自相矛盾，也让人以为机器已经替他想过了。
//
// 现在规则收紧为：
//   只有食养页把轨迹跑完（出单），才写一条 lastGen；
//   列表页读到 lastGen 且答案指纹一致，才承认这几道菜是「推演结果」。
// 指纹不一致说明用户重做了问卷，旧结果作废，需要重新推演。
//
// 存整张卡而不只存 id：扣子给的菜名未必能在本地菜谱库里对上（对不上就没有 id）。
// 只存 id 会把这类菜在下次进入时静默丢掉，用户看到「推演过，但少了一道」。

const KEY = 'lastGen';

// 答案指纹：与 index / menu 用同一套（JSON 原样序列化），
// 只用来判断「是不是同一份答案」，不做校验
function signAnswers(answers) {
  try {
    return JSON.stringify(answers || {});
  } catch (err) {
    return '';
  }
}

// 卡片要展示的字段原样留一份，下次进来不必重新推演，也不必重新查库
function snapshot(dish) {
  const d = dish || {};
  return {
    id: d.id || '',
    name: d.name || '',
    image: d.image || '',
    imgNote: d.imgNote || '',
    cuisine: d.cuisine || '',
    isSeasonal: !!d.isSeasonal,
    metaText: d.metaText || '',
    howText: d.howText || '',
    whyText: d.whyText || '',
  };
}

// 推演完成时调用：记下这份答案算出的几道菜
function save(answers, dishes) {
  try {
    const list = (dishes || []).filter((d) => d && d.name);
    wx.setStorageSync(KEY, {
      sign: signAnswers(answers),
      ids: list.map((d) => d.id).filter(Boolean),
      items: list.map(snapshot),
      at: Date.now(),
    });
    return true;
  } catch (err) {
    return false;
  }
}

function read() {
  try {
    const v = wx.getStorageSync(KEY);
    return v && typeof v === 'object' && Array.isArray(v.ids) ? v : null;
  } catch (err) {
    return null;
  }
}

// 这份答案推演过吗？推演过返回 id 列表，否则返回空数组
function idsFor(answers) {
  const gen = read();
  if (!gen || !gen.ids.length) return [];
  return gen.sign === signAnswers(answers) ? gen.ids : [];
}

// 这份答案推演出的整张卡（含本地库对不上的菜），没有就返回空数组
function itemsFor(answers) {
  const gen = read();
  if (!gen || !Array.isArray(gen.items) || !gen.items.length) return [];
  return gen.sign === signAnswers(answers) ? gen.items : [];
}

function clear() {
  try {
    wx.removeStorageSync(KEY);
  } catch (err) {
    // 清不掉最多下次多推演一遍，不阻断
  }
}

module.exports = { KEY, save, read, idsFor, itemsFor, signAnswers, clear };
