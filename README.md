# 康康食养 · 岭南节气食养小程序

> 24 节气 × 广府 / 潮汕 / 客家三系 · 288 道菜 · 222 张食材档案
>
> 一个**研究工具**，不是产品交付。研究问题是「基层养老服务中，需求与供给信息在采集—传递—使用链条上如何失真、又如何被修复」；本仓库是该问题下的工具实现。

---

## 目录

- [这个仓库是什么](#这个仓库是什么)
- [关键数字](#关键数字全部可当场复算)
- [功能清单](#功能清单)
- [目录导览](#目录导览)
- [数据结构](#数据结构)
- [技术架构](#技术架构)
- [三个可当场验证的命令](#三个可当场验证的命令)
- [运行方式](#运行方式)
- [合规](#合规)
- [自检](#自检)
- [已知局限](#已知局限)
- [工程复盘：踩过的坑](#工程复盘踩过的坑)
- [相关文档](#相关文档)

---

## 这个仓库是什么

| | |
|---|---|
| **是什么** | 微信小程序 + 云函数的完整实现，用 24 节气组织岭南三菜系的菜谱与食材知识 |
| **不是什么** | 不是营养建议工具，不做诊断、不承诺功效；不宣称"准确率 99%" |
| **研究角色** | 验证「供给结构可以被系统性重构」这件事能不能落地成可用工具 |
| **不覆盖** | 用户侧效果验证（缺盲标与真实使用数据，见[局限](#已知局限)）|

### 研究问题与这个工具的关系

研究的起点不是"做一个美食 App"，而是基层养老服务里一个具体的信息失真问题：

```
采集断   问不到真实需求（"我说随便"）
传递断   需求在层层上报中丢失
应用断   配餐没按登记来
沉淀断   反馈没有形成可复用的记录
```

工具在这个问题里的位置是**末端的微循环**：如果连"一个社区有多少人想吃清淡的、忌什么、当令该吃什么"都整理不出来，上面四个断点就无从修复。

所以这个仓库做的是**供给侧的结构化**：把 876 道杂乱的存量菜谱，重构成三系均衡、节气全覆盖、字段可追溯的 288 道。

---

## 关键数字（全部可当场复算）

| 项 | 值 | 复算方式 |
|---|---|---|
| 菜品 | **288 道** | `node -e "console.log(require('./miniprogram/data/recipes.js').length)"` |
| 菜系结构 | **广府 96 / 潮汕 96 / 客家 96**（各 33.3%） | 按 `cuisine` 字段计数 |
| 节气覆盖 | **24 / 24**，无断档 | 每节气菜数均 > 0 |
| 每节气菜数 | **12 道**（最小 12 / 最大 12） | 按 `terms` 字段过滤计数 |
| 字段完整度 | 主料 / 难度 / 成本档 / 做法 **288/288 = 100%** | 数组非空计数 |
| 食材档案 | **222 张标准卡** / 291 种主料索引 | `require('./miniprogram/packageIngredient/data/ingredients.js').length` |
| 页面 | 18 个主包页面 + 2 个分包页面 | `miniprogram/app.json` |
| 工具模块 | 25 个 | `miniprogram/utils/*.js` |
| 包体 | 主包 1,589 KB / 上限 2,048 KB | 见[自检](#自检) |

### 风味结构是本项目的核心成果

| | 重构前 | 重构后 |
|---|---|---|
| 存量菜品 | 876 道 | — |
| 可归入三系 | **32 道（3.7%）** | **288 道（100%）** |
| 潮汕菜 | **0 道，断档 24/24** | **96 道，覆盖 24/24** |
| 三系占比 | 广府 24 / 潮汕 0 / 客家 8 | 96 / 96 / 96 |

**潮汕菜从 0 到 96** 是这一轮最硬的数字——重构前它是一条完全断掉的线（卤水、生腌、鱼饭、粿品、砂锅粥、牛肉火锅六条主线全缺）。

---

## 功能清单

### 18 个主包页面

| 页面 | 作用 |
|---|---|
| `index` | 首页：当前节气主视觉、当令菜、节气文化摘要、两个对话入口 |
| `solarterm` | 节气列表 + 详情（三候 / 食俗 / 当令食材 / 当令菜，带餐次筛选） |
| `dish` | 菜谱详情：做法、主料（可点进食材档案）、难度成本、少吃提示 |
| `search` | 搜索：菜名 / 主料 / 做法关键词，带搜索历史 |
| `favorite` | 收藏夹 |
| `menu` | 专属推荐：问卷 → 推演动画 → 三道菜 + 当令提醒 |
| `preftest` | 原生问卷：6 道题，单选 + 多选 |
| `prefresult` | 问卷结果页 |
| `recommend` | 推荐结果独立页 |
| `agent` | **问问康康**：对话式问卷（点选项，6 轮，最后调工作流） |
| `aichat` | **康康对话**：连扣子 Bot（打字，多轮，可追问） |
| `cockpit` | 数据驾驶舱：节气视图 / 菜系对照 / 人群偏向 / 知识图谱 / 食材深库 |
| `foodsafety` | 食品安全信息 |
| `consent` | 数据分享同意（用户可选同意/不同意，可撤回） |
| `method` | 方法说明：指标口径、数据来源、已知局限 |
| `mine` | 我的：收藏、偏好、字号、数据分享设置 |
| `login` | 登录（仅存本机头像昵称，不上传） |
| `agreement` | 协议页 |

### 2 个分包页面

| 页面 | 作用 | 为什么在分包 |
|---|---|---|
| `packageDishes/pages/gallery` | 菜品大图全屏查看 | 图片 1,180 KB，放主包会挤爆 |
| `packageIngredient/pages/detail` | 食材档案（8 个区块） | 数据 236 KB |

### 25 个工具模块

| 模块 | 职责 |
|---|---|
| `config.js` | 全项目唯一允许出现地址与通道开关的地方，**不含任何 token** |
| `api.js` | 接口封装：工作流调用、云函数通路、降级 |
| `aichat.js` | Bot 对话调用 + 错误码翻译 |
| `agentChat.js` | 对话式问卷状态机 |
| `nutrition.js` | 推荐规则（当令 +10 / 口味 +2）+ 工作流入参拼装 |
| `workflowResult.js` | 模型输出解析（6 种格式兼容 + 出侧词表过滤） |
| `dataSource.js` | 数据查询与字段校验 |
| `seasonTips.js` | 当令小方法生成（按季节，离线） |
| `consent.js` | 数据分享同意（独立于埋点，白名单脱敏） |
| `track.js` | 行为埋点（默认关，同意才采） |
| `format.js` | 难度 / 成本 / 日期格式化 + 限制类文案净化 |
| `i18n.js` | 全部文案（35.9 KB） |
| `dishImages.js` | 菜品图按画面内容定键 |
| `solarTheme.js` / `seasonalBg.js` | 节气主题色与背景 |
| `genStore.js` | 推荐结果本地存取 |
| `favorite.js` | 收藏 |
| `share.js` | 分享长图 |
| `snapshot.js` / `kbStats.js` | 知识库统计（实时算，不写死）|
| `agentTrace.js` | 推演轨迹 |
| `daypart.js` | 餐次判断 |
| `methodDoc.js` | 方法说明文案 |
| `agreements.js` | 协议内容 |
| `tour.js` | 新手引导 |

---

## 目录导览

```
miniprogram/              微信小程序前端
├── pages/                18 个主包页面
├── components/           8 个自研组件
│   ├── disclaimer/       底部声明（灰色小字 + 版权行）
│   ├── dishCard/         菜品卡
│   ├── termCard/         节气卡
│   ├── loading/          加载态（骨架 / 转圈）
│   ├── emptyState/       空态
│   ├── cuisineTab/       菜系切换
│   └── dishMedia/        菜品图
├── utils/                25 个工具模块
├── data/                 构建产物（前端只读，禁止手改）
├── packageDishes/        分包① 菜品大图
├── packageIngredient/    分包② 食材档案
└── images/               图标与插画（111 张）

cloudfunctions/           微信云函数（零第三方依赖）
├── workflow/             扣子工作流转发（同步）
├── aichat/               扣子 Bot 对话转发（异步三跳）
└── gongzuoliu2/          工作流备用转发

knowledge/                内容源（构建产物的上游，可追溯）
├── ingredients_kb_v0.2.md      食材主料知识库（291 主料 / 222 标准卡）
├── 广府菜96道_十字段.md          三系菜谱交付包
├── 潮汕菜96道_十字段.md
├── 客家菜96道_十字段.md
├── card_meta.csv               旧存量菜品卡（已不作为真源）
├── solar_term_map.csv          节气日期区间
└── _archive/                   重构过程材料
    ├── gap_conclusion.md       缺口矩阵与结论（876 → 32 → 288 的依据）
    └── recon_v3.xlsx           三系重构表

scripts/                  构建与自检
├── build-data.js              CSV/MD → 菜品与节气数据模块
├── build-ingredients.js       食材知识库 → 222 张标准卡
├── build-food-safety.js       食品安全数据
├── check-compliance.js        12 脱敏词 + 明文密钥 + BOM
├── check-workflow.js          三段联调（参数 / 平台直连 / 云函数）
└── upload-to-cloud.js         批量上传

docs/                     接入说明
成果交付/                  阶段交付物（页面清单、自检报告、UI 预览）
```

---

## 数据结构

### 菜品（`data/recipes.js`，288 条）

```js
{
  id: 'TS0001',
  name: '白灼西兰花',
  cuisine: 'guangfu',              // guangfu | chaoshan | hakka
  cuisineName: '广府菜',
  terms: ['立春'],                  // 当令节气，白名单内
  termNote: '冬春应节',             // 为什么这个节气吃
  mainIngredients: ['西兰花', '生抽', '蒜'],
  method: '其他',
  mealHints: ['午'],                // 早 / 午 / 晚
  how: '掰小朵盐水浸10分钟，沸水加盐油焯60秒过凉，淋豉油泼热油',
  caution: '甲状腺功能低下者不宜大量生食',   // 界面显示前会过 format.softenCaution()
  difficulty: 'easy',              // easy | mid | hard
  costLevel: 1,                    // 1 | 2 | 3
  source: '民间流传｜白灼技法属广府…',        // 溯源
  origin: 'tri-series',            // 数据来源
  evidence: 'B',                   // A 文献可考 / B 民间流传 / C 待核
  allergen: '无',
  ageSuitable: ['成人', '长者'],
  ageCaution: '',
  verified: ''
}
```

### 节气（`data/terms.js`，24 条）

```js
{
  name: '立冬',
  order: 21,
  dateWindow: ['11-07', '11-21'],  // 日期区间，不是硬编码表
  season: '冬',
  intro: '立冬是冬季的第一个节气…',   // 已剔除功效表述
  ingredients: ['羊肉', '鸡肉', …],  // 当令食材 10 种
  ingredientDetails: [{ name, nature, priceLevel }],
  slogan: '万物收藏也',
  aura: '初冬清冷',
  poem: { text, author },
  phenology: ['水始冰', '地始冻', '雉入大水为蜃'],   // 三候
  folk: [{ title, icon, desc, detail }]              // 食俗，标「民间流传」
}
```

### 食材卡（`packageIngredient/data/ingredients.js`，222 张）

```js
{
  id: 'ING-A01',
  name: '猪肉',
  oneLine: '广东人餐桌上的"百搭肉"…',   // 一句话
  identity: '猪肉，又叫豚肉，畜肉…',
  origin: '主要产自粤西、粤北，四季都有…',
  quality: '看外观：瘦肉淡红均匀…安全指标：兽药残留、铅镉…',
  nutrition: '优质蛋白，维生素 B1 在肉类中较高…',
  select: '色匀、脂白、按回弹，口诀：色匀、脂白、按回弹',
  cook: '里脊逆纹切片上浆快炒，五花先煸后炖…',
  caution: '不吃生肉；长者切小炖软',
  price: '价格档 2，替代鸡肉、牛肉、豆制品',
  inspect: '取样：同批次不同部位…检测方法：GB 5009.3…按此判定：GB 2707',
  basis: 'CFCT6 第二册，膳食指南 2022，GB 2707…'
}
```

---

## 技术架构

| 层 | 选型 | 为什么 |
|---|---|---|
| 客户端 | 微信小程序原生 | 目标用户在微信内；包体余量紧张，框架会多吃 15–25% |
| 服务端 | 微信云开发云函数 | 免域名备案、免配 request 白名单 |
| AI | 扣子 Coze 工作流（3 条）+ Bot（1 个） | 结构化产出用工作流；自由问答用 Bot |
| 依赖 | **零第三方依赖** | 云函数只用 Node 原生 `https`；小程序无 `package.json` |
| 数据 | JSON 源 → `.js` 模块 | 规避不同基础库对 `require('*.json')` 支持不一致 |

### 两条 AI 链路（易混，特此说明）

```
工作流  POST /v1/workflow/run   同步，一次请求即返回结果
        → 用于：当令菜推荐（seasonal_recipe）、调研简报（survey_brief）、双份报告（weekly_report）

Bot     POST /v3/chat           异步，只返回 chat_id
        → 必须三跳：
           ① POST /v3/chat                    拿到 chat_id + conversation_id，status=in_progress
           ② GET  /v3/chat/retrieve           轮询到 status ∈ {completed, failed, canceled, requires_action}
           ③ GET  /v3/chat/message/list       取 role=assistant && type=answer
```

**最常踩的坑**：Bot 的第一跳响应体里**没有消息内容**，直接读永远是空的。

### 三层降级

```
① 本地知识库（288 道菜，离线可用，< 50ms）
        ↓ 模型可达时增强
② 扣子工作流 / Bot（20 秒左右）
        ↓ 失败即回退
③ 如实提示失败原因 + 保留本地结果
```

**失败就说失败**，不伪造结果。界面会显示具体原因：

```
TOKEN_MISSING          → 云函数没配 COZE_TOKEN 环境变量
UPSTREAM_TIMEOUT       → 扣子响应超时，把云函数超时改成 60 秒
-501000                → 云函数还没上传部署
INVALID_STATUS         → token 无效或没勾工作流权限
```

---

## 三个可当场验证的命令

> 本项目的原则：**凡写出来的数字，必须能当场打开证明。**

```bash
# ① 数据规模
node -e "console.log(require('./miniprogram/data/recipes.js').length)"
# → 288

# ② 三系结构
node -e "const r=require('./miniprogram/data/recipes.js');const c={};r.forEach(x=>c[x.cuisine]=(c[x.cuisine]||0)+1);console.log(c)"
# → { guangfu: 96, chaoshan: 96, hakka: 96 }

# ③ 合规扫描（词表收在脚本里，不在文档中列出）
node scripts/check-compliance.js
# → ✓ 脱敏词 0 命中 / 明文密钥 0 命中 / 0 BOM
```

### 另外三条可以自己跑

```bash
# ④ 每节气菜数（应全为 12）
node -e "const r=require('./miniprogram/data/recipes.js'),t=require('./miniprogram/data/terms.js');t.forEach(x=>console.log(x.name, r.filter(y=>(y.terms||[]).includes(x.name)).length))"

# ⑤ 字段完整度
node -e "const r=require('./miniprogram/data/recipes.js');console.log('主料', r.filter(x=>(x.mainIngredients||[]).length).length, '/', r.length)"

# ⑥ 食材档案覆盖
node scripts/build-ingredients.js
# → 覆盖：需溯源主料 928 次，命中 555 (59.8%)，辅料跳过 241 次
```

---

## 运行方式

### 前提

- 微信开发者工具（稳定版即可）
- 云开发环境（可选；不配也能跑，走本地数据）

### 步骤

```bash
# 1. 打开工程
微信开发者工具 → 导入项目 → 选择本目录（含 project.config.json 的这一层）

# 2. 构建数据（knowledge/ 有改动时才需要）
node scripts/build-data.js
node scripts/build-ingredients.js

# 3. 部署云函数（可选，不部署则走本地推荐）
右键 cloudfunctions/workflow → 上传并部署
右键 cloudfunctions/aichat   → 上传并部署

# 4. 配置云函数环境变量（云开发控制台 → 云函数 → 配置）
COZE_TOKEN  = <扣子个人访问令牌>
COZE_BOT_ID = <扣子 Bot ID，aichat 需要>
超时        = 60 秒        ← 扣子工作流实测 20.46 秒，默认 20 秒必超时
```

### 什么都不配也能跑

不配云开发时，小程序自动走**本地知识库**：288 道菜、24 节气、食材档案全部离线可用。

界面会如实标注「本地推荐 · 离线可用」，**不会假装模型在线**。

### 云函数超时这件事必须说清

| 项 | 值 |
|---|---|
| 扣子工作流实测耗时 | **20,460 ms** |
| 微信云函数默认超时 | **20,000 ms** |
| 差 | **460 ms → 必然失败** |

所以第 4 步的「超时改成 60 秒」不是建议，是**必须**。不改的话前端永远显示「扣子无响应」。

---

## 合规

| 项 | 状态 | 验证方式 |
|---|---|---|
| 12 个脱敏词（含注释与 JSON） | **0 命中** | `node scripts/check-compliance.js` |
| 前端明文密钥 | **0 命中** | 同上（token 只在云函数环境变量）|
| BOM | **0 文件** | 同上（BOM 会导致 JSON 解析失败、模拟器起不来）|
| 每页底部声明条 | 18 + 2 页全部在位 | 逐页检查 |
| 声明口径 | 「本内容为饮食文化科普，仅供日常饮食参考，不构成医疗建议」 | `components/disclaimer/` |
| 对比度 | 正文与声明行均 ≥4.5:1 | 实测值见 `disclaimer.wxss` 注释 |
| 适老化 | 正文 ≥36rpx、点击区 ≥88rpx、标题 ≥48rpx | 样式常量 |

**关于声明条的对比度**：初版用 `#8b8272` 只有 3.34:1、版权行 `#a39a89` 只有 2.45:1，都低于 4.5:1 的硬线。面向长者的产品这条不能让，所以改成 `#6b6255`（5.28:1）与 `#6b5a45`（5.83:1）。

---

## 自检

```bash
# 全部 JS 语法
find miniprogram cloudfunctions scripts -name "*.js" -exec node --check {} \;

# 合规三项
node scripts/check-compliance.js

# 数据与产物一致性（重跑构建后应无 diff）
node scripts/build-data.js && git diff --stat miniprogram/data
```

**当前状态**

```
✓ 全部 JS 语法通过（75 个文件）
✓ 12 个脱敏词 0 命中 / 明文密钥 0 命中 / 0 BOM
✓ 20 个页面 copy 字段齐全，声明条全部在位
✓ 主包 1,589 KB / 2,048 KB（余量 459 KB）
✓ 分包 packageIngredient 236 KB
```

---

## 已知局限

**这一节如实写，不修饰。**

| 局限 | 说明 |
|---|---|
| **用户侧效果未验证** | 400 条测试集的双人盲标未完成，Top-3 相关性**没有测**。任何"准确率 90%"的表述都不成立 |
| **无真实使用数据** | 研究窗口内不具备规模化用户触达条件，用户行为数据为空 |
| **食材档案覆盖 59.8%** | 主料引用 928 次，命中 555 次；其余是知识库未覆盖的（薯粉、南姜、乳鸽等），界面如实显示「暂无档案」，不编内容 |
| **推荐是规则加权** | 当令 +10 分、口味命中 +2 分/项。不是机器学习模型；无法处理未显式编码的偏好 |
| **部分统计为示例** | `cockpit` 页的人群分布标注为 `[示例]`，知识库没有真实统计来源 |
| **适用人群有限** | 面向岭南地区长者及其家庭，口味与食材判断基于岭南饮食实践，不外推到其他地域 |
| **未做真机全量测试** | 主要靠模拟器与静态校验，超高龄用户的真实操作路径未验证 |

**对外只能这样表述**：确定性指标（节气匹配、格式合规）可复算；语义相关性待盲标验证。

---

## 工程复盘：踩过的坑

这些是真实发生、并且影响过交付的问题，记在这里供后续参考。

### 1. 工作流返回的是 JSON 字符串，不是对象

```js
// 踩坑：直接取 data.content 拿不到
const text = res.data.content;

// 修法：二次 parse + 逐层取
function pickWorkflowText(payload) {
  let cur = payload;
  for (let depth = 0; depth < 4 && cur; depth += 1) {
    if (typeof cur === 'string') return cur;
    if (typeof cur.text === 'string' && cur.text) return cur.text;
    if (typeof cur.data === 'string' && cur.data) return cur.data;
    cur = cur.data;
  }
  return '';
}
```

**更隐蔽的一次**：云函数把未解析的原始串当 `text` 返回，前端拿到 `'{"content_type":1,"data":"<真正的 markdown>"}'`——877 个字符全是外壳，解析器一个菜名都认不出。现在前端会检测首字符是否为 `{` 并再剥一层。

### 2. `consent.json` 带 BOM 导致模拟器起不来

```
日志原文：SyntaxError: Unexpected token ﻿ in JSON at position 0
```

PowerShell 5.1 的 `Set-Content -Encoding utf8` **会写 BOM**，而微信解析 JSON 不容 BOM。现在 `check-compliance.js` 会扫 BOM。

### 3. 分包 `pages` 为空数组 → 编译失败

```json
"subPackages": [{ "root": "packageDishes", "pages": [] }]   // ✗ 编译失败
```

微信要求分包至少声明一个页面。修法不是塞空占位页，而是做成有实际用途的页面（菜品大图查看）。

### 4. 单字全局替换把文案改坏

```js
// 想改「宜」→「适合」，结果：
'最便宜的优质蛋白'  →  '最便适合的优质蛋白'   ✗
```

现在只做多字、语义明确的替换（`切勿`、`忌食`、`适宜`），单字一律不动。

### 5. 空数组的 `every()` 恒为 `true`

```js
// 踩坑：未作答被误判成「不清楚」
physiqueParts.every(x => x === '不清楚')   // [] → true

// 修法：先判长度
physiqueParts.length > 0 && physiqueParts.every(...)
```

### 6. 文案键名冲突导致注入失效

原本想用 `agent.*` 前缀加新文案，但 `agent.title` 早就存在（值 `'AI 食单'`，被别的页面用着），注入被跳过，页面显示错误标题。改用独立前缀 `qa.*` 隔离。

---

## 相关文档

| 文档 | 位置 | 内容 |
|---|---|---|
| **页面与交互说明** | `docs/页面与交互说明.md` | 20 个页面的入口、交互、四态覆盖、三个真实缺口 |
| **数据字典** | `docs/数据字典.md` | 三个实体的完整字段表、枚举白名单、净化规则 |
| 部署架构与调用链路 | `docs/扣子接入说明.md` | 云函数部署、扣子接入 |
| **AI 问答部署** | `docs/AI问答部署说明.md` | aiqa 云函数、LLM 平台选型、环境变量、错误对照 |
| 云存储接入 | `docs/云存储接入指南.md` | 图片走 CDN 的方案 |
| 食材知识库 | `knowledge/ingredients_kb_v0.2.md` | 291 主料 / 222 标准卡原始资料 |
| 重构过程与缺口分析 | `knowledge/_archive/gap_conclusion.md` | 876 → 32 → 288 的依据 |
| 前端待确认事项 | `成果交付/03_待确认事项清单_v1.0.docx` | 契约缺口的识别与处置记录 |

---

## 许可

研究用途。代码与内容可用于评审、复现与学术引用；商业使用请先联系团队。

---

*本仓库为第五届未来杯创新大赛参赛作品（赛道二 AI4S）。*
