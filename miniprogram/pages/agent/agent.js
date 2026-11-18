// 问问康康 —— 对话式问卷 + 推荐页
//
// 定位：把「填 6 道题」换成「跟康康聊几句」，答完直接出菜。
// 与 pages/menu 的区别：menu 是「先问卷、再推演动画、再出菜」的完整流程；
// 这里只保留对话，适合从首页一键进入、也适合第一次用的人。
//
// 后端两条路：
//   ① 本地推荐（nutrition.buildRecommendation）—— 即时、离线可用
//   ② 扣子工作流（api.runWorkflow）—— 可达时覆盖，20 秒左右
// 两条都给结果时，模型优先；模型失败就如实说明并保留本地结果。

const i18n = require('../../utils/i18n');
const format = require('../../utils/format');
const nutrition = require('../../utils/nutrition');
const dataSource = require('../../utils/dataSource');
const agentChat = require('../../utils/agentChat');
const api = require('../../utils/api');
const workflowResult = require('../../utils/workflowResult');
const cfg = require('../../utils/config');
const consent = require('../../utils/consent');
const track = require('../../utils/track');

const WORKFLOW_NAME = (cfg.WORKFLOW_ALIAS && cfg.WORKFLOW_ALIAS.recommend) || 'seasonal_recipe';
const STORAGE_ANSWERS = 'prefAnswers';
const STORAGE_HISTORY = 'agentHistory';

