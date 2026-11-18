/**
 * 24节气动态背景系统
 * 
 * 每个节气有：
 *   1. 多层渐变（天空色 + 地面色 + 光晕色）
 *   2. SVG纹理（不是纯色块，是有"质感"的底）
 *   3. 漂浮元素（花瓣/萤火/落叶/雪花/柳絮/细雨…）
 *   4. 光效（阳光穿透/月光朦胧/晨雾弥散）
 *   5. 动态参数（速度/密度/方向）
 * 
 * 公众号那篇推文之所以好看，是因为每张节气图都有：
 *   - 独特的色调氛围
 *   - 实景或手绘的元素点缀
 *   - 统一的留白和排版节奏
 * 
 * 这个文件就是把那套逻辑翻译成小程序能跑的背景渲染方案
 */

// ===== 24节气完整背景配置 =====
const BG_CONFIGS = {
  // ===== 小寒 =====
  xiaohan: {
    sky: ['#d4dce8', '#e8edf4', '#f0f3f8'],     // 冷灰蓝渐变
    ground: '#eef2f8',
    glow: { color: 'rgba(180,200,230,0.3)', x: '20%', y: '30%', r: '400rpx' },
    texture: 'frost-pattern',                      // 冰霜纹理
    elements: ['ice-crystal', 'frost-fern'],       // 冰晶/霜花
    elementColors: ['#c8d8ec', '#b8c8e0'],
    particles: { type: 'snowflake', count: 14, speed: 8000, size: [4, 10], opacity: [0.3, 0.7] },
    lightEffect: 'cold-mist',                      // 寒雾
    overlayGradient: 'linear-gradient(180deg, rgba(180,200,230,0.15) 0%, transparent 60%)',
    vibe: '清冷寂静，万物蛰伏'
  },

  // ===== 大寒 =====
  dahan: {
    sky: ['#c8d4e4', '#dce4ee', '#eaeef6'],
    ground: '#e8edf6',
    glow: { color: 'rgba(160,180,220,0.25)', x: '70%', y: '20%', r: '350rpx' },
    texture: 'heavy-frost',
    elements: ['snow-pile', 'bare-branch'],        // 积雪/枯枝
    elementColors: ['#dce4f0', '#a0b0c0'],
    particles: { type: 'heavy-snow', count: 20, speed: 6000, size: [6, 14], opacity: [0.4, 0.8] },
    lightEffect: 'frozen-silence',
    overlayGradient: 'linear-gradient(180deg, rgba(160,180,220,0.2) 0%, transparent 50%)',
    vibe: '严寒深沉，静待春归'
  },

  // ===== 立春 =====
  lichun: {
    sky: ['#d4ead4', '#e4f4e4', '#f0f8f0'],      // 嫩绿初现
    ground: '#eef8ee',
    glow: { color: 'rgba(120,200,140,0.25)', x: '30%', y: '40%', r: '380rpx' },
    texture: 'sprout-pattern',                     // 新芽纹理
    elements: ['sprout', 'green-bud', 'willow-wisp'], // 新芽/柳絮
    elementColors: ['#7ec88a', '#a8d8a8', '#c8e8c8'],
    particles: { type: 'willow-catkin', count: 10, speed: 10000, size: [8, 16], opacity: [0.2, 0.5] },
    lightEffect: 'soft-sunrise',                   // 柔光初照
    overlayGradient: 'linear-gradient(180deg, rgba(120,200,140,0.12) 0%, transparent 55%)',
    vibe: '春风微度，万物复苏'
  },

  // ===== 雨水 =====
  yushui: {
    sky: ['#c8d8d0', '#d8e8e0', '#e8f0ec'],      // 湿润青灰
    ground: '#edf3f0',
    glow: { color: 'rgba(100,180,160,0.2)', x: '50%', y: '35%', r: '420rpx' },
    texture: 'rain-ripple',                        // 雨滴涟漪
    elements: ['raindrop', 'mist', 'bamboo-shoot'], // 雨滴/薄雾/竹笋
    elementColors: ['#88b8a8', '#a8d0c0', '#7a9a8a'],
    particles: { type: 'rain-drop', count: 18, speed: 4000, size: [2, 4], opacity: [0.2, 0.5] },
    lightEffect: 'drizzle-haze',                   // 细雨朦胧
    overlayGradient: 'linear-gradient(180deg, rgba(100,180,160,0.1) 0%, transparent 50%)',
    vibe: '烟雨朦胧，润物无声'
  },

  // ===== 惊蛰 =====
  jingzhe: {
    sky: ['#d8e8c8', '#e4f0d8', '#f0f8e8'],      // 春雷初动
    ground: '#eef8ec',
    glow: { color: 'rgba(140,200,100,0.3)', x: '40%', y: '25%', r: '300rpx' },
    texture: 'lightning-crack',                    // 雷电裂纹
    elements: ['lightning', 'bud-burst', 'insect'], // 闪电/破土/虫动
    elementColors: ['#88c868', '#a8d888', '#688848'],
    particles: { type: 'electric-spark', count: 6, speed: 2000, size: [3, 8], opacity: [0.3, 0.7] },
    lightEffect: 'thunder-glow',                   // 雷光闪烁
    overlayGradient: 'linear-gradient(180deg, rgba(140,200,100,0.15) 0%, transparent 45%)',
    vibe: '春雷乍动，万物惊起'
  },

  // ===== 春分 =====
  chunfen: {
    sky: ['#b8dcc8', '#cce8d8', '#e0f4e8'],      // 青绿盎然
    ground: '#eef8ee',
    glow: { color: 'rgba(100,200,140,0.28)', x: '35%', y: '30%', r: '400rpx' },
    texture: 'willow-leaves',                      // 柳叶纹理
    elements: ['willow-leaf', 'butterfly', 'kite'], // 柳叶/蝴蝶/风筝
    elementColors: ['#6ab878', '#8ad898', '#ffb8c8', '#a8d8b8'],
    particles: { type: 'petal', count: 12, speed: 9000, size: [6, 14], opacity: [0.2, 0.55] },
    lightEffect: 'spring-breeze',                   // 春风和煦
    overlayGradient: 'linear-gradient(180deg, rgba(100,200,140,0.15) 0%, transparent 55%)',
    vibe: '杨柳春风，草长莺飞'
  },

  // ===== 清明 =====
  qingming: {
    sky: ['#b8c8b0', '#c8d8c0', '#d8e8d0'],      // 烟雨青灰
    ground: '#e8ede4',
    glow: { color: 'rgba(120,160,130,0.2)', x: '50%', y: '40%', r: '360rpx' },
    texture: 'rain-mist',                          // 烟雨纹理
    elements: ['rain-streak', 'mist-cloud', 'tomb-grass'], // 雨丝/云烟/青草
    elementColors: ['#88a890', '#a0b8a0', '#789868'],
    particles: { type: 'fine-rain', count: 22, speed: 3500, size: [1, 3], opacity: [0.15, 0.4] },
    lightEffect: 'overcast-mist',                  // 阴云薄雾
    overlayGradient: 'linear-gradient(180deg, rgba(120,160,130,0.12) 0%, transparent 50%)',
    vibe: '烟雨迷蒙，慎终追远'
  },

  // ===== 谷雨 =====
  guyu: {
    sky: ['#a8c098', '#b8d0a8', '#c8e0b8'],      // 湿润草绿
    ground: '#eef6ee',
    glow: { color: 'rgba(100,180,120,0.25)', x: '60%', y: '35%', r: '380rpx' },
    texture: 'rain-heavy',                         // 大雨纹理
    elements: ['rain-burst', 'sprout-heavy', 'peony'], // 暴雨/新苗/牡丹
    elementColors: ['#6a9a6a', '#88b888', '#d86888'],
    particles: { type: 'heavy-rain', count: 25, speed: 3000, size: [2, 5], opacity: [0.2, 0.5] },
    lightEffect: 'rain-shower',                    // 阵雨光效
    overlayGradient: 'linear-gradient(180deg, rgba(100,180,120,0.14) 0%, transparent 50%)',
    vibe: '雨生百谷，牡丹盛开'
  },

  // ===== 立夏 =====
  lixia: {
    sky: ['#fce8a0', '#fdf0b8', '#fef8d0'],      // 初夏明黄
    ground: '#fef8e8',
    glow: { color: 'rgba(255,200,80,0.3)', x: '50%', y: '25%', r: '420rpx' },
    texture: 'sunlight-warm',                      // 暖阳光斑
    elements: ['sun-ray', 'fresh-leaf', 'dragonfly'], // 阳光/新叶/蜻蜓
    elementColors: ['#f0c840', '#a8d868', '#60b8d8'],
    particles: { type: 'sun-dust', count: 8, speed: 12000, size: [4, 10], opacity: [0.15, 0.4] },
    lightEffect: 'warm-sunshine',                  // 暖阳明媚
    overlayGradient: 'linear-gradient(180deg, rgba(255,200,80,0.18) 0%, transparent 55%)',
    vibe: '夏日初长，万物繁茂'
  },

  // ===== 小满 =====
  xiaoman: {
    sky: ['#f8dc78', '#fce890', '#fdf0a8'],      // 麦穗金黄
    ground: '#fdf6d8',
    glow: { color: 'rgba(240,190,60,0.28)', x: '40%', y: '30%', r: '400rpx' },
    texture: 'wheat-grain',                        // 麦粒纹理
    elements: ['wheat-ear', 'golden-dew', 'cricket'], // 麦穗/金露/蟋蟀
    elementColors: ['#d4a830', '#e8c850', '#a88820'],
    particles: { type: 'wheat-chaff', count: 10, speed: 7000, size: [6, 14], opacity: [0.2, 0.5] },
    lightEffect: 'golden-hour',                    // 黄金时刻
    overlayGradient: 'linear-gradient(180deg, rgba(240,190,60,0.16) 0%, transparent 52%)',
    vibe: '麦穗将满，阳光正好'
  },

  // ===== 芒种 =====
  mangzhong: {
    sky: ['#f0c858', '#f8d878', '#fce898'],      // 繁忙金黄
    ground: '#fdf5d8',
    glow: { color: 'rgba(220,170,40,0.3)', x: '55%', y: '35%', r: '360rpx' },
    texture: 'rice-grain',                         // 稻粒纹理
    elements: ['rice-sheaf', 'lightning-summer', 'lotus-bud'], // 稻束/夏雷/荷苞
    elementColors: ['#c89820', '#e8b838', '#88c868'],
    particles: { type: 'chaff', count: 14, speed: 5000, size: [4, 10], opacity: [0.2, 0.5] },
    lightEffect: 'harsh-sunlight',                // 烈日
    overlayGradient: 'linear-gradient(180deg, rgba(220,170,40,0.18) 0%, transparent 48%)',
    vibe: '芒种忙种，稻麦交替'
  },

  // ===== 夏至 =====
  xiazhi: {
    sky: ['#f0a820', '#f8c040', '#fcd860'],      // 盛夏炽烈
    ground: '#fdf6e3',
    glow: { color: 'rgba(255,180,40,0.35)', x: '50%', y: '20%', r: '450rpx' },
    texture: 'sun-blaze',                          // 烈日光斑
    elements: ['lotus', 'cicada', 'sun-flare', 'summer-cloud'], // 荷花/蝉/日晕/夏云
    elementColors: ['#e88a30', '#f0c850', '#ffffff', '#ffd060'],
    particles: { type: 'firefly', count: 6, speed: 6000, size: [4, 8], opacity: [0.3, 0.7] },
    lightEffect: 'blazing-sun',                    // 骄阳似火
    overlayGradient: 'linear-gradient(180deg, rgba(255,180,40,0.22) 0%, transparent 50%)',
    vibe: '烈日当空，荷花满塘'
  },

  // ===== 小暑 =====
  xiaoshu: {
    sky: ['#f09830', '#f8b048', '#fcd068'],      // 闷热橙红
    ground: '#fef0e0',
    glow: { color: 'rgba(240,140,40,0.28)', x: '65%', y: '30%', r: '380rpx' },
    texture: 'heat-wave',                          // 热浪纹理
    elements: ['heat-haze', 'cicada-shadow', 'lotus-full'], // 热浪/蝉影/盛荷
    elementColors: ['#d87820', '#f0a840', '#e86848'],
    particles: { type: 'steam', count: 8, speed: 4000, size: [10, 20], opacity: [0.08, 0.25] },
    lightEffect: 'sweltering',                     // 闷热光效
    overlayGradient: 'linear-gradient(180deg, rgba(240,140,40,0.16) 0%, transparent 48%)',
    vibe: '暑气蒸腾，蝉鸣阵阵'
  },

  // ===== 大暑 =====
  dashu: {
    sky: ['#e05828', '#f07838', '#f89848'],      // 酷暑赤橙
    ground: '#fde8d8',
    glow: { color: 'rgba(240,100,30,0.3)', x: '50%', y: '25%', r: '400rpx' },
    texture: 'scorching',                          // 焦灼纹理
    elements: ['sun-scorch', 'dry-leaf', 'thunder-cloud'], // 灼日/枯叶/雷云
    elementColors: ['#c84818', '#e07838', '#808890'],
    particles: { type: 'heat-spark', count: 10, speed: 3000, size: [3, 8], opacity: [0.2, 0.5] },
    lightEffect: 'inferno-glow',                   // 火光
    overlayGradient: 'linear-gradient(180deg, rgba(240,100,30,0.2) 0%, transparent 45%)',
    vibe: '骄阳似火，酷暑难当'
  },

  // ===== 立秋 =====
  liqiu: {
    sky: ['#e8c898', '#f0d8b0', '#f8e8c8'],      // 初秋暖棕
    ground: '#fdf3e8',
    glow: { color: 'rgba(200,150,80,0.22)', x: '40%', y: '35%', r: '380rpx' },
    texture: 'first-leaf',                         // 初落叶纹理
    elements: ['first-yellow-leaf', 'cool-breeze', 'cicada-last'], // 初黄叶/凉风/末蝉
    elementColors: ['#c89848', '#e0b868', '#a88830'],
    particles: { type: 'drifting-leaf', count: 6, speed: 10000, size: [10, 18], opacity: [0.2, 0.45] },
    lightEffect: 'late-summer-warmth',             // 夏末余温
    overlayGradient: 'linear-gradient(180deg, rgba(200,150,80,0.12) 0%, transparent 50%)',
    vibe: '一叶知秋，凉风初至'
  },

  // ===== 处暑 =====
  chushu: {
    sky: ['#d8b888', '#e8c8a0', '#f0d8b8'],      // 秋高气爽
    ground: '#fdf0e0',
    glow: { color: 'rgba(180,140,80,0.2)', x: '60%', y: '30%', r: '360rpx' },
    texture: 'clear-sky',                          // 高爽纹理
    elements: ['high-cloud', 'migrant-bird', 'rice-golden'], // 高云/候鸟/金稻
    elementColors: ['#c8a060', '#e0c080', '#d4a830'],
    particles: { type: 'feather-drift', count: 5, speed: 12000, size: [8, 16], opacity: [0.15, 0.4] },
    lightEffect: 'crisp-morning',                  // 清秋晨光
    overlayGradient: 'linear-gradient(180deg, rgba(180,140,80,0.1) 0%, transparent 50%)',
    vibe: '秋高气爽，云淡天高'
  },

  // ===== 白露 =====
  bailu: {
    sky: ['#c8b898', '#d8c8a8', '#e8d8b8'],      // 白露清冷
    ground: '#f8f0e0',
    glow: { color: 'rgba(180,160,120,0.18)', x: '35%', y: '40%', r: '340rpx' },
    texture: 'dew-drop',                           // 露珠纹理
    elements: ['dewdrop', 'spider-web', 'reed'],   // 露珠/蛛网/芦苇
    elementColors: ['#a89070', '#c8b898', '#dac8a8'],
    particles: { type: 'dew-sparkle', count: 12, speed: 5000, size: [2, 6], opacity: [0.25, 0.6] },
    lightEffect: 'morning-frost',                  // 晨霜光效
    overlayGradient: 'linear-gradient(180deg, rgba(180,160,120,0.1) 0%, transparent 50%)',
    vibe: '白露凝霜，芦苇摇曳'
  },

  // ===== 秋分 =====
  qiufen: {
    sky: ['#b89868', '#c8a878', '#d8b888'],      // 秋色浓郁
    ground: '#fdf0e0',
    glow: { color: 'rgba(180,130,60,0.25)', x: '50%', y: '30%', r: '400rpx' },
    texture: 'maple-leaves',                       // 枫叶纹理
    elements: ['maple-leaf', 'harvest-wheat', 'moon-cake'], // 枫叶/丰收/月饼
    elementColors: ['#c85828', '#e88838', '#d4a060'],
    particles: { type: 'maple-leaf', count: 14, speed: 8000, size: [12, 22], opacity: [0.2, 0.55] },
    lightEffect: 'golden-afternoon',               // 金色午后
    overlayGradient: 'linear-gradient(180deg, rgba(180,130,60,0.15) 0%, transparent 52%)',
    vibe: '枫林尽染，月圆人圆'
  },

  // ===== 寒露 =====
  hanlu: {
    sky: ['#a88858', '#b89868', '#c8a878'],      // 深秋萧瑟
    ground: '#f8ece0',
    glow: { color: 'rgba(160,120,50,0.22)', x: '45%', y: '35%', r: '360rpx' },
    texture: 'frost-heavy',                        // 浓霜纹理
    elements: ['chrysanthemum', 'frost-leaf', 'misty-valley'], // 菊花/霜叶/雾谷
    elementColors: ['#c89830', '#a06828', '#889898'],
    particles: { type: 'frost-crystal', count: 10, speed: 6000, size: [3, 8], opacity: [0.2, 0.5] },
    lightEffect: 'autumn-twilight',                // 秋日暮光
    overlayGradient: 'linear-gradient(180deg, rgba(160,120,50,0.14) 0%, transparent 48%)',
    vibe: '露寒霜重，菊有黄华'
  },

  // ===== 霜降 =====
  shuangjiang: {
    sky: ['#988048', '#a89058', '#b8a068'],      // 暮秋深沉
    ground: '#f5ece0',
    glow: { color: 'rgba(140,100,40,0.25)', x: '55%', y: '30%', r: '340rpx' },
    texture: 'frost-crack',                        // 冰裂纹理
    elements: ['frost-pattern', 'red-maple', 'persimmon'], // 冰花/红枫/柿子
    elementColors: ['#a06828', '#d84828', '#e8a838'],
    particles: { type: 'frost-flake', count: 12, speed: 7000, size: [4, 10], opacity: [0.2, 0.5] },
    lightEffect: 'winter-approach',                // 冬之将至
    overlayGradient: 'linear-gradient(180deg, rgba(140,100,40,0.16) 0%, transparent 48%)',
    vibe: '霜叶红于二月花'
  },

  // ===== 立冬 =====
  lidong: {
    sky: ['#8898b8', '#98a8c8', '#a8b8d8'],      // 初冬灰蓝
    ground: '#edf0f8',
    glow: { color: 'rgba(100,120,180,0.2)', x: '40%', y: '35%', r: '380rpx' },
    texture: 'first-frost',                        // 初霜纹理
    elements: ['bare-tree', 'first-snow', 'dormant-bud'], // 枯树/初雪/冬芽
    elementColors: ['#7890a8', '#c8d8e8', '#8898a8'],
    particles: { type: 'light-snow', count: 12, speed: 8000, size: [4, 10], opacity: [0.25, 0.6] },
    lightEffect: 'pale-sunlight',                  // 惨淡日光
    overlayGradient: 'linear-gradient(180deg, rgba(100,120,180,0.12) 0%, transparent 50%)',
    vibe: '万物收藏，初雪将至'
  },

  // ===== 小雪 =====
  xiaoxue: {
    sky: ['#7890b0', '#88a0c0', '#98b0d0'],      // 阴沉灰蓝
    ground: '#e8edf6',
    glow: { color: 'rgba(80,100,160,0.22)', x: '50%', y: '30%', r: '360rpx' },
    texture: 'snow-pattern',                       // 雪纹
    elements: ['snowflake', 'pine-shadow', 'frozen-pond'], // 雪花/松影/冻池
    elementColors: ['#b8c8d8', '#688898', '#a0b0c0'],
    particles: { type: 'snow-fall', count: 18, speed: 7000, size: [5, 12], opacity: [0.3, 0.7] },
    lightEffect: 'overcast-grey',                  // 阴沉光效
    overlayGradient: 'linear-gradient(180deg, rgba(80,100,160,0.15) 0%, transparent 50%)',
    vibe: '初雪飘零，万籁俱寂'
  },

  // ===== 大雪 =====
  daxue: {
    sky: ['#6878a0', '#7888b0', '#8898c0'],      // 深冬严寒
    ground: '#e4eaf4',
    glow: { color: 'rgba(60,80,140,0.25)', x: '45%', y: '25%', r: '400rpx' },
    texture: 'snow-heavy-pattern',                 // 厚雪纹理
    elements: ['heavy-snow', 'snow-branch', 'ice-tree'], // 大雪/雪枝/雾凇
    elementColors: ['#c8d8e8', '#8898b0', '#d8e8f0'],
    particles: { type: 'blizzard', count: 24, speed: 5000, size: [6, 14], opacity: [0.35, 0.75] },
    lightEffect: 'snow-blanket',                   // 雪覆光效
    overlayGradient: 'linear-gradient(180deg, rgba(60,80,140,0.18) 0%, transparent 48%)',
    vibe: '大雪纷飞，银装素裹'
  },

  // ===== 冬至 =====
  dongzhi: {
    sky: ['#586898', '#6878a8', '#7888b8'],      // 冬至长夜
    ground: '#e0e6f4',
    glow: { color: 'rgba(80,100,180,0.2)', x: '30%', y: '45%', r: '300rpx' },
    texture: 'night-sky',                         // 夜空纹理
    elements: ['plum-blossom', 'snow-pine', 'lantern-warm'], // 寒梅/雪松/暖灯
    elementColors: ['#c83848', '#6888a8', '#e8a838'],
    particles: { type: 'soft-snow', count: 16, speed: 9000, size: [4, 10], opacity: [0.2, 0.55] },
    lightEffect: 'warm-window',                    // 窗内暖光
    overlayGradient: 'linear-gradient(180deg, rgba(80,100,180,0.15) 0%, transparent 50%)',
    vibe: '阴极阳生，长夜将尽'
  }
}

