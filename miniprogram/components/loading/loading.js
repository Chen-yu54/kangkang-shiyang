// components/loading —— 统一加载态
//
// type: 'skeleton'（骨架屏，列表 / 首页用）| 'spinner'（墨迹圆环，详情页用）
// banner: 骨架屏是否额外渲染一块顶部 banner 占位
//
// 墨迹圆环取自有版面设计稿：三层细金线圆环 + 绿 / 棕 / 灰三枚墨点，下方一行标题与副标题。

const i18n = require('../../utils/i18n');

Component({
  properties: {
    type: {
      type: String,
      value: 'skeleton',
    },
    banner: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    loadingTitle: i18n.t('common.loading'),
    loadingEn: i18n.t('common.loadingEn'),
    loadingSub: i18n.t('common.loadingSub'),
  },
});
