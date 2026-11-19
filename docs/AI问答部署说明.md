# AI 问答部署说明（aiqa 云函数）

> 回答一个常见疑问：**项目里为什么有两套 AI？**
> 结论：**两条独立通道，各管一个页面，不要互相替代。**
> 一条走扣子 Bot，一条走 DeepSeek。这一份讲后者。

---

## 一、两条通道的分工

```
                        用户
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
    pages/kangkang/                pages/qa/
   「智能体对话」                  「AI 问答」
            │                           │
            ▼                           ▼
  utils/aichat.js                utils/qa.js
            │                           │
            ▼                           ▼
   cloudfunctions/aichat        cloudfunctions/aiqa
            │                           │
            ▼                           ▼
      扣子 Bot 平台              本地检索 → DeepSeek
      COZE_TOKEN                 LLM_API_KEY
```

| | `aichat` | `aiqa` |
|---|---|---|
| 页面 | `pages/kangkang` | `pages/qa` |
| 后端 | 扣子 Bot | DeepSeek（可换任意 OpenAI 兼容平台）|
| 环境变量 | `COZE_TOKEN`、`COZE_BOT_ID` | `LLM_API_KEY`、`LLM_MODEL` |
| 依赖 | 无（纯 `https`）| `wx-server-sdk` + 3 个数据库集合 |
| 菜品知识 | 扣子平台上的知识库 | 本仓库 `data/recipes.json`（288 道）|
| 过滤能力 | 靠 Bot 的 prompt | **本地硬过滤**：回避项 / 年龄 / 耗时 |

**为什么不合并成一条**：`aiqa` 的回避项、年龄、耗时三道硬过滤写在本地代码里（`lib/retrieval.js` 的 `hardFilter`）。改成纯 Bot 后，这些约束只剩 prompt 在管，模型可能不遵守。

> 扣子那条线的 token 与权限，见 `docs/扣子token与权限.md`。

---

## 二、部署前要准备的三样东西

### ① LLM 的 API Key

默认接 DeepSeek，也可以换任意 OpenAI 兼容平台。

**拿 DeepSeek 的 key**：

1. 打开 <https://platform.deepseek.com>
2. 注册并登录 → 左侧「API keys」→「创建」
3. 复制 `sk-` 开头那串（**只显示一次**）

> 拿到后先跑 `node scripts/probe-llm-key.js` 验一下属于哪个平台、有哪些模型。不验就配，模型名过期了很难查。

### ② 三个数据库集合

云开发控制台 → 数据库 → 逐个新建：

| 集合名 | 用途 | 缺了会怎样 |
|---|---|---|
| `qa_quota` | 每日提问限流（默认每人 30 次）| 限流失效，可无限提问 |
| `qa_logs` | 问答日志（问题、耗时、拦截原因）| 出问题查不到原因 |
| `qa_search_cache` | 联网搜索缓存（7 天）| 每次重复搜同一内容 |

权限设置**不用改**，保持默认「仅创建者可读写」——云函数走管理员权限，不受这个限制。

### ③ 内容安全权限（可选）

`config.json` 里声明了：

```json
"permissions": { "openapi": ["security.msgSecCheck"] }
```

云开发控制台 → 设置 → 权限设置 → 「内容安全」→ 开通。

**不开也能跑**，`index.js` 里做了降级：

```js
return { pass: true, skipped: true, error: String(e.errCode || e.message || e) };
```

只是失去「提问内容送审」这层防护。

---

## 三、部署五步

### 第一步：建集合

见上面「三个数据库集合」。名字要**一字不差**，代码里是常量：

```js
// cloudfunctions/aiqa/index.js
const QUOTA_COLLECTION  = 'qa_quota';
const LOG_COLLECTION    = 'qa_logs';

// cloudfunctions/aiqa/lib/search.js
const CACHE_COLLECTION  = 'qa_search_cache';
```

### 第二步：上传云函数

左侧目录树找到：

```
cloudfunctions/
  └── aiqa/          ← 右键这个文件夹
```

右键 → **「上传并部署：云端安装依赖（不上传 node_modules）」**

> 选这个，不要选「所有文件」。`package.json` 里只有一个 `wx-server-sdk`，云端会自动装，比本地上传 `node_modules` 快得多。

#### ⚠️ `config.json` 管不了超时和内存

`cloudfunctions/aiqa/config.json` 只有这一项：

```json
{ "permissions": { "openapi": ["security.msgSecCheck"] } }
```

