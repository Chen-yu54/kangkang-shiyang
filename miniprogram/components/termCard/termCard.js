// components/termCard —— 节气卡（节气列表页）
//
// term 结构来自 utils/api.js getTerms()：{ name, order, dateWindow, windowText, season, headline, ingredients, dishes }
// active: 是否为当前节气（高亮 + 当令标记）
//
// 季节色条：season 是中文（春/夏/秋/冬），转成 CSS 类名后缀，
// 颜色取 app.wxss 的 --color-spring / summer / autumn / winter，
// 让 24 节气列表一眼能看出四季分段（也解释「同一套 UI 怎么随节气走」）。

const i18n = require('../../utils/i18n');

const SEASON_KEY = {
  春: 'spring',
  夏: 'summer',
  秋: 'autumn',
  冬: 'winter',
};

Component({
  properties: {
    term: {
      type: Object,
      value: {},
    },
    active: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    activeText: i18n.t('solarterm.current'),
    seasonKey: 'winter',
  },

  observers: {
    'term.name': function () {
      this.applySeason();
    },
  },

  lifetimes: {
    attached() {
      // observer 首帧未必触发（初始 term 是空对象），这里补一次
      this.applySeason();
    },
  },

  methods: {
    applySeason() {
      const season = this.data.term && this.data.term.season;
      this.setData({ seasonKey: SEASON_KEY[season] || 'winter' });
    },

    onTap() {
      // 事件名不用 'tap'，避免与原生冒泡重复触发
      this.triggerEvent('termtap', { name: this.data.term.name });
    },
  },
});
