// scripts/upload-to-cloud.js —— 批量上传菜品图到微信云存储
//
// 用法：
//   1. 安装依赖：npm i @cloudbase/manager-node
//   2. 准备腾讯云 API 密钥（云开发控制台 → 环境 → 腾讯云账号 → API 密钥），
//      用环境变量传入，不要写进代码、不要提交：
//        Windows PowerShell:  $env:SECRET_ID="..."; $env:SECRET_KEY="..."
//        macOS/Linux:         export SECRET_ID="..." SECRET_KEY="..."
//   3. 运行：
//        node scripts/upload-to-cloud.js <环境ID> [本地图片目录]
//      例：node scripts/upload-to-cloud.js prod-xxxx ./miniprogram/images/dishes
//
// 行为：
//   - 遍历目录下所有 .jpg/.jpeg/.png，逐张上传到云存储 dishes/ 同名路径
//   - 已存在的同名文件会覆盖（云存储默认行为），适合 A 反复改图
//   - 结束打印 fileID 前缀（填回 utils/dishImages.js 的 IMAGE_CLOUD_BASE）
//
// 注意：上传前请先在云开发控制台把 dishes/ 权限设为「所有用户可读」。

const fs = require('fs');
const path = require('path');

const ENV_ID = process.argv[2];
const LOCAL_DIR = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(__dirname, '..', 'miniprogram', 'images', 'dishes');
const CLOUD_DIR = 'dishes';

const { SECRET_ID, SECRET_KEY } = process.env;

if (!ENV_ID) {
  console.error('缺少环境ID。用法：node scripts/upload-to-cloud.js <环境ID> [本地图片目录]');
  process.exit(1);
}
if (!SECRET_ID || !SECRET_KEY) {
  console.error('缺少 SECRET_ID / SECRET_KEY 环境变量（见文件头注释第 2 步）。');
  process.exit(1);
}
if (!fs.existsSync(LOCAL_DIR)) {
  console.error('本地图片目录不存在：' + LOCAL_DIR);
  process.exit(1);
}

let CloudBase;
try {
  CloudBase = require('@cloudbase/manager-node');
} catch (e) {
  console.error('未安装 @cloudbase/manager-node，请先运行：npm i @cloudbase/manager-node');
  process.exit(1);
}

const app = CloudBase.init({
  secretId: SECRET_ID,
  secretKey: SECRET_KEY,
  envId: ENV_ID,
});

const FILES = fs
  .readdirSync(LOCAL_DIR)
  .filter((f) => /\.(jpe?g|png)$/i.test(f))
  .sort();

if (FILES.length === 0) {
  console.error('目录里没有可上传的图片：' + LOCAL_DIR);
  process.exit(1);
}

(async () => {
  console.log(`环境：${ENV_ID}`);
  console.log(`目录：${LOCAL_DIR}`);
  console.log(`待传：${FILES.length} 张 → 云存储 ${CLOUD_DIR}/\n`);

  let ok = 0;
  const failed = [];

  for (const name of FILES) {
    const localPath = path.join(LOCAL_DIR, name);
    const cloudPath = `${CLOUD_DIR}/${name}`;
    try {
      const res = await app.uploadFile({
        cloudPath,
        fileContent: fs.createReadStream(localPath),
      });
      ok += 1;
      console.log(`  ✓ ${name}${res && res.fileID ? '  →  ' + res.fileID : ''}`);
    } catch (err) {
      failed.push(name);
      console.error(`  ✗ ${name}：${err && err.message ? err.message : err}`);
    }
  }

  console.log(`\n完成：成功 ${ok} / ${FILES.length}${failed.length ? '，失败 ' + failed.length : ''}`);
  if (failed.length) console.error('失败清单：' + failed.join(', '));

  if (ok > 0) {
    console.log('\n下一步：');
    console.log('  1. 去云开发控制台 → 存储 → dishes/，确认权限为「所有用户可读」');
    console.log('  2. 复制任一 fileID，取到文件名前的前缀，填进 utils/dishImages.js：');
    console.log('       IMAGE_ON_CLOUD = true');
    console.log('       IMAGE_CLOUD_BASE = \'cloud://<环境前缀>/dishes/\'');
  }
})();
