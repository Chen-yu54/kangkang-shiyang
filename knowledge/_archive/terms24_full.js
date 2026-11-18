/**
 * 24 节气完整数据 + 主题配置
 * 
 * 每个节气包含：
 *   - 基础信息（名称/日期/季节归属）
 *   - 主题色板（自动驱动 UI 变色）
 *   - 视觉配置（背景风格/装饰元素/氛围关键词）
 *   - 内容（诗词/物候/民俗/养生）
 *   - 物候（七十二候对应）
 */

const TERMS_24 = [
  // ========== 冬季 ========
  {
    key: 'xiaohan', name: '小寒', order: 23,
    date: '1月5-7日', solarDate: '01-05', season: 'winter',
    slogan: '月初寒尚小',
    theme: {
      primary: '#3b5a8a', accent: '#5a8ac8', bg: '#eef3fa',
      gradient: ['#6a9ac8', '#2a4a7a'], text: '#1a2a4a',
      texture: 'frost', aura: '冷冽清透'
    },
    poem: { text: '小寒连大吕\n欢鹊垒新巢', author: '元稹《咏廿四气诗》' },
    phenology: '一候雁北乡，二候鹊始巢，三候雉始鸲',
    desc: '小寒标志着开始进入一年中最寒冷的日子，但阳气已动，候鸟开始北迁。',
    health: '宜温补，食羊肉、核桃、红枣，早睡晚起养藏阳气。忌生冷寒凉。',
    folk: [
      { title: '吃腊八粥', icon: '🍲', desc: '小寒前后正值腊八节，民间熬腊八粥祭祀祖先并馈赠亲友。', detail: '腊八粥用糯米、红枣、花生、莲子、桂圆等熬制，甜糯暖胃，寓意丰收吉祥。' },
      { title: '探梅', icon: '🌸', desc: '腊梅凌寒而开，此时正是探梅赏梅的最佳时节。', detail: '古人以梅为"岁寒三友"之一，赏梅品茗是高雅的冬日消遣。' }
    ]
  },
  {
    key: 'dahan', name: '大寒', order: 24,
    date: '1月20-21日', solarDate: '01-20', season: 'winter',
    slogan: '寒气之逆极',
    theme: {
      primary: '#2a4070', accent: '#4a6aa8', bg: '#e8edf6',
      gradient: ['#5878b0', '#1e3058'], text: '#0e1e38',
      texture: 'snow', aura: '严寒深沉'
    },
    poem: { text: '旧雪未及消\n新雪又拥户', author: '邵雍《大寒吟》' },
    phenology: '一候鸡始乳，二候征鸟厉疾，三候水泽腹坚',
    desc: '大寒是全年最后一个节气，天气寒冷到极致，但也预示着春天不远了。',
    health: '防风御寒，睡前泡脚，适当进补。大寒过后阳气渐生，不宜过度温补。',
    folk: [
      { title: '尾牙祭', icon: '🏮', desc: '商家一年活动的尾声，祭拜土地公，感谢一年庇佑。', detail: '尾牙源自"做牙"习俗，现代企业演变为"年会"，是年终重要的聚餐庆祝。' },
      { title: '蒸糯米饭', icon: '🍚', desc: '广东民间有大寒吃糯米饭的传统，糯米性温御寒。', detail: '糯米饭拌以腊味、虾米、冬菇等，香气扑鼻，是岭南大寒时节的应景美食。' }
    ]
  },
  {
    key: 'lichun', name: '立春', order: 1,
    date: '2月3-5日', solarDate: '02-04', season: 'spring',
    slogan: '万物复苏始',
    theme: {
      primary: '#3a8a5a', accent: '#6abf7a', bg: '#eef8ef',
      gradient: ['#8ad8a0', '#2d6a44'], text: '#1a3a2a',
      texture: 'sprout', aura: '清新嫩绿'
    },
    poem: { text: '律回岁晚冰霜少\n春到人间草木知', author: '张栻《立春偶成》' },
    phenology: '一候东风解冻，二候蛰虫始振，三候鱼陟负冰',
    desc: '立春是二十四节气之首，意味着万物复苏，新的轮回开始。东风送暖，大地解冻。',
    health: '宜食辛甘发散之品，如韭菜、香菜、萝卜。不宜吃酸收之味。早睡早起，顺应春生。',
    folk: [
      { title: '鞭春牛', icon: '🐂', desc: '打春牛以示劝农，祈求五谷丰登。', detail: '用泥土塑成春牛，用彩鞭抽打，寓意鞭策农耕。州县官行"打春"仪式，分送春牛图。' },
      { title: '咬春', icon: '🌯', desc: '吃春饼、春卷、萝卜，谓之"咬春"。', detail: '"咬得草根断，则百事可做"。春饼卷合菜，春卷炸至金黄，都是迎接春天的仪式感。' }
    ]
  },
  {
    key: 'yushui', name: '雨水', order: 2,
    date: '2月18-20日', solarDate: '02-19', season: 'spring',
    slogan: '好雨知时节',
    theme: {
      primary: '#4a9a78', accent: '#7ac8a0', bg: '#edf6f3',
      gradient: ['#9adcc0', '#2d7a58'], text: '#1a3a30',
      texture: 'rain', aura: '湿润朦胧'
    },
    poem: { text: '天街小雨润如酥\n草色遥看近却无', author: '韩愈《早春呈水部张十八员外》' },
    phenology: '一候獭祭鱼，二候鸿雁来，三候草木萌动',
    desc: '雨水节气气温回升，冰雪融化，降水增多。春风化雨，滋养万物萌发。',
    health: '春寒料峭注意保暖，宜食大枣、蜂蜜、山药等甘味食物。少吃酸冷，调养脾胃。',
    folk: [
      { title: '回娘家', icon: '👩‍👧', desc: '川西地区出嫁女儿在雨水这天带礼物回娘家。', detail: '礼物通常是两把藤椅缠红带（"接寿"），感谢父母养育之恩。' },
      { title: '占稻色', icon: '🌾', desc: '通过爆炒糯谷米花来占卜当年稻谷收成。', detail: '爆出来的米花越多越白，预示稻谷收成越好。这一习俗流行于华南地区。' }
    ]
  },
  {
    key: 'jingzhe', name: '惊蛰', order: 3,
    date: '3月5-7日', solarDate: '03-06', season: 'spring',
    slogan: '春雷惊百虫',
    theme: {
      primary: '#5a8a3a', accent: '#8ac858', bg: '#f0f8ee',
      gradient: ['#a8e088', '#3a6a28'], text: '#1a3010',
      texture: 'thunder', aura: '生机勃发'
    },
    poem: { text: '微雨众卉新\n一雷惊蛰始', author: '韦应物《观田家》' },
    phenology: '一候桃始华，二候仓庚鸣，三候鹰化为鸠',
    desc: '惊蛰意为春雷乍动，惊醒了蛰伏越冬的昆虫。桃花初绽，黄鹂鸣叫，万物复苏加速。',
    health: '宜清淡饮食，多吃梨润肺（"惊蛰吃梨"习俗）。少食油腻，预防"春困"。',
    folk: [
      { title: '吃梨', icon: '🍐', desc: '惊蛰吃梨，寓意与害虫别离，亦润肺止咳。', detail: '山西民间有"惊蛰吃了梨，一年都精神"的说法。梨可生食、蒸食、榨汁、烤食。' },
      { title: '打小人', icon: '🗣️', desc: '用鞋子拍打纸人，寓意驱赶霉运和小人。', detail: '流行于香港、广东地区。在惊蛰这天到庙宇或路边，用拖鞋拍打小人纸，口念咒语。' }
    ]
  },
  {
    key: 'chunfen', name: '春分', order: 4,
    date: '3月20-22日', solarDate: '03-21', season: 'spring',
    slogan: '阴阳相半也',
    theme: {
      primary: '#3a8a5a', accent: '#6abf7a', bg: '#eef5ee',
      gradient: ['#a8d8b8', '#2d5a3d'], text: '#1a3a2a',
      texture: 'willow', aura: '杨柳春风'
    },
    poem: { text: '草长莺飞二月天\n拂堤杨柳醉春烟\n儿童散学归来早\n忙趁东风放纸鸢', author: '高鼎《村居》' },
    phenology: '一候元鸟至，二候雷乃发声，三候始电',
    desc: '春分昼夜均分，阴阳相半。是春种作物播种的大忙季节，农事繁忙。',
    health: '春分时节调理阴阳平衡，注意餐饮。宜早睡早起，保持心情舒畅。',
    folk: [
      { title: '放风筝', icon: '🪁', desc: '风筝起源于中国，鲁班以竹为鸢。潍坊被称为风筝之都。', detail: '晚唐在纸鸢上加竹笛，风吹发出筝声，故称"风筝"。春分放鸢是迎接春天的标志。' },
      { title: '吃春菜', icon: '🥬', desc: '春分吃春菜保佑全家平安，春汤灌脏洗涤肝肠。', detail: '春菜即野苋菜（春碧蒿），与鱼片滚汤名"春汤"。顺口溜："春汤灌脏，阖家老少平安健康。"' },
      { title: '竖蛋', icon: '🥚', desc: '4000年前庆春习俗，春分这天最容易把鸡蛋立起来。', detail: '"春分到，蛋儿俏"。春分不冷不热，人心舒畅思维敏捷，易于竖蛋成功。寓意"添丁"人丁兴旺。' }
    ]
  },
  {
    key: 'qingming', name: '清明', order: 5,
    date: '4月4-6日', solarDate: '04-05', season: 'spring',
    slogan: '气清景明时',
    theme: {
      primary: '#4a7a5a', accent: '#7ab88a', bg: '#eef6f0',
      gradient: ['#a0d8b0', '#2d5a40'], text: '#1a3020',
      texture: 'rain-mist', aura: '烟雨迷蒙'
    },
    poem: { text: '清明时节雨纷纷\n路上行人欲断魂', author: '杜牧《清明》' },
    phenology: '一候桐始华，二候田鼠化为鹌，三候虹始见',
    desc: '清明既是节气也是节日。此时万物生长，清洁明净，故谓之清明。',
    health: '宜食清淡，多食荠菜、香椿等时令蔬菜。扫墓踏青注意防湿寒。',
    folk: [
      { title: '扫墓祭祖', icon: '🕯️', desc: '清明节最重要的习俗，慎终追远。', detail: '铲除杂草、供奉祭品、焚香祷祝。各地还有"挂纸""培墓"等不同做法。' },
      { title: '踏青插柳', icon: '🌿', desc: '清明踏青折柳插门，辟邪迎春。', detail: '柳谐音"留"，有挽留春光之意。插柳于门楣或头上，是古老的迎春辟邪习俗。' }
    ]
  },
  {
    key: 'guyu', name: '谷雨', order: 6,
    date: '4月19-21日', solarDate: '04-20', season: 'spring',
    slogan: '雨生百谷也',
    theme: {
      primary: '#3a6a48', accent: '#6a9a58', bg: '#eef6ee',
      gradient: ['#98c888', '#2a5038'], text: '#1a3018',
      texture: 'rain-heavy', aura: '润泽丰沛'
    },
    poem: { text: '谷雨如丝复似尘\n煮瓶浮蜡正尝新', author: '范成大《四时田园杂兴》' },
    phenology: '一候萍始生，二候鸣鸠拂其羽，三候戴胜降于桑',
    desc: '谷雨意为"雨生百谷"，此时雨水充沛，正是谷物生长的关键期。',
    health: '谷雨前后湿度大，宜食薏米、赤小豆祛湿。谷雨茶清火明目，值得一品。',
    folk: [
      { title: '喝谷雨茶', icon: '🍵', desc: '谷雨这天采的茶清火辟邪明目，南方尤重。', detail: '"谷雨茶"又称"二春茶"，芽叶肥硕色泽翠绿，香气宜人。传说可治百病。' },
      { title: '赏牡丹', icon: '🌺', desc: '谷雨三朝看牡丹，牡丹花被称为"谷雨花"。', detail: '山东菏泽、河南洛阳等地有谷雨赏牡丹盛会，已延续千年。"花中之王"此时正值盛花期。' }
    ]
  },
  // ========== 夏季 ========
  {
    key: 'lixia', name: '立夏', order: 7,
    date: '5月5-7日', solarDate: '05-06', season: 'summer',
    slogan: '万物至此皆长大',
    theme: {
      primary: '#d4a020', accent: '#f0c840', bg: '#fef8e8',
      gradient: ['#fde888', '#b88818'], text: '#3a2a08',
      texture: 'sun-warm', aura: '暖阳明媚'
    },
    poem: { text: '立夏天方霁\n闲情喜暂舒', author: '张宇初《喜晴》' },
    phenology: '一候蝼蝈鸣，二候蚯蚓出，三候王瓜生',
    desc: '立夏标志着夏季开始。万物进入生长旺季，温度升高，雷雨增多。',
    health: '宜养心，多食苦味食物（苦瓜、莲子心）。午休养心，晚睡早起。',
    folk: [
      { title: '称人', icon: '⚖️', desc: '立夏称体重，祈求夏季健康不发瘦。', detail: '挂起大秤，人坐竹筐中称体重。相传三国时诸葛亮嘱咐孟获每年立夏称阿斗，以验健康。' },
      { title: '吃立夏蛋', icon: '🥚', desc: '立夏吃蛋拄心，小孩胸前挂蛋袋。', detail: '"立夏吃了蛋，热天不疰夏"。用红茶或胡桃壳煮蛋，称"立夏蛋"，小孩挂彩线蛋袋。' }
    ]
  },
  {
    key: 'xiaoman', name: '小满', order: 8,
    date: '5月20-22日', solarDate: '05-21', season: 'summer',
    slogan: '物至于此小得盈满',
    theme: {
      primary: '#c09020', accent: '#e8b840', bg: '#fef6e0',
      gradient: ['#f8d868', '#a87818'], text: '#3a2808',
      texture: 'wheat', aura: '麦浪金黄'
    },
    poem: { text: '夜莺啼绿柳\n皓月醒长空', author: '欧阳修《五绝·小满》' },
    phenology: '一候苦菜秀，二候靡草死，三候麦秋至',
    desc: '小满指夏熟作物籽粒开始饱满但尚未成熟，正是"将满未满"的状态。',
    health: '小满湿热，宜食苦瓜、莴笋、绿豆等清热利湿之品。忌暴饮暴食。',
    folk: [
      { title: '祭车神', icon: '🚜', desc: '祭拜水车神，祈求水源充足灌溉农田。', detail: '南方水车灌溉重要，农家在车基上祭品供奉，祝水源涌旺。' },
      { title: '吃苦菜', icon: '🌿', desc: '小满吃苦菜，清热解毒应节气。', detail: '苦菜是中国人最早食用的野菜之一。《本草纲目》载其"安心益气"。' }
    ]
  },
  {
    key: 'mangzhong', name: '芒种', order: 9,
    date: '6月5-7日', solarDate: '06-06', season: 'summer',
    slogan: '有芒之谷可稼种',
    theme: {
      primary: '#b08018', accent: '#d8a830', bg: '#fdf5d8',
      gradient: ['#f0d858', '#906818'], text: '#3a2800',
      texture: 'grain', aura: '繁忙金黄'
    },
    poem: { text: '时雨及芒种\n四野皆插秧', author: '陆游《时雨》' },
    phenology: '一候螳螂生，二候鵙始鸣，三候反舌无声',
    desc: '芒种是"有芒之谷可稼种"的意思。此时麦类成熟待收，稻类亟待播种。',
    health: '芒种湿热最重，宜清淡少油腻，多食冬瓜、丝瓜、黄瓜等。',
    folk: [
      { title: '送花神', icon: '🌸', desc: '芒种饯送花神归位，感谢一春花事。', detail: '农历二月迎花神，芒种送花神。女孩子们系彩线、挂花枝，仪式感满满。' },
      { title: '煮梅', icon: '🍵', desc: '芒种煮梅，酸梅汤解暑开胃。', detail: '南方五月梅子成熟，但青梅酸涩需煮制。三国"望梅止渴""青梅煮酒论英雄"皆由此来。' }
    ]
  },
  {
    key: 'xiazhi', name: '夏至', order: 10,
    date: '6月21-22日', solarDate: '06-21', season: 'summer',
    slogan: '阳气极盛日最长',
    theme: {
      primary: '#c47820', accent: '#e8a838', bg: '#fdf6e3',
      gradient: ['#fde090', '#a06018'], text: '#3a2008',
      texture: 'sun-blaze', aura: '烈日当空'
    },
    poem: { text: '微雨过\n小荷翻\n榴花开欲然\n玉盆纤手弄清泉\n琼珠碎却圆', author: '苏轼《阮郎归·初夏》' },
    phenology: '一候鹿角解，二候蝉始鸣，三候半夏生',
    desc: '夏至是阳气最旺的时节，白昼最长。进入伏天，酷暑来临。',
    health: '保护阳气，预防中暑上火。饮食宜清淡，多食绿豆汤、西瓜。忌贪凉饮冷。',
    folk: [
      { title: '夏至面', icon: '🍜', desc: '冬至馄饨夏至面，吃过夏至面一天短一线。', detail: '江南夏至吃面是重要习俗。新麦登场，用新面做面条，既尝新又应节。' },
      { title: '称重', icon: '⚖️', desc: '夏至称体重，传说此后不怕酷暑炎热。', detail: '男女老少排队过秤，有人报重，场面热闹如过节。称完吃麦饭或麦粒。' },
      { title: '消夏避伏', icon: '🏖️', desc: '互赠折扇脂粉，扇借以生风，粉防痱子。', detail: '皇家拿出"冬藏夏用"的冰消夏避伏，从周代始历朝沿用成为制度。' }
    ]
  },
  {
    key: 'xiaoshu', name: '小暑', order: 11,
    date: '7月6-8日', solarDate: '07-07', season: 'summer',
    slogan: '暑气至此尚小',
    theme: {
      primary: '#d46818', accent: '#f08830', bg: '#fef0e0',
      gradient: ['#f8a850', '#b85010'], text: '#3a1a08',
      texture: 'heat-wave', aura: '闷热潮湿'
    },
    poem: { text: '倏忽温风至\n因循小暑来', author: '元稹《咏廿四气诗·小暑六月节》' },
    phenology: '一候温风至，二候蟋蟀居壁，三候鹰始鸷',
    desc: '小暑虽不是一年最热，但已入伏，暑热渐盛，江淮地区进入"梅雨"尾声。',
    health: '小暑黄鳝赛人参，宜食黄鳝、莲藕。注意防暑降温，适当午休。',
    folk: [
      { title: '食新', icon: '🍚', desc: '小暑食新米，尝新酒，感谢天地馈赠。', detail: '将新收割的稻谷碾米做饭，供祀五谷大神和祖先，然后人人品尝新酒新食。' },
      { title: '晒伏', icon: '☀️', desc: '小暑前后晒衣物书籍，防霉防蛀。', detail: '"六月六，晒红绿"。家家户户翻箱倒柜晾晒衣物书画，借骄阳除潮防虫。' }
    ]
  },
  {
    key: 'dashu', name: '大暑', order: 12,
    date: '7月22-24日', solarDate: '07-23', season: 'summer',
    slogan: '湿热交蒸极盛',
    theme: {
      primary: '#c04018', accent: '#e06828', bg: '#fde8d8',
      gradient: ['#f08858', '#982818'], text: '#3a1008',
      texture: 'scorching', aura: '骄阳似火'
    },
    poem: { text: '赤日几时过\n清风无处寻', author: '曾几《大暑》' },
    phenology: '一候腐草为萤，二候土润溽暑，三候大雨时行',
    desc: '大暑是一年中最热的时期，气温最高，农作物生长最快，旱涝风灾也最频繁。',
    health: '大暑宜饮伏茶、吃仙草（凉粉）、喝绿豆汤。防中暑是头等大事。',
    folk: [
      { title: '饮伏茶', icon: '🍵', desc: '三伏天饮伏茶，金银花甘草荷叶煮制。', detail: '免费供应路人的消暑凉茶，由金银花、夏枯草、甘草等中草药煮成，清凉去火。' },
      { title: '吃仙草', icon: '🍮', desc: '南方大暑吃仙草（凉粉草）消暑。', detail: '仙草又名凉粉草，茎叶晒干可制"烧仙草"。有"六月大暑吃仙草，活如神仙不会老"之说。' }
    ]
  },
  // ========== 秋季 ========
  {
    key: 'liqiu', name: '立秋', order: 13,
    date: '8月7-9日', solarDate: '08-08', season: 'autumn',
    slogan: '凉风至叶知秋',
    theme: {
      primary: '#a06028', accent: '#c88840', bg: '#fdf3e8',
      gradient: ['#e0b878', '#805018'], text: '#3a1a08',
      texture: 'leaf-fall', aura: '微凉初秋'
    },
    poem: { text: '自古逢秋悲寂寥\n我言秋日胜春朝', author: '刘禹锡《秋词》' },
    phenology: '一候凉风至，二候白露降，三候寒蝉鸣',
    desc: '立秋标志着秋季开始。虽暑热未消（"秋老虎"），但早晚已有凉意。',
    health: '立秋贴秋膘，宜食滋阴润燥之物。少吃辛辣，多食梨、百合、银耳。',
    folk: [
      { title: '贴秋膘', icon: '🥩', desc: '夏天消瘦，立秋进补炖肉吃肉补回来。', detail: '老北京立秋讲究"贴秋膘"，吃炖肉、烤肉、红烧肉。夏日苦瘦，秋来补养。' },
      { title: '啃秋', icon: '🍉', desc: '立秋吃西瓜，称"啃秋"或"咬秋"。', detail: '南京等地立秋吃西瓜，寓意炎夏结束。"啃秋"可免腹泻，也是入秋的仪式感。' }
    ]
  },
  {
    key: 'chushu', name: '处暑', order: 14,
    date: '8月22-24日', solarDate: '08-23', season: 'autumn',
    slogan: '暑气至此而止',
    theme: {
      primary: '#8a5820', accent: '#b88840', bg: '#fdf0e0',
      gradient: ['#d8b068', '#6a4018'], text: '#3a1e08',
      texture: 'mist', aura: '云淡天高'
    },
    poem: { text: '空山新雨后\n天气晚来秋', author: '王维《山居秋暝》' },
    phenology: '一候鹰乃祭鸟，二候天地始肃，三候禾乃登',
    desc: '处暑意为"出暑"，暑热即将结束。秋高气爽的好天气开始。',
    health: '处暑防"秋燥"，宜食蜂蜜、银耳、芝麻。早睡早起，与鸡俱兴。',
    folk: [
      { title: '放河灯', icon: '🏮', desc: '处暑放河灯，普渡水中孤魂。', detail: '将纸灯放入江河湖海，任其漂流。中元节前后尤盛，是古老的水上祭祀仪式。' },
      { title: '开渔节', icon: '🐟', desc: '处暑开渔，东海休渔期结束。', detail: '浙江沿海举行盛大开渔仪式，千帆竞发。此时海域水温适宜，鱼虾贝类肥美。' }
    ]
  },
  {
    key: 'bailu', name: '白露', order: 15,
    date: '9月7-9日', solarDate: '09-08', season: 'autumn',
    slogan: '露凝而白也',
    theme: {
      primary: '#7a6a30', accent: '#b0a050', bg: '#fdf5e8',
      gradient: ['#d8c878', '#5a4a20'], text: '#2a2010',
      texture: 'dew', aura: '清冷露白'
    },
    poem: { text: '蒹葭苍苍\n白露为霜', author: '《诗经·蒹葭》' },
    phenology: '一候鸿雁来，二候玄鸟归，三候群鸟养羞',
    desc: '白露时节气温下降，水汽凝为露水。早晚温差大，秋意渐浓。',
    health: '白露勿露身，注意保暖。宜食百合、莲子、梨。喝白露茶清甜回甘。',
    folk: [
      { title: '饮白露茶', icon: '🍵', desc: '白露茶不涩不苦，甘醇可口。', detail: '白露前后采的茶叶，经夏暑历练，叶片厚实，滋味独特，老茶客最爱。' },
      { title: '收清露', icon: '💧', desc: '古人以白露为"甘露"，收取煎药。', detail: '《本草纲目》载：秋露"煎如饴，令人轻身不饥"。古人清晨用盘子收取花上露水。' }
    ]
  },
  {
    key: 'qiufen', name: '秋分', order: 16,
    date: '9月22-24日', solarDate: '09-23', season: 'autumn',
    slogan: '昼夜再次均分',
    theme: {
      primary: '#8a5020', accent: '#c47838', bg: '#fdf0e0',
      gradient: ['#e0a868', '#6a3818'], text: '#3a1808',
      texture: 'harvest', aura: '丰收金黄'
    },
    poem: { text: '何处秋风至\n萧萧送雁群', author: '刘禹锡《秋风引》' },
    phenology: '一候雷始收声，二候蛰虫坯户，三候水始涸',
    desc: '秋分昼夜再次均分。曾是传统"祭月节"，后演变为中秋节。',
    health: '秋分燥气当令，宜润肺生津。多食梨、百合、银耳。注意保暖防"秋冻"。',
    folk: [
      { title: '立秋社', icon: '🌾', desc: '"春祈秋报"，秋分祭神感恩丰收。', detail: '秋社取立秋后第五个戊日。各地谚语按秋分在社前后占卜丰歉："秋分在社前，斗米换斗钱"。' },
      { title: '送秋牛', icon: '🐄', desc: '挨家挨户送秋牛图，说吉祥话。', detail: '二开红纸绘农夫耕田图样。送图者能言善唱，见景生情说吉祥话，句句有韵。' },
      { title: '祭月', icon: '🕯️', desc: '天子春朝日秋夕月，明清皇帝祭月。', detail: '《礼记》载："天子春朝日，秋夕月。"《宋史》："秋分之时，昼夜平分，遂行夕拜之祭。"' }
    ]
  },
  {
    key: 'hanlu', name: '寒露', order: 17,
    date: '10月7-9日', solarDate: '10-08', season: 'autumn',
    slogan: '露气寒冷将凝',
    theme: {
      primary: '#6a4828', accent: '#a07838', bg: '#faf0e0',
      gradient: ['#c8a058', '#4a3018'], text: '#2a1808',
      texture: 'frost-deep', aura: '深秋萧瑟'
    },
    poem: { text: '可怜九月初三夜\n露似真珠月似弓', author: '白居易《暮江吟》' },
    phenology: '一候鸿雁来宾，二候雀入大水为蛤，三候菊有黄华',
    desc: '寒露气温比白露更低，露水更冷，将要凝结成霜。菊花盛开。',
    health: '寒露脚不露，注意足部保暖。宜食芝麻、核桃、蜂蜜润燥。',
    folk: [
      { title: '赏菊', icon: '🏵️', desc: '寒露三候菊有黄华，正是赏菊好时节。', detail: '"采菊东篱下，悠然见南山"。重阳节赏菊饮菊花酒，寓意长寿。' },
      { title: '登高', icon: '⛰️', desc: '重阳登高避灾，赏秋景远眺。', detail: '九月九日登高插茱萸，饮菊花酒。王维"遥知兄弟登高处，遍插茱萸少一人"。' }
    ]
  },
  {
    key: 'shuangjiang', name: '霜降', order: 18,
    date: '10月23-24日', solarDate: '10-23', season: 'autumn',
    slogan: '气肃而凝露结为霜',
    theme: {
      primary: '#5a3820', accent: '#8a6030', bg: '#f8ece0',
      gradient: ['#b89050', '#3a2010'], text: '#2a1808',
      texture: 'frost-heavy', aura: '霜染红叶'
    },
    poem: { text: '停车坐爱枫林晚\n霜叶红于二月花', author: '杜牧《山行》' },
    phenology: '一候豺乃祭兽，二候草木黄落，三候蛰虫咸俯',
    desc: '霜降是秋季最后一个节气，天气渐冷开始降霜。枫叶如火，秋色最浓。',
    health: '霜降进补，宜食牛肉、栗子、柿子。注意保暖，预防呼吸道疾病。',
    folk: [
      { title: '吃柿子', icon: '🍅', desc: '霜降吃柿子，冬天不裂嘴唇。', detail: '霜降后柿子完全成熟，皮薄肉鲜味美。泉州有"霜降吃丁柿，不会流鼻涕"的说法。' },
      { title: '赏红叶', icon: '🍁', desc: '霜降枫叶如火，层林尽染。', detail: '北京香山、南京栖霞山、苏州天平山是赏红叶胜地。霜打后的红叶最为艳丽。' }
    ]
  },
  // ========== 冬季 ========
  {
    key: 'lidong', name: '立冬', order: 19,
    date: '11月7-8日', solarDate: '11-07', season: 'winter',
    slogan: '万物收藏也',
    theme: {
      primary: '#3a5078', accent: '#5a78a8', bg: '#edf0f8',
      gradient: ['#8aa8d8', '#283a58'], text: '#101e38',
      texture: 'frost', aura: '初冬清冷'
    },
    poem: { text: '冻笔新诗懒写\n寒炉美酒时温', author: '李白《立冬》' },
    phenology: '一候水始冰，二候地始冻，三候雉入大水为蜃',
    desc: '立冬标志着冬季开始。万物收藏，规避寒冷。北方开始供暖，南方渐入深秋。',
    health: '立冬进补，北方吃饺子，南方吃鸡鸭鱼肉。早睡晚起，养精蓄锐。',
    folk: [
      { title: '吃饺子', icon: '🥟', desc: '立冬吃饺子，耳朵不被冻掉。', detail: '北方立冬必吃饺子。饺子形似耳朵，立冬吃饺子保护耳朵不受冻。' },
      { title: '冬泳', icon: '🏊', desc: '立冬这天各地冬泳爱好者破冰入水。', detail: '全国多地立冬举行冬泳活动，以特殊方式迎接冬天。哈尔滨冬泳历史悠久。' }
    ]
  },
  {
    key: 'xiaoxue', name: '小雪', order: 20,
    date: '11月22-23日', solarDate: '11-22', season: 'winter',
    slogan: '气寒而将雪矣',
    theme: {
      primary: '#405a8a', accent: '#6080b8', bg: '#e8edf6',
      gradient: ['#90b0e0', '#2a3a60'], text: '#101830',
      texture: 'snow-light', aura: '初雪飘零'
    },
    poem: { text: '花雪随风不厌看\n更多还肯失林峦', author: '戴叔伦《小雪》' },
    phenology: '一候虹藏不见，二候天气上升地气下降，三候闭塞而成冬',
    desc: '小雪气温下降，开始降雪但雪量不大。北方进入封冻期。',
    health: '宜食温补，羊肉、牛肉、桂圆。小雪腌菜，储备过冬。',
    folk: [
      { title: '腌腊肉', icon: '🥩', desc: '小雪腌肉，春节享用。', detail: '"冬腊风腌，蓄以御冬"。气温低细菌少，是加工腊肉的最佳时机。' },
      { title: '吃糍粑', icon: '🍡', desc: '南方小雪吃糍粑，软糯暖胃。', detail: '古时农民用糍粑祭牛神。如今是客家人、湘西等地的传统小吃。' }
    ]
  },
  {
    key: 'daxue', name: '大雪', order: 21,
    date: '12月6-8日', solarDate: '12-07', season: 'winter',
    slogan: '至此而雪盛也',
    theme: {
      primary: '#3a4a78', accent: '#5a6aa8', bg: '#e4eaf6',
      gradient: ['#8898d8', '#222a50'], text: '#0e1530',
      texture: 'snow-heavy', aura: '银装素裹'
    },
    poem: { text: '大雪压青松\n青松挺且直', author: '陈毅《青松》' },
    phenology: '一候鹖鴠不鸣，二候虎始交，三候荔挺出',
    desc: '大雪节气降雪量增大，范围更广。北方"千里冰封，万里雪飘"。',
    health: '大雪宜进补，食羊肉、红薯、萝卜。注意头部保暖，戴帽防风寒。',
    folk: [
      { title: '观赏封河', icon: '❄️', desc: '"小雪封地，大雪封河"，冰上嬉戏。', detail: '北方河流结冰，孩童在冰上打陀螺、滑冰车。南方亦有"雪后初晴踏雪寻梅"。' },
      { title: '腌雪菜', icon: '🥬', desc: '大雪腌雪菜，备一冬下饭菜。', detail: '雪里蕻腌制成雪菜，炒肉丝、煮豆腐皆是美味。江南人家几乎家家户户腌制。' }
    ]
  },
  {
    key: 'dongzhi', name: '冬至', order: 22,
    date: '12月21-23日', solarDate: '12-22', season: 'winter',
    slogan: '阴极之至阳气始生',
    theme: {
      primary: '#2a4070', accent: '#4a6aa8', bg: '#e8eef8',
      gradient: ['#6a8ac8', '#1a2858'], text: '#0e1830',
      texture: 'snow-night', aura: '长夜将尽'
    },
    poem: { text: '日暮苍山远\n天寒白屋贫', author: '刘长卿《逢雪宿芙蓉山主人》' },
    phenology: '一候蚯蚓结，二候麋角解，三候水泉动',
    desc: '冬至是阴阳转换的重要节点，阴气极盛，阳气始生。被视为"大如年"。',
    health: '冬至一阳生，科学养生可延年益寿。宜多样饮食，适当高钙。',
    folk: [
      { title: '祭祖', icon: '🕯️', desc: '冬至祭祖，明清盛行悬遗像于中堂。', detail: '"冬至大如年"，唐宋皇帝郊外祭天，百姓祭拜父母尊长。有"送寒衣"习俗。' },
      { title: '吃汤圆', icon: '🍡', desc: '南方冬至吃汤圆，团团圆圆添岁。', detail: '"家家捣米做汤圆，知是明朝冬至天。"圆寓意团圆圆满，祀神祭祖后全家围吃。' },
      { title: '吃饺子', icon: '🥟', desc: '北方冬至吃饺子，纪念张仲景。', detail: '张仲景冬至舍"祛寒娇耳汤"治冻疮。后人仿"娇耳"包成食物，谚云："十月一，冬至到，家家户户吃水饺。"' }
    ]
  }
]