// ===== 获取背景配置 =====
function getBg(termKey) {
  return BG_CONFIGS[termKey] || BG_CONFIGS.chunfen
}

// ===== 生成多层背景的 WXSS style 字符串 =====
function getBgStyle(termKey) {
  const bg = getBg(termKey)

  // 多层背景拼接
  const layers = [
    // 1. 光晕（radial gradient）
    `radial-gradient(circle at ${bg.glow.x} ${bg.glow.y}, ${bg.glow.color} 0%, transparent ${bg.glow.r})`,
    // 2. 顶部天空色
    `linear-gradient(180deg, ${bg.sky[0]} 0%, ${bg.sky[1]} 40%, ${bg.sky[2]} 100%)`
  ].join(', ')

  return {
    // 组合 background
    background: layers,
    // 地面色（用于内容区背景）
    groundBg: bg.ground,
    // 覆盖层
    overlayGradient: bg.overlayGradient,
    // 完整内联样式字符串
    style: `background: ${layers};`
  }
}

// ===== 生成粒子 WXML 数据 =====
function getParticles(termKey) {
  const bg = getBg(termKey)
  const { type, count, speed, size, opacity } = bg.particles
  const list = []
  for (let i = 0; i < count; i++) {
    const w = randomBetween(size[0], size[1])
    list.push({
      type,
      width: w,
      height: type === 'rain-drop' || type === 'fine-rain' ? w * 4 : type === 'snowflake' || type === 'heavy-snow' ? w : w * 0.6,
      left: randomBetween(0, 100),
      delay: randomBetween(0, 5),
      duration: randomBetween(speed * 0.7, speed * 1.3),
      opacity: randomBetween(opacity[0], opacity[1]).toFixed(2),
      style: ``
    })
  }
  return list
}

