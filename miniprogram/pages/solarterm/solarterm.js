// pages/solarterm/solarterm.js —— 节气页（列表 → 详情在一页内完成）
//
// 两个视图共用一页：
//   view = 'list'   → 24 节气列表，当前节气高亮
//   view = 'detail' → 节气详情：文化简介 + 当令食材 + 按早/中/晚分的当令菜品
//
// 餐次说明：知识库没有「餐次」字段，mealHints 由做法推断（煮/蒸→三餐，炒/炖/煲等→午晚），
// 属建议而非数据标注，界面必须写明「按做法建议」。等 A 补 meal_time 后改读真值。

const api = require('../../utils/api');
const config = require('../../utils/config');
const dataSource = require('../../utils/dataSource');
const favorite = require('../../utils/favorite');
const format = require('../../utils/format');
const share = require('../../utils/share');
const solarTheme = require('../../utils/solarTheme');
const seasonalBg = require('../../utils/seasonalBg');
const termHealth = require('../../data/termHealth');
const track = require('../../utils/track');
const i18n = require('../../utils/i18n');

const t = i18n.t;
const ALL_MEAL = '';

/**
 * 安全解码页面参数里的节气名。
 *
 * decodeURIComponent 遇到不合法的 % 序列会抛 URIError，
 * 放在 onLoad 里裸调，一旦参数不干净整页就初始化失败：
 * setData 不执行、loadTerms 不跑，页面停在骨架屏，看着就是「加载不出来」。
 *
 * 顺序：先按常规解一次；解不出就用原串；如果结果里还带 %，说明是双重编码，再解一次。
 */
function decodeTermParam(raw) {
  if (!raw) return '';
  let s = String(raw);
  for (let i = 0; i < 2; i++) {
    if (s.indexOf('%') < 0) break;
    try {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    } catch (e) {
      // 非法 % 序列：保留上一次能读的结果，不抛
      break;
    }
  }
  return s.trim();
}

function toCard(dish) {
  return {
    id: dish.id,
    name: dish.name,
    cuisineName: dish.cuisineName,
    cuisine: dish.cuisine,
    termText: (dish.terms || []).join(' · '),
    how: dish.how,
    difficultyText: format.difficultyLabel(dish.difficulty),
    costText: format.costLabel(dish.costLevel),
    image: dish.image,
    faved: favorite.has(dish.id),
    mealText: (dish.mealHints || []).join(' · '),
  };
}

