const qa = require('../../utils/qa');
const profileUtil = require('../../utils/profile');
const config = require('../../utils/config');

// ⚠️ 按你的工程改：菜品详情页 / 菜单页路径
const DETAIL_PAGE = config.RECIPE_DETAIL_PAGE || '/pages/recipe/recipe';
const MENU_PAGE = config.MENU_PAGE || '/pages/menu/menu';

const INTRO_KEY = 'qaIntroAgreed';

// 降级用的本地精简少吃表（与云函数 data/rules.json 的 tabooExpand 对齐，可自行补充）
const TABOO_EXPAND = {
  海鲜: ['虾', '蟹', '贝', '蚝', '蛤', '带子', '鱿鱼', '墨鱼', '紫菜', '海带', '海蜇', '鱼'],
  牛肉: ['牛肉', '牛腩', '牛丸', '肥牛'],
  羊肉: ['羊肉', '羊排'],
  猪肉: ['猪肉', '五花', '排骨', '瘦肉', '腊肉', '叉烧'],
  鸡肉: ['鸡'],
  鸭肉: ['鸭'],
  蛋: ['蛋'],
  奶: ['奶', '芝士', '黄油'],
  花生: ['花生'],
  坚果: ['核桃', '杏仁', '腰果', '芝麻', '松仁'],
  芒果: ['芒果'],
  香菜: ['香菜', '芫荽'],
  辛辣: ['辣', '椒', '咖喱'],
  生冷: ['刺身', '生腌', '鱼生', '凉拌'],
};

let seq = 0;
function uid(prefix) {
  seq += 1;
  return prefix + '_' + Date.now() + '_' + seq;
}

function expandTaboos(taboos) {
  const words = [];
  (taboos || []).forEach((t) => {
    const list = TABOO_EXPAND[t] || [t];
    list.forEach((w) => {
      if (words.indexOf(w) < 0) words.push(w);
    });
  });
  return words;
}

