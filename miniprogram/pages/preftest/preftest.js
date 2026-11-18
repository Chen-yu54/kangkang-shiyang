// pages/preftest/preftest.js —— 饮食偏好小测试
//
// 两段式：前置同意页（三个开关默认全关）→ 5 题单选。
//   选中后 500ms 自动跳下一题；可返回上一题；每题都有「不清楚」选项。
//
// 三个开关的语义（按线框稿定稿）：
//   记录我的选择   —— 存不存答案 + 埋点总闸
//   按偏好推荐菜品 —— 推荐页是否使用偏好
//   接收节气提醒   —— 本期未开放，开关置灰不可操作

const track = require('../../utils/track');
const i18n = require('../../utils/i18n');

const t = i18n.t;
const ANSWERS_KEY = 'prefAnswers';
const SWITCH_KEY = 'preftestSwitches';
const AUTO_NEXT_DELAY = 500;

// 6 道题：来自《康康食养AI · 饮食与日常感受问卷原文（11 题完整版）》的 Q1/Q3/Q4/Q5/Q10/Q11。
// count = 该题选项数（不含「不清楚」）；multiple = 多选题（选完不自动跳，需点「下一题」）。
const QUESTIONS_META = [
  { key: 'q1', count: 4, multiple: false }, // 怕冷还是怕热
  { key: 'q2', count: 4, multiple: false }, // 容易出汗吗
  { key: 'q3', count: 4, multiple: false }, // 平时口干吗
  { key: 'q4', count: 4, multiple: false }, // 大便通常什么样
  { key: 'q5', count: 6, multiple: true }, // 口味偏好（多选）
  { key: 'q6', count: 7, multiple: true }, // 需要回避的食物（多选）
];

function buildQuestions() {
  return QUESTIONS_META.map((meta) => {
    const options = [];
    for (let i = 1; i <= meta.count; i += 1) {
      options.push({ value: 'a' + i, label: t(`preftest.${meta.key}.a${i}`), on: false });
    }
    // 单选题每题都能选「不清楚」，不允许被逼着作答；
    // 多选题原卷自带「没有特别偏好 / 都不回避」作兜底，不再追加。
    if (!meta.multiple) {
      options.push({ value: 'unsure', label: t('preftest.unsure'), on: false });
    }
    return {
      key: meta.key,
      title: t(`preftest.${meta.key}.title`),
      multiple: meta.multiple,
      multipleHint: meta.multiple ? t(`preftest.${meta.key}.multiple`) : '',
      options,
    };
  });
}

// 开关默认全关，读到的旧值也只在明确为 true 时才视为开启
function readSwitches() {
  const stored = wx.getStorageSync(SWITCH_KEY);
  const v = stored && typeof stored === 'object' ? stored : {};
  return {
    record: v.record === true,
    recommend: v.recommend === true,
    remind: false, // 本期未开放，不读取旧值也不允许打开
  };
}