**微信云函数的 `config.json` 只认 `permissions` 和 `triggers`**。写 `timeout` / `memorySize` 是无效的——它们会被静默忽略，函数照默认值跑。

判断方法：看云函数日志的最后一行。

```
Report RequestId: xxx Duration: 484ms Memory: 256MB
                                     ↑ 如果是 256MB，说明 512 的设置没生效
```

**要改超时和内存，只能去控制台**：

云开发控制台 → 云函数 → `aiqa` → **函数配置** → 编辑

| 项 | 建议值 | 理由 |
|---|---|---|
| 超时时间 | **60 秒** | 默认 20 秒；一次问答要「检索 + 拼 prompt + 调模型 + 二次校验」，失败还会重试一次，网络抖动时 20 秒不够 |
| 内存 | 256 MB | 实测峰值 23 MB，默认够用 |


### 第三步：配环境变量

云开发控制台 → 云函数 → `aiqa` → **配置** → 环境变量：

| 变量名 | 值 | 必需 |
|---|---|---|
| `LLM_API_KEY` | `sk-你的key` | **✓ 必填** |
| `LLM_MODEL` | `deepseek-flash` | 建议填 |
| `LLM_BASE_URL` | 留空（默认 `https://api.deepseek.com`）| 可选 |
| `QA_DAILY_LIMIT` | `30` | 可选 |

**`LLM_MODEL` 建议显式填**。代码里的默认值只是兜底，模型名会随平台迭代淘汰（见下面「踩过的坑」）。

改完点保存。云开发控制台的规则是：环境变量改完，**下一次调用就生效**，不需要重新上传代码。

### 第四步：（可选）联网搜索

搜索相关的三个变量**先不填**。不填时 `lib/search.js` 返回空数组，主流程照常：

```js
// 搜索失败绝不影响主流程，一律返回 []
```

要开的话：

| 变量名 | 说明 |
|---|---|
| `SEARCH_API_KEY` | 搜索服务的 key |
| `SEARCH_API_STYLE` | `bocha` / `tavily` / `generic` |
| `SEARCH_API_URL` | 搜索接口地址 |

触发条件是 `data/rules.json` 里的 `searchTriggers`（命中特定词才联网）。

### 第五步：验证

分两步，先看配置对不对，再跑问答。

#### 5.1 环境自检

云开发控制台 → 云函数 → `aiqa` → **测试** 标签，传：

```json
{"debug": true}
```

返回：

```json
{
  "status": "ok",
  "debug": {
    "LLM_API_KEY": {
      "set": true,
      "length": 35,
      "head": "sk-7cb…",
      "hasWhitespace": false,
      "trimmedEqual": true,
      "shape": "looks-ok"
    },
    "LLM_MODEL": "deepseek-flash",
    "LLM_BASE_URL": "(未配，走默认 api.deepseek.com)",
    "QA_DAILY_LIMIT": "(未配，走默认 30)",
    "node": "v18.15.0",
    "env": "cloud1-d8gzn5hsfaa574b2e"
  }
}
```

逐项看：

| 字段 | 要求 | 不对会怎样 |
|---|---|---|
| `set` | `true` | `false` 就是没配，直接返回 `LLM_KEY_MISSING` |
| `hasWhitespace` | **`false`** | `true` 说明尾部有空格，拼成 `Bearer sk-xxx ` 就是 401 |
| `trimmedEqual` | `true` | `false` 同上，key 前后有不可见字符 |
| `shape` | `looks-ok` | `unexpected` 说明粘贴时被截断或带了引号 |

**`hasWhitespace` 是最容易中招的一项**。控制台里粘贴完肉眼完全看不出，但每次调用都会 401。

#### 5.2 跑一次真实问答

```json
{"question":"半小时能做什么菜","profile":{"ageGroup":"成人","taboos":[]}}
```

**云上实测返回**（`elapsed: 2033` 毫秒，真实运行结果）：

