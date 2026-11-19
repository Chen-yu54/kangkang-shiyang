# 扣子 token 与权限说明

> 回答一个常见疑问：**Bot 要不要单独的 token？**
> 结论：**不要。Bot 和工作流用的是同一个 PAT（个人访问令牌）。**
> 但权限点必须勾对，否则报 4101。

---

## 一、一个 token 管两件事

```
                     ┌──────────────┐
                     │  同一个 PAT   │
                     │  pat_xxxxxx  │
                     └──────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
    POST /v1/workflow/run         POST /v3/chat
    需要权限点：run                需要权限点：chat
                                  + getChat
                                  + listMessage
```

云函数里两处读取的是**同一个环境变量**：

```js
// cloudfunctions/workflow/index.js
const token = process.env.COZE_TOKEN;

// cloudfunctions/aichat/index.js
const TOKEN = process.env.COZE_TOKEN;
```

所以配置时只需要填一次 `COZE_TOKEN`。

---

## 二、权限点对照表

| 接口 | 用途 | 需要的权限点 |
|---|---|---|
| `POST /v1/workflow/run` | 跑工作流（推荐、简报、报告） | `run` |
| `POST /v3/chat` | 发起 Bot 对话 | `chat`（新版文档写作 `Bot.chat`） |
| `GET /v3/chat/retrieve` | 轮询对话状态 | `getChat` |
| `GET /v3/chat/message/list` | 取 Bot 回复 | `listMessage` |
| `POST /v3/chat/cancel` | 取消对话（本项目未用） | `cancelChat` |
| 会话管理（本项目未用） | 自己建 conversation_id | `createConversation` / `listConversation` / `editConversation` |

**本项目要勾的最小集**：

```
✅ run
✅ chat
✅ getChat
✅ listMessage
```

**只做「一次性问答」不需要会话管理三件套**——我们的 `aichat` 是靠第一次返回的 `conversation_id` 复用上下文，不自己建会话。

---

## 三、生成 token 的步骤

```
扣子 → 左侧 API & SDK → 授权 → 个人访问令牌 → 添加

名称：      kangkang-server
过期时间：  30 天（可选 1–30 天，生成后不可修改）
权限：      勾 run / chat / getChat / listMessage
访问工作空间：⚠️ 必须选定 Bot 与工作流所在的那个空间
```

**「访问工作空间」这一项最容易漏**。权限点属于**工作空间级**，只勾权限不选空间，令牌实际不生效——调用时报 4101。

生成的令牌**只显示一次**，关掉页面就看不到了。

---

## 四、常见错误码

| code | 含义 | 真实原因 | 修法 |
|---|---|---|---|
| `4100` | 认证失败 | token 无效、已过期、或没授权这个 Bot | 重新生成 |
| `4101` | 权限校验未通过 | ① 没勾对应权限点 ② 勾了但**没绑定工作空间** ③ 绑的空间不是资源所在空间 | 重建令牌，勾权限 + 选空间 |
| `4160` | 缺少 Bearer 前缀 | Header 写成 `Authorization: pat_xxx` | 加 `Bearer ` |
| `4200` | 资源未发布 | Bot 或工作流**没发布** | 扣子后台点「发布」；Bot 发布时选 **Bot as API** |
| `4000` | 参数缺失 | `bot_id` / `workflow_id` 没传对 | 检查 ID |

**Bot 特有的坑**：发布时如果只选了「发布到商店」而没选「Bot as API」，API 调用会一直 4200。

---

## 五、有效期与轮换

| 项 | 说明 |
|---|---|
| 最长有效期 | **30 天** |
| 能否续期 | **不能**。到期即失效，只能重建 |
| 个人版数量上限 | 10 个 |
| 生产环境建议 | 官方口径：PAT 本质是预授权的明文长期令牌，**只用于测试/调试**；生产应改 OAuth |

**对我们的影响**：材料评审期间（比如 11-18 到 12-20）如果 token 过期，小程序会突然报 `4100`。

**建议**：在日历上标一个到期提醒，或者每次提交材料前跑一遍验证脚本确认还活着。

---

## 六、验证 token 有没有 Bot 权限

```powershell
$env:COZE_TOKEN = 'pat_xxx'
node scripts/check-bot.js
```

脚本会走完三跳并打印每一步。**如果报 4101，就是这个 token 缺 `chat` 权限或没绑工作空间**。

工作流那条链路用另一个脚本验证：

```powershell
node scripts/check-workflow.js
```

**两条都通过，才说明这个 token 同时覆盖了工作流和 Bot。**

---

## 七、一句话总结

```
Bot 没有独立的 token。
Bot 和工作流共用一个 PAT。
区别只在「这个 PAT 勾了哪些权限点」。
```

所以生成令牌时把 `run` + `chat` + `getChat` + `listMessage` 一起勾上，一次配好两条链路都能用。

---

## 参考

- [添加个人访问令牌 — 扣子官方](https://docs.coze.cn/api/open/docs/developer_guides/pat)
- [鉴权方式概述（权限层级）](https://docs.coze.cn/api/open/docs/developer_guides/authentication)
- [4100/4101 问题排查](https://docs.coze.cn/developer_guides_troubleshooting_4100_4101)
- [发起对话 v3（权限 chat）](https://docs.coze.cn/developer_guides_chat_v3)
- [恢复运行工作流（权限 run）](https://docs.coze.cn/developer_guides_resume_workflow)
