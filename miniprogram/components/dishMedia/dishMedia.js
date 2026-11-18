// components/dishMedia —— 菜品图片位（全端唯一图片出口）
//
// 解决的问题：知识库 419 道菜里只有 29 张风味卡配图，缺口约 93%。
// 上线时如果缺口裸露成「灰色空块 / 图片加载不了」，整屏会像没做完的半成品。
//
// 做法：把「无图」和「图挂了」两种状态，统一渲染成一张**风味签**——
//   暖色渐变底 + 45° 细斜纹 + 内层细框 + 菜系图形水印 + 朱砂印章（广/潮/客/岭/味）
// 它是一个完整的版式，而不是占位符：有图没图在同一屏里都像设计，缺口因此不可见。
//
// 三条硬约束：
//   1. 永不向用户输出「暂无图片 / 图片加载不了」这类字样，缺口不解释、不道歉
//   2. 高度由外部 height 传入，图文两态等高，列表节奏不塌
//   3. 颜色只取 app.wxss 的 CSS 变量，不写死色值（印章朱砂除外，它不属于主题色）

// 菜系 → 水彩插图：首页「按菜系逛」撤掉后，那三幅水彩不再有入口，
// 但它们是全库最好的一套菜系视觉。没有照片的菜直接拿它当底色，
// 比灰色色块 + 小图标更像「有内容」，也不会让三系看起来像三个空档。
const CUISINE_WASH = {
  guangfu: '/images/cuisine-card-guangfu.jpg',
  chaoshan: '/images/cuisine-card-chaoshan.jpg',
  hakka: '/images/cuisine-card-hakka.jpg',
};

// 菜系 → 印章字：没有菜名时用它兜底（朱砂方块里的单字，当装饰用）
const SEAL_CHAR = {
  lingnan_home: '岭',
  guangfu: '广',
  chaoshan: '潮',
  hakka: '客',
  other: '味',
};

// 取菜名首字做印章：419 道菜里 413 道没有配图，如果印章一律写「岭」，
// 长列表会齐刷刷同一个模板；换成首字后一菜一签，翻页时才有节奏。
// 首字是虚词（清蒸/老火/干煸…）也没关系，印章是装饰不是标签。
function sealOf(name, cuisine) {
  const text = name === null || name === undefined ? '' : String(name).trim();
  if (text) return text.charAt(0);
  return SEAL_CHAR[cuisine] || SEAL_CHAR.other;
}

Component({
  properties: {
    image: {
      type: String,
      value: '',
    },
    // 菜名只用来取印章首字，不参与版面文案（避免与卡片正文重复）
    name: {
      type: String,
      value: '',
    },
    // 菜系 key：lingnan_home / guangfu / chaoshan / hakka / other
    cuisine: {
      type: String,
      value: 'other',
    },
    height: {
      type: Number,
      value: 320,
    },
    // card 列表卡 / thumb 小横滑卡 / hero 详情大图
    mode: {
      type: String,
      value: 'card',
    },
    // 贴在卡片顶部时去掉自身圆角与描边，避免与外层卡片圆角打架
    flush: {
      type: Boolean,
      value: false,
    },
    // 详情页大图用卡片级大圆角
    round: {
      type: Boolean,
      value: false,
    },
    // AI 生成内容标识文案：由调用方传入（文案统一走 i18n），为空则不显示角标
    aiTag: {
      type: String,
      value: '',
    },
    // 节气色温：给照片叠一层极淡的节气色（--color-green-soft，随节气换），
    // 让同一屏里的图「统一调色」，像杂志一期一个色调。仅照片态生效。
    tint: {
      type: Boolean,
      value: false,
    },
    // 蒸汽：照片右下角三道缓慢上升的蒸汽（纯 CSS），给「刚出锅」的通感。
    // 只在大图（详情 / 主推）开，小卡片开了会显脏。
    steam: {
      type: Boolean,
      value: false,
    },
    // 压暗：照片底部暖色压暗渐变，让叠在上面的文字可读、视线聚焦食物。
    // 默认关闭，由「图上压字」的场景（封面 / 主推大卡）显式打开。
    veil: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    failed: false,
    sealChar: SEAL_CHAR.other,
    wash: '',
  },

  observers: {
    image(image) {
      // 换了一条菜：重置失败标记，否则上一条的失败态会串到下一条
      this.setData({ failed: false });
      if (!image) return;
    },
    'name, cuisine'(name, cuisine) {
      this.setData({
        sealChar: sealOf(name, cuisine),
        wash: CUISINE_WASH[cuisine] || '',
      });
    },
  },

  lifetimes: {
    attached() {
      // 首屏可能不触发 observer，这里兜一次，避免印章空白
      this.setData({
        sealChar: sealOf(this.data.name, this.data.cuisine),
        wash: CUISINE_WASH[this.data.cuisine] || '',
      });
    },
  },

  methods: {
    onError() {
      this.setData({ failed: true });
    },
  },
});