Page({
  data: {
    pageStyle: '', // page-meta 用它注入字号变量
    copy: {},
    messages: [],
    // ask 答题中 | think 出菜中 | result 已出结果
    stage: 'ask',
    step: 0,
    answers: {},
    // 当前题的可选项 / 多选状态 / 已勾选
    curOptions: [],
    curMulti: false,
    picked: [],
    progressText: '',
    dishes: [],
    // 模型是否参与（false 时界面要说明是本地推荐）
    engineNote: '',
    canSend: false,
    inputText: '',
  },

  onLoad() {
    // 字号变量：和其他页面一致，从 app 取
    let style = '';
    try {
      const app = getApp();
      if (app && typeof app.getPageStyle === 'function') style = app.getPageStyle();
    } catch (e) {
      style = '';
    }

    this.setData({
      pageStyle: style,
      copy: {
        title: t('qa.title'),
        subtitle: t('qa.subtitle'),
        thinking: t('qa.thinking'),
        next: t('qa.next'),
        localNote: t('qa.localNote'),
        modelNote: t('qa.modelNote'),
        modelFail: t('qa.modelFail'),
        goDetail: t('qa.goDetail'),
        restart: t('qa.restart'),
        multiHint: t('qa.multiHint'),
        you: t('qa.you'),
        noLocal: t('qa.noLocal'),
        noDetail: t('qa.noDetail'),
      },
    });

    const opening = agentChat.buildOpening();
    const first = opening[1];
    this.setData({
      messages: opening,
      step: 0,
      curOptions: first.options,
      curMulti: first.multi,
      picked: [],
      progressText: i18n.tpl('agent.progress', { current: 1, total: agentChat.totalSteps() }),
    });
    track.pageView('agent');
  },

  /** 点某个选项 */
  onTapOption(e) {
    if (this.data.stage !== 'ask') return;
    const value = e.currentTarget.dataset.value;
    if (!value) return;

    if (this.data.curMulti) {
      // 多选：只切换勾选，等用户点「下一题」
      const picked = this.data.picked.slice();
      const at = picked.indexOf(value);
      if (at > -1) picked.splice(at, 1);
      else picked.push(value);
      this.setData({ picked });
      return;
    }

    // 单选：点了就进下一题
    this.commitAnswer([value]);
  },

  /** 多选时点「下一题」 */
  onNextStep() {
    if (this.data.stage !== 'ask') return;
    const picked = this.data.picked;
    if (!picked.length) {
      wx.showToast({ title: t('qa.needPick'), icon: 'none' });
      return;
    }
    this.commitAnswer(picked);
  },

  /** 记答案 → 回显 → 下一题 或 出结果 */
  commitAnswer(values) {
    const answers = Object.assign({}, this.data.answers);
    const index = this.data.step;
    const r = agentChat.recordAnswer(answers, index, values);

    if (!r.ok) {
      wx.showToast({ title: t('qa.needPick'), icon: 'none' });
      return;
    }

    // 1) 把用户的选择作为一条消息回显
    const labels = agentChat.labelsOf(answers, index);
    const messages = this.data.messages.concat([{ role: 'me', text: labels.join('、') }]);

    if (r.next) {
      // 2) 还有下一题
      const q = agentChat.buildQuestion(index + 1);
      messages.push(q);
      this.setData({
        messages,
        answers,
        step: index + 1,
        curOptions: q.options,
        curMulti: q.multi,
        picked: [],
        progressText: i18n.tpl('agent.progress', {
          current: index + 2,
          total: agentChat.totalSteps(),
        }),
      });
      return;
    }

    // 3) 答完 → 总结 + 出菜
    messages.push({ role: 'bot', text: agentChat.buildSummary(answers) });
    this.setData({
      messages,
      answers,
      stage: 'think',
      curOptions: [],
      curMulti: false,
      picked: [],
      progressText: '',
      canSend: false,
    });

    // 存一份到本地，和原生问卷共用同一个 key，两条入口的画像不会打架
    try {
      wx.setStorageSync(STORAGE_ANSWERS, answers);
    } catch (e) { /* 存不下也不影响当前流程 */ }

    this.startRecommend(answers);
  },

  /** 出菜：先本地，再尝试模型 */
  startRecommend(answers) {
    const local = nutrition.buildRecommendation(answers, { limit: 3 });
    const localDishes = this.decorate(local.dishes || []);

    // 先亮本地结果，避免空等
    this.setData({
      stage: 'result',
      dishes: localDishes,
      engineNote: t('qa.localNote'),
      messages: this.data.messages.concat([
        { role: 'bot', text: t('qa.pickLocal'), dishes: localDishes, from: 'local' },
      ]),
    });

    // 引擎不可达就不发请求，如实标本地
    const ready = !!(cfg.CLOUD_ENV && typeof wx !== 'undefined' && wx.cloud);
    if (!ready) return;

    this.fetchModel(answers, localDishes);
  },

  fetchModel(answers, localDishes) {
    const params = nutrition.toWorkflowParams(answers);
    api
      .runWorkflow(WORKFLOW_NAME, params)
      .then((data) => {
        const text = api.pickWorkflowText(data);
        const parsed = workflowResult.parseRecommendation(text, { limit: 10 });
        if (!parsed.ok || !parsed.dishes.length) throw new Error('PARSE_FAILED');

        const dishes = this.decorate(parsed.dishes);
        if (!dishes.length) throw new Error('NO_DISH');

        // 模型结果替换掉本地那条，不并列两套菜
        const messages = this.data.messages.map((m) =>
          m.from === 'local' ? Object.assign({}, m, { hidden: true }) : m
        );
        messages.push({
          role: 'bot',
          text: parsed.intro || t('qa.pickModel'),
          dishes,
          from: 'model',
        });

        this.setData({
          messages,
          dishes,
          engineNote: t('qa.modelNote'),
        });

        // 用户同意分享时，把这一轮推荐记下来（不传任何身份信息）
        consent
          .submit({
            termName: this.data.currentTerm || '',
            taste: nutrition.tasteLabels(answers),
            avoid: nutrition.avoidLabels(answers),
            dishes: dishes.map((d) => d.name),
          })
          .catch(() => {});
      })
      .catch((e) => {
        const reason = (e && (e.message || e.bizMsg || e.code)) || '';
        this.setData({
          messages: this.data.messages.concat([
            { role: 'bot', text: t('qa.modelFail') + (reason ? '（' + reason + '）' : '') },
          ]),
        });
      });
  },

  /** 把菜谱对象转成界面可用字段（字段在 JS 里算好，WXML 不做函数调用） */
  decorate(list) {
    return (list || []).map((d, i) => {
      const hit = this.matchRecipe(d.name);
      const name = d.name || (hit && hit.name) || '';
      return {
        key: (hit && hit.id) || 'm' + i,
        id: (hit && hit.id) || '',
        name,
        cuisineName: (hit && (hit.cuisineName || hit.cuisine)) || '',
        difficultyText: hit && hit.difficulty ? format.difficultyLabel(hit.difficulty) : '',
        costText: hit && hit.costLevel ? format.costLabel(hit.costLevel) : '',
        howText: d.how || (hit && hit.how) || '',
        whyText: d.reason || '',
        matched: !!hit,
      };
    });
  },

  /** 按菜名找本地菜谱：去菜系前缀 + 互相包含 */
  matchRecipe(name) {
    const n = String(name || '').replace(/^\s*(广府|潮汕|客家|岭南)[菜式]?/, '').trim();
    if (!n) return null;
    const all = dataSource.getRecipes({}) || [];
    return (
      all.filter((r) => {
        const rn = String(r.name || '');
        if (!rn) return false;
        if (rn === n) return true;
        if (n.length < 3 || rn.length < 3) return false;
        return rn.indexOf(n) > -1 || n.indexOf(rn) > -1;
      })[0] || null
    );
  },

  /** 点菜品卡 */
  onTapDish(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      wx.showToast({ title: t('qa.noDetail'), icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  /** 重来一遍 */
  onRestart() {
    this.onLoad();
  },

  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/menu/menu' });
  },
});
