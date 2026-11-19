/**
 * utils/profile.js
 * 汇总用户画像，交给云函数。云函数不信任这里的内容，会重新校正。
 *
 * 数据来源（按优先级）：
 *   1. utils/nutrition.js 的 toWorkflowParams()  → 偏好/偏好/少吃（与现有工作流一致）
 *   2. Storage prefAnswers                        → 问卷原始答案
 *   3. Storage favoriteIds + data/recipes.js      → 收藏菜系
 */
const TERM_DATES = [
  ['小寒', '0106'], ['大寒', '0120'], ['立春', '0204'], ['雨水', '0219'],
  ['惊蛰', '0306'], ['春分', '0321'], ['清明', '0405'], ['谷雨', '0420'],
  ['立夏', '0506'], ['小满', '0521'], ['芒种', '0606'], ['夏至', '0621'],
  ['小暑', '0707'], ['大暑', '0723'], ['立秋', '0808'], ['处暑', '0823'],
  ['白露', '0908'], ['秋分', '0923'], ['寒露', '1008'], ['霜降', '1023'],
  ['立冬', '1107'], ['小雪', '1122'], ['大雪', '1207'], ['冬至', '1222'],
];

function currentTerm(date) {
  const d = date || new Date();
  const md = ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
  let picked = TERM_DATES[TERM_DATES.length - 1][0];
  for (let i = 0; i < TERM_DATES.length; i += 1) {
    if (md >= TERM_DATES[i][1]) picked = TERM_DATES[i][0];
    else break;
  }
  return picked;
}

function getStorage(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    return v === '' || v === undefined || v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function toArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string') {
    return v.split(/[,，、;；\s]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [v];
}

// 优先复用现有 nutrition 的入参构造
function fromWorkflow() {
  try {
    const nutrition = require('./nutrition');
    if (nutrition && typeof nutrition.toWorkflowParams === 'function') {
      const p = nutrition.toWorkflowParams() || {};
      return {
        physique: p.user_physique || '',
        preferences: p.user_preferences || '',
        taboos: p.user_taboos || '',
      };
    }
  } catch (e) {
    /* 原工程没有该模块时走兜底 */
  }
  return null;
}

function fromPrefAnswers() {
  const a = getStorage('prefAnswers', null);
  if (!a) return null;
  if (Array.isArray(a)) {
    return {
      physique: toArray(a.slice(0, 4)).join('；'),
      preferences: toArray(a[4]).join('、'),
      taboos: toArray(a[5]).filter((x) => x !== '都不回避').join('、'),
    };
  }
  return {
    physique: toArray([a.q1, a.q2, a.q3, a.q4]).join('；'),
    preferences: toArray(a.q5).join('、'),
    taboos: toArray(a.q6).filter((x) => x !== '都不回避').join('、'),
  };
}

function favoriteInfo() {
  const ids = toArray(getStorage('favoriteIds', [])).slice(0, 20);
  if (!ids.length) return { favoriteIds: [], favoriteNames: [], favoriteCuisines: [] };
  let recipes = [];
  try {
    recipes = require('../data/recipes.js') || [];
  } catch (e) {
    recipes = [];
  }
  const idSet = {};
  ids.forEach((id) => {
    idSet[id] = true;
  });
  const names = [];
  const cuisines = [];
  recipes.forEach((r) => {
    if (!r || !idSet[r.id]) return;
    names.push(r.name);
    if (r.cuisine && cuisines.indexOf(r.cuisine) < 0) cuisines.push(r.cuisine);
  });
  return { favoriteIds: ids, favoriteNames: names.slice(0, 10), favoriteCuisines: cuisines.slice(0, 6) };
}

function elderModeOn() {
  try {
    const app = getApp();
    if (app && app.globalData && typeof app.globalData.elderMode === 'boolean') return app.globalData.elderMode;
  } catch (e) {
    /* ignore */
  }
  return !!getStorage('elderMode', false);
}

function ageGroup() {
  const info = getStorage('userInfo', {}) || {};
  return info.ageGroup || getStorage('ageGroup', '成人') || '成人';
}

/**
 * @returns {Object} 云函数入参 profile
 */
function build() {
  const wf = fromWorkflow();
  const pref = fromPrefAnswers() || {};
  const fav = favoriteInfo();

  const physique = (wf && wf.physique) || pref.physique || '';
  const preferences = (wf && wf.preferences) || pref.preferences || '';
  const taboos = (wf && wf.taboos) || pref.taboos || '';

  return {
    physique: String(physique).slice(0, 200),
    preferences: toArray(preferences).slice(0, 8),
    taboos: toArray(taboos).filter((t) => t && t !== '都不回避').slice(0, 10),
    favoriteIds: fav.favoriteIds,
    favoriteNames: fav.favoriteNames,
    favoriteCuisines: fav.favoriteCuisines,
    ageGroup: ageGroup(),
    elderMode: elderModeOn(),
    currentTerm: currentTerm(),
  };
}

module.exports = { build, currentTerm, toArray, elderModeOn };
