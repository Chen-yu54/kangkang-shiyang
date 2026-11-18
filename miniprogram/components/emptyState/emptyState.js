// components/emptyState —— 统一空状态
//
// 用法：<empty-state text="{{...}}" actionText="{{...}}" bind:action="onAction" />
// 动作按钮文案为空时不渲染按钮。
//
// 2026-11-14：加了一张水彩空碗插图（默认开），空态不再是一句话悬在空白里；
// 卡片内的小面积空态传 compact="{{true}}"，插图缩到一半，别把区块撑高。

Component({
  properties: {
    text: {
      type: String,
      value: '',
    },
    actionText: {
      type: String,
      value: '',
    },
    // 插图：默认空碗；传 '' 可整块关掉（个别位置不需要图形）
    image: {
      type: String,
      value: '/images/state-empty.jpg',
    },
    // 紧凑模式：卡片内的小空态，插图减半、上下留白收紧
    compact: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    onAction() {
      this.triggerEvent('action');
    },
  },
});