```json
{
  "status": "ok",
  "reply": "半小时内能做的菜不少。立冬时节，建议选当令、清淡好消化的。先给您三道稳妥的：白灼菜心约12分钟，潮汕牛肉丸汤约30分钟，菜脯炒蛋约20分钟。菜脯偏咸，血压高的长者少放一点。您平时口味偏清淡还是偏咸？",
  "dishes": [
    { "id": "TS0073", "name": "白灼菜心",     "cuisine": "广府", "reason": "立冬当令，12分钟快手，清淡爽口" },
    { "id": "TS0169", "name": "潮汕牛肉丸汤", "cuisine": "潮汕", "reason": "立冬汤品，30分钟一锅，暖身好入口" },
    { "id": "TS0106", "name": "菜脯炒蛋",     "cuisine": "潮汕", "reason": "20分钟家常，蛋香软嫩，长者易嚼" }
  ],
  "followups": ["口味偏清淡还是偏咸？"],
  "sources": [],
  "disclaimer": "食养建议不构成医疗建议，长期与用药请遵医嘱。",
  "meta": {
    "filtered": {
      "total": 288,
      "kept": 170,
      "droppedEvidence": 0,
      "droppedAge": 0,
      "droppedTaboo": 0,
      "droppedTime": 118,
      "timeLimit": 40,
      "tabooCount": 0
    },
    "candidateCount": 30,
    "searchUsed": false,
    "degraded": false,
    "droppedInvalid": 0,
    "elapsed": 2033,
    "term": "立冬"
  }
}
```

#### 5.3 四个必须核对的字段

| 字段 | 要求 | 不对说明什么 |
|---|---|---|
| `degraded` | **`false`** | `true` 表示走了兜底，模型没调通，看 `meta.upstreamError` |
| `droppedTime` | `> 0`（本次 `118`）| `0` 且 `kept: 288` → 部署的是旧代码 |
| `timeLimit` | `40` | 「半小时」应解析成 40 分钟上限 |
| `kept` | 约 `170` | 288 道里筛掉 118 道超时菜 |

#### 5.4 推荐质量的自查

**模型报的分钟数必须和库里一致**。本次核对结果：

```
ID       菜名            模型说   数据     一致
──────────────────────────────────────────────
TS0073   白灼菜心          12分    12分     ✓
TS0169   潮汕牛肉丸汤        30分    30分     ✓
TS0106   菜脯炒蛋          20分    20分     ✓

超时混入：0 道（全部 ≤ 40 分钟）
```

如果模型报的时间和 `timeMinutes` 对不上，说明 `lib/prompt.js` 的 `compactCandidate` 没把 `time` 字段传过去，模型在自行估算。

#### 5.5 三种组合的降级行为

这三组值得单独试，是修「说半小时却推腌制两小时」时加的兜底：

| 试这个 | 预期 |
|---|---|
| 「20 分钟内能做什么」 | `timeLimit` 变 `25`，`kept` 约 `90` |
| 「我海鲜过敏」 | `droppedTaboo > 0` |
| 「半小时想喝汤」 | **很可能筛空**，此时应答「按你说的半小时左右，加上其它条件，库里没有能在 40 分钟内做完的」，**不能硬推一道老火汤** |

第三种是重点。旧版会静默推出超时菜，现在必须如实说挑不到。


---

## 四、错误对照表

### 4.1 部署类错误（还没进到函数里）

| 报错 | 什么时候出现 | 怎么修 |
|---|---|---|
| `ResourceNotFound.Function` | 控制台点测试但云端没这个函数 | 函数没上传成功，或控制台环境切错了。先看左上角环境 ID 是不是 `cloud1-d8gzn5hsfaa574b2e`，再确认函数列表里有 `aiqa` |
| `上传并部署` 一直转圈 | 上传中 | 等 10–30 秒，`recipes.json` 有 146 KB |
| 提示「上传成功」但列表没有 | 控制台没刷新 | 按 F5 刷新 |

> `ResourceNotFound.Function` 几乎只有两种原因：**环境不对**，或者**上传失败把旧函数删了、新的没建成**。

### 4.2 函数返回的错误码

前端 `utils/qa.js` 会把错误码翻成人话，这里是对照根因：

| 返回码 | 前端显示 | 根因 | 怎么修 |
|---|---|---|---|
| `LLM_KEY_MISSING` | 问答未开通 | 环境变量没配 | 第三步配 `LLM_API_KEY` |
| `RATE_LIMITED` | 今天已经问了 N 次 | 当日额度用完 | 等明天，或调大 `QA_DAILY_LIMIT` |
| `EMPTY_QUESTION` | （不会显示）| 问题为空 | 前端已拦 |
| `CONTENT_BLOCKED` | 换个说法再试试 | 内容安全拦截 | 换措辞 |
| `BAD_JSON` | （走兜底）| 模型没按 JSON 输出 | 见下面「坑 2」 |
| `UPSTREAM_FAILED` | 网络开小差了 | 上游 4xx/5xx | **看 `meta.upstreamError`**，见下 |
| `NO_CANDIDATE` | （走兜底）| 硬过滤把 288 道全筛没了 | 条件太严，让用户放宽 |
| `FUNCTION_NOT_DEPLOYED` | 云函数还没上传 | 没部署或部署失败 | 第二步 |

