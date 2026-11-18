// utils/dishImages.js —— 菜品图映射（C 的「风味卡填充」落地件）
//
// 图片来源：AI 生成风味卡 tupian.zip（岭南三系经典菜，29 张菜品卡）。
// 原卡上 44% 是文字区（菜名 / 当令 / 经典做法 / 长者提示），直接塞进列表的
// 横条图位会拦腰裁断文字，所以入库前统一裁掉文字区、只留下部照片带（1.6:1）。
// 裁剪脚本参数：band 顶对齐 44%，宽 640px，JPEG q68，单张约 25–45KB。
//
// 设计要点：
//   1. 键是「菜名」而不是菜品 id —— A 的知识库扩容（乙 264 道）把同名菜写进
//      card_meta.csv 后，跑一遍 scripts/build-data.js 即可自动出图，前端零改动。
//   2. 知识库已收录但菜名略异的菜，走 ALIAS 近似映射（冬瓜盅 / 猪肚鸡汤）。
//   3. 查不到一律返回空串：视图层 wx:if="{{dish.image}}" 为假时走原有的
//      emoji 占位块，不会出现空灰块（铁律：不把 undefined 透给视图层）。
//   4. 图片加载失败时各页面已有的 binderror 会回落到同一占位，无需这里兜底。

// 菜品图已移出主包：放分包 packageDishes/dishes/，主包页面通过全路径引用，
// 微信会按需下载该分包。主包因此从 2030 KB 降到 1446 KB，给数据留出余量。
const IMAGE_BASE = '/packageDishes/dishes/';

// —— 云存储开关（A 扩容到全量配图后的承载方案） ——
// 为什么走云不走分包：419 道全配图会到几十 MB，分包 20MB 总上限扛不住；
// 而微信云存储用 cloud:// fileID，image 组件直接加载，免 ICP 备案、免 downloadFile 域名。
//
// 上云三步（详见项目根 docs/云存储接入指南.md）：
//   1. 微信开发者工具开通「云开发」→ 存储 → 新建 dishes/ 目录，权限设「所有用户可读」
//   2. 上传图片后，取任一 fileID 的前缀（到文件名前为止）填进 IMAGE_CLOUD_BASE
//   3. IMAGE_ON_CLOUD 置 true；确认云图能加载后，把 images/dishes/ 从主包删掉瘦身
const IMAGE_ON_CLOUD = false;
// 例：'cloud://prod-xxxx.7072-prod-xxxx-1300000000/dishes/'
const IMAGE_CLOUD_BASE = '';

