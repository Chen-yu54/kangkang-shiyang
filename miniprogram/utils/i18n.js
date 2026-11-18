// utils/i18n.js —— 文案字典（全端中文文案唯一来源）
//
// 规则：
//   1. 本期只做 zh-CN；页面与 utils 里不得散写中文文案，一律走 t('key') / tpl('key', params)
//   2. key 结构为 <域>.<语义> 的扁平命名，后续加粤语只扩充 locale 分片，不改调用点
//   3. 来自 A 的数据字段（菜品名、菜系名、节气名、置信标签等）不在此处，直接渲染数据值
//   4. 本文件是脱敏扫描的重点区域：全端中文文案集中于此，便于一次核对

const zhCN = {
  // —— 通用
  'common.retry': '重新加载',
  // 声明条文案：沿用线框稿的「饮食文化科普 / 日常饮食参考」表述，
  // 并保留「不构成医疗建议」这句过审关键话。线框稿原句末尾的措辞含禁用词，未采用。
  'common.disclaimer': '本内容为饮食文化科普，仅供日常饮食参考，不构成医疗建议。',
  'common.dataVersion': '数据版本：',
  'common.imageFailed': '图片加载不了',
  'common.all': '全部',
  'common.back': '返回',
  'common.cancel': '取消',
  'common.confirm': '确定',
  'common.loading': '加载中',
  'common.loadingEn': 'Loading…',
  'common.loadingSub': '正在为你整理内容',
  // AI 生成内容标识：生成式内容需显式标注，同时也是本项目「AI 在哪参与」的落点
  'common.aiGenerated': 'AI 生成',

  // 参考警示条（首页首次进入，点「我知道了」后本机记忆）
  // 措辞按版面设计稿，保留「结合实际情况判断」的行为约束，不写成泛泛的免责套话

  // —— 跟着节气吃（首页底部仪表盘）
  // 口径：全部按当前知识库实时计算，不写死、不估计。
  // 不堆「我们有多少道菜」，只说「你能得到什么」：不空档、不费事、顾得上。
  'snapshot.title': '跟着节气吃',
  'snapshot.live': '按今天的节气',
  'snapshot.asOf': '截至',
  'snapshot.termPos': '第 {order} / {total} 个节气',
  'snapshot.line1Unit': '次 / 年',
  'snapshot.line1Sub': '自动换菜单',
  'snapshot.line2Unit': '道 / 节气',
  'snapshot.line2Sub': '换季有得挑',
  'snapshot.line3Unit': '餐 / 天',
  'snapshot.line3Sub': '三顿都齐',
  'snapshot.miniAllTermLabel': '节气有菜',
  'snapshot.miniAllTermSub': '{done}/{total} 个节气',
  'snapshot.miniEasyLabel': '家常做法',
  'snapshot.miniEasySub': '{done}/{total} 道好上手',
  'snapshot.miniCareLabel': '人群提示',
  'snapshot.miniCareSub': '{done}/{total} 道有标注',
  'snapshot.note': '数字按当前知识库实时统计，库里的内容变了，这里就跟着变。',
  'snapshot.ckKpi1': '3 菜系 × 4 道，换季有得挑',
  'snapshot.ckKpi2': '按节令自动换菜单',
  'snapshot.ckKpi3': '≤ 两星难度，日常能上手',
  'snapshot.ckExpand': '展开全部数据',
  'snapshot.ckCollapse': '收起数据',
  'snapshot.ckEnterTitle': '看完整数据',
  'snapshot.ckEnterSub': '点开看五个分区，逐项细看',

  // —— 节气数据详情页（点首页预览卡进入）
  'cockpit.title': '节气数据',
  'cockpit.kicker': '跟着节气吃 · 数据概览',
  'cockpit.lead': '数字按当前知识库实时统计，库里的内容变了，这里就跟着变。',
  'cockpit.overview': '本期概览',
  'cockpit.sections': '分区细看',
  'cockpit.tip': '点分区切换数据，当前选中的会高亮。',
  'cockpit.noteTitle': '数据口径',
  'cockpit.sampleTag': '示例',

  // —— 首页
  'home.searchPlaceholder': '搜菜名 / 食材',
  'home.askTitle': '问问康康',
  'home.askSub': '聊几句，帮你挑今天的菜',
  'home.chatTitle': '康康对话',
  'home.chatSub': '打字问，可以追问',
  'home.sectionCuisine': '按菜系逛',
  'home.sectionDishes': '当令菜',
  'home.seeAll': '查看全部当令菜',
  // 主区栏目引题：一句话交代「这三道菜是怎么来的」，把推荐抬成页面主角
  'home.leadKicker': '当令 · 三系各一道',
  // 次区分隔：诗句 / 菜系 / 数据统一收在「节气风物」之下，不再与推荐并列
  'home.bandCulture': '节气风物',
  'home.countUnit': '道',
  // 今日食单三步：没做问卷就不给推演，也不把当令菜冒充成个性化推荐
  'home.gateQuizFirst': '先做口味问卷',
  'home.gateNeedQuiz': '先做完口味问卷',
  // 第③段占位：没推演就不摆菜，三种状态各说各的下一步
  'home.pendingTag': '待生成',
  'home.pendingNoQuiz': '做完口味问卷就能生成。',
  'home.pendingNoGen': '口味记下了，点上面生成。',
  'home.pendingStale': '口味改过，重新生成一份。',
  'home.sectionMore': '更多',
  'home.empty': '内容准备中',
  'home.error': '加载没成功，请稍后再试',
  'home.daysToNext': '距「{name}」还有 {days} 天',
  'home.daysToNextEnd': '正处在「{name}」',

  // —— 首页杂志化（封面 / 荐语 / 五宫格 / 主推）
  // 封面顶部小字：像杂志的刊名栏，点出这是一份「谱系」而非工具
  'home.heroKicker': '二十四节气 · 岭南饮食谱系',
  // 封面出版信息：把 AI4S 落成「本期怎么来的」，不吹能力，只陈述机制
  'home.heroAiNote': 'AI 编校 · 实时校验',
  // 编辑荐语署名
  'home.quoteBy': '—— 康康食养AI · 节气食单',
  // 首页节气文化摘要：只露「节气名 + 一句 + 诗」，细节交给节气详情页
  'home.cultureTag': '节气',
  'home.cultureOpenTitle': '{name}的讲究',
  'home.cultureOpenSub': '三候 · 食俗 · 当令食材',
  'home.cultureOpen': '点开看看',
  // ── 康康对话（连扣子 Bot 的自由问答页 pages/aichat）──
  'chat.title': '问问康康',
  'chat.subtitle': '想吃什么、拿不准什么，都可以问',
  'chat.placeholder': '说说你想吃什么…',
  'chat.send': '发送',
  'chat.clear': '清空',
  'chat.thinking': '康康正在想…',
  'chat.back': '返回',
  'chat.clearConfirmTitle': '清空对话',
  'chat.clearConfirmBody': '清空后这段对话不会再保留，确定吗？',
  'chat.clearDone': '已清空',
  'chat.q1': '今天吃什么好',
  'chat.q2': '立冬喝什么汤',
  'chat.q3': '我不吃海鲜，有什么推荐',
  'chat.q4': '想吃清淡一点的',
  // ── 问问康康（对话式问卷页 pages/agent）──
  'qa.title': '问问康康',
  'qa.subtitle': '聊几句，帮你挑今天的菜',
  'qa.you': '你',
  'qa.thinking': '让我按你的情况挑一挑…',
  'qa.next': '下一题',
  'qa.needPick': '先选一个吧',
  'qa.multiHint': '可以多选，选完点下一步',
  'qa.progress': '第 {current} / {total} 步',
  'qa.pickLocal': '按你说的，先挑这几道：',
  'qa.pickModel': '结合当令和你的口味，我挑这几道：',
  'qa.localNote': '本地推荐 · 离线可用',
  'qa.modelNote': 'Coze Agent 推荐',
  'qa.modelFail': '模型这次没接上，先看本地推的这几道',
  'qa.noLocal': '模型推荐',
  'qa.noDetail': '这道菜库里没有详细页',
  'qa.goDetail': '看详情',
  'qa.restart': '重来',
  // 五宫格风味关键词：各菜系一句话气质，来自知识库菜系卡的 style 字段
  'home.cuisineTagLingnan': '中和日常',
  'home.cuisineTagGuangfu': '清鲜爽嫩',
  'home.cuisineTagChaoshan': '清鲜本味',
  'home.cuisineTagHakka': '咸香肥熟',
  // 当令主推大卡的角标
  'home.featured': '主编力荐',
  // 数据快照（复算入口已撤：口径写清即可，不必再引一条说明链）
  // 栏目编号（书口序号）：按版面从上往下排，标号跟着位置走，不跟板块身份走。
  // 现在顺序是 节气文化 → 当令菜 → 跟着节气吃，所以 壹、贰、叁 依次对应。
  'home.noCulture': '壹',
  'home.noDishes': '贰',
  'home.noSnapshot': '叁',
  'home.sectionCulture': '节气文化',

  // —— 时辰问候条（按本地时间六时段轮换，见 utils/daypart.js）
  'daypart.dawn.greet': '早上好',
  'daypart.dawn.tip': '一盅两件，叹早茶正当时',
  'daypart.morning.greet': '上午好',
  'daypart.morning.tip': '茶歇时分，饮啖茶食件点心',
  'daypart.noon.greet': '中午好',
  'daypart.noon.tip': '饭前一碗例汤，是老规矩',
  'daypart.afternoon.greet': '下午好',
  'daypart.afternoon.tip': '三点三，来碗糖水歇一歇',
  'daypart.evening.greet': '晚上好',
  'daypart.evening.tip': '今晚煲咩汤？看看当令菜',
  'daypart.night.greet': '夜深了',
  'daypart.night.tip': '早点休息，明早一盅两件',

  // —— 时段问候：只报时段与节气位置，不给饮食建议（避免滑向建议性表述）
  'greeting.morning': '早上好',
  'greeting.noon': '中午好',
  'greeting.afternoon': '下午好',
  'greeting.evening': '晚上好',
  'greeting.night': '夜深了',
  'greeting.todayTerm': '今日{name}',
  'greeting.toNext': '距{name}还有{days}天',

  // —— 风味（对应 knowledge/card_meta.csv 的 cuisine 字段，五值）
  // 注意：验收标准要求全端不使用旧的三菜系称法，统一用广府 / 潮汕 / 客家 / 岭南家常
  'cuisine.lingnan_home': '岭南家常',
  'cuisine.guangfu': '广府菜',
  'cuisine.chaoshan': '潮汕菜',
  'cuisine.hakka': '客家菜',
  'cuisine.other': '其他菜系',
  'cuisine.riskLabel': '搭配提示',

  // —— 食养页（原「菜单」Tab）：按作答推荐 + 推荐过程可视化
  'nutrition.tab': '食养',
  'nutrition.termBadge': '当前节气',
  'nutrition.toNext': '距「{name}」还有 {days} 天',
  'nutrition.profileTitle': '我的口味偏好',
  'nutrition.profileEmpty': '还没有作答',
  // 问卷入口：整行按钮，标题 + 一句交代「答完会怎样」
  'nutrition.quizBig': '做一次口味问卷',
  'nutrition.quizSub': '6 道小题 · 约 1 分钟 · 答完出食单',
  'nutrition.redoQuiz': '重新作答',
  'nutrition.profileTaste': '口味',
  'nutrition.profileAvoid': '回避',
  'nutrition.profileUnset': '未选',
  'nutrition.recTitle': '「{name}」推荐',
  'nutrition.tagSeasonal': '当令',
  'nutrition.tagYearRound': '常用',
  'nutrition.stepsTitle': '推荐过程',
  'nutrition.stepsHint': '每一步的数字都来自当前数据，可当场复算',
  'nutrition.stepsExpand': '展开',
  'nutrition.stepsCollapse': '收起',
  'nutrition.browseEntry': '按菜系浏览全部菜品',
  'nutrition.browseBack': '返回食养',
  'nutrition.genTitle': '生成今日食单',
  'nutrition.genDesc': '按节气与口味逐道挑，过程可查',
  'nutrition.genAction': '开始',
  'nutrition.genAgain': '重新推演',
  'nutrition.genSummary': '已按你的口味推演好',
  // 食养页合成一条流：口味 → 推演 → 三道菜（原先是三张并列卡，彼此割裂）
  'nutrition.flowTitle': '今天吃什么',
  'nutrition.stepTaste': '口味',
  'nutrition.stepGen': '推演',
  'nutrition.stepDish': '今日菜',
  'nutrition.resultTitle': '今日食单',
  // 就地推演：过程只写「在做什么」，不写「AI 正在思考」这类空话
  'nutrition.genRunning': '推演中',
  // 扣子工作流：等模型 / 模型出单 / 模型没接上
  'nutrition.modelPendingTitle': '大模型 Agent 正在选菜',
  'nutrition.modelPendingLine': '读当令菜和你的口味，十几秒',
  'nutrition.modelDoneTitle': '大模型把食单配好了',
  'nutrition.modelDoneLine': '挑了 {n} 道，都是当令菜',
  'nutrition.modelFailTitle': '大模型没接上，改用本机规则',
  'nutrition.modelFailLine': '条数与结论照旧可查',
  'nutrition.genFallback': '大模型这次没接上，这单按本机规则出，菜一样是当令的。',
  'nutrition.genThinking': '正在按你的口味挑',
  'nutrition.genMixing': '正在生成专属食单…',
  'nutrition.tipsTitle': '节气食养小贴士',
  'nutrition.healthTitle': '节气养生提醒',
  'nutrition.whyLabel': '推荐理由',
  'nutrition.dishOpen': '看做法',
  'nutrition.noDetail': '暂无详情',
  'nutrition.notice': '以上按节气习俗与饮食经验整理，不做专业诊断。',
  'nutrition.termTipsTitle': '当令小方法',
  'nutrition.briefHow': '做法',
  'nutrition.briefWhy': '推荐理由',
  'nutrition.termRemindTitle': '当令提醒',

  // —— AI 食单生成页（Agent 推理轨迹）
  'agent.title': 'AI 食单',
  'agent.engineLocal': '本地推演引擎',
  'agent.engineNoteLocal': '扣子模型未接入 · 本机规则推演',
  'agent.engineCoze': 'Coze Agent',
  'agent.engineNoteCoze': '模型在线 · 流式推理',
  'agent.promptTitle': '本次诉求',
  'agent.traceTitle': '推理轨迹',
  'agent.traceHint': '每一步的数字都来自当前知识库，可当场复算',
  'agent.thinking': '正在推演',
  'agent.done': '生成完成',
  'agent.resultTitle': '按你的口味挑的',
  'agent.regen': '重新推演',
  'agent.evidenceShow': '查看依据',
  'agent.evidenceHide': '收起依据',
  'agent.kbVersion': '知识库',
  'agent.matchNote': '匹配口径：菜名 / 主料 / 做法关键词，不是成分表判定',
  'agent.tasteLabel': '口味',
  'agent.avoidLabel': '回避',
  'agent.none': '未填',
  'agent.countChip': '{n} 道',
  'agent.elapsed': '实测 {ms} ms',
  'agent.retake': '重测口味',
  'agent.step.term': '读取节气',
  'agent.step.input': '理解诉求',
  'agent.step.recall': '知识库召回',
  'agent.step.filter': '剔除不要的',
  'agent.step.rank': '口味排序',
  'agent.step.result': '生成食单',
  'agent.modelPendingTitle': '正在请模型出菜单',
  'agent.modelPendingLine': '读取当令菜与你的偏好，通常要 20 秒左右',
  'agent.modelGot': '模型返回了 {n} 道菜',
  'agent.tipsTitle': '节气食养小贴士',
  // 推演完成后的推进：回专属推荐页看成品
  'agent.goMenu': '回专属推荐',
  // 演完之后就地展开的成品：一道一道菜 + 小贴士 / 文化 / 养生提醒
  'agent.whyLabel': '推荐理由',
  'agent.cultureTitle': '节气文化',
  'agent.healthTitle': '养生提醒',
  'agent.notice': '以上内容根据节气习俗与饮食经验整理，不做专业诊断，不构成医疗建议；身体不适请及时咨询医生。',
  'agent.dishOpen': '看做法',
  'agent.noDetail': '暂无详情',
  'agent.tagSeasonal': '当令',
  'agent.tagYearRound': '常年',
  'agent.step.model': '模型复述',
  'agent.modelTitle': '正在请模型复述',
  'agent.modelFailTitle': '扣子无响应，已回退本地推演',
  'agent.modelFailLine': '上面的条数与结论不受影响，仍可在「查看依据」里复算',

  // —— 适老版 ——
  'elder.onHint': '长辈模式已开启',

  // —— 分类页
  'menu.masthead': '风味谱',
  'menu.no': '肆',
  'cuisine.filterTerm': '按节气筛',
  'cuisine.count': '共 {count} 道',
  'cuisine.empty': '这个组合暂时还没有菜',
  'cuisine.emptyAction': '看看全部',

  // —— 节气页
  'solarterm.intro': '节气简介',
  'solarterm.cultureNote': '节气文化常识整理，仅供参考；具体饮食请结合自身情况。',
  'solarterm.culture': '节气文化',
  'solarterm.phenology': '三候',
  'solarterm.phenologyHint': '古人按物候变化把每个节气分为三候',
  'solarterm.folk': '民间习俗',
  'solarterm.folkConfidence': '民间流传',
  'solarterm.hou1': '一候',
  'solarterm.hou2': '二候',
  'solarterm.hou3': '三候',
  'solarterm.ingredientHint': '性味与价格档次来自知识库食材表，供参考',
  'solarterm.mealHint': '餐次按做法建议，不是数据标注',
  'solarterm.mealMorning': '早餐',
  'solarterm.mealNoon': '午餐',
  'solarterm.mealNight': '晚餐',
  'solarterm.mealEmpty': '这个餐次的菜还在补',
  'solarterm.title': '二十四节气',
  'solarterm.current': '当令',
  'solarterm.empty': '节气内容准备中',
  'solarterm.detailEmpty': '这个节气的菜还在补',
  'solarterm.ingredients': '当令食材',
  'solarterm.dishes': '当令菜品',
  'solarterm.shareLongImage': '生成当令食单长图',
  // 养生建议（来自节气材料包 health 字段，已剔功效性表述）
  'solarterm.healthTitle': '养生建议',
  'solarterm.healthNote': '节气习俗与生活经验整理，仅供参考，不构成医疗建议。',

  // —— 菜品详情页
  'dish.loading': '加载中',
  'dish.notFound': '这道菜还没收录',
  'dish.notFoundAction': '回到上一页',
  'dish.ingredientHint': '点开看食材档案',
  'dish.ingredientUnavailable': '食材档案暂时打不开',
  'dish.mainIngredients': '主要食材',
  'dish.feature': '食养特点',
  'dish.caution': '食用提示',
  'dish.difficulty': '做法难度',
  'dish.cost': '花费',
  'dish.culture': '文化出处',
  'dish.source': '数据来源',
  'dish.favorite': '收藏',
  'dish.favorited': '已收藏',
  'dish.method': '做法方式',
  'dish.steps': '做法',
  'dish.ageSuitable': '适合人群',
  'dish.ageCaution': '需要留意',
  'dish.allergen': '过敏原',
  'dish.evidence': '证据等级',
  'dish.evidenceBlock': '出处',
  // 详情页补充：当令由头 + 同节气其他菜
  'dish.termWhy': '为什么这个时节吃',
  'dish.related': '同一节气还能吃',
  'dish.sourceShow': '查看数据来源',
  'dish.sourceHide': '收起数据来源',
  'dish.aiImage': '配图为 AI 生成',
  'dish.evidenceA': '有文献可查',
  'dish.evidenceB': '知识库整理',
  'dish.evidenceC': '待核验',
  'dish.origin': '来源类型',
  'dish.classicHint': '典籍药膳，来源与禁忌须人工核验后方可入推荐',

  // —— 来源类型（card_meta.csv 的 origin 字段）
  'origin.existing': '已有菜式',
  'origin.classic': '典籍药膳',
  'origin.ai': 'AI 推荐',

  // —— 登录后的功能引导（components/guideTour，跨三页五站）
  // 跳过要确认一次；走完送去首页并留一句实在的话
  'tour.skipTitle': '跳过功能引导？',
  'tour.skipContent': '之后可以在「我的 → 再看一遍功能引导」重新看。',
  'tour.skipConfirm': '跳过',
  'tour.skipCancel': '继续看',
  'tour.finishTitle': '三个页面都认过了',
  'tour.finishContent': '今天先看一眼当令菜；想更贴口味，就去专属推荐答那六道小题。慢慢来，不着急。',
  'tour.finishConfirm': '去首页看看',
  'tour.finishCancel': '留在这页',
  'guide.next': '下一步',
  'guide.done': '知道了',
  'guide.skip': '跳过',

  // —— 登录页（本地登录 + 协议勾选）
  // 口径：不联网、不换 openid，只用微信的头像昵称选择能力，结果存本机
  'login.brand': '康康食养',
  'login.slogan': '近邻颐养，顺时而食',
  // 主按钮与协议行（参考图版式：一个按钮 + 一行同意说明）
  'login.wxLogin': '微信一键登录',
  'login.agreeLine': '登录即同意',
  'login.skip': '先随便逛逛',
  'login.fontScale': '字号',
  'login.foot': '康康食养AI · 岭南时令饮食文化科普',
  // 登录弹层
  'login.authTitle': '微信登录',
  'login.authSub': '用微信头像和昵称，只存这台手机',
  'login.authConfirm': '确认登录',
  'login.whoHint': '点头像可换',
  'login.nickLabel': '昵称',
  'login.nickPlaceholder': '给自己起个名字',
  'login.agreePre': '我已阅读并同意',
  'login.serviceName': '用户服务协议',
  'login.privacyName': '隐私政策',
  'login.needAgree': '请先勾选同意协议',
  'login.note': '不登录也能看全部内容；头像昵称只存本机，不会上传',
  'login.welcomeBack': '已登录',
  'login.defaultNick': '食养朋友',

  // —— 协议页
  'agreement.serviceTitle': '用户服务协议',
  'agreement.privacyTitle': '隐私政策',
  'agreement.effective': '生效日期：{date}',
  'agreement.version': '版本 {version}',
  'agreement.back': '返回',

  // —— 方法说明页（科研流程的产品内落地）
  // ── 数据分享同意（与行为埋点分开，独立开关）──
  'consent.title': '要不要把你的口味告诉饭堂',
  'consent.lead': '这一项你可以自己决定。选「暂不分享」不影响任何功能，菜谱和推荐照常能用。',
  'consent.whatTitle': '会分享这些',
  'consent.whatBody': '你选的口味、想少吃的、推荐的菜名，以及你所属的社区。',
  'consent.notTitle': '不会分享这些',
  'consent.notBody': '你的微信昵称、头像、手机号、微信账号标识，一个都不发。',
  'consent.whoTitle': '会发给谁',
  'consent.whoBody': '你选择的社区所在的街道，以及为该社区供餐的长者饭堂。',
  'consent.purposeTitle': '用来做什么',
  'consent.purposeBody': '让饭堂知道这个社区大概想吃什么，用来调整菜式。不做其他用途，也不会卖给第三方。',
  'consent.regionTitle': '你属于哪个社区',
  'consent.district': '街道',
  'consent.community': '社区',
  'consent.agree': '同意并分享',
  'consent.decline': '暂不分享',
  'consent.declineHint': '随时可以在「我的」里改主意，改了立即生效。',
  'consent.agreeDone': '已开启',
  'consent.revoke': '撤回同意',
  'consent.revoked': '已撤回，不再分享',
  'consent.grantedAt': '当前已开启分享',
  'consent.notConfigured': '社区名单还没配置好，暂时无法开启分享。功能不受影响，可以正常使用。',
  'consent.needRegion': '请先选择街道和社区',
  'consent.revokeConfirmTitle': '撤回同意',
  'consent.revokeConfirmBody': '撤回后不再向饭堂和街道分享你的数据，已发出的记录需要联系饭堂处理。功能照常可用。',
  'method.title': '方法说明',
  // ── 数据分享同意（与行为埋点分开，独立开关）──
  'consent.title': '要不要把你的口味告诉饭堂',
  'consent.lead': '这一项你可以自己决定。选「暂不分享」不影响任何功能，菜谱和推荐照常能用。',
  'consent.whatTitle': '会分享这些',
  'consent.whatBody': '你选的口味、想少吃的、推荐的菜名，以及你所属的社区。',
  'consent.notTitle': '不会分享这些',
  'consent.notBody': '你的微信昵称、头像、手机号、微信账号标识，一个都不发。',
  'consent.whoTitle': '会发给谁',
  'consent.whoBody': '你选择的社区所在的街道，以及为该社区供餐的长者饭堂。',
  'consent.purposeTitle': '用来做什么',
  'consent.purposeBody': '让饭堂知道这个社区大概想吃什么，用来调整菜式。不做其他用途，也不会卖给第三方。',
  'consent.regionTitle': '你属于哪个社区',
  'consent.district': '街道',
  'consent.community': '社区',
  'consent.agree': '同意并分享',
  'consent.decline': '暂不分享',
  'consent.declineHint': '随时可以在「我的」里改主意，改了立即生效。',
  'consent.agreeDone': '已开启',
  'consent.revoke': '撤回同意',
  'consent.revoked': '已撤回，不再分享',
  'consent.grantedAt': '当前已开启分享',
  'consent.notConfigured': '社区名单还没配置好，暂时无法开启分享。功能不受影响，可以正常使用。',
  'consent.needRegion': '请先选择街道和社区',
  'consent.revokeConfirmTitle': '撤回同意',
  'consent.revokeConfirmBody': '撤回后不再向饭堂和街道分享你的数据，已发出的记录需要联系饭堂处理。功能照常可用。',
  'method.lead':
    '这一页说明数据从哪来、AI 在哪些环节参与、七项指标怎么判定、怎么复算，以及当前版本做不到的地方。所有数字按知识库实时计算。',
  // ── 数据分享同意（与行为埋点分开，独立开关）──
  'consent.title': '要不要把你的口味告诉饭堂',
  'consent.lead': '这一项你可以自己决定。选「暂不分享」不影响任何功能，菜谱和推荐照常能用。',
  'consent.whatTitle': '会分享这些',
  'consent.whatBody': '你选的口味、想少吃的、推荐的菜名，以及你所属的社区。',
  'consent.notTitle': '不会分享这些',
  'consent.notBody': '你的微信昵称、头像、手机号、微信账号标识，一个都不发。',
  'consent.whoTitle': '会发给谁',
  'consent.whoBody': '你选择的社区所在的街道，以及为该社区供餐的长者饭堂。',
  'consent.purposeTitle': '用来做什么',
  'consent.purposeBody': '让饭堂知道这个社区大概想吃什么，用来调整菜式。不做其他用途，也不会卖给第三方。',
  'consent.regionTitle': '你属于哪个社区',
  'consent.district': '街道',
  'consent.community': '社区',
  'consent.agree': '同意并分享',
  'consent.decline': '暂不分享',
  'consent.declineHint': '随时可以在「我的」里改主意，改了立即生效。',
  'consent.agreeDone': '已开启',
  'consent.revoke': '撤回同意',
  'consent.revoked': '已撤回，不再分享',
  'consent.grantedAt': '当前已开启分享',
  'consent.notConfigured': '社区名单还没配置好，暂时无法开启分享。功能不受影响，可以正常使用。',
  'consent.needRegion': '请先选择街道和社区',
  'consent.revokeConfirmTitle': '撤回同意',
  'consent.revokeConfirmBody': '撤回后不再向饭堂和街道分享你的数据，已发出的记录需要联系饭堂处理。功能照常可用。',
  'method.footnote': '数据版本 {version} · 本页数字随知识库实时计算，非估计值',

  // —— 我的（一级 Tab 页）
  // —— 我的页（档案式版面）
  'mine.mastTitle': '食养簿',
  'mine.loggedTag': '已登录',
  'mine.statFavorite': '收藏食谱',
  'mine.statTaste': '口味偏好',
  'mine.statFont': '当前字号',
  'mine.tasteLabel': '口味',
  'mine.avoidLabel': '想少吃的',
  'mine.tasteEmpty': '还没记录',
  'mine.avoidEmpty': '没有特别回避',
  'mine.elderLabel': '长辈模式',
  'mine.elderDesc': '字更大，少些次要入口',
  'mine.favEmptyTitle': '还没有收藏',
  'mine.favEmptySub': '在菜谱页点一下心形，收藏会存到这台手机',
  'mine.favMore': '{count} 道 · 全部',
  'mine.prefNote': '调完立刻生效；口味改了，专属推荐会按新的重排。',
  'mine.more': '更多',
  'mine.replayTour': '再看一遍功能引导',
  'mine.consent': '数据分享设置',
  'mine.agentEntry': '问问康康',
  'mine.agentEntryHint': '聊几句挑菜',
  'mine.consentOn': '已开启',
  'mine.consentOff': '未开启',
  'mine.notLogin': '未登录 · 本地使用',
  'mine.notLoginHint': '收藏与偏好只存在这台手机',
  'mine.loginAction': '登录 / 换头像昵称',
  'mine.loggedInHint': '头像昵称只存在这台手机',
  'mine.logout': '退出登录',
  'mine.logoutConfirm': '退出后收藏与偏好仍会保留，只删除本机头像昵称，确定退出吗？',
  'mine.logoutDone': '已退出登录',
  'mine.agreementService': '用户服务协议',
  'mine.agreementPrivacy': '隐私政策',
  'mine.method': '方法说明',
  'mine.foodSafety': '食品安全',
  'mine.foodSafetyHint': '抽检与处罚公开数据',
  'mine.favorite': '我的收藏',
  'mine.favoriteCount': '{count} 道',
  'mine.pref': '饮食偏好',
  'mine.prefEmpty': '还没测过',
  'mine.prefDone': '已测过',
  'mine.about': '关于与免责声明',
  'mine.aboutText':
    '康康食养AI 是一个岭南时令饮食科普小程序：按 24 节气与岭南风味整理当令食材与家常做法。所有内容为饮食文化科普，仅供日常饮食参考，不构成医疗建议，也不能替代专业意见。',
  'mine.privacy': '隐私说明',
  'mine.privacyText':
    '头像与昵称只有你在登录页主动选择时才产生，和收藏、偏好答案、搜索历史一起保存在这台手机上，不上传服务器、不共享给第三方。换手机或删除小程序后会一并消失。在「清除本地数据」里可以一次性删除。',
  'mine.clearData': '清除本地数据',
  'mine.clearConfirm': '收藏与偏好将一起清空，无法恢复，确定吗？',
  'mine.cleared': '已清除',
  'mine.fontScale': '字号大小',
  'mine.fontStandard': '标准',
  'mine.fontLarge': '大',
  'mine.fontXLarge': '特大',
  'mine.fontHint': '放大后正文会整体变大，页面不会截断',
  'mine.version': '康康食养AI v2.0.0',

  // —— 搜索页
  'search.masthead': '寻味',
  'search.no': '陆',
  'search.placeholder': '搜菜名 / 食材',
  'search.action': '搜索',
  'search.emptyKeyword': '输入菜名或食材试试',
  'search.history': '搜索历史',
  'search.clearHistory': '清空',
  'search.hot': '当令推荐词',
  'search.empty': '换个说法试试',
  'search.resultCount': '找到 {count} 道',
  'search.voice': '语音',
  'search.voiceHint': '语音搜菜名：本期未开放',
  'search.failed': '搜索没成功，请稍后再试',

  // —— 收藏页
  'favorite.masthead': '收藏箧',
  'favorite.no': '柒',
  'favorite.title': '我的收藏',
  'favorite.count': '共 {count} 道',
  'favorite.empty': '还没有收藏',
  'favorite.emptyAction': '去逛逛菜系',
  'favorite.remove': '取消收藏',
  'favorite.removeDone': '已取消收藏',

  // —— 饮食偏好小测试
  'preftest.title': '饮食偏好小测试',
  'preftest.intro': '6 道题，帮我们记住你的口味与日常饮食习惯。随时可以返回上一题。',
  'preftest.progress': '{current} / {total}',
  'preftest.prev': '上一题',
  'preftest.next': '下一题',
  'preftest.finish': '完成',
  'preftest.pickAtLeastOne': '至少选一项，或选最后一项表示没有',
  'preftest.multipleHint': '可多选，选好点下一题',
  'preftest.switchRemindDesc': '本期暂未开放',
  'preftest.introTitle': '6 道题，约 1 分钟',
  'preftest.notSaved': '未开启记录，本次答案不保存',
  'preftest.introDesc': '题目涉及口味、饮食习惯与几点日常身体感受。答案只用于生成饮食搭配参考，不做任何健康判断；不开启记录时，本次答案不保存。',
  'preftest.switchRecommend': '按偏好推荐菜品',
  'preftest.switchRecommendDesc': '不看也可以正常用推荐',
  'preftest.switchRemind': '接收节气提醒',
  'preftest.start': '开始测试',
  'preftest.switchRecord': '记录我的选择',
  'preftest.switchHint': '三个开关默认关闭，可随时在「我的」里改',
  'preftest.switchRecordDesc': '用于生成偏好画像，仅存在本机',
  'preftest.unsure': '不清楚',
  'preftest.submitting': '正在整理你的偏好',
  'preftest.failed': '提交没成功，请稍后再试',

  // 题目来源：《康康食养AI · 饮食与日常感受问卷原文（11 题完整版）》
  // 取其中的 Q1 / Q3 / Q4 / Q5 / Q10 / Q11，跳过 Q2 舌色、Q6 自理能力与 Q7–Q9 指标题。
  // Q10、Q11 为多选，其余单选；每题末尾保留「不清楚」，不逼着作答。

  'preftest.q1.title': '你平时是怕冷还是怕热？',
  'preftest.q1.a1': '怕冷',
  'preftest.q1.a2': '怕热',
  'preftest.q1.a3': '正常',
  'preftest.q1.a4': '冷热都怕',

  'preftest.q2.title': '你容易出汗吗？',
  'preftest.q2.a1': '容易出汗',
  'preftest.q2.a2': '很少出汗',
  'preftest.q2.a3': '正常',
  'preftest.q2.a4': '晚上睡觉出汗',

  'preftest.q3.title': '你平时口干吗？',
  'preftest.q3.a1': '经常口干',
  'preftest.q3.a2': '很少口干',
  'preftest.q3.a3': '正常',
  'preftest.q3.a4': '口苦',

  'preftest.q4.title': '你的大便通常是怎样的？',
  'preftest.q4.a1': '偏软不成形',
  'preftest.q4.a2': '偏干硬',
  'preftest.q4.a3': '正常',
  'preftest.q4.a4': '时干时稀',

  'preftest.q5.title': '你平时口味有什么偏好？',
  'preftest.q5.multiple': '可多选',
  'preftest.q5.a1': '清淡',
  'preftest.q5.a2': '咸香',
  'preftest.q5.a3': '酸甜',
  'preftest.q5.a4': '辣',
  'preftest.q5.a5': '喜欢喝汤',
  'preftest.q5.a6': '没有特别偏好',

  'preftest.q6.title': '你有没有需要回避的食物？',
  'preftest.q6.multiple': '可多选',
  'preftest.q6.a1': '海鲜',
  'preftest.q6.a2': '牛肉',
  'preftest.q6.a3': '鸡蛋',
  'preftest.q6.a4': '豆制品',
  'preftest.q6.a5': '牛奶',
  'preftest.q6.a6': '鸡肉',
  'preftest.q6.a7': '都不回避',
  // 测试页声明：线框稿原句含禁用词，此处改用合规表述
  'preftest.disclaimer': '本结果仅用于饮食搭配参考，不构成健康判断，也不作为任何诊断依据。',

  // —— 偏好画像结果页
  'prefresult.title': '偏好画像',
  'prefresult.empty': '还没有你的偏好画像',
  'prefresult.emptyAction': '去做小测试',
  'prefresult.serviceOffline': '偏好判定服务还没接上，暂时看不了画像',
  'prefresult.retry': '再试一次',
  'prefresult.consentTitle': '数据怎么用',
  'prefresult.consentHint': '三个开关默认关闭，你需要哪个就打开哪个；关掉后立即停止对应上报。',
  'prefresult.consentBasic': '基础：记住我的偏好，用来生成推荐',
  'prefresult.consentCanteen': '共享饭堂：匿名汇总到饭堂',
  'prefresult.consentStreet': '共享街道：匿名汇总到街道',
  'prefresult.myData': '我的数据',
  'prefresult.viewData': '查看我的数据',
  'prefresult.viewDataTitle': '我保存的数据',
  'prefresult.deleteData': '删除我的数据',
  'prefresult.deleteConfirm': '删除后无法恢复，确定吗？',
  'prefresult.deleted': '已删除',
  'prefresult.dataAnswers': '偏好答案：{count} 条',
  'prefresult.dataFavorites': '收藏菜品：{count} 道',
  'prefresult.dataHistory': '搜索历史：{count} 条',

  // —— 个性化推荐页
  'recommend.title': '当令推荐',
  'recommend.empty': '这个节气还没有可以推荐的菜',
  'recommend.emptyAction': '换个节气看看',
  'recommend.degraded': '个性化推荐服务还没接上，当前展示的是当令菜，不构成推荐依据。',
  // 依据链路：把「为什么是这三道」拆成四步显示，评审问「推荐过程是否可追溯」时能直接指
  'recommend.chainTerm': '当令节气',
  'recommend.chainPref': '偏好命中',
  'recommend.chainRecall': '召回来源',
  'recommend.chainFilter': '回避项过滤',
  'recommend.genRule': '生成方式：规则召回 + 回避项过滤。个性化模型未接入，因此不称其为模型推荐。',
  'recommend.genModel': '生成方式：模型召回 + 回避项过滤。依据均来自接口返回，前端不补理由。',
  'recommend.reason': '推荐过程',
  'recommend.reasonTerm': '命中的节气',
  'recommend.reasonPrefs': '你的偏好',
  'recommend.reasonRecall': '召回来源',
  'recommend.reasonEmpty': '本次没有可展示的判定依据',
  'recommend.refresh': '换一批',
  'recommend.failed': '推荐没成功，请稍后再试',

  // —— 分享
  'share.appTitle': '康康食养AI · 岭南时令食单',
  'share.dishTitle': '{name} · 做法与文化出处',
  'share.termTitle': '{name} · 当令食单',
  'share.longImageDishes': '当令菜品',
  'share.longImageFooter': '扫码查看当令食单 · 内容为科普，不构成医疗建议',
  'share.qrPlaceholder': '小程序码待接入',
  'share.saveAlbum': '保存长图',
  'share.generating': '长图生成中',
  'share.saved': '已保存到相册',
  'share.failed': '保存没成功',
  'share.recent': '最近收藏',
  'share.favoriteFrom': '已带到收藏',

  // —— 格式化
  'format.difficulty.easy': '简单',
  'format.difficulty.mid': '中等',
  'format.difficulty.hard': '稍费工夫',

  // —— 数据版本
  'meta.notGenerated': '尚未生成',
};

const LOCALES = {
  'zh-CN': zhCN,
};

let currentLocale = 'zh-CN';

// 取文案。缺 key 时返回 fallback（默认空字符串），并在控制台留痕便于开发期发现遗漏。
function t(key, fallback) {
  const dict = LOCALES[currentLocale] || LOCALES['zh-CN'];
  const value = dict[key];
  if (value === undefined) {
    console.warn('[i18n] missing key: ' + key);
    return fallback === undefined ? '' : fallback;
  }
  return value;
}

// 带占位符的文案：tpl('home.daysToNext', { name: '小满', days: 3 })
function tpl(key, params, fallback) {
  let text = t(key, fallback);
  const data = params || {};
  Object.keys(data).forEach((name) => {
    text = text.replace('{' + name + '}', data[name]);
  });
  return text;
}

function setLocale(locale) {
  if (LOCALES[locale]) currentLocale = locale;
}

function getLocale() {
  return currentLocale;
}

module.exports = {
  t,
  tpl,
  setLocale,
  getLocale,
};
