// utils/share.js —— 分享：转发卡片 + 节气食单长图（团队分工方案 6.1「节气食单分享长图」）
//
// 长图用 canvas 2d 绘制。canvas 读不到 CSS 变量，因此这里维护一份与 app.wxss 对应的
// 颜色常量：改 app.wxss 的 token 时，这里的 COLOR 要同步改。
//
// 小程序码（QR_IMAGE_PATH）未提供时仍可生成完整长图，但码位画成占位框，
// 不编造二维码 —— 宁可缺一块，也不能放一个扫不出来的假码。

const i18n = require('./i18n');
const config = require('./config');

// 与 app.wxss 的 token 对应（canvas 不支持 CSS 变量）
const COLOR = {
  bg: '#f7f0e1',
  bgSoft: '#fbf7ea',
  ink: '#3d2b1a',
  ink3: '#5a4630',
  brand: '#8b5a2b',
  green: '#3f7a45',
  card: '#fbf7ea',
  border: '#d9c39c',
};

// 长图逻辑尺寸（px）。canvas 节点按此尺寸的 dpr 倍实际绘制。
const LOGIC_W = 600;
const LOGIC_H = 960;

function createError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

// —— 转发卡片 ——

function messageForApp() {
  return {
    title: i18n.t('share.appTitle'),
    path: '/pages/index/index',
  };
}

function messageForDish(dish) {
  const name = dish && dish.name ? dish.name : '';
  return {
    title: name ? i18n.tpl('share.dishTitle', { name }) : i18n.t('share.appTitle'),
    path: dish && dish.id ? '/pages/dish/dish?id=' + encodeURIComponent(dish.id) : '/pages/index/index',
  };
}

function messageForTerm(term) {
  const name = term && term.name ? term.name : '';
  return {
    title: name ? i18n.tpl('share.termTitle', { name }) : i18n.t('share.appTitle'),
    path: '/pages/solarterm/solarterm',
  };
}

// —— 长图绘制 ——

function getPixelRatio() {
  if (wx.getWindowInfo) {
    const info = wx.getWindowInfo();
    if (info && info.pixelRatio) return info.pixelRatio;
  }
  return 2;
}

