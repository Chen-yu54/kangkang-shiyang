// components/dishCard —— 菜品卡（菜单 / 节气 / 搜索 / 收藏 / 推荐共用）
//
// dish 结构由 utils/api.js 统一产出，字段已 sanitize，不会出现 undefined。
// showTerm: 是否展示当令节气（菜单页内已按节气筛过时可不展示）
// faved: 是否已收藏，控制收藏按钮的文案与样式
//
// 图片位交给 components/dishMedia：有图显示图，无图/加载失败都渲染成「风味签」，
// 本组件不再持有 imgFailed 之类的图片状态。
const i18n = require('../../utils/i18n');
const format = require('../../utils/format');

Component({
  properties: {
    dish: {
      type: Object,
      value: {},
    },
    showTerm: {
      type: Boolean,
      value: true,
    },
    faved: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    favoriteText: i18n.t('dish.favorite'),
    favoritedText: i18n.t('dish.favorited'),
    removeText: i18n.t('favorite.remove'),
    aiTag: i18n.t('common.aiGenerated'),
  },

  methods: {
    onTap() {
      // 事件名不用 'tap'：自定义组件上的 bindtap 会同时收到原生冒泡与 triggerEvent，
      // 用独立事件名避免一次点击触发两次
      this.triggerEvent('cardtap', { id: this.data.dish.id });
    },

    // catchtap：阻止冒泡到卡片，否则点收藏会顺带打开详情
    onFavoriteTap() {
      this.triggerEvent('favoritetap', { id: this.data.dish.id });
    },
  },
});
