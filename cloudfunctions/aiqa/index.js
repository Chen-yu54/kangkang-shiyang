/**
 * cloudfunctions/aiqa/index.js
 * 入口：参数校验 → 画像校正 → 检索 → 搜索 → 模型 → 二次校验 → 内容安全 → 返回
 *
 * 环境变量（只在这里出现 Key）：
 *   LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
 *   SEARCH_API_URL / SEARCH_API_KEY / SEARCH_API_STYLE（可选）
 *   QA_DAILY_LIMIT（可选，默认 30）
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const rules = require('./data/rules.json');
const { buildCandidates, toArray } = require('./lib/retrieval');
const { buildMessages } = require('./lib/prompt');
const { chat } = require('./lib/llm');
const { webSearch, needSearch } = require('./lib/search');
const { validateAnswer, buildFallback } = require('./lib/guard');

const QUOTA_COLLECTION = 'qa_quota';
const LOG_COLLECTION = 'qa_logs';

/* ---------------- 工具 ---------------- */

// 北京时间当天 YYYY-MM-DD
function todayCN() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

// 按日期近似推算当前节气（不依赖前端，避免前端乱传）
function currentTerm(date) {
  const d = date || new Date(Date.now() + 8 * 3600 * 1000);
  const md = String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0');
  let picked = rules.termDates[rules.termDates.length - 1].term;
  for (let i = 0; i < rules.termDates.length; i += 1) {
    if (md >= rules.termDates[i].md) picked = rules.termDates[i].term;
    else break;
  }
  return picked;
}

function safeProfile(raw, recipes) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const favoriteIds = toArray(p.favoriteIds).slice(0, 20).map(String);
  const idSet = new Set(favoriteIds);
  const favoriteNames = (recipes || []).filter((r) => idSet.has(String(r.id))).map((r) => r.name).slice(0, 10);

  return {
    physique: String(p.physique || '').slice(0, 200),
    preferences: toArray(p.preferences).slice(0, 8).map((x) => String(x).slice(0, 12)),
    taboos: toArray(p.taboos).filter((t) => t && t !== '都不回避').slice(0, 10).map((x) => String(x).slice(0, 12)),
    favoriteIds,
    favoriteNames,
    favoriteCuisines: toArray(p.favoriteCuisines).slice(0, 6),
    ageGroup: String(p.ageGroup || '成人').slice(0, 10),
    elderMode: !!p.elderMode,
    currentTerm: currentTerm(),
  };
}

function db() {
  try {
    return cloud.database();
  } catch (e) {
    return null;
  }
}

/* ---------------- 限流 ---------------- */

async function checkQuota(openid, limit) {
  const database = db();
  if (!database || !openid) return { ok: true, skipped: true };
  const _id = `${openid}_${todayCN()}`;
  try {
    const res = await database.collection(QUOTA_COLLECTION).doc(_id).get();
    const used = (res && res.data && res.data.count) || 0;
    if (used >= limit) return { ok: false, used };
    await database.collection(QUOTA_COLLECTION).doc(_id).update({ data: { count: used + 1, updatedAt: new Date() } });
    return { ok: true, used: used + 1 };
  } catch (e) {
    try {
      await database.collection(QUOTA_COLLECTION).add({
        data: { _id, count: 1, date: todayCN(), createdAt: new Date(), updatedAt: new Date() },
      });
      return { ok: true, used: 1 };
    } catch (e2) {
      return { ok: true, skipped: true }; // 计数失败不阻塞用户
    }
  }
}

/* ---------------- 内容安全（失败放行，不阻塞主流程） ---------------- */

async function msgSecCheck(content, openid, scene) {
  const text = String(content || '').trim();
  if (!text || !openid) return { pass: true, skipped: true };
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      content: text.slice(0, 500),
      version: 2,
      scene: scene || 2,
      openid,
    });
    const suggest = res && res.result && res.result.suggest;
    return { pass: suggest !== 'risky', suggest };
  } catch (e) {
    return { pass: true, skipped: true, error: String(e.errCode || e.message || e) };
  }
}

/* ---------------- 日志 ---------------- */

async function logEvent(payload) {
  const database = db();
  if (!database) return;
  try {
    await database.collection(LOG_COLLECTION).add({ data: Object.assign({ createdAt: new Date() }, payload) });
  } catch (e) {
    /* 忽略 */
  }
}

/* ---------------- 主流程 ---------------- */