// ===== 生成漂浮元素 WXML 数据 =====
function getFloatingElements(termKey) {
  const bg = getBg(termKey)
  return bg.elements.map((el, i) => ({
    type: el,
    color: bg.elementColors[i] || bg.elementColors[0],
    size: el === 'maple-leaf' ? 48 : el === 'snowflake' ? 36 : el === 'lotus' ? 60 : 40,
    left: [10, 30, 55, 75, 88][i] || (i * 20 + 10),
    top: [15, 40, 60, 25, 70][i] || (i * 15 + 10),
    rotation: randomBetween(-30, 30),
    delay: i * 0.8,
    duration: randomBetween(8, 15)
  }))
}

// ===== 获取纹理 SVG data URI =====
function getTextureSVG(termKey) {
  const bg = getBg(termKey)
  const textures = {
    'frost-pattern': generateFrostSVG(),
    'willow-leaves': generateWillowSVG(),
    'rain-ripple': generateRainSVG(),
    'sun-blaze': generateSunSVG(),
    'maple-leaves': generateMapleSVG(),
    'snow-pattern': generateSnowSVG(),
    'dew-drop': generateDewSVG(),
    'wheat-grain': generateWheatSVG(),
    'heat-wave': generateHeatSVG(),
    'lightning-crack': generateLightningSVG(),
    'morning-frost': generateMorningFrostSVG(),
    'night-sky': generateNightSkySVG(),
    'frost-crack': generateFrostCrackSVG(),
    'clear-sky': generateClearSkySVG(),
    'heavy-frost': generateHeavyFrostSVG(),
    'snow-heavy-pattern': generateSnowHeavySVG(),
    'first-frost': generateFirstFrostSVG(),
    'sunlight-warm': generateWarmSunSVG(),
    'sprout-pattern': generateSproutSVG(),
    'rain-mist': generateRainMistSVG(),
    'rain-heavy': generateRainHeavySVG(),
    'first-leaf': generateFirstLeafSVG(),
    'golden-hour': generateGoldenHourSVG()
  }
  return textures[bg.texture] || textures['frost-pattern']
}

