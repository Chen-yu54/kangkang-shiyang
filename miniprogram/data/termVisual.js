// data/termVisual.js —— 节气视觉气质（由 scripts/build-data.js 从 knowledge/terms24.json 生成，请勿手改）
// 重新生成：node scripts/build-data.js
//
// 只取三项，均为纯视觉描述，不含功效表述：
//   aura     氛围词（如「霜染红叶」），用于节气文化板块的一行题眼
//   gradient 渐变（[起点, 终点]），用于文化卡与 hero 兜底底色
//   texture  质感标识（frost / snow / rain…），供 CSS 决定叠加哪种肌理
//
// 色板本身仍以 utils/solarTheme.js 的 THEMES 为唯一真源；本文件只补「气质」维度。

module.exports = {
  "xiaohan": {
    "aura": "冷冽清透",
    "gradient": [
      "#6a9ac8",
      "#2a4a7a"
    ],
    "texture": "frost"
  },
  "dahan": {
    "aura": "严寒深沉",
    "gradient": [
      "#5878b0",
      "#1e3058"
    ],
    "texture": "snow"
  },
  "lichun": {
    "aura": "清新嫩绿",
    "gradient": [
      "#8ad8a0",
      "#2d6a44"
    ],
    "texture": "sprout"
  },
  "yushui": {
    "aura": "湿润朦胧",
    "gradient": [
      "#9adcc0",
      "#2d7a58"
    ],
    "texture": "rain"
  },
  "jingzhe": {
    "aura": "生机勃发",
    "gradient": [
      "#a8e088",
      "#3a6a28"
    ],
    "texture": "thunder"
  },
  "chunfen": {
    "aura": "杨柳春风",
    "gradient": [
      "#a8d8b8",
      "#2d5a3d"
    ],
    "texture": "willow"
  },
  "qingming": {
    "aura": "烟雨迷蒙",
    "gradient": [
      "#a0d8b0",
      "#2d5a40"
    ],
    "texture": "rain-mist"
  },
  "guyu": {
    "aura": "润泽丰沛",
    "gradient": [
      "#98c888",
      "#2a5038"
    ],
    "texture": "rain-heavy"
  },
  "lixia": {
    "aura": "暖阳明媚",
    "gradient": [
      "#fde888",
      "#b88818"
    ],
    "texture": "sun-warm"
  },
  "xiaoman": {
    "aura": "麦浪金黄",
    "gradient": [
      "#f8d868",
      "#a87818"
    ],
    "texture": "wheat"
  },
  "mangzhong": {
    "aura": "繁忙金黄",
    "gradient": [
      "#f0d858",
      "#906818"
    ],
    "texture": "grain"
  },
  "xiazhi": {
    "aura": "烈日当空",
    "gradient": [
      "#fde090",
      "#a06018"
    ],
    "texture": "sun-blaze"
  },
  "xiaoshu": {
    "aura": "闷热潮湿",
    "gradient": [
      "#f8a850",
      "#b85010"
    ],
    "texture": "heat-wave"
  },
  "dashu": {
    "aura": "骄阳似火",
    "gradient": [
      "#f08858",
      "#982818"
    ],
    "texture": "scorching"
  },
  "liqiu": {
    "aura": "微凉初秋",
    "gradient": [
      "#e0b878",
      "#805018"
    ],
    "texture": "leaf-fall"
  },
  "chushu": {
    "aura": "云淡天高",
    "gradient": [
      "#d8b068",
      "#6a4018"
    ],
    "texture": "mist"
  },
  "bailu": {
    "aura": "清冷露白",
    "gradient": [
      "#d8c878",
      "#5a4a20"
    ],
    "texture": "dew"
  },
  "qiufen": {
    "aura": "丰收金黄",
    "gradient": [
      "#e0a868",
      "#6a3818"
    ],
    "texture": "harvest"
  },
  "hanlu": {
    "aura": "深秋萧瑟",
    "gradient": [
      "#c8a058",
      "#4a3018"
    ],
    "texture": "frost-deep"
  },
  "shuangjiang": {
    "aura": "霜染红叶",
    "gradient": [
      "#b89050",
      "#3a2010"
    ],
    "texture": "frost-heavy"
  },
  "lidong": {
    "aura": "初冬清冷",
    "gradient": [
      "#8aa8d8",
      "#283a58"
    ],
    "texture": "frost"
  },
  "xiaoxue": {
    "aura": "初雪飘零",
    "gradient": [
      "#90b0e0",
      "#2a3a60"
    ],
    "texture": "snow-light"
  },
  "daxue": {
    "aura": "银装素裹",
    "gradient": [
      "#8898d8",
      "#222a50"
    ],
    "texture": "snow-heavy"
  },
  "dongzhi": {
    "aura": "长夜将尽",
    "gradient": [
      "#6a8ac8",
      "#1a2858"
    ],
    "texture": "snow-night"
  }
};
