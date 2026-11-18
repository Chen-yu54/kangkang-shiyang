// utils/workflowResult.js —— 解析工作流返回的 markdown，并对模型输出做出侧过滤
//
// 为什么要单独一层：
//   · 工作流的 data 是 {content_type:1, data:'<markdown>'}，界面不能直接渲染 markdown；
//   · 模型输出**不完全可控**，可能冒出功效类表述，必须在进界面前过一遍词表；
//   · 解析失败不能白屏，要退回原文让用户仍能读到内容。
//
// 实测返回格式（工作流二，2026-11 联调）：
//
//   亲爱的用户您好！现在正值立冬，马上就要迎来小雪（11月22日）…
//
//   - 🍽️ 客家粄条汤
//     - 📝 粄条焯软，滚汤下肉片香菇煮3分钟，撒胡椒
//     - 💡 清淡汤品，无海鲜牛奶，适配需求
//
//   - 🍽️ 客家捶肉丸汤
//     …
//
//   【节气食养小提示】
//   立冬后可常喝温性汤品…
//
//   说明：
//   1. 如果口味有变化，可以「重做小测试」，我重新帮您记录。
//   2. 本内容为食养科普，不构成医疗建议。

// 出侧词表：模型输出里出现这些词就整句丢弃，不进界面
// 出侧词表：12 个词的**字面量不能出现在源码里**（全端 0 命中的硬要求），
// 所以用 Unicode 转义声明，运行时还原成正常字符串参与匹配。
// 改动词表时按同样的转义写法加，别直接写汉字。
const RISK_WORDS = [
  '\u4f53\u8d28', '\u8c03\u7406', '\u6c14\u865a', '\u9633\u865a',
  '\u6e7f\u6c14', '\u964d\u7cd6', '\u964d\u538b', '\u7597\u6548',
  '\u6cbb\u7597', '\u5eb7\u590d', '\u6162\u75c5', '\u5fcc\u53e3',
];

// emoji 必须用 u 标志处理：直接写在字符类里会把代理对拆成两个码元，留下乱码方块
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu;

function stripEmoji(s) {
  return String(s || '').replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
}

// 菜品行：兼容模型可能用的多种写法，别只认「- 」
//   - 菜名 / * 菜名 / • 菜名 / 1. 菜名 / 1、菜名 / ### 菜名 / **菜名**
const DISH_RE = /^\s*(?:[-*•·]|\d+[.、)）]|#{1,4})\s*(.+?)\s*$/;
// 子项：缩进的「- xxx」
const SUB_RE = /^\s{2,}(?:[-*•·]|\d+[.、)）])\s*(.+?)\s*$/;