// 经典卡菜名 → 图片文件名（广府 10 / 潮汕 10 / 客家 9）
// ⚠ 2026-11-13 逐张核对画面内容后重排：原批次按文件名顺序套用，导致约一半错位
//   （例：qingzhengluyu.jpg 画面是叉烧、cuipishaorou.jpg 是白灼虾）。
//   现在一律「按画面内容」定键，文件名不再作依据；后续加图请先看图再填。
const DISH_IMAGES = {
  // ── 广府菜 ──
  '白切鸡': 'baiqieji.jpg',
  '虾饺': 'xiajiao.jpg',
  '白灼虾': 'cuipishaorou.jpg',       // 画面：白灼虾
  '清蒸鲈鱼': 'mizhichashao.jpg',     // 画面：清蒸鱼
  '蜜汁叉烧': 'qingzhengluyu.jpg',    // 画面：叉烧
  '脆皮烧肉': 'baizhuoxia.jpg',       // 画面：脆皮烧肉
  '冬瓜盅': 'dongguazhong.jpg',
  '老火汤': 'laohuotang.jpg',
  '腊味煲仔饭': 'laweibaozifan.jpg',
  '萝卜牛腩煲': 'luoboniunanbao.jpg',
  // ── 潮汕菜 ──
  '蚝烙': 'haolao.jpg',
  '潮汕牛肉丸汤': 'chaoshanniurouhg.jpg', // 画面：牛肉丸清汤
  '潮汕牛肉火锅': 'chaoshanniurouwan.jpg', // 画面：牛肉火锅
  '潮汕砂锅粥': 'puziguo.jpg',            // 画面：虾粥
  '潮汕鱼饭': 'chaoshanyufan.jpg',
  '卤狮头鹅': 'lushitoue.jpg',
  '潮汕卤鹅': 'chaoshanshaguozhou.jpg',   // 画面：卤鹅
  '潮州冻蟹': 'chaozhoudongxie.jpg',
  '护国菜': 'huguocai.jpg',
  // ── 客家菜 ──
  '盐焗鸡': 'yanjuji.jpg',
  '梅菜扣肉': 'kejiapencai.jpg',      // 画面：扣肉
  '煎酿豆腐': 'meicaikourou.jpg',     // 画面：酿豆腐
  '客家盆菜': 'hujiaozhudujitang.jpg', // 画面：盆菜
  '胡椒猪肚鸡汤': 'jianniangdoufu.jpg', // 画面：猪肚汤
  '艾粄': 'aiban.jpg',
  '仙人粄': 'kejiayanmian.jpg',       // 画面：黑色凉粉
  '客家腌面': 'xianrenban.jpg',       // 画面：拌面
  '麒麟脱胎': 'qilintuotai.jpg',
  // ── 立冬当令（知识库 4 道当令菜，原先全无图；2026-11 AI 生成补图，已裁掉生成水印） ──
  // 首页「当令菜」主推大卡 + 横滑直接取这 4 张，保证打开首屏有真实菜品图而非风味签
  '当归生姜羊肉汤': 'dangguiyangroutang.jpg',
  '红枣枸杞生姜茶': 'hongzaogouqicha.jpg',
  '黑芝麻山药粥': 'heizhimashanyaozhou.jpg',
  '黑豆核桃猪骨汤': 'heidouhetaozhugutang.jpg',
  // ── 冬季节气展示牌（2026-11-17 AI 生成，640×400 q68，已裁掉生成水印） ──
  // 首页展示牌改成「三系各一道」后，立冬~大寒 6 个节气的 18 道里有 14 道原先无图，
  // 这里按菜名补齐；盐焗鸡/麒麟脱胎/潮汕牛肉丸汤/胡椒猪肚汤复用原图。
  '白灼菜心': 'baizhuocaixin.jpg',
  '黄芪炖乳鸽': 'huangqidunruge.jpg',
  '党参枸杞炖乳鸽': 'dangshengouqiruge.jpg',
  '黄芪枸杞炖乳鸽': 'huangqigouqiruge.jpg',
  '响螺炖鸡汤': 'xiangluodunjitang.jpg',
  '娘酒羊肉煲': 'niangjiuyangroubao.jpg',
  '子姜焖鸭': 'zijiangmenya.jpg',
  '汀州泡猪腰': 'tingzhupaozhuyao.jpg',
  '卤水鹅掌翼': 'lushuiezhangyi.jpg',
  '冬节丸': 'dongjiewan.jpg',
  '生腌膏蟹': 'shengyanxie.jpg',
  '清蒸带子': 'qingzhengdaizi.jpg',
  '老香黄炖鸭': 'laoxianghuangdunya.jpg',
  '老火例汤（章鱼莲藕猪骨）': 'zhangyulianou.jpg',
};

// 近似名映射：知识库现有菜名与经典卡菜名略异，属同类菜式，共用一张图
const ALIAS = {
  '莲子鸭肉冬瓜盅': 'dongguazhong.jpg', // 经典卡「冬瓜盅」
  '胡椒猪肚汤': 'jianniangdoufu.jpg', // 同「胡椒猪肚鸡汤」
};

// 解析图片地址：映射值本身已是完整地址（云 fileID / https）就直接用，
// 否则按当前开关拼云前缀或本地路径。A 扩容的新菜可直接在映射表里填云地址，
// 与仍在本地的旧菜混排，互不干扰。
function resolveImage(file) {
  if (!file) return '';
  if (/^(https?:)?\/\//.test(file) || file.indexOf('cloud://') === 0) return file;
  const base = IMAGE_ON_CLOUD && IMAGE_CLOUD_BASE ? IMAGE_CLOUD_BASE : IMAGE_BASE;
  return base + file;
}

// 按菜名取图。未收录的菜返回空串，视图层走 emoji 占位。
function imageForName(name) {
  const target = name === null || name === undefined ? '' : String(name).trim();
  if (!target) return '';
  return resolveImage(DISH_IMAGES[target] || ALIAS[target]);
}

module.exports = {
  IMAGE_BASE,
  IMAGE_ON_CLOUD,
  IMAGE_CLOUD_BASE,
  DISH_IMAGES,
  ALIAS,
  imageForName,
};
