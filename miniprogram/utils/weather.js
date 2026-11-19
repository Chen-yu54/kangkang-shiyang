// 天气：拿当前城市实时天气，带 30 分钟本地缓存。
//
// 为什么缓存放前端：云函数实例会回收，内存缓存不可靠；建云数据库集合又要多一步部署。
// 前端 wx.setStorageSync 足够——同一个用户 30 分钟内只调一次。
//
// 降级：拿不到就返回 null，调用方不显示天气行，绝不编造数据。

const cfg = require('./config');
const cities = require('../data/cities');

const CACHE_KEY = 'weatherCache';
const CITY_KEY = 'weatherCity';
const TTL = 30 * 60 * 1000; // 30 分钟

/** 用户选的城市 id；没选过用默认（广州） */
function currentCityId() {
  try {
    return wx.getStorageSync(CITY_KEY) || '';
  } catch (e) {
    return '';
  }
}

function currentCity() {
  return cities.get(currentCityId());
}

function setCity(id) {
  try {
    wx.setStorageSync(CITY_KEY, String(id || ''));
    // 换城市后旧缓存作废
    wx.removeStorageSync(CACHE_KEY);
  } catch (e) { /* 存不下不影响本次 */ }
}

function readCache(cityId) {
  try {
    const c = wx.getStorageSync(CACHE_KEY);
    if (!c || typeof c !== 'object') return null;
    if (c.cityId !== cityId) return null;
    if (!c.at || Date.now() - c.at > TTL) return null;
    return c.weather || null;
  } catch (e) {
    return null;
  }
}

function writeCache(cityId, weather) {
  try {
    wx.setStorageSync(CACHE_KEY, { cityId, at: Date.now(), weather });
  } catch (e) { /* 忽略 */ }
}

function cloudReady() {
  return !!(cfg.CLOUD_ENV && typeof wx !== 'undefined' && wx.cloud);
}

/**
 * 拿天气。
 * @returns {Promise<object|null>} 成功返回 {temp, feelsLike, text, humidity, cityName}；失败返回 null
 */
function fetch() {
  const city = currentCity();
  if (!city) return Promise.resolve(null);

  const cached = readCache(city.id);
  if (cached) {
    return Promise.resolve(Object.assign({ cityName: city.name }, cached));
  }

  if (!cloudReady()) return Promise.resolve(null);

  return new Promise((resolve) => {
    wx.cloud.callFunction({
      name: 'weather',
      data: { lat: city.lat, lon: city.lon },
      config: { env: cfg.CLOUD_ENV },
      success: (res) => {
        const r = (res && res.result) || {};
        if (r.status === 'success' && r.weather) {
          writeCache(city.id, r.weather);
          resolve(Object.assign({ cityName: city.name }, r.weather));
          return;
        }
        resolve(null);
      },
      fail: () => resolve(null),
    });
  });
}

/**
 * 天气 → 一句「怎么吃」的提醒。
 *
 * ⚠️ 口径纪律：只说食物形态与处理方式，不写任何功效。
 *    可以说「热汤比凉菜合适」，不能说「喝姜汤驱寒」。
 *
 * @returns {string} 拿不到关键字段就返回空串，调用方不显示这一行
 */
function toTip(w) {
  if (!w || w.temp === null || w.temp === undefined) return '';

  const t = Number(w.temp);
  const feels = w.feelsLike !== null && w.feelsLike !== undefined ? Number(w.feelsLike) : t;
  const hum = w.humidity;
  const parts = [];

  // 第一段：今天多少度、什么天
  parts.push('今天 ' + t + '℃' + (w.text ? '，' + w.text : ''));

  // 第二段：按体感给「食物形态」，只说怎么做、不说效果
  let how = '';
  if (feels <= 10) how = '热食热汤更合适，凉菜先放一放';
  else if (feels <= 18) how = '汤水和炖煮正当时';
  else if (feels <= 26) how = '快炒少油，别做得太腻';
  else how = '凉拌清炒都行，注意别久放';

  // 第三段：湿度高时补一句储存提示（这是可核验的常识，不是功效）
  if (hum !== null && hum !== undefined && Number(hum) >= 85) {
    how += '；湿度 ' + hum + '%，叶菜买回当天吃';
  }

  return parts.join('') + '——' + how;
}

module.exports = { fetch, toTip, currentCity, currentCityId, setCity, TTL };