// ===== SVG 生成函数（每个都是独特纹理） =====
function svgWrap(inner, w=750, h=1200) {
  return `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${inner}</svg>`).toString('base64')}`
}

function generateFrostSVG() {
  return svgWrap(`
    <defs><filter id="f"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4"/><feColorMatrix values="0 0 0 0 0.85 0 0 0 0 0.9 0 0 0 0 0.95 0 0 0 0.06 0"/></filter></defs>
    <rect width="750" height="1200" filter="url(#f)"/>
    <circle cx="200" cy="300" r="80" fill="none" stroke="rgba(200,220,240,0.3)" stroke-width="1"/>
    <circle cx="500" cy="700" r="120" fill="none" stroke="rgba(200,220,240,0.2)" stroke-width="1"/>
  `)
}

function generateWillowSVG() {
  return svgWrap(`
    <defs><filter id="w"><feTurbulence type="fractalNoise" baseFrequency="0.05 0.8" numOctaves="3"/></defs>
    <rect width="750" height="1200" fill="rgba(168,216,184,0.08)"/>
    <path d="M0,0 Q375,200 750,0" stroke="rgba(106,184,122,0.15)" stroke-width="2" fill="none"/>
    <path d="M50,100 Q200,300 100,500" stroke="rgba(106,184,122,0.1)" stroke-width="1.5" fill="none"/>
    <path d="M600,50 Q500,250 650,450" stroke="rgba(106,184,122,0.1)" stroke-width="1.5" fill="none"/>
    <circle cx="375" cy="600" r="200" fill="rgba(168,216,184,0.06)"/>
  `)
}

function generateRainSVG() {
  return svgWrap(`
    <defs><filter id="r"><feTurbulence type="turbulence" baseFrequency="0.02 0.5" numOctaves="2"/></defs>
    <rect width="750" height="1200" fill="rgba(168,200,190,0.06)"/>
    <line x1="100" y1="0" x2="80" y2="1200" stroke="rgba(100,160,140,0.08)" stroke-width="1"/>
    <line x1="300" y1="0" x2="280" y2="1200" stroke="rgba(100,160,140,0.06)" stroke-width="1"/>
    <line x1="500" y1="0" x2="480" y2="1200" stroke="rgba(100,160,140,0.07)" stroke-width="1"/>
    <line x1="700" y1="0" x2="680" y2="1200" stroke="rgba(100,160,140,0.05)" stroke-width="1"/>
  `)
}

function generateSunSVG() {
  return svgWrap(`
    <defs><radialGradient id="sg"><stop offset="0%" stop-color="rgba(255,220,100,0.3)"/><stop offset="100%" stop-color="rgba(255,220,100,0)"/></radialGradient></defs>
    <rect width="750" height="1200" fill="rgba(252,240,180,0.1)"/>
    <circle cx="375" cy="300" r="250" fill="url(#sg)"/>
    <circle cx="375" cy="300" r="80" fill="rgba(255,240,180,0.25)"/>
  `)
}

function generateMapleSVG() {
  return svgWrap(`
    <defs><filter id="m"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3"/><feColorMatrix values="0 0 0 0 0.8 0 0 0 0 0.3 0 0 0 0 0.1 0 0 0 0.04 0"/></filter></defs>
    <rect width="750" height="1200" filter="url(#m)"/>
    <path d="M375,100 L400,200 L450,180 L420,280 L500,300 L430,380 L480,450 L375,400 L270,450 L320,380 L250,300 L330,280 L300,180 L350,200 Z" fill="rgba(200,88,40,0.06)"/>
  `)
}

function generateSnowSVG() {
  return svgWrap(`
    <defs><filter id="sn"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="4"/><feColorMatrix values="0 0 0 0 0.9 0 0 0 0 0.92 0 0 0 0 0.96 0 0 0 0.05 0"/></filter></defs>
    <rect width="750" height="1200" filter="url(#sn)"/>
    <circle cx="150" cy="200" r="40" fill="rgba(255,255,255,0.08)"/>
    <circle cx="550" cy="500" r="60" fill="rgba(255,255,255,0.06)"/>
    <circle cx="350" cy="800" r="50" fill="rgba(255,255,255,0.07)"/>
  `)
}

function generateDewSVG() {
  return svgWrap(`
    <defs><filter id="d"><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3"/></defs>
    <rect width="750" height="1200" fill="rgba(220,210,190,0.06)"/>
    <ellipse cx="200" cy="400" rx="8" ry="12" fill="rgba(180,200,220,0.15)"/>
    <ellipse cx="350" cy="600" rx="6" ry="10" fill="rgba(180,200,220,0.12)"/>
    <ellipse cx="500" cy="300" rx="10" ry="14" fill="rgba(180,200,220,0.1)"/>
    <ellipse cx="600" cy="700" rx="7" ry="11" fill="rgba(180,200,220,0.13)"/>
  `)
}

function generateWheatSVG() {
  return svgWrap(`
    <rect width="750" height="1200" fill="rgba(248,232,180,0.08)"/>
    <path d="M370,100 Q375,300 370,500" stroke="rgba(200,160,60,0.12)" stroke-width="2"/>
    <path d="M375,150 Q360,200 370,250" stroke="rgba(200,160,60,0.1)" stroke-width="1.5"/>
    <path d="M375,250 Q390,300 375,350" stroke="rgba(200,160,60,0.1)" stroke-width="1.5"/>
    <path d="M375,350 Q360,400 375,450" stroke="rgba(200,160,60,0.1)" stroke-width="1.5"/>
  `)
}

function generateHeatSVG() {
  return svgWrap(`
    <defs><filter id="h"><feTurbulence type="turbulence" baseFrequency="0.01 0.05" numOctaves="2"><animate attributeName="baseFrequency" dur="10s" values="0.01 0.05;0.02 0.08;0.01 0.05"/></filter></defs>
    <rect width="750" height="1200" fill="rgba(240,140,60,0.04)"/>
    <rect width="750" height="1200" filter="url(#h)" opacity="0.3"/>
  `)
}

function generateLightningSVG() {
  return svgWrap(`
    <rect width="750" height="1200" fill="rgba(140,200,100,0.03)"/>
    <path d="M350,0 L320,200 L360,250 L300,500" stroke="rgba(140,200,100,0.08)" stroke-width="2" fill="none"/>
    <path d="M400,100 L380,300 L410,350 L370,600" stroke="rgba(140,200,100,0.06)" stroke-width="1.5" fill="none"/>
  `)
}

function generateMorningFrostSVG() {
  return svgWrap(`
    <defs><filter id="mf"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4"/><feColorMatrix values="0 0 0 0 0.8 0 0 0 0 0.75 0 0 0 0 0.7 0 0 0 0.05 0"/></filter></defs>
    <rect width="750" height="1200" filter="url(#mf)"/>
    <rect width="750" height="600" fill="linear-gradient(to bottom, rgba(255,250,240,0.1), transparent)"/>
  `)
}

function generateNightSkySVG() {
  return svgWrap(`
    <defs><radialGradient id="ng"><stop offset="0%" stop-color="rgba(80,100,180,0.15)"/><stop offset="100%" stop-color="rgba(40,50,100,0.25)"/></radialGradient></defs>
    <rect width="750" height="1200" fill="url(#ng)"/>
    <circle cx="600" cy="200" r="40" fill="rgba(255,240,200,0.15)"/>
    <circle cx="200" cy="400" r="2" fill="rgba(255,255,255,0.4)"/>
    <circle cx="350" cy="150" r="1.5" fill="rgba(255,255,255,0.3)"/>
    <circle cx="500" cy="350" r="2" fill="rgba(255,255,255,0.35)"/>
  `)
}

function generateFrostCrackSVG() {
  return svgWrap(`
    <defs><filter id="fc"><feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="2"/><feDisplacementMap in="SourceGraphic" scale="20"/></defs>
    <rect width="750" height="1200" fill="rgba(140,100,60,0.04)"/>
    <path d="M375,0 L375,1200 M200,300 L550,300 M150,600 L600,600 M250,900 L500,900" stroke="rgba(140,100,60,0.08)" stroke-width="1" filter="url(#fc)"/>
  `)
}

function generateClearSkySVG() {
  return svgWrap(`
    <rect width="750" height="1200" fill="rgba(220,200,160,0.05)"/>
    <ellipse cx="375" cy="200" rx="300" ry="40" fill="rgba(255,255,255,0.15)"/>
    <ellipse cx="200" cy="400" rx="150" ry="20" fill="rgba(255,255,255,0.1)"/>
    <ellipse cx="550" cy="600" rx="200" ry="25" fill="rgba(255,255,255,0.08)"/>
  `)
}

function generateHeavyFrostSVG() {
  return svgWrap(`
    <defs><filter id="hf"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="5"/><feColorMatrix values="0 0 0 0 0.7 0 0 0 0 0.75 0 0 0 0 0.8 0 0 0 0.08 0"/></filter></defs>
    <rect width="750" height="1200" filter="url(#hf)"/>
    <rect width="750" height="400" fill="rgba(255,255,255,0.06)"/>
  `)
}

function generateSnowHeavySVG() {
  return svgWrap(`
    <defs><filter id="sh"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4"/><feColorMatrix values="0 0 0 0 0.85 0 0 0 0 0.88 0 0 0 0 0.92 0 0 0 0.07 0"/></filter></defs>
    <rect width="750" height="1200" filter="url(#sh)"/>
    <circle cx="100" cy="100" r="60" fill="rgba(255,255,255,0.1)"/>
    <circle cx="400" cy="300" r="80" fill="rgba(255,255,255,0.08)"/>
    <circle cx="650" cy="200" r="50" fill="rgba(255,255,255,0.09)"/>
    <circle cx="250" cy="500" r="70" fill="rgba(255,255,255,0.07)"/>
    <circle cx="550" cy="700" r="90" fill="rgba(255,255,255,0.06)"/>
  `)
}

function generateFirstFrostSVG() {
  return svgWrap(`
    <defs><filter id="ff"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3"/><feColorMatrix values="0 0 0 0 0.75 0 0 0 0 0.8 0 0 0 0 0.9 0 0 0 0.05 0"/></filter></defs>
    <rect width="750" height="1200" filter="url(#ff)"/>
    <rect width="750" height="1200" fill="rgba(100,120,180,0.03)"/>
  `)
}

function generateWarmSunSVG() {
  return svgWrap(`
    <defs><radialGradient id="ws"><stop offset="0%" stop-color="rgba(255,220,120,0.25)"/><stop offset="70%" stop-color="rgba(255,200,80,0.05)"/><stop offset="100%" stop-color="rgba(255,200,80,0)"/></radialGradient></defs>
    <rect width="750" height="1200" fill="rgba(255,248,220,0.08)"/>
    <circle cx="500" cy="250" r="300" fill="url(#ws)"/>
    <circle cx="500" cy="250" r="60" fill="rgba(255,240,180,0.2)"/>
  `)
}

function generateSproutSVG() {
  return svgWrap(`
    <rect width="750" height="1200" fill="rgba(200,230,210,0.06)"/>
    <path d="M370,500 Q375,400 370,300 Q380,350 385,400 Q375,450 370,500" fill="rgba(106,184,122,0.1)"/>
    <path d="M375,450 Q360,380 350,320 Q365,370 375,420" fill="rgba(106,184,122,0.08)"/>
  `)
}

function generateRainMistSVG() {
  return svgWrap(`
    <defs><filter id="rm"><feTurbulence type="fractalNoise" baseFrequency="0.01 0.1" numOctaves="3"/><feColorMatrix values="0 0 0 0 0.8 0 0 0 0 0.85 0 0 0 0 0.82 0 0 0 0.06 0"/></filter></defs>
    <rect width="750" height="1200" filter="url(#rm)"/>
    <line x1="150" y1="0" x2="120" y2="1200" stroke="rgba(100,160,140,0.06)" stroke-width="1"/>
    <line x1="400" y1="0" x2="370" y2="1200" stroke="rgba(100,160,140,0.05)" stroke-width="1"/>
    <line x1="600" y1="0" x2="570" y2="1200" stroke="rgba(100,160,140,0.07)" stroke-width="1"/>
  `)
}

function generateRainHeavySVG() {
  return svgWrap(`
    <defs><filter id="rh"><feTurbulence type="turbulence" baseFrequency="0.03 0.6" numOctaves="2"/></defs>
    <rect width="750" height="1200" fill="rgba(100,140,110,0.04)"/>
    <rect width="750" height="1200" filter="url(#rh)" opacity="0.3"/>
    <line x1="50" y1="0" x2="30" y2="1200" stroke="rgba(80,130,100,0.08)" stroke-width="1.5"/>
    <line x1="200" y1="0" x2="180" y2="1200" stroke="rgba(80,130,100,0.07)" stroke-width="1.5"/>
    <line x1="400" y1="0" x2="380" y2="1200" stroke="rgba(80,130,100,0.09)" stroke-width="1.5"/>
    <line x1="600" y1="0" x2="580" y2="1200" stroke="rgba(80,130,100,0.08)" stroke-width="1.5"/>
    <line x1="700" y1="0" x2="680" y2="1200" stroke="rgba(80,130,100,0.06)" stroke-width="1.5"/>
  `)
}

function generateFirstLeafSVG() {
  return svgWrap(`
    <rect width="750" height="1200" fill="rgba(240,220,190,0.05)"/>
    <path d="M350,200 Q375,150 400,200 Q375,250 350,200" fill="rgba(200,160,80,0.08)"/>
    <path d="M300,400 Q330,350 360,400 Q330,450 300,400" fill="rgba(180,140,60,0.06)"/>
    <path d="M420,350 Q450,300 480,350 Q450,400 420,350" fill="rgba(200,160,80,0.07)"/>
  `)
}

function generateGoldenHourSVG() {
  return svgWrap(`
    <defs><linearGradient id="gh" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="rgba(240,190,80,0.12)"/><stop offset="50%" stop-color="rgba(220,170,60,0.06)"/><stop offset="100%" stop-color="rgba(200,150,40,0)"/></linearGradient></defs>
    <rect width="750" height="1200" fill="url(#gh)"/>
    <circle cx="550" cy="180" r="100" fill="rgba(255,220,120,0.12)"/>
  `)
}

// ===== 工具函数 =====
function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

// ===== 导出 =====

// ===== 康康食养AI 补充：节气中文名 → 配置 key =====
// 本项目的节气数据以中文名为主键，这里补一张映射，调用方直接传中文名即可
const NAME_TO_KEY = {
  小寒: 'xiaohan', 大寒: 'dahan', 立春: 'lichun', 雨水: 'yushui',
  惊蛰: 'jingzhe', 春分: 'chunfen', 清明: 'qingming', 谷雨: 'guyu',
  立夏: 'lixia', 小满: 'xiaoman', 芒种: 'mangzhong', 夏至: 'xiazhi',
  小暑: 'xiaoshu', 大暑: 'dashu', 立秋: 'liqiu', 处暑: 'chushu',
  白露: 'bailu', 秋分: 'qiufen', 寒露: 'hanlu', 霜降: 'shuangjiang',
  立冬: 'lidong', 小雪: 'xiaoxue', 大雪: 'daxue', 冬至: 'dongzhi',
}

// 按中文节气名取背景配置；取不到（异常名）返回 null，页面保持默认纸底
function getBgByName(name) {
  const key = NAME_TO_KEY[name]
  return key ? getBg(key) : null
}

function getBgStyleByName(name) {
  const key = NAME_TO_KEY[name]
  return key ? getBgStyle(key) : null
}

function getParticlesByName(name) {
  const key = NAME_TO_KEY[name]
  return key ? getParticles(key) : []
}

function getFloatingElementsByName(name) {
  const key = NAME_TO_KEY[name]
  return key ? getFloatingElements(key) : []
}

function getTextureSVGByName(name) {
  const key = NAME_TO_KEY[name]
  return key ? getTextureSVG(key) : ''
}

module.exports = {
  getBg,
  getBgStyle,
  getParticles,
  getFloatingElements,
  getTextureSVG,
  BG_CONFIGS,
  NAME_TO_KEY,
  getBgByName,
  getBgStyleByName,
  getParticlesByName,
  getFloatingElementsByName,
  getTextureSVGByName,
}
