// 合规扫描 —— 12 个脱敏词 + 明文密钥 + BOM
//
// 为什么单独成脚本：README 里如果直接列出这 12 个字，README 自身就会被扫描命中。
// 把词表收进脚本，文档只调用命令，仓库表面干净、检查仍然严格。
//
// 用法：node scripts/check-compliance.js
// 退出码：0 = 全部通过，1 = 有问题

const fs = require('fs');
const path = require('path');

// 12 个脱敏词：项目红线，全端 0 命中（含注释与 JSON）
// 拆开拼接，避免本文件被自己的扫描逻辑命中
const BAN = [
  '体' + '质', '调' + '理', '气' + '虚', '阳' + '虚',
  '湿' + '气', '降' + '糖', '降' + '压', '疗' + '效',
  '治' + '疗', '康' + '复', '慢' + '病', '忌' + '口',
];

// 明文密钥模式
const SECRET = [
  /pat_[A-Za-z0-9]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /Bearer\s+[A-Za-z0-9._-]{20,}/,
  /client_secret\s*[:=]\s*['"][^'"]{8,}/,
];

// 扫描范围：前端与云函数。scripts/ 与文档不在其中
// （scripts 里必然出现词表本身，属检查逻辑，不是内容）
const ROOTS = ['miniprogram', 'cloudfunctions'];
const EXTS = ['.js', '.json', '.wxml', '.wxss'];

const issues = [];

function walk(dir, out) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  entries.forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.indexOf(path.extname(e.name).toLowerCase()) > -1) out.push(p);
  });
  return out;
}

function check() {
  let files = 0;
  ROOTS.forEach((root) => {
    const list = walk(root, []);
    list.forEach((f) => {
      files += 1;
      let text = '';
      try {
        text = fs.readFileSync(f, 'utf8');
      } catch (e) {
        issues.push({ file: f, type: 'READ_FAILED' });
        return;
      }

      // ① 脱敏词
      BAN.forEach((w) => {
        if (text.indexOf(w) > -1) issues.push({ file: f, type: 'BAN_WORD', detail: w });
      });

      // ② 明文密钥
      SECRET.forEach((re) => {
        if (re.test(text)) issues.push({ file: f, type: 'SECRET', detail: String(re) });
      });

      // ③ BOM
      const buf = fs.readFileSync(f);
      if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
        issues.push({ file: f, type: 'BOM' });
      }
    });
  });

  console.log('[check-compliance] 扫描 ' + files + ' 个文件（' + ROOTS.join(' + ') + '）');

  if (issues.length === 0) {
    console.log('[check-compliance] ✓ 脱敏词 0 命中 / 明文密钥 0 命中 / 0 BOM');
    return 0;
  }

  const byType = {};
  issues.forEach((i) => {
    byType[i.type] = (byType[i.type] || 0) + 1;
  });
  Object.keys(byType).forEach((t) => {
    console.log('[check-compliance] ✗ ' + t + ' × ' + byType[t]);
  });
  issues.slice(0, 20).forEach((i) => {
    console.log('  ' + i.file + (i.detail ? '  → ' + i.detail : ''));
  });
  if (issues.length > 20) console.log('  … 还有 ' + (issues.length - 20) + ' 处');
  return 1;
}

process.exit(check());
