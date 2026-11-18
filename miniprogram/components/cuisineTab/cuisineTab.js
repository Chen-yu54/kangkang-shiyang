// components/cuisineTab —— 风味筛选（四路 tab：岭南家常 / 广府 / 潮汕 / 客家）
//
// list: [{ key: 'lingnan_home', name: '岭南家常' }, ...]
// current: 当前选中的 key
// 事件 change: { key }

Component({
  properties: {
    list: {
      type: Array,
      value: [],
    },
    current: {
      type: String,
      value: '',
    },
  },

  methods: {
    onTap(e) {
      const key = e.currentTarget.dataset.key;
      if (!key || key === this.data.current) return;
      this.triggerEvent('change', { key });
    },
  },
});
