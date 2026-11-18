// 食材溯源详情页（分包 packageIngredient）
//
// 从菜谱详情页点主料进来，看这样食材的：身份 / 产地 / 质量指标 / 选购 / 处理 / 注意 / 检测。
// 数据来自《岭南食材主料知识库 v0.2》，已在构建期做过疾病名与功效表述过滤。
//
// 为什么放在分包：食材库 220+ KB，放主包会挤爆（主包上限 2048 KB）。
// 主包只留一个跳转入口，不 require 任何食材数据。

const cards = require('../../data/ingredients.js');
const indexData = require('../../data/ingredientsIndex.js');

const CARD_BY_ID = {};
const CARD_BY_NAME = {};
cards.forEach((c) => {
  CARD_BY_ID[c.id] = c;
  CARD_BY_NAME[c.name] = c;
});

const LOOKUP = indexData.LOOKUP || {};
const PREFIXES = indexData.PREFIXES || [];

// 按名称找卡：先直接查，再剥掉「客家 / 增城 / 鲜」这类前缀查，
// 最后走别名表。菜谱写「增城菜心」，档案里叫「菜心」。
function findByName(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  if (CARD_BY_NAME[n]) return CARD_BY_NAME[n];

  for (let i = 0; i < PREFIXES.length; i += 1) {
    const p = PREFIXES[i];
    if (n.indexOf(p) === 0) {
      const rest = n.slice(p.length);
      if (CARD_BY_NAME[rest]) return CARD_BY_NAME[rest];
      if (LOOKUP[rest] && CARD_BY_ID[LOOKUP[rest]]) return CARD_BY_ID[LOOKUP[rest]];
    }
  }

  const id = LOOKUP[n];
  return id ? CARD_BY_ID[id] || null : null;
}

// 卡片区块定义：把字段映射成「标题 + 内容」，字段为空就整块不显示。
// 顺序按「先判断能不能买、再判断怎么做」排，符合实际使用顺序。
// 每块配一张手绘小图（images/ingredients/，来自康养智能体的插画包），
// 选的不是「好看」，是跟这一块在讲什么对得上：罗盘对应产地、印章对应合格、
// 砂锅对应下锅、警示牌对应注意。图只是引子，正文仍是唯一的信息来源。
const SECTIONS = [
  { key: 'identity', label: '这是什么', icon: 'home_record_bamboo' },
  { key: 'origin', label: '产地与季节', icon: 'register_location_compass' },
  { key: 'quality', label: '质量与安全', icon: 'register_check_seal', important: true },
  { key: 'select', label: '怎么挑', icon: 'home_today_bamboo' },
  { key: 'cook', label: '怎么处理', icon: 'home_season_cauldron' },
  { key: 'caution', label: '要注意', icon: 'home_warn_token' },
  { key: 'price', label: '价格与替代', icon: 'home_analysis_bookmark' },
  { key: 'inspect', label: '检测与判定', icon: 'home_text_scrollbrush' },
];

// 统一在这里拼路径，模板里只拿现成值，免得路径散落在 wxml 里
const ICON_DIR = '/images/ingredients/';
function iconOf(name) {
  return name ? ICON_DIR + name + '.png' : '';
}

Page({
  data: {
    found: false,
    name: '',
    oneLine: '',
    typeText: '',
    sections: [],
    basis: '',
    emptyText: '',
  },

  onLoad(options) {
    const o = options || {};
    const id = o.id ? decodeURIComponent(o.id) : '';
    const name = o.name ? decodeURIComponent(o.name) : '';
    const card = CARD_BY_ID[id] || findByName(name);

    wx.setNavigationBarTitle({ title: name || '食材档案' });

    if (!card) {
      this.setData({
        found: false,
        name,
        emptyText: name
          ? '「' + name + '」暂时没有档案。\n我们只收录有据可查的食材资料，不编内容。'
          : '没有找到这样食材的档案。',
      });
      return;
    }

    // 组装非空区块；营养特点并入「这是什么」下方单独一块
    const sections = [];
    if (card.nutrition) {
      sections.push({
        label: '主要成分',
        text: card.nutrition,
        important: false,
        icon: iconOf('home_effect_ginseng'),
      });
    }
    SECTIONS.forEach((s) => {
      const text = card[s.key];
      if (!text) return;
      sections.push({
        label: s.label,
        text,
        important: !!s.important,
        icon: iconOf(s.icon),
      });
    });

    this.setData({
      found: true,
      name: card.name,
      oneLine: card.oneLine || '',
      typeText: this.typeOf(card.name, name),
      sections,
      basis: card.basis || '',
    });
  },

  // 品类标签：取索引里的类型，取不到就不显示标签
  typeOf(cardName, fallbackName) {
    try {
      const idx = require('../../data/ingredientsIndex.js');
      const list = idx.INDEX || [];
      const hit = list.filter((r) => r.name === (cardName || fallbackName))[0];
      return hit ? hit.type : '';
    } catch (e) {
      return '';
    }
  },

  onBack() {
    wx.navigateBack();
  },
});
