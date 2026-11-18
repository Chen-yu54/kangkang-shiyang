// 康康对话 —— 连扣子 Bot 的自由问答页
//
// 与 pages/agent 的区别：
//   pages/agent  脚本化问卷（点选项，固定 6 题，最后调**工作流**出菜）
//   pages/aichat 自由对话（打字，连**Bot**，多轮上下文）
//
// 两条后端链路完全不同：
//   工作流 POST /v1/workflow/run  同步，一次给结果
//   Bot    POST /v3/chat          异步三跳，云函数内部轮询
//
// 页面职责：只管消息展示与发送，三跳逻辑全在云函数 aichat 里。

const aichat = require('../../utils/aichat');
const cfg = require('../../utils/config');

const OPENING = '你好，我是康康。想吃什么、有什么拿不准的，都可以问我。';

Page({
  data: {
    pageStyle: '',
    copy: {},
    messages: [],
    inputText: '',
    sending: false,
    // 首屏是否给几个常用问法（点一下就能发）
    quick: [],
    scrollTo: '',
    inputBottom: 0,
  },

  onLoad() {
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
        title: t('chat.title'),
        subtitle: t('chat.subtitle'),
        placeholder: t('chat.placeholder'),
        send: t('chat.send'),
        clear: t('chat.clear'),
        thinking: t('chat.thinking'),
        back: t('chat.back'),
        clearConfirmTitle: t('chat.clearConfirmTitle'),
        clearConfirmBody: t('chat.clearConfirmBody'),
        clearDone: t('chat.clearDone'),
      },
      quick: [
        t('chat.q1'),
        t('chat.q2'),
        t('chat.q3'),
        t('chat.q4'),
      ],
    });

    // 恢复本地历史；没有就给一句开场白
    const history = aichat.readHistory();
    const messages = history.length
      ? history.map((m) => ({ role: m.role, text: m.text }))
      : [{ role: 'bot', text: OPENING }];

    this.setData({ messages }, () => this.scrollToBottom());
  },

  onInput(e) {
    this.setData({ inputText: (e.detail && e.detail.value) || '' });
  },

  onSend() {
    const text = String(this.data.inputText || '').trim();
    if (!text || this.data.sending) return;
    this.sendQuestion(text);
  },

  onQuick(e) {
    const text = e.currentTarget.dataset.text || '';
    if (!text || this.data.sending) return;
    this.sendQuestion(text);
  },

  /** 发送一句话 */
  sendQuestion(text) {
    const messages = this.data.messages.concat([{ role: 'me', text }]);
    this.setData({ messages, inputText: '', sending: true }, () => this.scrollToBottom());

    aichat
      .ask(text, { conversationId: this.conversationId || '' })
      .then((r) => {
        // 记住会话 id，后续轮次 Bot 才记得上下文
        if (r.conversationId) this.conversationId = r.conversationId;

        const next = this.data.messages.concat([{ role: 'bot', text: r.reply }]);
        this.setData({ messages: next, sending: false }, () => this.scrollToBottom());

        aichat.appendHistory({ role: 'me', text });
        aichat.appendHistory({ role: 'bot', text: r.reply });
      })
      .catch((err) => {
        // 失败如实说，不伪造回复
        const next = this.data.messages.concat([
          { role: 'bot', text: aichat.explain(err), isError: true },
        ]);
        this.setData({ messages: next, sending: false }, () => this.scrollToBottom());
      });
  },

  scrollToBottom() {
    const n = this.data.messages.length;
    this.setData({ scrollTo: 'm' + Math.max(0, n - 1) });
  },

  onClear() {
    wx.showModal({
      title: this.data.copy.clearConfirmTitle,
      content: this.data.copy.clearConfirmBody,
      confirmText: this.data.copy.clear,
      cancelText: t('common.cancel'),
      success: (res) => {
        if (!res.confirm) return;
        aichat.clearHistory();
        this.conversationId = '';
        this.setData(
          { messages: [{ role: 'bot', text: OPENING }] },
          () => this.scrollToBottom()
        );
        wx.showToast({ title: this.data.copy.clearDone, icon: 'none' });
      },
    });
  },

  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/index/index' });
  },
});
