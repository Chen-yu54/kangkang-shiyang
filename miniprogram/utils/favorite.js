// utils/favorite.js —— 收藏的本地存储（团队分工方案 6.3 D3「收藏页：本地 storage 保存」）
//
// 只存菜品 id 数组，展示时再用 api 取详情，避免把整条菜品数据复制一份进 storage
// （数据更新后收藏项会自动跟上，不会留下过期副本）。
//
// 新收藏放在数组头部，收藏页因此天然按「最近收藏在前」排列。

const KEY = 'favoriteIds';

function getIds() {
  const value = wx.getStorageSync(KEY);
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === 'string' && id);
}

function saveIds(ids) {
  wx.setStorageSync(KEY, ids);
  return ids;
}

function has(id) {
  if (!id) return false;
  return getIds().indexOf(id) > -1;
}

function add(id) {
  if (!id) return getIds();
  const ids = getIds().filter((item) => item !== id);
  ids.unshift(id);
  return saveIds(ids);
}

function remove(id) {
  if (!id) return getIds();
  return saveIds(getIds().filter((item) => item !== id));
}

function toggle(id) {
  return has(id) ? remove(id) : add(id);
}

function clear() {
  return saveIds([]);
}

function count() {
  return getIds().length;
}

module.exports = {
  getIds,
  has,
  add,
  remove,
  toggle,
  clear,
  count,
};
