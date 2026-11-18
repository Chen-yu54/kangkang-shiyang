#!/usr/bin/env node
// scripts/auto-check.js —— 在真实模拟器里验证「小程序 → 云函数 → 扣子」这条链
//
// 前提：微信开发者工具已打开本项目，且「设置 → 安全设置 → 服务端口」已开启。
//
// 用法：
//   node scripts/auto-check.js
//   node scripts/auto-check.js --port=9420 --timeout=40000
//
// 它做的事（全部是真实操作，不推断）：
//   ① 连上模拟器
//   ② 重新进入「食养」页，触发一次生成
//   ③ 轮询页面 data，直到 rec.dishes 有内容或超时
//   ④ 打印引擎、菜名、小贴士，并把 trace 步骤打出来
//   ⑤ 顺带收集控制台错误

const path = require('path');

const AUTOMATOR_DIR = path.join(__dirname, '..', '.tmp-automator', 'node_modules');

function parseArgs(argv) {
  const out = {};
  argv.slice(2).forEach((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  });
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const port = Number(args.port) || 9420;
  const timeoutMs = Number(args.timeout) || 40000;

  let automator;
  try {
    automator = require(path.join(AUTOMATOR_DIR, 'miniprogram-automator'));
  } catch (e) {
    console.log('✗ 找不到 miniprogram-automator，先执行：');
    console.log('    cd .tmp-automator && npm install miniprogram-automator --registry=https://registry.npmmirror.com');
    process.exitCode = 1;
    return;
  }

  console.log('连接模拟器 ws://127.0.0.1:' + port + ' …');
  let miniProgram;
  try {
    miniProgram = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + port });
  } catch (e) {
    console.log('✗ 连不上：' + (e && e.message ? e.message : e));
    console.log('');
    console.log('  多半是服务端口没开。请打开：');
    console.log('    微信开发者工具 → 设置 → 安全设置 → 服务端口 → 打开');
    process.exitCode = 1;
    return;
  }
  console.log('✓ 已连上');

  // 收集控制台错误，便于判断是 token / 超时 / 未部署
  const errors = [];
  miniProgram.on('console', (msg) => {
    const text = msg && (msg.text || msg.args || '');
    const s = String(Array.isArray(text) ? text.join(' ') : text);
    if (s && /error|fail|超时|未配置|4100|4101|501000/i.test(s)) {
      errors.push(s.slice(0, 200));
    }
  });

  // 先把口味答案写进去，避免页面因无答案被挡回问卷
  console.log('写入测试用答题记录…');
  const page = await miniProgram.reLaunch('/pages/menu/menu');
  await page.waitFor(1200);

  try {
    await miniProgram.evaluate(() => {
      wx.setStorageSync('prefAnswers', {
        q1: 'a1', q2: 'a2', q3: 'a3', q4: 'a2',
        q5: ['a1', 'a5'], q6: ['a1', 'a5'],
      });
    });
  } catch (e) {
    console.log('  （写 storage 失败，继续：' + e.message + '）');
  }

  // 重新进页面，让 onShow 重新读答案
  const p2 = await miniProgram.reLaunch('/pages/menu/menu');
  await p2.waitFor(1000);

  console.log('触发一次生成…');
  try {
    await p2.callMethod('onRunGen');
  } catch (e) {
    console.log('  ✗ 调 onRunGen 失败：' + e.message);
  }

  // 轮询页面数据
  console.log('等待结果（最多 ' + Math.round(timeoutMs / 1000) + ' 秒）…');
  const started = Date.now();
  let last = null;
  let settled = null;

  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      last = await p2.data();
    } catch (e) {
      continue;
    }
    const dishes = (last.rec && last.rec.dishes) || [];
    const playing = last.trace && last.trace.playing;
    const steps = (last.trace && last.trace.steps) || [];
    const lastTitle = steps.length ? steps[steps.length - 1].title : '';
    process.stdout.write(
      '\r  已等 ' + Math.round((Date.now() - started) / 1000) + 's  菜 ' + dishes.length +
      '  播放中 ' + (playing ? '是' : '否') + '  末步「' + lastTitle + '」        '
    );
    // 判定落定：不播放了且有菜，或末步已经是模型/失败结论
    if (!playing && (dishes.length > 0 || /模型|回退|失败/.test(lastTitle))) {
      settled = last;
      break;
    }
  }
  console.log('');

  if (!settled) {
    console.log('\n✗ 超时没等到落定。最后状态：');
    settled = last || {};
  } else {
    console.log('\n✓ 已落定，用时 ' + Math.round((Date.now() - started) / 1000) + ' 秒');
  }

  const engine = settled.engine || {};
  const dishes = (settled.rec && settled.rec.dishes) || [];
  const steps = (settled.trace && settled.trace.steps) || [];

  console.log('\n────────── 模拟器里的真实结果 ──────────');
  console.log('引擎    : ' + (engine.key || '—') + '  ' + (engine.label || ''));
  console.log('引擎说明: ' + (engine.note || '—'));
  console.log('菜数    : ' + dishes.length);
  dishes.forEach((d, i) => {
    console.log('  ' + (i + 1) + '. ' + d.name + (d.id ? '   [可跳详情]' : '   [详情待补]'));
    if (d.whyText) console.log('       理由: ' + d.whyText);
  });
  console.log('小贴士  : ' + (settled.wfTips || '（无）'));
  console.log('步骤    :');
  steps.forEach((s, i) => {
    console.log('  ' + (i + 1) + '. [' + (s.state || '') + '] ' + s.title);
    (s.lines || []).filter(Boolean).slice(0, 2).forEach((l) => console.log('       ' + l));
  });

  if (errors.length) {
    console.log('\n────────── 控制台里的报错 ──────────');
    [...new Set(errors)].slice(0, 8).forEach((e) => console.log('  ' + e));
  } else {
    console.log('\n控制台没有捕获到错误');
  }

  console.log('\n────────── 判定 ──────────');
  if (engine.key === 'coze' && settled.wfTips) {
    console.log('✓ 扣子调用成功：引擎是 coze，且拿到了模型产出的当令小贴士');
  } else if (engine.key === 'coze' && dishes.length && steps.some((s) => /模型/.test(s.title))) {
    console.log('✓ 扣子调用成功：拿到了模型返回的菜谱步骤');
  } else if (/回退/.test((steps[steps.length - 1] || {}).title || '')) {
    console.log('✗ 扣子没通，已回退本地推演。看上面的控制台报错定位：');
    console.log('   TOKEN_MISSING / -501000 → 云函数未部署或环境变量没配');
    console.log('   4100 / 4101            → token 无效、过期、权限没勾');
    console.log('   等 20 秒后超时          → 云函数超时仍是默认 20 秒');
  } else {
    console.log('? 状态不明，请把上面整段输出发回来');
  }

  await miniProgram.disconnect().catch(() => {});
}

main().catch((e) => {
  console.log('✗ 脚本异常：' + (e && e.stack ? e.stack : e));
  process.exitCode = 1;
});
