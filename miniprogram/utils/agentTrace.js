// utils/agentTrace.js —— 把「真实计算」包装成一条可观看的 Agent 推理轨迹
//
// 定位：专属推荐页点「生成今日食单」，六步轨迹就在那一页演（不另开页）。
// 原则（合规硬约束，不要改）：
//   1. 步骤、条数、理由全部来自 nutrition.buildRecommendation 的真实计算，
//      这里只做「呈现层」的加工（步骤名、耗时、引擎标识），不编造任何推理结果。
//   2. 引擎标识必须如实：扣子未配置就写「本地推演」，不能伪装成模型在线。
//   3. 耗时来自 Date.now() 实测，不写死。

const nutrition = require('./nutrition');
const dataSource = require('./dataSource');
const config = require('./config');
const i18n = require('./i18n');

const t = i18n.t;

// 步骤类型 → 展示名（i18n 键），顺序与 nutrition 的 kind 一一对应
const KIND_LABEL = {
  term: 'agent.step.term',
  input: 'agent.step.input',
  recall: 'agent.step.recall',
  filter: 'agent.step.filter',
  rank: 'agent.step.rank',
  result: 'agent.step.result',
};

// 引擎标识：三态如实反映当前通道
// 前端不持有 botId / token，判断依据是「转发层是否就绪」：
//   云开发通道（CLOUD_ENV 已配）或 SCF 代理（API_BASE 已配）都算真引擎在线；
//   都没有就如实显示本地推演，绝不伪装成模型在线。
function engineInfo() {
  const hasEnv = !!(config.CLOUD_ENV);
  const hasCloud = typeof wx !== 'undefined' && !!wx.cloud;
  const proxyReady = !!(config.API_BASE && config.DATA_CHANNEL === 'coze-proxy');

  if ((hasEnv && hasCloud) || proxyReady) {
    return { key: 'coze', label: t('agent.engineCoze'), note: t('agent.engineNoteCoze') };
  }

  // 走不了模型时，把「缺哪一环」写进 note —— 用户看界面就知道为什么没调扣子，
  // 不用去翻控制台，也不用猜。
  let why = t('agent.engineNoteLocal');
  if (!hasEnv && !proxyReady) why = '未配置云开发环境';
  else if (hasEnv && !hasCloud) why = '云开发未开通（wx.cloud 不存在）';
  return { key: 'local', label: t('agent.engineLocal'), note: why };
}

function prefsOf(answers) {
  const a = answers && typeof answers === 'object' ? answers : {};
  return {
    taste: nutrition.tasteLabels(a.q5),
    avoid: nutrition.avoidLabels(a.q6),
  };
}

/**
 * @param {object} answers 问卷答案
 * @param {object} opts { termName }
 * @returns {object} 生成页所需的完整视图模型
 */
function build(answers, opts) {
  const o = opts || {};
  const engine = engineInfo();
  const prefs = prefsOf(answers);

  const startedAt = Date.now();
  const rec = nutrition.buildRecommendation(answers, { termName: o.termName });
  // 真实实测耗时：本地规则引擎通常 < 10ms，如实展示，不美化
  const elapsed = Math.max(1, Date.now() - startedAt);

  const steps = (rec.steps || []).map((step, i) => ({
    no: String(i + 1).padStart(2, '0'),
    kind: step.kind,
    label: t(KIND_LABEL[step.kind] || 'agent.step.term'),
    title: step.title,
    lines: step.lines || [],
    count: step.count === null || step.count === undefined ? null : step.count,
    isLast: i === (rec.steps || []).length - 1,
  }));

  const mk = dataSource.getMeta ? dataSource.getMeta() : null;

  return {
    engine,
    elapsed,
    steps,
    counts: rec.counts,
    answered: rec.answered,
    termName: rec.termName,
    prefs,
    dishes: (rec.dishes || []).map((x) => ({
      id: x.dish.id,
      name: x.dish.name,
      cuisine: x.dish.cuisine,
      cuisineName: x.dish.cuisineName || '',
      how: x.dish.how || '',
      isSeasonal: !!x.isSeasonal,
      why: (x.hits || []).map((h) => h.method).join('、'),
    })),
    // 证据信息：版本与口径随结果一起出现，可在 method 页复算
    evidence: {
      version: (mk && (mk.version || mk.kbVersion)) || '',
      total: (mk && mk.total) || 0,
      note: t('agent.matchNote'),
    },
    note: rec.note || '',
  };
}

module.exports = { build, engineInfo };
