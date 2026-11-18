// components/disclaimer —— 页面底部固定声明条
//
// 形态取自设计稿（浅青绿卡片 + 圆形感叹号），文案保留任务书硬性要求：
//   「本内容为食养科普，不构成医疗建议。」
// 设计稿原句是「内容仅供参考，请结合实际情况判断。」——少了「不构成医疗建议」，
// 这是过审关键句，不能改；设计稿的「我知道了」关闭按钮也不做：
// 声明条必须常驻，一旦允许关闭，关掉之后页面就失去合规声明了。

const i18n = require('../../utils/i18n');

Component({
  properties: {
    text: {
      // 页面用 <disclaimer /> 不传值时，微信会给这个属性传 null。
      // 声明 type:String 会触发「expected <String> but get null」告警，
      // 所以放开 null 类型，实际展示在视图层用 text || fallback 兜底。
      type: String,
      optionalTypes: [null],
      value: '',
    },
  },

  data: {
    fallback: i18n.t('common.disclaimer'),
  },
});
