// utils/config.js —— 全端唯一的配置真源
//
// 本文件是全项目唯一允许出现「地址 / 通道 / 凭证位」的地方，
// 页面与其它 utils 文件不得散写 url、开关或 token。
//
// ── 数据通道开关（团队分工方案 V2.0 六章 D1） ───────────────────────────
//   'local'       当前通道：只读 data/ 的 A 构建产物，先把页面跑通
//   （直连通道已移除：凭证进前端会随小程序包公开，与零密钥红线冲突）

//   'coze-proxy'  经 E 的 SCF 代理转发：前端零 token，推荐口径
//
// 切换通道只需改这一个常量，页面与 api.js 调用方不需要任何改动。
const DATA_CHANNEL = 'local';

// SCF 代理域名（'coze-proxy' 通道、埋点上报、推荐与偏好接口共用）
// D3 提审前必须替换为 E 的正式代理地址；微信后台「开发管理 → 服务器域名」需同步配置。
const API_BASE = '';

// 微信云开发环境 ID（推荐通道）
//   云函数「workflow」持 token 转发扣子，小程序只 callFunction：
//   不需要域名备案、不需要配 request 白名单、包里没有任何凭证。
//   开启方式：开发者工具左侧「云开发」→ 新建环境 → 把环境 ID 填到这里。
const CLOUD_ENV = 'cloud1-d8gzn5hsfaa574b2e';

// 前端不持有任何平台凭证位：
//   （直连通道已移除：凭证进前端会随小程序包公开，与零密钥红线冲突）
//   工作流与对话统一走 E 的 SCF 代理，token 存在服务端环境变量，前端只认 API_BASE。
// 扣子工作流：别名 → workflow_id（来源：团队提供的《字段表》）
//
// ⚠️ 前端调用时只传**别名**（'recommend' 等），不传这里的长 ID：
//    小程序 ──► SCF /workflow ──► 扣子 /v1/workflow/run
//    ID 与 token 都留在服务端，前端包里不该出现它们。
//    这份表是给 E 配服务端映射用的对照，也方便本地核对。
// 代理就绪前，这些 ID 只作记录，不会发起任何请求。
const WORKFLOWS = {
  // 问卷：6 道题的题面与选项，用于服务端校对前端的题目版本
  qnaire: '7666310500133765163',
  // 推荐：入参 user_physique / user_preferences / user_taboos，
  // 另外带 CONVERSATION_NAME（固定值）与 USER_INPUT（本轮原始输入）
  recommend: '7666385885823516682',
  // 调研统计简报（2026-11-17 实测确认）
  //   空参数即可跑，数据从服务端库读；返回 {output:'<markdown>'}。
  //   产出：调研基本概况 / 核心统计结果 / 数据处理规则（小样本阈值 10）
  survey: '7666376707049947142',
  // 报告工作流（2026-11-17 实测确认）
  //   必填 report_type + month；缺任一项报 code=4000。
  //   返回 {district_report:'', personal_report:'<markdown>'} 双输出。
  report: '7666377322421354515',
};

// 前端实际使用的别名（与服务端 WORKFLOWS 的 key 对齐）
const WORKFLOW_ALIAS = {
  qnaire: 'qnaire',
  recommend: 'seasonal_recipe',
  report: 'weekly_report',
  district: 'district_report',
};

// 工作流二的固定会话名（字段表标注 default 固定值）
const WORKFLOW_CONVERSATION_NAME = '';

// 小程序码图片（分享长图用）
// 未提供时分享长图仍可生成，但码位画成占位框，不编造二维码。
const QR_IMAGE_PATH = '';

module.exports = {
  DATA_CHANNEL,
  API_BASE,
  CLOUD_ENV,
  WORKFLOWS,
  WORKFLOW_ALIAS,
  WORKFLOW_CONVERSATION_NAME,
  QR_IMAGE_PATH,
};
