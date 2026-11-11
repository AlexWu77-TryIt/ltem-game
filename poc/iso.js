/* 等角（isometric）辦公室地圖：全部以程式繪製的原創幾何圖形 */
(function () {
  'use strict';

  // 配色：深藍、青綠、琥珀、米白（其餘皆為這四色的明暗變化）
  const C = {
    navy: '#1F3A5F',
    teal: '#2A9D8F',
    amber: '#F4A261',
    cream: '#F6F1E7'
  };

  function shade(hex, amt) {
    // amt < 0 變暗，> 0 變亮
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r);
    g = Math.round((t - g) * p + g);
    b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  const GRID = 7;
  const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

  // 站點位置（格子座標）；stand = 玩家站的位置（在桌子前方）
  const LAYOUT = [
    { desk: [1, 4], stand: [2, 4.5] },  // P
    { desk: [1, 1], stand: [2, 1.5] },  // D
    { desk: [4, 0.6], stand: [4.5, 1.8] },  // Do
    { desk: [5.2, 3], stand: [5.2, 4.2] },  // R
    { desk: [3, 3], stand: [3.5, 4.3] }   // O
  ];
  const START = [5.5, 6];
  const NPC_COLORS = [C.navy, C.teal, shade(C.navy, 0.3), shade(C.teal, -0.3), shade(C.navy, -0.25)];

  function IsoMap(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.stations = [];       // [{id,name,state:'locked'|'active'|'done'}]
    this.player = { x: START[0], y: START[1] };
    this.path = null;
    this.t0 = performance.now();
    this.resize();
    const loop = (t) => {
      try { this.draw(t); } catch (e) { if (window.console) console.error(e); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  IsoMap.prototype.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.dpr = dpr;
    const r = this.cv.getBoundingClientRect();
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.cv.width = Math.round(this.w * dpr);
    this.cv.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 地圖寬 = GRID*tw；高 ≈ (GRID + 3.6) * th（含牆與標籤）
    // 手機直式時寬度最吃緊：允許裁掉左右兩個空的地板尖角，讓角色更大
    const tw = Math.min(this.w / (GRID - 0.9), (2 * this.h) / (GRID + 3.6), 110);
    this.tw = tw;
    this.th = tw / 2;
    this.ox = this.w / 2;
    const mapH = (GRID + 3.6) * this.th;
    this.oy = Math.max(0, (this.h - mapH) / 2) + 2.9 * this.th;
  };

  IsoMap.prototype.pt = function (x, y, z) {
    return [this.ox + (x - y) * this.tw / 2, this.oy + (x + y) * this.th / 2 - (z || 0) * this.th];
  };

  IsoMap.prototype.poly = function (pts, fill, stroke) {
    const c = this.ctx;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  };

  // 等角方塊：(x,y,z) 為後方底角；w 沿 x、d 沿 y、h 高度（單位：格高）
  IsoMap.prototype.box = function (x, y, z, w, d, h, color) {
    const P = (a, b, c) => this.pt(a, b, c);
    const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
    const left = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)];
    const right = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
    this.poly(left, shade(color, -0.18));
    this.poly(right, shade(color, -0.34));
    this.poly(top, color);
  };

  // 方塊人：x,y 為腳底中心
  IsoMap.prototype.person = function (x, y, color, bob) {
    const s = 0.36, z = bob || 0;
    // 影子
    const sh = this.pt(x, y, 0);
    const c = this.ctx;
    c.fillStyle = 'rgba(31,58,95,0.18)';
    c.beginPath();
    c.ellipse(sh[0], sh[1], this.tw * 0.2, this.th * 0.2, 0, 0, Math.PI * 2);
    c.fill();
    this.box(x - s / 2, y - s / 2, z, s, s, 1.0, color);
    const hs = 0.3;
    this.box(x - hs / 2, y - hs / 2, z + 1.0, hs, hs, 0.62, shade(C.amber, 0.55));
    // 眼睛（畫在正面兩側）
    c.fillStyle = C.navy;
    const r = Math.max(1.2, this.tw * 0.018);
    [[x + hs / 2, y - 0.05], [x - 0.05, y + hs / 2]].forEach((e) => {
      const p = this.pt(e[0], e[1], z + 1.35);
      c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fill();
    });
  };

  // 角色圖像（characters.js 的向量 Q 版角色）；尚未載入或沒有設計稿時退回方塊人
  const REDUCE_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  IsoMap.prototype.actor = function (id, x, y, color, o) {
    o = o || {};
    const sp = id && window.CHAR ? window.CHAR.mapSprite(id, o.expr || 'neutral', this.th * 2.45, this.dpr || 1) : null;
    if (!sp) { this.person(x, y, color, o.bob); return; }
    const p = this.pt(x, y, o.bob || 0);
    const c = this.ctx;
    c.save();
    if (o.alpha != null) c.globalAlpha = o.alpha;
    c.translate(p[0], p[1]);
    if (o.flip) c.scale(-1, 1);
    c.drawImage(sp.canvas, -sp.ax, -sp.ay, sp.w, sp.h);
    c.restore();
  };

  IsoMap.prototype.plant = function (x, y) {
    this.box(x - 0.15, y - 0.15, 0, 0.3, 0.3, 0.35, shade(C.amber, -0.25));
    this.box(x - 0.22, y - 0.22, 0.35, 0.44, 0.44, 0.7, C.teal);
    this.box(x - 0.12, y - 0.12, 1.05, 0.24, 0.24, 0.35, shade(C.teal, 0.2));
  };

  IsoMap.prototype.label = function (x, y, z, text, state, t) {
    const c = this.ctx;
    let p = this.pt(x, y, z);
    if (state === 'active') p = [p[0], p[1] - Math.abs(Math.sin(t / 260)) * this.th * 0.35];
    const fs = Math.max(11, Math.round(this.tw * 0.2));
    c.font = '700 ' + fs + 'px ' + FONT;
    const tw = c.measureText(text).width + fs * 1.1;
    const th = fs * 1.7;
    const bg = state === 'locked' ? '#B9B4AA' : state === 'done' ? C.teal : C.amber;
    const fg = state === 'active' ? C.navy : '#FFFFFF';
    c.fillStyle = bg;
    roundRect(c, p[0] - tw / 2, p[1] - th, tw, th, th / 2);
    c.fill();
    // 小三角
    c.beginPath();
    c.moveTo(p[0] - fs * 0.35, p[1] - 1);
    c.lineTo(p[0] + fs * 0.35, p[1] - 1);
    c.lineTo(p[0], p[1] + fs * 0.4);
    c.closePath();
    c.fill();
    c.fillStyle = fg;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, p[0], p[1] - th / 2 + 1);
    return p;
  };

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  IsoMap.prototype.draw = function (t) {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);

    // 地板
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const col = (i + j) % 2 ? C.cream : shade(C.cream, -0.05);
        this.poly([this.pt(i, j), this.pt(i + 1, j), this.pt(i + 1, j + 1), this.pt(i, j + 1)], col);
      }
    }
    // 地板邊緣厚度
    this.poly([this.pt(0, GRID), this.pt(GRID, GRID), this.pt(GRID, GRID, -0.3), this.pt(0, GRID, -0.3)], shade(C.cream, -0.2));
    this.poly([this.pt(GRID, 0), this.pt(GRID, GRID), this.pt(GRID, GRID, -0.3), this.pt(GRID, 0, -0.3)], shade(C.cream, -0.32));
    // 後牆
    this.poly([this.pt(0, 0), this.pt(GRID, 0), this.pt(GRID, 0, 1.6), this.pt(0, 0, 1.6)], shade(C.navy, 0.62));
    this.poly([this.pt(0, 0), this.pt(0, GRID), this.pt(0, GRID, 1.6), this.pt(0, 0, 1.6)], shade(C.navy, 0.5));
    // 牆上白板與窗
    this.poly([this.pt(2.2, 0, 0.6), this.pt(3.8, 0, 0.6), this.pt(3.8, 0, 1.3), this.pt(2.2, 0, 1.3)], '#FFFFFF');
    this.poly([this.pt(0, 2.6, 0.55), this.pt(0, 4.4, 0.55), this.pt(0, 4.4, 1.3), this.pt(0, 2.6, 1.3)], shade(C.teal, 0.55));

    // 收集可排序物件（依 x+y 深度）
    const items = [];
    items.push({ d: 6.2 + 0.3, f: () => this.plant(6.3, 0.4) });
    items.push({ d: 0.5 + 6.4, f: () => this.plant(0.5, 6.4) });
    items.push({ d: 6.4 + 6.4, f: () => this.plant(6.4, 6.4) });
    // 書櫃
    items.push({ d: 0.3 + 5.8, f: () => this.box(0.05, 5.6, 0, 0.5, 1.2, 1.3, shade(C.amber, -0.35)) });

    this.stations.forEach((s, i) => {
      const L = LAYOUT[i];
      const dx = L.desk[0], dy = L.desk[1];
      const locked = s.state === 'locked';
      const deskCol = locked ? '#C9C3B8' : shade(C.amber, 0.25);
      const idle = REDUCE_MOTION ? 0 : (Math.sin(t / 650 + i * 1.7) + 1) * 0.025;
      items.push({
        d: dx + dy + 0.2, f: () => this.actor(s.npc, dx + 0.5, dy + 0.35, locked ? '#A7A196' : NPC_COLORS[i], {
          bob: locked ? 0 : idle, alpha: locked ? 0.5 : null, expr: s.state === 'done' ? 'happy' : 'neutral'
        })
      });
      items.push({
        d: dx + dy + 1.0, f: () => {
          this.box(dx, dy + 0.65, 0, 1.0, 0.55, 0.62, deskCol);
          // 桌上電腦
          this.box(dx + 0.55, dy + 0.75, 0.62, 0.3, 0.06, 0.4, locked ? '#9E988E' : C.navy);
        }
      });
    });

    // 玩家
    this.updatePath(t);
    const moving = !!this.path;
    const bob = moving ? Math.abs(Math.sin(t / 90)) * 0.12 : 0;
    const flip = moving && this.facing < 0;
    items.push({ d: this.player.x + this.player.y + 0.05, f: () => this.actor('player', this.player.x, this.player.y, C.amber, { bob, flip }) });

    items.sort((a, b) => a.d - b.d).forEach((it) => it.f());

    // 站點標籤（最上層）
    this.stations.forEach((s, i) => {
      const L = LAYOUT[i];
      const lp = [L.desk[0] + 0.5, L.desk[1] + 0.35, 3.0];
      const txt = (s.state === 'done' ? '✓ ' : '') + s.id + ' ' + s.name;
      s._screen = this.label(lp[0], lp[1], lp[2], txt, s.state, t);
    });
  };

  IsoMap.prototype.updatePath = function (t) {
    if (!this.path) return;
    const p = this.path;
    const k = Math.min(1, (t - p.t0) / p.dur);
    // L 形路徑：先走 x 再走 y
    const total = Math.abs(p.to[0] - p.from[0]) + Math.abs(p.to[1] - p.from[1]) || 1;
    const dist = k * total;
    const dxAbs = Math.abs(p.to[0] - p.from[0]);
    const prevScreenX = this.player.x - this.player.y;
    if (dist <= dxAbs) {
      this.player.x = p.from[0] + Math.sign(p.to[0] - p.from[0]) * dist;
      this.player.y = p.from[1];
    } else {
      this.player.x = p.to[0];
      this.player.y = p.from[1] + Math.sign(p.to[1] - p.from[1]) * (dist - dxAbs);
    }
    // 依螢幕水平方向決定角色面向（往左走時鏡像）
    const sdx = (this.player.x - this.player.y) - prevScreenX;
    if (Math.abs(sdx) > 1e-4) this.facing = sdx < 0 ? -1 : 1;
    if (k >= 1) {
      const cb = p.done;
      this.path = null;
      if (cb) cb();
    }
  };

  IsoMap.prototype.setStations = function (list) {
    // 保留上一幀算好的點擊位置
    list.forEach((s, i) => { if (this.stations[i]) s._screen = this.stations[i]._screen; });
    this.stations = list;
  };

  IsoMap.prototype.placePlayer = function (idx) {
    const s = idx < 0 ? START : LAYOUT[idx].stand;
    this.player.x = s[0]; this.player.y = s[1];
  };

  IsoMap.prototype.walkTo = function (idx, done) {
    const to = LAYOUT[idx].stand;
    const from = [this.player.x, this.player.y];
    const dist = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);
    if (dist < 0.05) { done && done(); return; }
    const path = { from, to, t0: performance.now(), dur: Math.min(1100, 260 + dist * 170), done };
    this.path = path;
    // 保險：若動畫被暫停（分頁在背景、省電模式），時間到仍會抵達
    setTimeout(() => {
      if (this.path === path) {
        this.path = null;
        this.player.x = to[0]; this.player.y = to[1];
        done && done();
      }
    }, path.dur + 400);
  };

  IsoMap.prototype.isWalking = function () { return !!this.path; };

  // 點擊判定：回傳站點 index 或 -1
  IsoMap.prototype.hit = function (px, py) {
    let best = -1, bestD = Infinity;
    this.stations.forEach((s, i) => {
      const L = LAYOUT[i];
      const pts = [s._screen, this.pt(L.desk[0] + 0.5, L.desk[1] + 0.9, 0.5)];
      pts.forEach((q) => {
        if (!q) return;
        const d = Math.hypot(px - q[0], py - q[1]);
        if (d < bestD) { bestD = d; best = i; }
      });
    });
    return bestD < Math.max(36, this.tw * 0.75) ? best : -1;
  };

  window.IsoMap = IsoMap;
  window.ISO_COLORS = C;
})();