Page({
  data: {
    pageStyle: '',
    view: 'list',
    status: 'loading', // 列表态：loading | ready | empty | error
    loadError: '', // 加载失败的具体原因，显示到界面上便于定位
    dishStatus: 'loading', // 详情菜品态：loading | ready | empty | error
    terms: [],
    currentName: '',
    detail: null,
    detailPoster: '',
    dishes: [], // 当前餐次筛选后的列表
    allDishes: [], // 全部当令菜品（按 id 命中餐次用）
    mealFilter: ALL_MEAL,
    mealTabs: [],
    emptyMealText: '',
    sharing: false,
    copy: {},
    // —— 节气动态背景（详情视图才有；来自节气材料包 seasonalBg，六层渲染）
    bg: null, // { style, glowStyle, overlayStyle, texture, particles, elements }
    health: null, // 养生提醒（data/termHealth.js：气候 + 今天/吃什么/起居）
  },

  onLoad(options) {
    // 首页的节气海报带 term 进来：直接进详情，省掉一次列表点击
    //
    // decodeURIComponent 不能裸调：参数里只要有一个不合法的 % 序列（比如 %E7
    // 被截断、或手写链接带了孤立的 %），它会抛 URIError，onLoad 当场中断，
    // 后面的 setData / loadTerms 全都不执行 —— 页面就停在初始态，看着像「加载不出来」。
    // 这里做两级兜底：先安全解码，解不出来就用原串；再对可能的双重编码补一次。
    // 只要 URL 上出现了 term 这个键（哪怕值是空的），就说明是「来看某个节气」的，
    // 后面必须落到详情，不能退化成列表。用 in 判断而不是取值判断，
    // 是为了区分「没带参数」和「带了但解不出来」两种情况。
    this.hasTermParam = !!(options && 'term' in options);
    this.pendingTerm = decodeTermParam(options && options.term);
    this.setData({
      copy: {
        empty: t('solarterm.empty'),
        detailEmpty: t('solarterm.detailEmpty'),
        ingredients: t('solarterm.ingredients'),
        dishes: t('solarterm.dishes'),
        intro: t('solarterm.intro'),
        culture: t('solarterm.culture'),
        cultureNote: t('solarterm.cultureNote'),
        phenology: t('solarterm.phenology'),
        phenologyHint: t('solarterm.phenologyHint'),
        folk: t('solarterm.folk'),
        folkConfidence: t('solarterm.folkConfidence'),
        ingredientHint: t('solarterm.ingredientHint'),
        mealHint: t('solarterm.mealHint'),
        mealEmpty: t('solarterm.mealEmpty'),
        all: t('common.all'),
        error: t('home.error'),
        retry: t('common.retry'),
        shareLongImage: t('solarterm.shareLongImage'),
        healthTitle: t('solarterm.healthTitle'),
        healthNote: t('solarterm.healthNote'),
        generating: t('share.generating'),
        saved: t('share.saved'),
        saveFailed: t('share.failed'),
      },
      mealTabs: [
        { key: ALL_MEAL, label: t('common.all') },
        { key: '早', label: t('solarterm.mealMorning') },
        { key: '午', label: t('solarterm.mealNoon') },
        { key: '晚', label: t('solarterm.mealNight') },
      ],
    });
    this.loadTerms();
    track.pageView('solarterm');
  },

  onShow() {
    this.setData({ pageStyle: getApp().getFontStyle() });
  },

  loadTerms() {
    // local 通道下节气数据就在包里，dataSource.getTerms() 是同步函数。
    // 原来绕了一层 Promise.resolve()，一旦微任务没跑起来（真机偶发、低版本基础库、
    // 或 Promise 被别的库覆盖过），setData 就永远不执行，页面停在骨架屏 ——
    // 这正是「有标题但内容出不来」的样子。
    // 这里直接同步取，setData 当场生效，从根上没有异步等待。
    const apply = (terms) => {
      const current = dataSource.getCurrentTerm();
      this.setData({
        terms,
        currentName: current ? current.name : '',
        status: terms.length > 0 ? 'ready' : 'empty',
        loadError: '',
      });

      // 带 term 参数进来：直接展开该节气详情
      // 只要 URL 上有 term 这个键就一定要落到详情，不能退化成列表——
      // 用户点的是「立冬的讲究」，看到一排节气卡会以为跳转失败。
      if (this.pendingTerm || this.hasTermParam) {
        const name = this.pendingTerm;
        this.pendingTerm = '';
        this.hasTermParam = false;
        if (name && terms.some((x) => x.name === name)) {
          this.onTapTerm({ detail: { name } });
        } else if (current) {
          // 编码坏了或节气名对不上时退到当前节气，至少让用户看到文化内容
          this.onTapTerm({ detail: { name: current.name } });
        }
      }
    };

    const fail = (reason) => {
      this.setData({ status: 'error', loadError: String(reason || '').slice(0, 80) });
    };

    // ① 本地通道：同步
    if (config.DATA_CHANNEL === 'local') {
      let terms = [];
      try {
        terms = dataSource.getTerms();
      } catch (e) {
        fail((e && e.message) || '读取节气数据失败');
        return;
      }
      if (!Array.isArray(terms)) terms = [];
      apply(terms);
      return;
    }

    // ② 其它通道：仍走接口，保留超时与错误兜底
    this.setData({ status: 'loading' });
    let timer = null;
    try {
      const p = api.getTerms();
      timer = setTimeout(() => {
        if (this.data.status === 'loading') fail('加载超时');
      }, 8000);
      p.then((res) => {
        if (timer) clearTimeout(timer);
        apply((res && res.list) || []);
      }).catch((e) => {
        if (timer) clearTimeout(timer);
        fail((e && (e.message || e.code)) || '读取节气失败');
      });
    } catch (e) {
      if (timer) clearTimeout(timer);
      fail((e && e.message) || '初始化失败');
    }
  },

  onTapTerm(e) {
    const name = e.detail && e.detail.name;
    if (!name) return;

    const detail = this.decorateTerm(dataSource.getTerm(name));
    // 数据没命中时不要把 view 切到 detail：
    // 那样 wxml 会走 <view wx:if="{{detail}}"> 的 else 分支显示空态，
    // 用户看到的是「这个节气没有内容」而不是「页面坏了」，很难判断是谁的问题。
    // 留一个明确的错误态，带重试。
    if (!detail) {
      this.setData({ status: 'error', view: 'list' });
      return;
    }
    // 节气海报：AI 生成的水墨横板图，24 节气各一张（utils/solarTheme.js）
    const themeInfo = solarTheme.getThemeByName(detail.name);
    this.setData({
      view: 'detail',
      detail,
      detailPoster: themeInfo ? themeInfo.poster : '',
      dishes: [],
      allDishes: [],
      mealFilter: ALL_MEAL,
      dishStatus: 'loading',
      // 动态背景：每个节气一套天空渐变 + 纹理 + 光晕 + 漂浮元素 + 粒子
      bg: buildScene(detail.name),
      // 养生提醒：气候特征 + 今天怎么喝 + 当令吃什么 + 起居（已剔功效性表述）
      health: termHealth.buildToday(detail.name, {}),
    });

    track.solarTermView(name);
    this.loadDishes(name);
  },

  // 食材价格档位：视图层按 priceLevel 渲染 1–3 颗星形图（压印五角星），
  // WXML 不做计算，这里只保证 priceLevel 是 1–3 的合法值
  decorateTerm(term) {
    if (!term) return term;
    const details = (term.ingredientDetails || []).map((x) => {
      const level = Number(x.priceLevel) || 0;
      return Object.assign({}, x, { priceLevel: Math.min(Math.max(level, 0), 3) });
    });
    // 三候：数据只给物候名，序号在视图层要显示成「一候/二候/三候」，
    // 在 JS 侧拼好，避免 WXML 里做数组下标取字面量
    const houLabels = [t('solarterm.hou1'), t('solarterm.hou2'), t('solarterm.hou3')];
    const phenology = (term.phenology || []).map((text, i) => ({
      label: houLabels[i] || '',
      text,
      no: i + 1,
    }));
    return Object.assign({}, term, { ingredientDetails: details, phenologyList: phenology });
  },

  loadDishes(termName) {
    this.setData({ dishStatus: 'loading' });

    api
      .getRecipes({ term: termName })
      .then((res) => {
        const list = (res.list || []).map(toCard);
        this.setData({
          allDishes: list,
          dishStatus: list.length > 0 ? 'ready' : 'empty',
        });
        this.applyMealFilter();
      })
      .catch(() => {
        this.setData({ dishStatus: 'error' });
      });
  },

  // 按当前餐次筛选；某餐次没有菜时如实说明，不拿别的餐次充数
  applyMealFilter() {
    const filter = this.data.mealFilter;
    const all = this.data.allDishes;
    if (!filter) {
      this.setData({ dishes: all, emptyMealText: '' });
      return;
    }
    const list = all.filter((d) => (d.mealText || '').indexOf(filter) > -1);
    this.setData({
      dishes: list,
      emptyMealText: list.length === 0 ? this.data.copy.mealEmpty : '',
    });
  },

  onTapMeal(e) {
    const key = e.currentTarget.dataset.key;
    if (key === undefined || key === this.data.mealFilter) return;
    this.setData({ mealFilter: key });
    this.applyMealFilter();
  },

  // 生成节气食单长图并保存到相册
  onShareLongImage() {
    if (this.data.sharing) return;
    if (!this.data.detail) return;

    this.setData({ sharing: true });
    wx.showLoading({ title: this.data.copy.generating, mask: true });

    share
      .drawTermLongImage({
        page: this,
        canvasId: 'shareCanvas',
        term: this.data.detail,
        dishes: this.data.allDishes.slice(0, 3),
      })
      .then((filePath) => share.saveImageToAlbum(filePath))
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: this.data.copy.saved, icon: 'none' });
        track.share('longimage', 'button');
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: this.data.copy.saveFailed, icon: 'none' });
      })
      .then(() => {
        this.setData({ sharing: false });
      });
  },

  onRetry() {
    if (this.data.view === 'detail' && this.data.detail) {
      this.loadDishes(this.data.detail.name);
      return;
    }
    this.loadTerms();
  },

  onTapDish(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    track.dishClick(id, 'solarterm');
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  onFavoriteTap(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    const added = favorite.has(id);
    favorite.toggle(id);
    track.favoriteEvent(id, added ? 'remove' : 'add', 'solarterm');

    const patch = (item) => (item.id === id ? Object.assign({}, item, { faved: !added }) : item);
    this.setData({
      allDishes: this.data.allDishes.map(patch),
      dishes: this.data.dishes.map(patch),
    });
  },

  // 转发当前节气
  onShareAppMessage() {
    track.share(this.data.view === 'detail' ? 'term' : 'app', 'menu');
    if (this.data.detail) return share.messageForTerm(this.data.detail);
    return share.messageForApp();
  },
});

// 节气动态背景：从材料包的六层配置拼出本页需要的四组数据。
// 取不到配置（异常节气名）返回 null，页面退回默认纸底，不报错。
function buildScene(name) {
  const style = seasonalBg.getBgStyleByName(name);
  if (!style) return null;
  const bg = seasonalBg.getBgByName(name);
  return {
    style: style.style,
    overlayStyle: 'background: ' + (bg && bg.overlayGradient ? bg.overlayGradient : 'none') + ';',
    texture: seasonalBg.getTextureSVGByName(name),
    particles: seasonalBg.getParticlesByName(name),
    elements: seasonalBg.getFloatingElementsByName(name),
  };
}