Page({
  data: {
    pageStyle: '',
    showIntro: true,
    switches: { record: false, recommend: false, remind: false },
    step: 0,
    total: 6,
    questions: [],
    answers: {},
    selected: [],
    curOptions: [],
    progressText: '',
    copy: {},
  },

  onLoad() {
    const questions = buildQuestions();
    this.setData({
      questions,
      total: questions.length,
      switches: readSwitches(),
      // 首题必须自带选项：curOptions 初值是空数组，不在这里填就不会渲染出选项
      curOptions: this.markOptions(questions[0], []),
      progressText: i18n.tpl('preftest.progress', { current: 1, total: questions.length }),
      copy: {
        intro: t('preftest.intro'),
        introTitle: t('preftest.introTitle'),
        introDesc: t('preftest.introDesc'),
        switchRecord: t('preftest.switchRecord'),
        switchRecordDesc: t('preftest.switchRecordDesc'),
        switchRecommend: t('preftest.switchRecommend'),
        switchRecommendDesc: t('preftest.switchRecommendDesc'),
        switchRemind: t('preftest.switchRemind'),
        switchRemindDesc: t('preftest.switchRemindDesc'),
        switchHint: t('preftest.switchHint'),
        start: t('preftest.start'),
        prev: t('preftest.prev'),
        // 多选题的推进按钮文案：漏取会让按钮渲染成一块无字的实心色块
        next: t('preftest.next'),
        finish: t('preftest.finish'),
        pickAtLeastOne: t('preftest.pickAtLeastOne'),
        // 测试页用独立声明：线框稿原句含脱敏词，已换成合规表述
        disclaimer: t('preftest.disclaimer'),
      },
    });
    track.pageView('preftest');
  },

  onShow() {
    this.setData({ pageStyle: getApp().getFontStyle() });
  },

  onUnload() {
    this.clearTimer();
  },

  // —— 前置同意页 ——

  onSwitchChange(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === 'remind') return; // remind 本期不开放

    const switches = Object.assign({}, this.data.switches);
    switches[key] = e.detail.value === true;
    wx.setStorageSync(SWITCH_KEY, { record: switches.record, recommend: switches.recommend });

    // 「记录我的选择」同时是埋点总闸：打开才采，关闭立即停采
    if (key === 'record') track.setConsent(switches.record);

    this.setData({ switches });
  },

  onStart() {
    // 前置页只是告知与授权，不改题目本身；关闭后进入第一题
    this.setData({ showIntro: false });
  },

  // —— 答题 ——

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  },

  goStep(step) {
    const question = this.data.questions[step];
    const saved = this.data.answers[question.key];
    // 已答过的题回退时要还原选中态：单选存字符串，多选存数组
    const selected = Array.isArray(saved) ? saved.slice() : saved ? [saved] : [];
    this.setData({
      step,
      selected,
      curOptions: this.markOptions(question, selected),
      progressText: i18n.tpl('preftest.progress', { current: step + 1, total: this.data.total }),
    });
  },

  // 把「哪些选项被选中」算进选项本身，避免在 WXML 里做数组查找
  markOptions(question, selected) {
    return (question.options || []).map((o) =>
      Object.assign({}, o, { on: selected.indexOf(o.value) > -1 })
    );
  },

  onSelect(e) {
    const value = e.currentTarget.dataset.value;
    if (!value) return;

    this.clearTimer();

    const question = this.data.questions[this.data.step];
    const answers = Object.assign({}, this.data.answers);

    if (question.multiple) {
      // 多选：切换选中态，不自动跳题，由「下一题」推进
      const selected = this.data.selected.slice();
      const at = selected.indexOf(value);
      if (at > -1) selected.splice(at, 1);
      else selected.push(value);
      answers[question.key] = selected;
      this.setData({ answers, selected, curOptions: this.markOptions(question, selected) });
      return;
    }

    answers[question.key] = value;
    this.setData({
      answers,
      selected: [value],
      curOptions: this.markOptions(question, [value]),
    });

    // 单选题选中后 500ms 自动进下一题；最后一题则直接进入结果
    this.timer = setTimeout(() => {
      this.timer = null;
      this.advance();
    }, AUTO_NEXT_DELAY);
  },

  // 多选题的「下一题 / 完成」按钮
  onNext() {
    if (!this.data.selected.length) {
      wx.showToast({ title: this.data.copy.pickAtLeastOne, icon: 'none' });
      return;
    }
    this.clearTimer();
    this.advance();
  },

  advance() {
    if (this.data.step < this.data.total - 1) {
      this.goStep(this.data.step + 1);
      return;
    }
    this.submit();
  },

  onPrev() {
    if (this.data.step === 0) return;
    this.clearTimer();
    this.goStep(this.data.step - 1);
  },

  // 只有用户同意「记录我的选择」才落盘；不同意则本次答案不保存，直接返回
  submit() {
    this.clearTimer();

    if (!this.data.switches.record) {
      wx.showToast({ title: t('preftest.notSaved'), icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    wx.setStorageSync(ANSWERS_KEY, this.data.answers);
    // 交卷就回专属推荐：推演不另开页，回到那一页由 onShow 接着演六步、转圈、出食单。
    // 留一个标记，避免「只是切了个 tab 也开始推演」。
    const app = getApp();
    if (app.globalData) app.globalData.autoRunGen = true;
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/menu/menu' });
  },
});
