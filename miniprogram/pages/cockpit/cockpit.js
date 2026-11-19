// pages/cockpit/cockpit.js —— 节气数据详情页
//
// 首页那张浅色预览卡点进来，这里才展开完整罗盘、概览指标与五个分区。
// 数据口径与首页完全同一份：kbStats.build（概览）+ cockpit.build（分区），
// 能从知识库算的一律现算，缺失的集中在 data/cockpit.js 的 SAMPLE 并标「示例」。
//
// 分区映射（默认 01）：
//   01 term 节气视图 / 02 cuisine 菜系对照 / 03 fit 人群偏向
//   04 graph 知识图谱 / 05 library 食材深库
// 支持 ?tab=cuisine 这样的直达参数，方便以后从别处深链进来。

const dataSource = require('../../utils/dataSource');
const kbStats = require('../../utils/kbStats');
const cockpit = require('../../data/cockpit');
const i18n = require('../../utils/i18n');

const t = i18n.t;

Page({
  data: {
    pageStyle: '',
    elderMode: false,
    copy: {},
    dataVersion: '',
    stats: null,
    ck: null,
    tabs: [],
    ckTab: 'term', // 默认展示 01 节气视图
    ckCap: '',
    dashOn: false, // 罗盘刻度进页面后依次点亮
    ckNode: 'core', // 图谱档案当前展示的实体，默认核心
    ckNodeInfo: {},
    gFallback: false, // 老基础库不支持 canvas 2D 时的降级提示
  },

  onLoad(options) {
    const current = dataSource.getCurrentTerm();

    // —— 概览：与首页预览卡同一份口径 ——
    const stats = kbStats.build(current);
    stats.term.posText = i18n.tpl('snapshot.termPos', {
      order: stats.term.order,
      total: stats.term.total,
    });
    stats.promises = stats.promises.map((p) => ({
      key: p.key,
      label: t(p.labelKey),
      sub: p.subParams ? i18n.tpl(p.subKey, p.subParams) : t(p.subKey),
      pct: p.pct,
      text: p.text,
    }));
    stats.easyPct = stats.promises[1] ? stats.promises[1].pct : 0;

    // —— 分区数据 ——
    const ck = cockpit.build(current);
    const wanted = options && options.tab;
    const active = ck.tabs.filter((x) => x.key === wanted)[0] || ck.tabs[0];
    const tabs = ck.tabs.map((x, i) =>
      Object.assign({}, x, { no: i + 1 < 10 ? '0' + (i + 1) : String(i + 1) })
    );

    this.setData({
      copy: {
        title: t('cockpit.title'),
        kicker: t('cockpit.kicker'),
        lead: t('cockpit.lead'),
        overview: t('cockpit.overview'),
        sections: t('cockpit.sections'),
        tip: t('cockpit.tip'),
        noteTitle: t('cockpit.noteTitle'),
        sampleTag: t('cockpit.sampleTag'),
        live: t('snapshot.live'),
        asOf: t('snapshot.asOf'),
        note: t('snapshot.note'),
        ckKpi1: t('snapshot.ckKpi1'),
        ckKpi2: t('snapshot.ckKpi2'),
        ckKpi3: t('snapshot.ckKpi3'),
      },
      dataVersion: (dataSource.getDataVersionLabel().split('·').pop() || '').trim(),
      stats,
      ck,
      tabs,
      ckTab: active.key,
      ckCap: active.cap,
      ckNode: 'core',
      ckNodeInfo: ck.graph.map.detail.core,
    });
  },

  onShow() {
    const app = getApp();
    this.setData({
      pageStyle: app.getFontStyle(),
      elderMode: app.getElderMode ? app.getElderMode() : false,
    });
    if (this.data.ckTab === 'graph') this._startGraph();
  },

  onReady() {
    // 页面一打开就播刻度点亮，不再依赖滚动进视野
    setTimeout(() => this.setData({ dashOn: true }), 120);
    // 深链直接落在 04 分区时，也要把画布建起来
    if (this.data.ckTab === 'graph') this._initGraph();
  },

  onHide() { this._stopGraph(); },
  onUnload() { this._stopGraph(); },

  // 点分区切数据：五个分支由 WXML 的 wx:if 切换
  onPickTab(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.ckTab) return;
    const tab = this.data.tabs.filter((x) => x.key === key)[0];
    this._stopGraph();
    this.setData({ ckTab: key, ckCap: tab ? tab.cap : '' }, () => {
      if (key === 'graph') setTimeout(() => this._initGraph(), 60);
    });
  },

  // ——— 04 动态图谱：canvas 2D 画 38 节点 / 85 边，72 条弧线持续流动 ———
  // 设计坐标 640 × 660 由 data/cockpit.js 算好，这里只按实际画布宽高等比映射。
  _initGraph() {
    wx.createSelectorQuery()
      .in(this)
      .select('#gcanvas')
      .fields({ node: true, size: true, rect: true })
      .exec((res) => {
        const it = res && res[0];
        if (!it || !it.node || !it.node.getContext) {
          this.setData({ gFallback: true });
          return;
        }
        const canvas = it.node;
        const ctx = canvas.getContext('2d');
        let dpr = 2;
        try { dpr = wx.getSystemInfoSync().pixelRatio || 2; } catch (e) { /* 老版本兜底 */ }
        canvas.width = Math.round(it.width * dpr);
        canvas.height = Math.round(it.height * dpr);
        ctx.scale(dpr, dpr);
        this._graph = {
          canvas, ctx,
          w: it.width, h: it.height,
          sx: it.width / 640, sy: it.height / 760,
          left: it.left || 0, top: it.top || 0,
          dash: 0, raf: 0,
        };
        this._drawGraph();
        this._startGraph();
      });
  },

  _startGraph() {
    const g = this._graph;
    if (!g || g.raf) return;
    const raf = g.canvas.requestAnimationFrame
      ? (cb) => g.canvas.requestAnimationFrame(cb)
      : (cb) => setTimeout(cb, 40);
    g.rafCancel = g.canvas.cancelAnimationFrame
      ? (id) => g.canvas.cancelAnimationFrame(id)
      : (id) => clearTimeout(id);
    const loop = () => {
      g.dash -= 0.8;
      this._drawGraph();
      g.raf = raf(loop);
    };
    g.raf = raf(loop);
  },

  _stopGraph() {
    const g = this._graph;
    if (g && g.raf && g.rafCancel) { g.rafCancel(g.raf); g.raf = 0; }
  },

  _drawGraph() {
    const g = this._graph;
    const map = this.data.ck && this.data.ck.graph.map;
    if (!g || !map) return;
    const ctx = g.ctx;
    const focus = this._focus;
    const near = focus ? map.near[focus] || [focus] : null;
    const COLOR = { cu: '#b5482a', ing: '#8b5a2b', fit: '#6f8a5a', term: '#b8863b' };

    ctx.save();
    ctx.clearRect(0, 0, g.w, g.h);
    ctx.scale(g.sx, g.sy);
    ctx.lineCap = 'round';

    // 三层椭圆导轨
    ctx.setLineDash([1, 8]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(184,134,59,0.16)';
    ctx.globalAlpha = 1;
    // 导轨用 scale 模拟椭圆：ctx.ellipse 在个别老基础库上没有，会整段断掉
    map.guides.forEach((r) => {
      ctx.save();
      ctx.translate(map.cx, map.cy);
      ctx.scale(1, r.ry / r.rx);
      ctx.beginPath();
      ctx.arc(0, 0, r.rx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
    ctx.setLineDash([]);

    // 72 条节气—菜系弧线：合成两个 path 一次描边，避免每帧 72 次 stroke
    const onDash = [], offDash = [];
    map.links.forEach((l) => {
      if (!l.dashed) return;
      const on = !focus || l.s === focus || l.t === focus;
      (on ? onDash : offDash).push(l);
    });
    const strokeDash = (arr, alpha, width) => {
      if (!arr.length) return;
      ctx.beginPath();
      arr.forEach((l) => {
        ctx.moveTo(l.x1, l.y1);
        ctx.quadraticCurveTo(l.qx, l.qy, l.x2, l.y2);
      });
      ctx.setLineDash([3, 9]);
      ctx.lineDashOffset = g.dash;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = COLOR.term;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.setLineDash([]);
    };
    strokeDash(offDash, 0.04, 1);
    strokeDash(onDash, focus ? 0.75 : 0.13, focus ? 1.6 : 1.1);

    // 13 条实线主线
    map.links.forEach((l) => {
      if (l.dashed) return;
      const on = !focus || l.s === focus || l.t === focus;
      ctx.globalAlpha = focus ? (on ? 0.85 : 0.05) : 0.42;
      ctx.strokeStyle = COLOR[l.tone] || COLOR.cu;
      ctx.lineWidth = l.tone === 'cu' ? 2.4 : 1.6;
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    });

    // 节点
    const dim = (id) => !!near && near.indexOf(id) < 0;
    map.nodes.forEach((n) => {
      ctx.globalAlpha = dim(n.id) ? 0.16 : 1;
      if (n.kind === 'core') {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(181,72,42,0.05)'; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = '#fffdf6'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#b5482a'; ctx.stroke();
      } else if (n.kind === 'cuisine') {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(184,134,59,0.12)'; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = '#fffdf8'; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#b8863b'; ctx.stroke();
      } else if (n.kind === 'term') {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = n.cur ? 'rgba(181,72,42,0.16)' : 'rgba(184,134,59,0.06)'; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.cur ? '#b5482a' : '#b8863b'; ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = '#fffdf8'; ctx.fill();
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = n.kind === 'ing' ? '#8b5a2b' : '#6f8a5a';
        ctx.stroke();
      }
    });

    // 选中节点加一圈朱砂，明确当前焦点
    if (focus) {
      const f = map.nodes.filter((n) => n.id === focus)[0];
      if (f) {
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 9, 0, Math.PI * 2);
        ctx.lineWidth = 2; ctx.strokeStyle = '#b5482a'; ctx.stroke();
      }
    }

    // 文字
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    map.nodes.forEach((n) => {
      ctx.globalAlpha = dim(n.id) ? 0.16 : 1;
      ctx.textAlign = 'center';
      if (n.kind === 'core') {
        ctx.fillStyle = '#3b3026'; ctx.font = '600 28px serif';
        ctx.fillText(n.label, n.x, n.y - 10);
        ctx.fillStyle = '#b5482a'; ctx.font = '19px sans-serif';
        ctx.fillText(n.sub, n.x, n.y + 20);
      } else if (n.kind === 'cuisine') {
        ctx.fillStyle = '#3b3026'; ctx.font = '600 26px serif';
        ctx.fillText(n.label, n.x, n.y - 9);
        ctx.fillStyle = '#b8863b'; ctx.font = '17px sans-serif';
        ctx.fillText(n.sub, n.x, n.y + 18);
      } else if (n.kind === 'ing' || n.kind === 'fit') {
        // 名字在圆外侧，道数留在档案里——圆里塞不下两行
        ctx.textAlign = n.anchor === 'middle' ? 'center' : n.anchor;
        ctx.fillStyle = '#4a3b2c'; ctx.font = '24px sans-serif';
        ctx.fillText(n.label, n.lx, n.ly);
      }
    });
    map.labels.forEach((l) => {
      ctx.globalAlpha = dim(l.id.replace('lb-', 't-')) ? 0.16 : 1;
      ctx.textAlign = l.anchor === 'middle' ? 'center' : l.anchor;
      ctx.fillStyle = l.now ? '#b5482a' : '#7a6852';
      ctx.font = (l.now ? '600 ' : '') + '22px sans-serif';
      ctx.fillText(l.text, l.x, l.y);
    });

    ctx.restore();
  },

  // 点画布：触摸点反算设计坐标，命中最近节点
  onTapGraph(e) {
    const g = this._graph;
    const map = this.data.ck && this.data.ck.graph.map;
    if (!g || !map) return;
    const d = e.detail || {};
    const tp = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || {};
    let px = Number(tp.x), py = Number(tp.y);
    if (!isFinite(px) || !isFinite(py)) { px = Number(tp.clientX) - g.left; py = Number(tp.clientY) - g.top; }
    if (!isFinite(px) || !isFinite(py)) { px = Number(d.x) - g.left; py = Number(d.y) - g.top; }
    if (!isFinite(px) || !isFinite(py)) return;
    const x = px / g.sx, y = py / g.sy;
    let best = null, bd = 1e9;
    map.nodes.forEach((n) => {
      const dist = Math.sqrt((n.x - x) * (n.x - x) + (n.y - y) * (n.y - y));
      if (dist < Math.max(n.r + 12, 18) && dist < bd) { bd = dist; best = n; }
    });
    if (!best) { this.onResetGraph(); return; }
    const info = map.detail[best.id];
    if (!info) return;
    this._focus = best.id;
    this.setData({ ckNode: best.id, ckNodeInfo: info });
    this._drawGraph();
  },

  onResetGraph() {
    this._focus = '';
    const map = this.data.ck && this.data.ck.graph.map;
    if (!map) return;
    this.setData({ ckNode: 'core', ckNodeInfo: map.detail.core });
    this._drawGraph();
  },

  onTapBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => wx.switchTab({ url: '/pages/index/index' }),
    });
  },
});