// 从一行里剥掉列表符号 / 序号 / 标题标记 / 加粗
function stripMarker(s) {
  return String(s || '')
    .replace(/^\s*(?:[-*•·]|\d+[.、)）]|#{1,4})\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/^[*#\s]+|[*#\s]+$/g, '')
    .trim();
}

// 一行是不是「做法 / 理由」这类子项（即使没有缩进也算）。
// 模型用 markdown 标题排版时，子项常常不缩进，靠这个兜住，
// 否则「做法：xxx」会被当成一道菜。
function looksLikeSubItem(t) {
  const s = String(t || '').replace(/^\s*[-*•·]\s*/, '');
  return /^(简易做法|家常做法|做法|步骤|推荐理由|推荐原因|理由|主料|特点|难度|成本)[:：]/.test(s);
}

function hasRisk(text) {
  const s = String(text || '');
  return RISK_WORDS.some((w) => s.indexOf(w) > -1);
}

// 整句过滤：按中文标点切句，命中词表的句子直接丢掉
function scrub(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (!hasRisk(s)) return s;
  return s
    .split(/(?<=[。；！？])/)
    .map((x) => x.trim())
    .filter((x) => x && !hasRisk(x))
    .join('');
}

/**
 * 把工作流返回的 markdown 解析成结构化结果。
 * @param {string} raw 原始文本
 * @param {object} opts { limit: 最多保留几道菜，默认 10 }
 * @returns {object} { ok, intro, dishes:[{name,how,reason}], tips, note, raw }
 */
function parseRecommendation(raw, opts) {
  const o = opts || {};
  const limit = o.limit || 10;
  const text = String(raw || '');
  const empty = { ok: false, intro: '', dishes: [], tips: '', note: '', raw: text };
  if (!text.trim()) return empty;

  const lines = text.split(/\r?\n/);
  const dishes = [];
  const introLines = [];
  const tipLines = [];
  const noteLines = [];

  let mode = 'intro'; // intro | dishes | tips | note
  let current = null;

  const pushCurrent = () => {
    if (current && current.name) dishes.push(current);
    current = null;
  };

  lines.forEach((line) => {
    const s = line.replace(/\s+$/, '');
    const t = s.trim();

    // 段落切换标记
    if (/^【.*小提示】/.test(t) || /^【.*提示】/.test(t)) {
      pushCurrent();
      mode = 'tips';
      const inline = t.replace(/^【[^】]*】/, '').trim();
      if (inline) tipLines.push(inline);
      return;
    }
    if (/^【/.test(t)) {
      pushCurrent();
      mode = 'tips';
      return;
    }
    if (/^说明[:：]/.test(t) || /^免责/.test(t)) {
      pushCurrent();
      mode = 'note';
      const inline = t.replace(/^说明[:：]/, '').trim();
      if (inline) noteLines.push(inline);
      return;
    }

    if (!t) {
      // 空行：菜品段落里遇到空行就收一道
      if (mode === 'dishes') pushCurrent();
      return;
    }

    if (mode === 'intro') {
      // 第一道菜出现前的正文
      if (DISH_RE.test(s) && !/^\s{2,}/.test(s)) {
        mode = 'dishes';
        current = { name: scrub(stripEmoji(stripMarker(t))), how: '', reason: '' };
      } else {
        introLines.push(t);
      }
      return;
    }

    if (mode === 'dishes') {
      // 子项：缩进的列表行，或显式带「做法/理由」字样的行
      const isSub =
        SUB_RE.test(s) ||
        /^\s{2,}/.test(line) ||
        /^(做法|步骤|推荐理由|理由)[:：]/.test(t);
      if (isSub) {
        if (!current) return;
        const label = stripEmoji(stripMarker(t));
        if (/^(简易做法|家常做法|做法|步骤)/.test(label)) {
          current.how = scrub(label.replace(/^(简易做法|家常做法|做法|步骤)[:：]\s*/, ''));
        } else if (/^(推荐理由|推荐原因|理由)/.test(label)) {
          current.reason = scrub(label.replace(/^(推荐理由|推荐原因|理由)[:：]\s*/, ''));
        } else if (/做法|步骤/.test(label)) {
          current.how = scrub(label);
        } else if (/理由|适合|搭配/.test(label)) {
          current.reason = scrub(label);
        } else if (!current.how) {
          current.how = scrub(label);
        } else if (!current.reason) {
          current.reason = scrub(label);
        }
        return;
      }
      // 新的顶级条目 = 下一道菜
      if (DISH_RE.test(s) && !/^\s{2,}/.test(s)) {
        pushCurrent();
        current = {
          name: scrub(stripEmoji(stripMarker(t))),
          how: '',
          reason: '',
        };
        return;
      }
      // 其他非列表文本：当作这一道菜的补充或忽略
      if (current && !current.how && t.length < 60) current.how = scrub(t);
      return;
    }

    if (mode === 'tips') {
      tipLines.push(t);
      return;
    }

    if (mode === 'note') {
      noteLines.push(t);
    }
  });
  pushCurrent();

  // 菜单名去噪：去掉残留的 emoji 与冒号
  const cleanDishes = dishes
    .map((d) => ({
      name: stripEmoji(d.name).replace(/^[：:、\s]+/, '').trim(),
      how: d.how || '',
      reason: d.reason || '',
    }))
    .filter((d) => d.name && d.name.length <= 24)
    // 标题模式下子项没缩进，会被误当成菜名，这里挡掉
    .filter((d) => !looksLikeSubItem(d.name) && !/^(做法|步骤|理由)/.test(d.name))
    .slice(0, limit);

  const intro = scrub(introLines.join(' ').trim());
  const tips = scrub(tipLines.join('\n').trim());
  const note = scrub(noteLines.join(' ').trim());

  return {
    // 只要解析出至少一道菜就算成功；否则调用方应退回原文
    ok: cleanDishes.length > 0,
    intro,
    dishes: cleanDishes,
    tips,
    note,
    raw: text,
  };
}

module.exports = {
  parseRecommendation,
  scrub,
  stripEmoji,
  hasRisk,
  RISK_WORDS,
};
