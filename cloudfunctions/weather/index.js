// 天气转发 —— 云函数 weather
//
// 为什么必须走云函数：和风天气的 key 不能进小程序包（前端零密钥红线）。
//
// 设计要点：
//   · 不缓存（云函数实例会回收，内存缓存不可靠）；改由前端 wx.setStorageSync 缓存 30 分钟
//   · 只返回界面要用的 5 个字段，不把原始响应整个透传
//   · 上游失败如实返回错误码，前端据此降级到「无天气」状态，不编造天气
//   · 零第三方依赖，与 workflow / aichat 同风格

const https = require('https');

// 和风天气：2024 年起每个账号有独立的 ApiHost，从环境变量读
const API_HOST = (process.env.QWEATHER_HOST || 'devapi.qweather.com').replace(/^https?:\/\//, '');
const API_KEY = process.env.QWEATHER_KEY || '';

const REQUEST_TIMEOUT = 10000;

function createError(code, message) {
  const e = new Error(message || code);
  e.code = code;
  return e;
}

/** 发一个 GET，返回解析后的 JSON */
function get(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: API_HOST,
        path: path,
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: REQUEST_TIMEOUT,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (e) {
            return reject(createError('UPSTREAM_NOT_JSON', '天气接口返回非 JSON：' + raw.slice(0, 120)));
          }
          if (res.statusCode !== 200) {
            return reject(createError('HTTP_' + res.statusCode, '天气接口状态码异常'));
          }
          resolve(json);
        });
      }
    );
    req.on('error', (e) => reject(createError('UPSTREAM_FAILED', e.message)));
    req.on('timeout', () => {
      req.destroy();
      reject(createError('UPSTREAM_TIMEOUT', '天气接口超时'));
    });
    req.end();
  });
}

/**
 * 把和风的实时天气压成界面要的 5 个字段。
 *
 * 和风返回（节选）：
 *   { code: "200", now: { temp: "18", feelsLike: "16", text: "多云",
 *                         humidity: "78", windDir: "北风", windScale: "2" } }
 *
 * code 非 "200" 都是业务错误（204 是查不到该地区）。
 */
function pickNow(body) {
  const code = String((body && body.code) || '');
  if (code !== '200') {
    const msg =
      code === '204'
        ? '查不到这个地区的天气'
        : code === '401'
        ? '天气接口密钥无效'
        : code === '402'
        ? '天气接口调用次数已用完'
        : '天气接口返回错误码 ' + code;
    throw createError('WEATHER_CODE_' + code, msg);
  }

  const n = (body && body.now) || {};
  const num = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };

  return {
    temp: num(n.temp),
    feelsLike: num(n.feelsLike),
    text: String(n.text || ''),
    humidity: num(n.humidity),
    windDir: String(n.windDir || ''),
    windScale: String(n.windScale || ''),
    observedAt: String((body && body.updateTime) || ''),
  };
}

/**
 * 入参：{ lat: number, lon: number }
 *   用经纬度而不是城市名：和风的 location 支持经纬度（最多两位小数），
 *   不依赖城市 ID 表，扩展城市时只改前端数据文件。
 *
 * 返回：
 *   { status:'success', weather: {...} }
 *   { status:'error', code, message }
 */
exports.main = async (event) => {
  const e = event || {};

  if (!API_KEY) {
    return {
      status: 'error',
      code: 'KEY_MISSING',
      message: '云函数环境变量 QWEATHER_KEY 未配置',
    };
  }

  const lat = Number(e.lat);
  const lon = Number(e.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { status: 'error', code: 'BAD_LOCATION', message: '缺少有效的经纬度' };
  }
  // 和风要求最多两位小数；中国范围粗查一下，防止传错
  if (lat < 3 || lat > 54 || lon < 73 || lon > 136) {
    return { status: 'error', code: 'OUT_OF_CHINA', message: '经纬度不在服务范围内' };
  }

  const location = lat.toFixed(2) + ',' + lon.toFixed(2);
  const path = '/v7/weather/now?location=' + encodeURIComponent(location) + '&key=' + encodeURIComponent(API_KEY);

  try {
    const body = await get(path);
    return { status: 'success', weather: pickNow(body) };
  } catch (err) {
    return {
      status: 'error',
      code: (err && err.code) || 'UNKNOWN',
      message: String((err && err.message) || err),
    };
  }
};
