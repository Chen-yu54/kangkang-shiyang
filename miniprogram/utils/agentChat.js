// 对话式问卷 —— 把「填 6 道题」包装成「跟康康聊几句」。
//
// 为什么这么改：
//   直接摆一张问卷，长者会觉得是「表单」，容易中途退出；
//   改成对话后，每次只回答一件事，答完有反馈，像在跟人说话。
//
// 实现是**脚本化对话**，不是自由对话：
//   · 问题与选项固定，用户点选而不是打字（长者友好，也不会被带跑）
//   · 不依赖大模型，扣子工作流只在最后一步出推荐
//   · 答完立刻能改（点「说错了」回到上一题）
//
// 数据来源：题面与选项取自 i18n 的 preftest.*，与原生问卷同一份，避免两套口径。

const i18n = require('./i18n');
const nutrition = require('./nutrition');

// 6 道题：前 4 题单选，后 2 题多选。与 preftest 完全一致。
const STEPS = [
  { key: 'q1', count: 4, multi: false, lead: '先问个简单的——' },
  { key: 'q2', count: 4, multi: false, lead: '再问一句——' },
  { key: 'q3', count: 4, multi: false, lead: '还有——' },
  { key: 'q4', count: 4, multi: false, lead: '这件事有点私人，但对挑菜挺有用——' },
  { key: 'q5', count: 6, multi: true, lead: '说说口味吧——' },
  { key: 'q6', count: 7, multi: true, lead: '最后一件——' },
];

function titleOf(step) {
  return i18n.t('preftest.' + step.key + '.title');
}

function optionsOf(step) {
  const list = [];
  for (let i = 1; i <= step.count; i += 1) {
    const value = 'a' + i;
    const label = i18n.t('preftest.' + step.key + '.' + value);
    // i18n 缺键时会原样返回 key，这里挡掉，避免界面出现 preftest.q1.a9
    if (label && label.indexOf('preftest.') !== 0) list.push({ value, label });
  }
  list.push({ value: 'unsure', label: i18n.t('preftest.unsure') });
  return list;
}

/** 开场白 + 第一题 */
function buildOpening() {
  return [
    {
      role: 'bot',
      text: '你好，我是康康。帮你挑今天的菜，先问你几件小事，一分钟就够。',
    },
    {
      role: 'bot',
      text: STEPS[0].lead + titleOf(STEPS[0]),
      step: 0,
      options: optionsOf(STEPS[0]),
      multi: STEPS[0].multi,
    },
  ];
}

/** 第 n 题（答完上一题后由页面调用） */
function buildQuestion(index) {
  const step = STEPS[index];
  if (!step) return null;
  return {
    role: 'bot',
    text: step.lead + titleOf(step),
    step: index,
    options: optionsOf(step),
    multi: step.multi,
  };
}

/** 把用户选的 key 转成可读文案（对话里回显用） */
function labelsOf(answers, index) {
  const step = STEPS[index];
  if (!step) return [];
  const picked = answers[step.key];
  const keys = Array.isArray(picked) ? picked : picked ? [picked] : [];
  const map = {};
  optionsOf(step).forEach((o) => { map[o.value] = o.label; });
  return keys.map((k) => map[k]).filter(Boolean);
}

/**
 * 记录一题答案。
 * @returns {{ok:boolean, next:boolean, reason?:string, text?:string}}
 *   next=true 表示还有下一题；false 表示答完可以出结果了
 */
function recordAnswer(answers, index, values) {
  const step = STEPS[index];
  if (!step) return { ok: false, reason: 'BAD_STEP' };

  const picked = (Array.isArray(values) ? values : [values]).filter(Boolean);
  if (!picked.length) return { ok: false, reason: 'EMPTY' };

  if (!step.multi && picked.length > 1) return { ok: false, reason: 'SINGLE_ONLY' };

  if (step.multi) {
    answers[step.key] = picked.slice();
  } else {
    answers[step.key] = picked[0];
  }

  // 多选里勾了「都不回避」，其他项就不该留着——否则后面回避项过滤会把好菜全挡掉
  if (step.multi && picked.indexOf('a7') > -1 && step.key === 'q6') {
    answers[step.key] = ['a7'];
  }

  return { ok: true, next: index + 1 < STEPS.length };
}

/** 收完所有答案后的一句话总结（让用户知道 agent 记住了什么） */
function buildSummary(answers) {
  const parts = [];
  const q1 = labelsOf(answers, 0)[0];
  const q2 = labelsOf(answers, 1)[0];
  const q3 = labelsOf(answers, 2)[0];
  const q4 = labelsOf(answers, 3)[0];
  if (q1) parts.push(q1);
  if (q2) parts.push(q2);
  if (q3) parts.push(q3);
  if (q4) parts.push(q4);

  const taste = labelsOf(answers, 4);
  const avoid = labelsOf(answers, 5).filter((x) => x !== i18n.t('preftest.unsure'));

  let text = '好，我记下了';
  if (parts.length) text += '：' + parts.join('、');
  if (taste.length) text += '；口味偏' + taste.join('、');
  if (avoid.length) text += '；不吃' + avoid.join('、');
  text += '。';
  return text;
}

/** 答完的问题数量（用于进度显示） */
function answeredCount(answers) {
  return STEPS.filter((s) => {
    const v = answers[s.key];
    return Array.isArray(v) ? v.length > 0 : !!v;
  }).length;
}

function totalSteps() {
  return STEPS.length;
}

/** 交给 nutrition / 工作流的答案对象（与原生问卷格式一致） */
function toAnswers(answers) {
  return Object.assign({}, answers);
}

module.exports = {
  STEPS,
  buildOpening,
  buildQuestion,
  recordAnswer,
  buildSummary,
  labelsOf,
  answeredCount,
  totalSteps,
  toAnswers,
  titleOf,
  optionsOf,
};