Page({
  data: {
    messages: [],
    input: '',
    sending: false,
    elderMode: false,
    canAsk: true,
    showIntro: false,
    scrollIntoView: '',
    chips: ['今天吃什么', '我的收藏怎么搭', '这个节气吃什么', '血压高能吃啥'],
  },

  onLoad(options) {
    const elderMode = profileUtil.elderModeOn();
    const introAgreed = !!wx.getStorageSync(INTRO_KEY);
    this.setData({
      elderMode,
      showIntro: !introAgreed,
      canAsk: qa.enabled(),
    });

    // 从菜品详情页带入菜名
    const dishName = options && options.name ? decodeURIComponent(options.name) : '';
    const preset = options && options.q ? decodeURIComponent(options.q) : '';

    if (!qa.enabled()) {
      this.pushMessage({
        role: 'assistant',
        text: 'AI 问答还没开通，先看看当令推荐吧。',
        degraded: true,
        dishes: this.localSeasonal(),
      });
      return;
    }

    if (preset) {
      this.send(preset);
    } else if (dishName) {
      this.send('这道「' + dishName + '」适合我吗？');
    } else {
      this.pushMessage({
        role: 'assistant',
        text: '我是康康，会按你的偏好、少吃和收藏帮你挑菜。想吃什么，直接问我。',
        followups: ['今天吃什么', '这个节气吃什么'],
      });
    }
  },

  onIntroAgree() {
    wx.setStorageSync(INTRO_KEY, true);
    this.setData({ showIntro: false });
  },

  onIntroClose() {
    this.setData({ showIntro: false });
    wx.navigateBack({ fail() {} });
  },

  /* ---------- 消息 ---------- */
  pushMessage(msg) {
    const messages = this.data.messages.slice();
    const item = Object.assign(
      { id: uid('m'), dishes: [], followups: [], sources: [], showSources: false, degraded: false },
      msg
    );
    messages.push(item);
    this.setData({ messages }, () => this.scrollToBottom(item.id));
    return item;
  },

  replaceMessage(id, msg) {
    const messages = this.data.messages.map((m) =>
      m.id === id
        ? Object.assign({}, m, { dishes: [], followups: [], sources: [], showSources: false }, msg)
        : m
    );
    this.setData({ messages }, () => this.scrollToBottom(id));
  },

  scrollToBottom(id) {
    this.setData({ scrollIntoView: 'm' + id });
  },

  /* ---------- 输入与发送 ---------- */
  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  onChip(e) {
    const q = e.currentTarget.dataset.q;
    if (q) this.send(q);
  },

  onSend() {
    const text = String(this.data.input || '').trim();
    if (!text) return;
    this.setData({ input: '' });
    this.send(text);
  },

  send(text) {
    if (!qa.enabled()) {
      wx.showToast({ title: '问答未开通', icon: 'none' });
      return;
    }
    if (this.data.sending) return;

    const question = String(text || '').trim().slice(0, 300);
    if (!question) return;

    const history = this.data.messages
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.text)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.text }));

    this.pushMessage({ role: 'user', text: question });
    const loading = this.pushMessage({ role: 'loading', text: '正在想…' });
    this.setData({ sending: true });

    const timer = setTimeout(() => {
      // 20s 前端兜底
      if (this.data.sending) {
        this.setData({ sending: false });
        this.replaceMessage(loading.id, {
          role: 'assistant',
          text: '等太久了，先给你几道当令菜。',
          degraded: true,
          dishes: this.localSeasonal(),
        });
      }
    }, 20000);

    qa.ask(question, history)
      .then((res) => {
        clearTimeout(timer);
        this.replaceMessage(loading.id, {
          role: 'assistant',
          text: res.reply || '',
          dishes: (res.dishes || []).map((d) =>
            Object.assign({}, d, { favorited: this.isFavorited(d.id) })
          ),
          followups: res.followups || [],
          sources: res.sources || [],
          degraded: !!(res.meta && res.meta.degraded),
          disclaimer: res.disclaimer || '',
        });
        this.saveToLocalHistory(question, res.reply);
      })
      .catch((err) => {
        clearTimeout(timer);
        const code = (err && err.code) || 'UNKNOWN';
        const text2 = (err && err.message) || qa.errorText(code);
        this.replaceMessage(loading.id, {
          role: 'assistant',
          text: text2,
          degraded: true,
          dishes: this.localSeasonal(),
          errorCode: code,
        });
      })
      .then(() => {
        this.setData({ sending: false });
      });
  },

  /* ---------- 本地降级：当令 3 道 ---------- */
  localSeasonal() {
    let recipes = [];
    try {
      recipes = require('../../data/recipes.js') || [];
    } catch (e) {
      return [];
    }
    const profile = profileUtil.build();
    const banned = expandTaboos(profile.taboos);
    const ok = (r) => {
      if (!r || !r.id) return false;
      if (String(r.evidence || '').toUpperCase().charAt(0) === 'C') return false;
      const pool = []
        .concat(r.mainIngredients || [])
        .concat(r.allergen || [])
        .concat([r.name || '']);
      return !pool.some((i) => banned.some((w) => String(i).indexOf(w) >= 0));
    };
    const term = profile.currentTerm;
    const seasonal = recipes.filter(
      (r) => ok(r) && (r.terms || []).some((t) => String(t).indexOf(term) >= 0)
    );
    const list = (seasonal.length ? seasonal : recipes.filter(ok)).slice(0, 3);
    return list.map((r) => ({
      id: r.id,
      name: r.name,
      cuisine: r.cuisine || '',
      reason: (r.terms || []).indexOf(term) >= 0 ? '当令食材，做法家常。' : '食材温和，做法简单。',
      favorited: this.isFavorited(r.id),
    }));
  },

  /* ---------- 菜品卡 ---------- */
  onOpenDish(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: DETAIL_PAGE + '?id=' + encodeURIComponent(id),
      fail: () => {
        wx.showToast({ title: '请先在 config 配置菜品详情页路径', icon: 'none' });
      },
    });
  },

  isFavorited(id) {
    try {
      const list = wx.getStorageSync('favoriteIds') || [];
      return Array.isArray(list) && list.indexOf(id) >= 0;
    } catch (e) {
      return false;
    }
  },

  onFav(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    let added = false;
    try {
      const favorite = require('../../utils/favorite.js');
      if (favorite && typeof favorite.toggle === 'function') {
        const r = favorite.toggle(id);
        added = r === true || (r && r.added === true);
      } else if (favorite && typeof favorite.add === 'function') {
        favorite.add(id);
        added = true;
      } else {
        throw new Error('no api');
      }
    } catch (err) {
      // 兜底：直接维护 Storage
      let list = wx.getStorageSync('favoriteIds') || [];
      if (!Array.isArray(list)) list = [];
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
      else {
        list.push(id);
        added = true;
      }
      wx.setStorageSync('favoriteIds', list);
    }
    const messages = this.data.messages.map((m) => {
      if (!m.dishes || !m.dishes.length) return m;
      return Object.assign({}, m, {
        dishes: m.dishes.map((d) => (d.id === id ? Object.assign({}, d, { favorited: added }) : d)),
      });
    });
    this.setData({ messages });
    wx.showToast({ title: added ? '已收藏' : '已取消收藏', icon: 'none' });
  },

  /* ---------- 来源 ---------- */
  onToggleSources(e) {
    const id = e.currentTarget.dataset.id;
    const messages = this.data.messages.map((m) =>
      m.id === id ? Object.assign({}, m, { showSources: !m.showSources }) : m
    );
    this.setData({ messages });
  },

  onOpenSource(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '链接已复制', icon: 'none' }),
    });
  },

  /* ---------- 本地历史 ---------- */
  saveToLocalHistory(question, reply) {
    const list = qa.loadHistory();
    list.push({ q: question, a: reply, t: Date.now() });
    qa.saveHistory(list);
  },

  onClear() {
    wx.showModal({
      title: '清空对话',
      content: '会清空本机保存的问答记录，确定吗？',
      success: (res) => {
        if (!res.confirm) return;
        qa.clearHistory();
        this.setData({ messages: [] });
        this.pushMessage({
          role: 'assistant',
          text: '已经清空了，重新开始吧。',
          followups: ['今天吃什么', '我的收藏怎么搭'],
        });
      },
    });
  },

  onGoMenu() {
    wx.navigateTo({
      url: MENU_PAGE,
      fail: () => wx.switchTab({ url: MENU_PAGE, fail() {} }),
    });
  },
});
