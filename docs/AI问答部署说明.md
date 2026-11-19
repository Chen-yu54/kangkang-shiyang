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

`config.json` 会自动生效：

```json
{ "timeout": 60, "memorySize": 512 }
```

**60 秒超时别改小**。一次问答要「检索 + 拼 prompt + 调模型 + 二次校验」，模型那一步实测 0.8～1.8 秒，但网络抖动时 30 秒容易不够。

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

云开发控制台 → 云函数 → `aiqa` → **测试** 标签，粘贴：

```json
{
  "question": "我只有半小时，想做个简单点的菜",
  "profile": { "ageGroup": "成人", "taboos": [] }
}
```

预期返回：

```json
{
  "status": "ok",
  "answer": {
    "reply": "半小时内能做好的，我挑了三道简单的……",
    "dishes": [{ "id": "TS0001", "reason": "十二分钟就成……" }]
  },
  "meta": {
    "filtered": {
      "total": 288,
      "kept": 170,
      "droppedTime": 118,
      "timeLimit": 40
    },
    "candidateCount": 10
  }
}
```

**三个关键看 Return**：

| 字段 | 正常值 | 说明 |
|---|---|---|
| `filtered.timeLimit` | `40` | 「半小时」解析成 40 分钟上限 |
| `filtered.droppedTime` | `> 0` | 说明时间过滤生效了 |
| `filtered.kept` | 约 `170` | 288 道里筛掉超时的 |

如果 `droppedTime: 0` 且 `kept: 288`，说明**部署的是旧代码**，重新上传。

---

## 四、错误对照表

前端 `utils/qa.js` 会把错误码翻成人话，这里是对照根因：

| 返回码 | 前端显示 | 根因 | 怎么修 |
|---|---|---|---|
| `LLM_KEY_MISSING` | 问答未开通 | 环境变量没配 | 第三步配 `LLM_API_KEY` |
| `RATE_LIMITED` | 今天已经问了 N 次 | 当日额度用完 | 等明天，或调大 `QA_DAILY_LIMIT` |
| `EMPTY_QUESTION` | （不会显示）| 问题为空 | 前端已拦 |
| `CONTENT_BLOCKED` | 换个说法再试试 | 内容安全拦截 | 换措辞 |
| `BAD_JSON` | （走兜底）| 模型没按 JSON 输出 | 见下面「坑 2」 |
| `UPSTREAM_FAILED` | 网络开小差了 | 上游 4xx/5xx | 看云函数日志里的原始报文 |
| `FUNCTION_NOT_DEPLOYED` | 云函数还没上传 | 没部署或部署失败 | 第二步 |

**模型名写错的表现**是 `UPSTREAM_FAILED`，日志里能看到类似：

```
上游 HTTP 400：Model Not Exist
```

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
□ 环境变量 LLM_API_KEY 已配
□ 环境变量 LLM_MODEL = deepseek-flash 已配
□ 测试调用返回 status: "ok"
□ meta.filtered.droppedTime > 0（说明是新代码）
□ 小程序里点「AI 问答」能正常提问
□ 云函数日志里没有 LLM_KEY_MISSING
```

**第八条最关键**——前七条都过了但日志有 `LLM_KEY_MISSING`，通常是环境变量保存后没等生效，或者改的是另一个环境的配置（注意 `CLOUD_ENV` 对应的是哪个环境 ID）。