exports.main = async (event) => {
  const startedAt = Date.now();
  const wxContext = cloud.getWXContext ? cloud.getWXContext() : {};
  const openid = wxContext.OPENID || '';

  const question = String((event && event.question) || '').trim().slice(0, 300);
  const history = toArray(event && event.history).slice(-6);

  if (!question) {
    return { status: 'error', code: 'EMPTY_QUESTION', message: rules.emptyQuestion };
  }

  const key = process.env.LLM_API_KEY;
  if (!key) {
    return { status: 'error', code: 'LLM_KEY_MISSING', message: '云函数未配置 LLM_API_KEY' };
  }

  // 环境自检：传 {"debug": true} 时返回配置状态，不跑问答。
  // 只暴露「有没有配、像不像、长度多少」，绝不回传 key 明文。
  // 线上出问题最常见的是 key 尾部多一个空格或换行，肉眼看不出来，
  // 但拼成 Bearer 头就是 401，而日志只会给一个 UPSTREAM_FAILED。
  if (event && event.debug) {
    const mask = (v) => {
      const s = String(v || '');
      if (!s) return { set: false };
      return {
        set: true,
        length: s.length,
        head: s.slice(0, 6) + '…',
        hasWhitespace: /\s/.test(s),
        trimmedEqual: s.trim() === s,
        shape: /^sk-[0-9a-z]{20,}$/i.test(s) ? 'looks-ok' : 'unexpected',
      };
    };
    return {
      status: 'ok',
      debug: {
        LLM_API_KEY: mask(key),
        LLM_MODEL: process.env.LLM_MODEL || '(未配，走默认 deepseek-flash)',
        LLM_BASE_URL: process.env.LLM_BASE_URL || '(未配，走默认 api.deepseek.com)',
        QA_DAILY_LIMIT: process.env.QA_DAILY_LIMIT || '(未配，走默认 30)',
        node: process.version,
        env: process.env.TCB_ENV || process.env.SCF_NAMESPACE || '(未知)',
      },
    };
  }

  const recipes = require('./data/recipes.json');
  const profile = safeProfile(event && event.profile, recipes);

  // 0) 限流
  const dailyLimit = Number(process.env.QA_DAILY_LIMIT || 30);
  const quota = await checkQuota(openid, dailyLimit);
  if (!quota.ok) {
    return { status: 'error', code: 'RATE_LIMITED', message: `今天已经问了 ${quota.used} 次，明天再来吧。` };
  }

  // 1) 输入内容安全（失败放行）
  const inputCheck = await msgSecCheck(question, openid, 2);
  if (!inputCheck.pass) {
    return { status: 'error', code: 'CONTENT_BLOCKED', message: '这个问题换个说法再试试？' };
  }

  // 2) 硬过滤 + 排序
  const { candidates, filtered, fallback } = buildCandidates(profile, question, recipes);
  if (!candidates.length) {
    return {
      status: 'error',
      code: 'NO_CANDIDATE',
      message: '按当前少吃过滤后没有合适的菜，试试放宽一个少吃。',
      meta: { filtered },
    };
  }

  // 3) 是否需要联网（关键词规则先判；模型也可二次要求）
  let web = [];
  if (needSearch(question)) {
    web = await webSearch(question).catch(() => []);
  }

  const llmOpt = {
    key,
    base: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
    timeout: 25000,
    maxTokens: profile.elderMode ? 500 : 800,
  };

  // 4) 第一次调用（网络类失败重试一次）
  let answer;
  let attempts = 0;
  let lastError = null;
  while (attempts < 2) {
    attempts += 1;
    try {
      answer = await chat(buildMessages({ question, profile, candidates, web, history }), llmOpt);
      break;
    } catch (e) {
      const code = e && e.code;
      // 留下最后一次失败原因。线上排查时 meta 里的 upstreamError 比
      // 只有一个 UPSTREAM_FAILED 有用得多——否则只能翻 qa_logs，
      // 而集合没建对时连日志都没有。
      lastError = {
        code: code || 'UNKNOWN',
        message: String((e && e.message) || e).slice(0, 200),
        status: (e && e.status) || null,
      };
      if (code === 'BAD_JSON') {
        // 非 JSON：不重试，直接降级
        await logEvent({ type: 'bad_json', openid, question, raw: String(e.raw || '').slice(0, 300) });
        const fb = buildFallback(fallback, profile.currentTerm, rules.degradeNote);
        return Object.assign(
          {
            status: 'ok',
            meta: {
              filtered,
              candidateCount: candidates.length,
              searchUsed: web.length > 0,
              degraded: true,
              errorCode: 'BAD_JSON',
              upstreamError: lastError,
            },
          },
          fb
        );
      }
      if (attempts >= 2) {
        await logEvent({ type: 'upstream_failed', openid, question, error: String(e && e.message).slice(0, 300) });
        const fb = buildFallback(fallback, profile.currentTerm, rules.degradeNote);
        return Object.assign(
          {
            status: 'ok',
            meta: {
              filtered,
              candidateCount: candidates.length,
              searchUsed: web.length > 0,
              degraded: true,
              errorCode: 'UPSTREAM_FAILED',
              upstreamError: lastError,
            },
          },
          fb
        );
      }
    }
  }

  // 5) 模型要求补搜：最多再调一次
  if (answer && answer.need_search && answer.search_query && web.length === 0) {
    const more = await webSearch(String(answer.search_query).slice(0, 100)).catch(() => []);
    if (more.length) {
      web = more;
      try {
        answer = await chat(buildMessages({ question, profile, candidates, web, history }), llmOpt);
      } catch (e) {
        /* 二次失败就用第一次的结果 */
      }
    }
  }

  // 6) 校验与兜底
  const safe = validateAnswer(answer, { candidates, fallback, profile });

  // 7) 输出内容安全
  const outCheck = await msgSecCheck(safe.reply, openid, 2);
  let reply = safe.reply;
  if (!outCheck.pass) {
    reply = rules.safeReply;
    safe.flags.blocked = true;
    await logEvent({ type: 'content_blocked', openid, question, reason: 'msgSecCheck' });
  }
  if (safe.flags && safe.flags.blocked) {
    await logEvent({ type: 'content_blocked', openid, question, words: safe.flags.bannedWords || [] });
  }
  if (safe.flags && safe.flags.droppedTaboo && safe.flags.droppedTaboo.length) {
    await logEvent({ type: 'taboo_dropped', openid, question, ids: safe.flags.droppedTaboo });
  }

  return {
    status: 'ok',
    reply,
    dishes: safe.dishes,
    followups: safe.followups,
    sources: safe.sources,
    disclaimer: rules.disclaimer,
    meta: {
      filtered,
      candidateCount: candidates.length,
      searchUsed: web.length > 0,
      degraded: !!(safe.flags && safe.flags.degraded),
      droppedInvalid: (safe.flags && safe.flags.droppedInvalid) || 0,
      elapsed: Date.now() - startedAt,
      term: profile.currentTerm,
    },
  };
};
