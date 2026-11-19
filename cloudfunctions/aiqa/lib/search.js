/**
 * lib/search.js
 * 搜索适配（bocha / tavily / generic）+ 7 天缓存
 * 设计原则：搜索失败绝不影响主流程，一律返回 []。
 */
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const rules = require('../data/rules.json');

const CACHE_COLLECTION = 'qa_search_cache';
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;

/* ---------- 是否需要联网 ---------- */
function needSearch(question) {
  const q = String(question || '');
  if (!q) return false;
  return rules.searchTriggers.some((w) => q.indexOf(w) >= 0);
}

/* ---------- 通用 POST ---------- */
function postJSON(urlStr, body, headers, timeout) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch (e) {
      return resolve(null);
    }
    const isHttps = url.protocol === 'https:';
    const payload = JSON.stringify(body);
    const req = (isHttps ? https : http).request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          headers || {}
        ),
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) return resolve(null);
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            resolve(null);
          }
        });
      }
    );
    req.setTimeout(Number(timeout || 6000), () => req.destroy(new Error('search timeout')));
    req.on('error', () => resolve(null));
    req.write(payload);
    req.end();
  });
}

/* ---------- 各厂商响应归一化 ---------- */
function normalize(style, data, limit) {
  if (!data) return [];
  const out = [];
  const push = (title, url, snippet) => {
    if (!url || !/^https?:\/\//.test(String(url))) return;
    out.push({
      title: String(title || url).slice(0, 80),
      url: String(url),
      snippet: String(snippet || '').replace(/\s+/g, ' ').slice(0, 200),
    });
  };

  if (style === 'bocha') {
    const pages = (data.data && data.data.webPages && data.data.webPages.value) || [];
    pages.forEach((p) => push(p.name, p.url, p.snippet || p.summary));
  } else if (style === 'tavily') {
    (data.results || []).forEach((p) => push(p.title, p.url, p.content));
  } else {
    // generic：尽量兼容 results / data / items / webPages
    const list =
      data.results ||
      (data.data && (data.data.results || data.data.items || data.data)) ||
      data.items ||
      data.webPages ||
      [];
    const arr = Array.isArray(list) ? list : [];
    arr.forEach((p) => push(p.title || p.name, p.url || p.link, p.snippet || p.content || p.summary || p.description));
  }
  return out.slice(0, limit);
}

/* ---------- 缓存 ---------- */
function cacheKey(query) {
  const norm = String(query || '').replace(/\s+/g, '').toLowerCase();
  return 'q_' + crypto.createHash('md5').update(norm).digest('hex');
}

function getDB() {
  try {
    const cloud = require('wx-server-sdk');
    return cloud.database();
  } catch (e) {
    return null;
  }
}

async function readCache(key) {
  const db = getDB();
  if (!db) return null;
  try {
    const res = await db.collection(CACHE_COLLECTION).doc(key).get();
    const doc = res && res.data;
    if (!doc || !doc.updatedAt) return null;
    if (Date.now() - new Date(doc.updatedAt).getTime() > CACHE_TTL_MS) return null;
    return Array.isArray(doc.results) ? doc.results : null;
  } catch (e) {
    return null;
  }
}

async function writeCache(key, query, results) {
  const db = getDB();
  if (!db) return;
  try {
    const data = { query: String(query).slice(0, 120), results, updatedAt: new Date() };
    try {
      await db.collection(CACHE_COLLECTION).doc(key).set({ data });
    } catch (e) {
      await db.collection(CACHE_COLLECTION).add({ data: Object.assign({ _id: key }, data) });
    }
  } catch (e) {
    /* 缓存失败不影响主流程 */
  }
}

/* ---------- 对外入口 ---------- */
async function webSearch(query, opt) {
  const o = opt || {};
  const limit = Math.min(Number(o.limit || 3), 5);
  const q = String(query || '').trim();
  if (!q) return [];

  const url = o.url || process.env.SEARCH_API_URL;
  const key = o.key || process.env.SEARCH_API_KEY;
  const style = String(o.style || process.env.SEARCH_API_STYLE || 'generic').toLowerCase();
  if (!url) return [];

  const key2 = cacheKey(q);
  const cached = await readCache(key2);
  if (cached) return cached.slice(0, limit);

  let body;
  let headers = {};
  if (style === 'bocha') {
    body = { query: q, count: limit, summary: true };
    headers = { Authorization: 'Bearer ' + (key || '') };
  } else if (style === 'tavily') {
    body = { api_key: key, query: q, max_results: limit, search_depth: 'basic' };
  } else {
    body = { query: q, limit };
    if (key) headers = { Authorization: 'Bearer ' + key };
  }

  const data = await postJSON(url, body, headers, o.timeout);
  const results = normalize(style, data, limit);
  if (results.length) await writeCache(key2, q, results);
  return results;
}

module.exports = { webSearch, needSearch, normalize, cacheKey, CACHE_COLLECTION };
