// 城市列表 —— 天气查询用。
//
// 为什么用经纬度而不是城市 ID：和风天气的 location 参数支持「经度,纬度」，
// 不依赖他家的 LocationID 表，扩展城市时只改这个文件，云函数不用动。
//
// ⚠️ 只收录广东省 21 个地级市 + 港澳。这是本项目的服务范围（岭南）。
//    要扩到全国，按同样格式追加即可。经纬度取市政府所在地，两位小数。
//
// 精度说明：一个城市的天气差异主要体现在区县，市级精度对「今天吃什么」够用。

const CITIES = [
  { id: 'guangzhou', name: '广州', prov: '广东', lat: 23.13, lon: 113.26, default: true },
  { id: 'shenzhen', name: '深圳', prov: '广东', lat: 22.55, lon: 114.06 },
  { id: 'zhuhai', name: '珠海', prov: '广东', lat: 22.27, lon: 113.58 },
  { id: 'foshan', name: '佛山', prov: '广东', lat: 23.02, lon: 113.12 },
  { id: 'dongguan', name: '东莞', prov: '广东', lat: 23.05, lon: 113.75 },
  { id: 'zhongshan', name: '中山', prov: '广东', lat: 22.52, lon: 113.38 },
  { id: 'huizhou', name: '惠州', prov: '广东', lat: 23.11, lon: 114.42 },
  { id: 'jiangmen', name: '江门', prov: '广东', lat: 22.58, lon: 113.08 },
  { id: 'zhaoqing', name: '肇庆', prov: '广东', lat: 23.05, lon: 112.47 },
  { id: 'shantou', name: '汕头', prov: '广东', lat: 23.35, lon: 116.68 },
  { id: 'chaozhou', name: '潮州', prov: '广东', lat: 23.66, lon: 116.63 },
  { id: 'jieyang', name: '揭阳', prov: '广东', lat: 23.55, lon: 116.37 },
  { id: 'shanwei', name: '汕尾', prov: '广东', lat: 22.79, lon: 115.38 },
  { id: 'meizhou', name: '梅州', prov: '广东', lat: 24.29, lon: 116.12 },
  { id: 'heyuan', name: '河源', prov: '广东', lat: 23.74, lon: 114.70 },
  { id: 'shaoguan', name: '韶关', prov: '广东', lat: 24.81, lon: 113.60 },
  { id: 'qingyuan', name: '清远', prov: '广东', lat: 23.70, lon: 113.05 },
  { id: 'yunfu', name: '云浮', prov: '广东', lat: 22.92, lon: 112.04 },
  { id: 'yangjiang', name: '阳江', prov: '广东', lat: 21.86, lon: 111.98 },
  { id: 'maoming', name: '茂名', prov: '广东', lat: 21.66, lon: 110.93 },
  { id: 'zhanjiang', name: '湛江', prov: '广东', lat: 21.27, lon: 110.36 },
  { id: 'hongkong', name: '香港', prov: '香港', lat: 22.32, lon: 114.17 },
  { id: 'macau', name: '澳门', prov: '澳门', lat: 22.19, lon: 113.54 },
];

/** 全部分组展示：按省份分组，港澳单列 */
function groups() {
  const map = {};
  CITIES.forEach((c) => {
    if (!map[c.prov]) map[c.prov] = [];
    map[c.prov].push({ id: c.id, name: c.name });
  });
  return Object.keys(map).map((prov) => ({ prov, list: map[prov] }));
}

/** 按 id 取城市；取不到返回默认城市（广州），不返回 null 让调用方处理空值 */
function get(id) {
  const hit = CITIES.filter((c) => c.id === id)[0];
  if (hit) return hit;
  return CITIES.filter((c) => c.default)[0] || CITIES[0];
}

module.exports = { CITIES, groups, get };