### 4.3 `UPSTREAM_FAILED` 怎么定位

降级时 `meta.upstreamError` 会带出真实原因：

```json
"meta": {
  "errorCode": "UPSTREAM_FAILED",
  "upstreamError": {
    "code": "UPSTREAM_FAILED",
    "message": "上游 HTTP 401：Authentication Fails",
    "status": 401
  }
}
```

按 `status` 对照：

| status / message | 原因 | 修法 |
|---|---|---|
| `401` | key 无效 | 传 `{"debug":true}` 看 `hasWhitespace`，多半是尾部空格 |
| `400` + `Model Not Exist` | 模型名过期 | `LLM_MODEL` 改成 `deepseek-flash` |
| `402` | 余额不足 | 去平台充值 |
| `429` | 触发限流 | 稍等重试 |
| `0` + `上游请求超时` | 网络慢 | 控制台把超时改到 60 秒 |
| `0` + `ENOTFOUND` | 域名解析失败 | 检查 `LLM_BASE_URL` 拼写 |

**没有 `upstreamError` 字段** = 部署的是旧代码，重新上传。


---

## 五、换一个平台

代码走标准 OpenAI 协议（`/v1/chat/completions` + `Authorization: Bearer`），换平台只改两个变量：

| 平台 | `LLM_BASE_URL` | `LLM_MODEL` 示例 |
|---|---|---|
| DeepSeek | `https://api.deepseek.com` | `deepseek-flash` |
| 阿里百炼（通义）| `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `Qwen/Qwen3-8B` |
| 月之暗面 | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| 火山方舟（豆包）| `https://ark.cn-beijing.volces.com/api/v3` | 你的推理接入点 ID |

`buildUrl()` 会自动补 `/v1`，写成 `https://api.deepseek.com` 或 `https://api.deepseek.com/v1` 都行。

**两个参数会自动降级**，换平台不会因为不支持而崩：

```
① thinking + response_format 都带
② 400 且错误提到 thinking   → 去掉 thinking，保留 JSON mode
③ 400 且错误提到 response_format → 两个都去掉，靠 prompt 约束
```

---

## 六、成本

以 `deepseek-flash` 为例（空闲时段：输入 1 元 / 输出 4 元，每百万 token）：

单次问答实测消耗：

```
prompt_tokens     1106
completion_tokens  164
合计              1270

≈ 1106 × 1/1e6 + 164 × 4/1e6
≈ 0.0011 + 0.00066
≈ 0.0018 元
```

**一千次问答约 1.8 元**。答辩演示的花费可以忽略，成本主要产生在调试期反复试 prompt。

> 价格会变，以 <https://api-docs.deepseek.com/quick_start/pricing/> 为准。高峰时段是空闲价的两倍（北京时间工作日 9–12、14–18 点）。

---

## 七、踩过的三个坑

### 坑 1：模型名会过期

`deepseek-chat` / `deepseek-reasoner` 已于 **2026-07-24** 停用，现在只有：

```
deepseek-flash      1M 上下文，速度快，默认开思考
deepseek-v4-pro     1M 上下文，推理更强，价格约 4 倍
```

代码里 `DEFAULT_MODEL` 只是兜底，**正式部署请用环境变量显式指定**，并在上线前跑一次：

```powershell
$env:PROBE_KEY = '你的key'
node scripts/probe-llm-key.js
```

它会列出这个 key 当前能用哪些模型。

### 坑 2：思考模式会吃光输出额度

`deepseek-flash` 默认开思考。`max_tokens` 偏小时（比如 100），思考过程会把额度用完，**正文返回空字符串**：

```
✓ 200  1600 ms
回答:                              ← 空的
token: 输入 45 / 输出 100          ← 全用完
```

实测对比（同一问题）：

| 模式 | 耗时 | 输出 token |
|---|---|---|
| 默认（思考开）| 1543 ms | 195 |
| `thinking: disabled` | **831 ms** | **71** |
| `reasoning_effort: low` | 1297 ms | 181 |

`lib/llm.js` 因此**默认传 `thinking: {type: 'disabled'}`**。这一页要的是结构化 JSON，不需要推理过程，关掉既快又省。

