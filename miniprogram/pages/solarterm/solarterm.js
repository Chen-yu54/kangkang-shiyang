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
    view: 'detail', // 进来先看节气内容；列表只在点「换节气」之后才出现
    status: 'loading', // 列表态：loading | ready | empty | error
    loadError: '', // 加载失败的具体原因，显示到界面上便于定位
    dishStatus: 'loading', // 详情菜品态：loading | ready | empty | error
    terms: [],
    currentName: '',
    backCurrentText: '',
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
    // 入口参数只用来决定「先展开哪个节气」，不再决定「能不能进详情」。
    // 之前留了 ?view=list 的口子，结果只要 URL 上出现这个键，页面就整屏变成
    // 一排节气卡 —— 用户点「节气文化」看到的是列表，看着就像跳错了。
    // 现在列表只能由用户点详情页的「换节气」进入，参数一律不理会。
    this._userList = false;
    this._retried = false;
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
        switchTerm: t('solarterm.switchTerm'),
        listTitle: t('solarterm.title'),
        listSub: t('solarterm.listSub'),
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
    this.ensureDetailView();
  },

  // 兜底：从首页「节气文化」/ 海报 / 我的页进来，本该看到文化详情。
  // 只要用户没有主动点「换节气」，进页面时视图还停在列表、或内容没落地，
  // 就自动展开节气内容，绝不让用户看到一排节气卡还以为点错了。
  ensureDetailView() {
    if (this._userList) return; // 用户主动点了「换节气」，尊重这个选择
    if (this.data.view === 'detail' && this.data.detail) return; // 已经在详情
    if (!this.data.terms || !this.data.terms.length) return; // 数据没到，保留骨架/错误态
    const name = this.data.currentName || (this.data.terms[0] && this.data.terms[0].name);
    if (!name) return;
    this.openTerm(name);

    // 一次延迟补偿：首帧 setData 偶发丢失时（切页动画、低版本基础库），
    // 300ms 后内容还没落地就再补一次。只补一次，不跟用户的操作抢。
    if (this._retried) return;
    this._retried = true;
    setTimeout(() => {
      if (this._userList) return;
      if (this.data.view === 'detail' && this.data.detail) return;
      if (!this.data.terms || !this.data.terms.length) return;
      const again = this.data.currentName || (this.data.terms[0] && this.data.terms[0].name);
      if (again) this.openTerm(again);
    }, 300);
  },

  loadTerms() {
    // local 通道下节气数据就在包里，dataSource.getTerms() 是同步函数。
    // 原来绕了一层 Promise.resolve()，一旦微任务没跑起来（真机偶发、低版本基础库、
    // 或 Promise 被别的库覆盖过），setData 就永远不执行，页面停在骨架屏 ——
    // 这正是「有标题但内容出不来」的样子。
    // 这里直接同步取，setData 当场生效，从根上没有异步等待。
    const apply = (terms) => {
      const current = dataSource.getCurrentTerm();
      const curName = current ? current.name : '';
      this.setData({
        terms,
        currentName: curName,
        // 列表视图右上角「回立冬」用：落列表时一键回当前节气的文化详情
        backCurrentText: curName ? i18n.tpl('solarterm.backCurrent', { name: curName }) : '',
        status: terms.length > 0 ? 'ready' : 'empty',
        loadError: '',
      });

      // 进来一律先展开节气详情，不再看任何 URL 参数。
      // 这个页面从任何入口进来，用户最想看的就是「这个节气的文化内容」，
      // 而不是一排节气卡；列表只留给「换节气」这个动作。
      const name = this.pendingTerm;
      this.pendingTerm = '';
      this.hasTermParam = false;
      if (name && terms.some((x) => x.name === name)) {
        this.openTerm(name);
      } else if (terms.length) {
        // 没带参数、或编码坏了、或节气名对不上，都退到当前节气
        const fallback = (current && current.name) || (terms[0] && terms[0].name) || '';
        if (fallback) this.openTerm(fallback);
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

  // 从详情切回 24 节气列表（只有用户点「换节气」才会到这里）
  onBackList() {
    this._userList = true;
    this.setData({ view: 'list', detail: null, bg: null, health: null, dishes: [], allDishes: [] });
  },

  // 列表视图里「回当前节气」：一键回到这个节气的文化详情
  onBackCurrent() {
    const name = this.data.currentName;
    if (!name) return;
    this.onTapTerm({ detail: { name } });
  },

  onTapTerm(e) {
    const name = e.detail && e.detail.name;
    if (!name) return;
    this.openTerm(name);
  },

  // 打开某个节气的文化详情。
  //
  // setData 分两段：先落「必须看到的内容」，再补背景和养生这类装饰。
  // 原来全部塞在一次 setData 的参数里，参数对象求值阶段任何一处抛错
  // （背景纹理、养生提醒构造），整个 setData 都不执行，detail 一直是 null，
  // 页面就只剩「这个节气的菜还在补」——内容其实取到了，只是没送到视图层。
  openTerm(name) {
    let detail = null;
    try {
      detail = this.decorateTerm(dataSource.getTerm(name));
    } catch (err) {
      this.setData({
        status: 'error',
        loadError: '读取「' + name + '」出错：' + ((err && err.message) || '未知原因'),
      });
      return;
    }

    if (!detail) {
      // 不切回 list：切了就成了「点节气文化，结果看到一排节气卡」。
      // 已经有内容时留在详情，只把原因提示出来；本来就在列表时再显示错误态。
      this.setData({
        status: 'error',
        loadError: '没找到「' + name + '」的节气内容',
        view: this.data.detail ? 'detail' : 'list',
      });
      return;
    }

    // 节气海报：AI 生成的水墨横板图，24 节气各一张（utils/solarTheme.js）
    let poster = '';
    try {
      const themeInfo = solarTheme.getThemeByName(detail.name);
      poster = themeInfo ? themeInfo.poster : '';
    } catch (err) {
      poster = '';
    }

    // 内容这一段落必须成功落地。真机上若因数据异常导致 setData 失败，
    // 把原因写出来，而不是让页面停在「内容还在补」的空态上。
    try {
      this.setData({
        view: 'detail',
        detail,
        detailPoster: poster,
        dishes: [],
        allDishes: [],
        mealFilter: ALL_MEAL,
        dishStatus: 'loading',
        status: 'ready',
        loadError: '',
        bg: null,
        health: null,
      });
    } catch (err) {
      this.setData({
        status: 'error',
        loadError: '「' + name + '」内容写入失败：' + ((err && err.message) || '未知原因'),
      });
      return;
    }

    // 已经从列表里挑了一个节气，退出「用户想看列表」的状态
    this._userList = false;

    // —— 以下都是可缺省的装饰层，失败就退回素纸底，不能拖累内容 ——

    // 动态背景：每个节气一套天空渐变 + 纹理 + 光晕 + 漂浮元素 + 粒子
    try {
      const scene = buildScene(detail.name);
      if (scene) this.setData({ bg: scene });
    } catch (err) {
      console.warn('[solarterm] 背景构建失败', err);
    }

    // 养生提醒：气候特征 + 今天怎么喝 + 当令吃什么 + 起居（已剔功效性表述）
    try {
      const health = termHealth.buildToday(detail.name, {});
      if (health) this.setData({ health });
    } catch (err) {
      console.warn('[solarterm] 养生提醒构建失败', err);
    }

    try {
      track.solarTermView(name);
    } catch (err) {
      // 埋点失败不影响页面
    }

    // 菜品列表：接口异常时落到 dishStatus='error'，顶部内容照旧显示
    try {
      this.loadDishes(name);
    } catch (err) {
      this.setData({ dishStatus: 'error' });
    }
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
    // 视图层直接读 xxx.length，字段必须一定是数组：
    // 少一个就会让 WXML 表达式取到 undefined.length，整块渲染不出来
    return Object.assign({}, term, {
      ingredients: Array.isArray(term.ingredients) ? term.ingredients : [],
      ingredientDetails: details,
      phenologyList: phenology,
      folk: Array.isArray(term.folk) ? term.folk : [],
      poem: term.poem || null,
    });
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