// 按最大宽度把文本切成多行
function wrapLines(ctx, text, maxWidth) {
  const content = String(text || '');
  if (!content) return [];
  const lines = [];
  let current = '';
  for (let i = 0; i < content.length; i += 1) {
    const next = current + content[i];
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = content[i];
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawLines(ctx, lines, x, y, lineHeight, maxLines) {
  const limit = maxLines || lines.length;
  let top = y;
  for (let i = 0; i < lines.length && i < limit; i += 1) {
    ctx.fillText(lines[i], x, top);
    top += lineHeight;
  }
  return top;
}

function loadImage(canvas, src) {
  return new Promise((resolve, reject) => {
    const image = canvas.createImage();
    image.onload = () => resolve(image);
    image.onerror = () => reject(createError('IMAGE_LOAD_FAILED'));
    image.src = src;
  });
}

function paint(ctx, options) {
  const term = options.term || {};
  const dishes = (options.dishes || []).slice(0, 3);

  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, LOGIC_W, LOGIC_H);
  ctx.textBaseline = 'top';

  // 顶部色条
  ctx.fillStyle = COLOR.brand;
  ctx.fillRect(0, 0, LOGIC_W, 8);

  let y = 64;

  // 节气名
  ctx.fillStyle = COLOR.ink;
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(term.name || '', 48, y);
  y += 64;

  // 节气时间窗
  if (term.windowText) {
    ctx.font = '22px sans-serif';
    ctx.fillText(term.windowText, 48, y);
    y += 40;
  }

  // 标题句
  if (term.headline) {
    ctx.font = '24px sans-serif';
    const lines = wrapLines(ctx, term.headline, LOGIC_W - 96);
    y = drawLines(ctx, lines, 48, y, 36, 2);
    y += 8;
  }

  // 分隔线
  y += 16;
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(48, y);
  ctx.lineTo(LOGIC_W - 48, y);
  ctx.stroke();
  y += 28;

  // 当令菜品
  ctx.font = '22px sans-serif';
  ctx.fillStyle = COLOR.ink;
  ctx.fillText(i18n.t('share.longImageDishes'), 48, y);
  y += 44;

  dishes.forEach((dish, index) => {
    const cardTop = y + index * 132;
    // 卡片底
    ctx.fillStyle = COLOR.card;
    ctx.fillRect(48, cardTop, LOGIC_W - 96, 116);

    ctx.fillStyle = COLOR.ink;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(String(index + 1) + '. ' + (dish.name || ''), 72, cardTop + 16);

    ctx.font = '20px sans-serif';
    const meta = [dish.cuisineName, dish.termText].filter(Boolean).join(' · ');
    if (meta) ctx.fillText(meta, 72, cardTop + 56);

    if (dish.feature) {
      const lines = wrapLines(ctx, dish.feature, LOGIC_W - 144);
      drawLines(ctx, lines, 72, cardTop + 84, 26, 1);
    }
  });

  // 底部：码位 + 声明
  const footTop = LOGIC_H - 168;

  ctx.strokeStyle = COLOR.brand;
  ctx.lineWidth = 2;
  ctx.strokeRect(48, footTop, 112, 112);

  ctx.fillStyle = COLOR.ink;
  ctx.font = '20px sans-serif';
  drawLines(ctx, wrapLines(ctx, i18n.t('share.qrPlaceholder'), 96), 56, footTop + 36, 24, 3);

  ctx.font = '22px sans-serif';
  const noteLines = wrapLines(ctx, i18n.t('share.longImageFooter'), LOGIC_W - 220);
  drawLines(ctx, noteLines, 184, footTop + 24, 32, 3);
}

// 生成节气食单长图，resolve 临时文件路径
// options: { page, canvasId, term, dishes }
function drawTermLongImage(options) {
  return new Promise((resolve, reject) => {
    if (!options || !options.page || !options.canvasId) {
      reject(createError('INVALID_ARGS'));
      return;
    }

    const query = wx.createSelectorQuery().in(options.page);
    query
      .select('#' + options.canvasId)
      .fields({ node: true, size: true })
      .exec((res) => {
        const item = res && res[0];
        if (!item || !item.node) {
          reject(createError('CANVAS_NOT_READY'));
          return;
        }

        const canvas = item.node;
        const ctx = canvas.getContext('2d');
        const dpr = getPixelRatio();
        canvas.width = LOGIC_W * dpr;
        canvas.height = LOGIC_H * dpr;
        ctx.scale(dpr, dpr);

        const paintTask = config.QR_IMAGE_PATH
          ? loadImage(canvas, config.QR_IMAGE_PATH).catch(() => null)
          : Promise.resolve(null);

        paintTask
          .then((qrImage) => {
            paint(ctx, options);
            if (qrImage) ctx.drawImage(qrImage, 48, LOGIC_H - 168, 112, 112);
            return new Promise((done, fail) => {
              wx.canvasToTempFilePath({
                canvas,
                x: 0,
                y: 0,
                width: LOGIC_W,
                height: LOGIC_H,
                destWidth: LOGIC_W * dpr,
                destHeight: LOGIC_H * dpr,
                fileType: 'png',
                success: (result) => done(result.tempFilePath),
                fail: () => fail(createError('CANVAS_EXPORT_FAILED')),
              });
            });
          })
          .then(resolve)
          .catch(reject);
      });
  });
}

// 保存到相册（需要用户授权 scope.writePhotosAlbum）
function saveImageToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail: () => reject(createError('SAVE_ALBUM_FAILED')),
    });
  });
}

module.exports = {
  LOGIC_W,
  LOGIC_H,
  messageForApp,
  messageForDish,
  messageForTerm,
  drawTermLongImage,
  saveImageToAlbum,
};