### 坑 3：`.gitignore` 拦不住环境变量

前端零密钥是硬规则——`miniprogram/utils/config.js` 里**只有** `API_BASE` 和 `CLOUD_ENV`，不允许出现任何 `apiToken` 字段。

所有 key 只能活在两处：

```
云端：云开发控制台的云函数环境变量
本地：PowerShell 的 $env: 临时变量（跑探针脚本时）
```

**不要**写进 `.env` 文件再提交，也不要贴进 `config.js`。`scripts/check-compliance.js` 会扫 `sk-` / `pat_` 明文，但防不住手滑。

---

## 八、自检清单

部署完逐条勾：

```
□ 三个集合建好了：qa_quota / qa_logs / qa_search_cache
□ aiqa 右键「上传并部署：云端安装依赖」成功
□ 控制台函数列表里能看到 aiqa（F5 刷新后）
□ 环境变量 LLM_API_KEY 已配
□ 环境变量 LLM_MODEL = deepseek-flash 已配
□ 控制台「函数配置」里超时改成了 60 秒
□ 传 {"debug":true} 返回 set:true / hasWhitespace:false / shape:looks-ok
□ 正常提问返回 degraded: false（不是 true）
□ meta.filtered.droppedTime > 0（说明是新代码）
□ 小程序里点「AI 问答」能正常提问
```

**最容易漏的是两条**：

- **`hasWhitespace: false`** —— key 尾部一个空格，肉眼看不出来，但每次调用都 401
- **`degraded: false`** —— 如果是 `true`，页面照样显示回答，但那是兜底的当令菜，不是 AI 说的，很容易误以为部署成功了

---

## 九、实战记录：这次部署踩的坑

留档用，下次照着排查能省时间。

### 坑 A：`ResourceNotFound.Function`

在控制台点测试，报：

```
TencentCloud API error: ResourceNotFound.Function
未找到指定的Function，请创建后再试。
```

**原因**：云端没有这个函数。两种可能——控制台环境切错了，或上传失败导致旧函数删了、新的没建成。

**判断**：先看控制台左上角环境 ID 是不是 `cloud1-d8gzn5hsfaa574b2e`，再看函数列表里有没有 `aiqa`。

### 坑 B：`degraded: true` + `UPSTREAM_FAILED`

第一次部署成功，但返回的是兜底内容：

```json
{
  "degraded": true,
  "errorCode": "UPSTREAM_FAILED",
  "reply": "网络问答暂不可用，以下是当令菜。"
}
```

**注意 `droppedTime: 118` 是正常的**——这说明数据层和检索层都没问题，**只有模型调用这一环断了**。

看日志最后一行是关键：

```
Report RequestId: xxx Duration: 484ms Memory: 256MB MemUsage: 23MB
```

`484ms` 是破案点：本地实测调 DeepSeek 要 831～1748 ms，且失败后要重试两次。484 毫秒内完成两次请求不可能，说明**请求根本没发出去**。

而 `Memory: 256MB` 暴露了另一个问题：`config.json` 里写的 `memorySize: 512` 没生效。

**结论**：微信云函数的 `config.json` 只认 `permissions` 和 `triggers`，`timeout` / `memorySize` 是无效字段。要在控制台「函数配置」里改。

### 坑 C：错误原因被吞掉

原来的降级只返回一个 `errorCode: 'UPSTREAM_FAILED'`，看不出是 401 还是 DNS 失败。`logEvent` 会写进 `qa_logs`，但**集合没建对时连日志都没有**。

**改进**：

1. 降级时增加 `meta.upstreamError`，带 `code` / `message` / `status`
2. 新增 `{"debug": true}` 自检模式，直接看配置状态

### 最终跑通的返回

```json
{
  "status": "ok",
  "degraded": false,
  "elapsed": 2033,
  "meta": {
    "filtered": { "kept": 170, "droppedTime": 118, "timeLimit": 40 },
    "term": "立冬"
  }
}
```

三道推荐菜的耗时与库里完全一致：

```
TS0073 白灼菜心      模型说 12 分 / 数据 12 分  ✓
TS0169 潮汕牛肉丸汤  模型说 30 分 / 数据 30 分  ✓
TS0106 菜脯炒蛋      模型说 20 分 / 数据 20 分  ✓
```

**超时混入 0 道**——说明 `timeMinutes` 传给了模型，且它照着说了，没有自行估算。