// 按季节分组
const SEASONS_MAP = {
  spring: { name: '春', terms: TERMS_24.filter(t => t.season === 'spring'), color: '#6abf7a' },
  summer: { name: '夏', terms: TERMS_24.filter(t => t.season === 'summer'), color: '#e8a838' },
  autumn: { name: '秋', terms: TERMS_24.filter(t => t.season === 'autumn'), color: '#c47a3a' },
  winter: { name: '冬', terms: TERMS_24.filter(t => t.season === 'winter'), color: '#4a7ab5' }
}

// 按键查找
function getTerm(key) {
  return TERMS_24.find(t => t.key === key)
}

// 按节气顺序排序
function getTermsByOrder() {
  return [...TERMS_24].sort((a, b) => a.order - b.order)
}

// 获取下一个节气（按当前日期）
function getNextTerm(now = new Date()) {
  const month = now.getMonth() + 1
  const day = now.getDate()
  const today = month * 100 + day // MMDD 格式便于比较
  
  const ordered = getTermsByOrder()
  for (const term of ordered) {
    const [m, d] = term.solarDate.split('-').map(Number)
    const termDay = m * 100 + d
    if (termDay >= today) {
      return term
    }
  }
  return ordered[0] // 来年立春
}

module.exports = {
  TERMS_24,
  SEASONS_MAP,
  getTerm,
  getTermsByOrder,
  getNextTerm
}
