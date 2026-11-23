// 街道 / 社区名单 —— 分享归属用。
//
// ⚠️ 这份名单必须由项目方（A 侧或街道对接人）提供真实数据，代码里不编造社区名。
//    名单为空时，分享功能在界面上自动降级为「暂未开放」，不会出现空选项或假社区。
//
// 结构：
//   districts[i].id            街道唯一标识（英文/数字，用于上报，稳定不变）
//   districts[i].name          街道显示名
//   districts[i].communities[] 该街道下的社区
//     .id                      社区唯一标识
//     .name                    社区显示名
//
// 填法：把下面的 communities 数组换成真实社区即可，不需要改任何页面代码。
//       改完重新编译，consent 页会自动出现对应选项。

const DISTRICTS = [
  {
    id: 'jiangnan-zhong',
    name: '江南中街',
    // TODO(待填)：请街道对接人提供该街下辖社区名单。
    //   在此之前为空数组 —— 分享功能会显示「暂未开放」，不会误导用户。
    communities: [],
  },
];

const MAX_COMMUNITIES = 40;

/** 街道列表。社区名单还没补齐时也照常可选，只按街道记录，不挡用户。 */
function listDistricts() {
  return DISTRICTS.filter((d) => d && d.id && d.name).map((d) => ({ id: d.id, name: d.name }));
}

function listCommunities(districtId) {
  const hit = DISTRICTS.filter((d) => d.id === districtId)[0];
  if (!hit) return [];
  return (hit.communities || []).slice(0, MAX_COMMUNITIES).map((c) => ({ id: c.id, name: c.name }));
}

function isConfigured() {
  return listDistricts().length > 0;
}

/** 按 id 反查显示名，页面展示用；取不到返回空串，不编名字 */
function nameOf(districtId, communityId) {
  const d = DISTRICTS.filter((x) => x.id === districtId)[0];
  if (!d) return { districtName: '', communityName: '' };
  const c = (d.communities || []).filter((x) => x.id === communityId)[0];
  return {
    districtName: d.name || '',
    communityName: c ? c.name || '' : '',
  };
}

module.exports = { DISTRICTS, listDistricts, listCommunities, isConfigured, nameOf, MAX_COMMUNITIES };
