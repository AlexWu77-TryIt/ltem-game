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

  // 站點位置（格子座標）；stand = 玩家站的位置（在桌子前方，與改版前相同）
  // guest = 來訪角色站的桌邊位置
  const LAYOUT = [
    { desk: [1, 4], stand: [2, 4.5], guest: [0.55, 4.55] },     // P
    { desk: [1, 1], stand: [2, 1.5], guest: [0.5, 1.75] },      // D
    { desk: [4, 0.6], stand: [4.5, 1.8], guest: [3.35, 0.75] }, // Do
    { desk: [5.2, 3], stand: [5.2, 4.2], guest: [6.4, 3.8] },   // R
    { desk: [3, 3], stand: [3.5, 4.3], guest: [2.75, 3.55] }    // O
  ];
  // NPC 從桌前／桌邊走到站位（stand）的路線點，繞開桌子與隔間；最後一點一定是 stand
  const EXITS = [
    { host: [[2.15, 4.35], [2.15, 4.5], [2, 4.5]], guest: [[2, 4.5]] },
    { host: [[2.15, 1.35], [2.15, 1.5], [2, 1.5]], guest: [[0.5, 1.5], [2, 1.5]] },
    { host: [[5.15, 0.95], [5.15, 1.8], [4.5, 1.8]], guest: [[3.9, 0.75], [3.9, 1.8], [4.5, 1.8]] },
    { host: [[6.35, 3.35], [6.35, 4.2], [5.2, 4.2]], guest: [[6.4, 4.2], [5.2, 4.2]] },
    { host: [[4.15, 3.35], [4.15, 4.3], [3.5, 4.3]], guest: [[2.75, 4.3], [3.5, 4.3]] }
  ];
  const spotPos = (i, spot) => (spot === 'guest' ? LAYOUT[i].guest.slice() : [LAYOUT[i].desk[0] + 0.5, LAYOUT[i].desk[1] + 0.35]);
  // 站與站之間沿主角走的同一條 L 形走道（先 x 後 y；反方向則原路折返）
  function legs(a, b) {
    const pts = [];
    if (a < b) for (let k = a; k < b; k++) pts.push([LAYOUT[k + 1].stand[0], LAYOUT[k].stand[1]], LAYOUT[k + 1].stand.slice());
    else for (let k = a - 1; k >= b; k--) pts.push([LAYOUT[k + 1].stand[0], LAYOUT[k].stand[1]], LAYOUT[k].stand.slice());
    return pts;
  }
  // 常用的跨站捷徑（走道上不會穿過桌子或隔間）；其餘沿主角路線
  const SHORTCUTS = {
    '0-4': [[3.5, 4.5]],                 // 計畫室 → 成果區
    '4-0': [[3.5, 4.5]],
    '3-1': [[5.2, 4.42], [2, 4.42]],     // 查核區 → 設計室
    '1-3': [[2, 4.42], [5.2, 4.42]]
  };
  function route(a, aSpot, b, bSpot) {
    const out = EXITS[a][aSpot].map((p) => p.slice());
    const back = EXITS[b][bSpot].map((p) => p.slice()).reverse().slice(1);
    const sc = SHORTCUTS[a + '-' + b];
    const mid = sc ? sc.map((p) => p.slice()).concat([LAYOUT[b].stand.slice()]) : legs(a, b);
    return out.concat(mid, back, [spotPos(b, bSpot)]);
  }

  // 辦公分區：rect = [x0, y0, x1, y1]（格子座標），wall = 靠哪面牆（畫牆腳色帶）
  const ZONES = [
    { name: '計畫會議室', rect: [0.15, 3.3, 2.5, 5.55], tint: '#FBE4CC', label: 'back', wall: { x0: [3.3, 5.55] } },
    { name: '課程設計室', rect: [0.15, 0.15, 2.5, 2.75], tint: '#D2ECE8', label: 'back', wall: { x0: [0.15, 2.75], y0: [0.15, 2.5] } },
    { name: '訓練教室', rect: [3.0, 0.15, 5.75, 2.35], tint: '#DAE3EF', label: 'front', wall: { y0: [3.0, 5.75] } },
    { name: '數據查核區', rect: [4.75, 2.65, 6.85, 4.85], tint: '#D9EAEE', label: 'front', wall: {} },
    { name: '成果發表區', rect: [2.6, 2.6, 4.45, 4.65], tint: '#F5E6C4', label: 'front', wall: {} }
  ];
  // 隔間（玻璃矮牆）：只放在不會擋到主角路線的位置，路線處留出入口
  const PARTITIONS = [
    { along: 'x', at: 3.0, from: 0.15, to: 1.45 },   // 計畫｜設計
    { along: 'y', at: 2.8, from: 0.15, to: 1.0 },    // 設計｜教室
    { along: 'x', at: 2.5, from: 5.6, to: 6.85 },    // 教室｜查核
    { along: 'y', at: 4.6, from: 2.7, to: 3.8 }      // 成果｜查核
  ];
  const START = [5.5, 6];
  const NPC_COLORS = [C.navy, C.teal, shade(C.navy, 0.3), shade(C.teal, -0.3), shade(C.navy, -0.25)];

  function IsoMap(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.stations = [];       // [{id,name,state:'locked'|'active'|'done'}]
    this.player = { x: START[0], y: START[1] };
    this.camX = 0;
    this.cast = {};           // NPC 目前位置與目標位置 {id: {x,y,tx,ty,expr,alpha}}
    this.lastT = 0;
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
    // 手機直式時寬度最吃緊：地圖放大到比畫面寬，再用鏡頭左右平移跟著主角
    const tw = Math.min(this.w / 4.2, (2 * this.h) / (GRID + 3.6), 110);
    this.tw = tw;
    this.th = tw / 2;
    this.panMax = Math.max(0, (GRID * tw - this.w) / 2 + tw * 0.3);
    this.camX = this.camTarget();
    this.ox = this.w / 2 - this.camX;
    const mapH = (GRID + 3.6) * this.th;
    this.oy = Math.max(0, (this.h - mapH) * 0.4) + 2.9 * this.th;
  };

  // 鏡頭焦點：主角與目前站點的中間，限制在地圖範圍內
  IsoMap.prototype.camTarget = function () {
    if (!this.panMax) return 0;
    let fx = this.player.x, fy = this.player.y;
    const ai = (this.stations || []).findIndex((s) => s.state === 'active');
    if (ai >= 0 && !this.path) {
      fx = (fx + LAYOUT[ai].stand[0]) / 2;
      fy = (fy + LAYOUT[ai].stand[1]) / 2;
    }
    const sx = (fx - fy) * this.tw / 2;
    return Math.max(-this.panMax, Math.min(this.panMax, sx));
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

  /* ---------- 場景元件 ---------- */
  // 牆面上的矩形（x=0 左後牆：a/b 為 y 範圍；y=0 右後牆：a/b 為 x 範圍）
  IsoMap.prototype.wallRect = function (wall, a, b, z0, z1, fill, stroke) {
    const P = wall === 'x0' ? (u, z) => this.pt(0, u, z) : (u, z) => this.pt(u, 0, z);
    this.poly([P(a, z0), P(b, z0), P(b, z1), P(a, z1)], fill, stroke);
  };

  // 沿地板平面書寫的文字（像貼在地毯上的區域名稱）
  IsoMap.prototype.floorText = function (text, x, y, size, color) {
    const c = this.ctx, o = this.pt(x, y);
    c.save();
    c.translate(o[0], o[1]);
    c.transform(this.tw / 200, this.th / 200, -this.tw / 200, this.th / 200, 0, 0);
    c.font = '900 ' + Math.round(size * 100) + 'px ' + FONT;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillStyle = color;
    c.fillText(text, 0, 0);
    c.restore();
  };

  IsoMap.prototype.chair = function (x, y, color) {
    this.box(x - 0.14, y - 0.14, 0, 0.28, 0.28, 0.26, color);
    this.box(x - 0.14, y + 0.1, 0.26, 0.28, 0.05, 0.3, shade(color, -0.12));
  };

  IsoMap.prototype.partition = function (p) {
    const frame = shade(C.navy, 0.45);
    if (p.along === 'x') {
      this.box(p.from, p.at - 0.04, 0, p.to - p.from, 0.08, 0.28, frame);
      this.poly([this.pt(p.from, p.at, 0.28), this.pt(p.to, p.at, 0.28), this.pt(p.to, p.at, 0.95), this.pt(p.from, p.at, 0.95)], 'rgba(158,216,240,.38)', frame);
    } else {
      this.box(p.at - 0.04, p.from, 0, 0.08, p.to - p.from, 0.28, frame);
      this.poly([this.pt(p.at, p.from, 0.28), this.pt(p.at, p.to, 0.28), this.pt(p.at, p.to, 0.95), this.pt(p.at, p.from, 0.95)], 'rgba(158,216,240,.38)', frame);
    }
  };

  // 各站桌面與桌上物品（依分區用途不同）
  IsoMap.prototype.deskSet = function (i, dx, dy, locked) {
    const g = (col) => (locked ? '#C9C3B8' : col);
    const dark = locked ? '#9E988E' : C.navy;
    if (i === 0) {          // 計畫：會議桌＋文件
      this.box(dx, dy + 0.65, 0, 1.0, 0.55, 0.6, g(shade(C.amber, 0.3)));
      this.box(dx + 0.15, dy + 0.75, 0.6, 0.3, 0.22, 0.02, '#FFFFFF');
      this.box(dx + 0.55, dy + 0.8, 0.6, 0.3, 0.22, 0.02, g('#FFF3E2'));
    } else if (i === 1) {   // 設計：工作桌＋筆電＋便利貼
      this.box(dx, dy + 0.65, 0, 1.0, 0.55, 0.6, g(shade(C.teal, 0.55)));
      this.box(dx + 0.5, dy + 0.75, 0.6, 0.36, 0.26, 0.03, dark);
      this.box(dx + 0.5, dy + 0.75, 0.63, 0.36, 0.04, 0.24, dark);
      this.box(dx + 0.12, dy + 0.8, 0.6, 0.12, 0.12, 0.02, g(C.amber));
      this.box(dx + 0.28, dy + 0.9, 0.6, 0.12, 0.12, 0.02, g('#FFE08A'));
    } else if (i === 2) {   // 執行：講台
      this.box(dx + 0.15, dy + 0.65, 0, 0.7, 0.5, 0.75, g(shade(C.navy, 0.55)));
      this.box(dx + 0.45, dy + 0.72, 0.75, 0.3, 0.22, 0.03, dark);
    } else if (i === 3) {   // 查核：桌子＋顯示數據圖表的螢幕
      this.box(dx, dy + 0.65, 0, 1.0, 0.55, 0.6, g(shade(C.navy, 0.62)));
      this.box(dx + 0.2, dy + 0.75, 0.6, 0.6, 0.06, 0.42, dark);
      if (!locked) {
        const yb = dy + 0.81, base = 0.66;
        [[0.28, 0.1, C.teal], [0.4, 0.2, C.teal], [0.52, 0.15, C.amber], [0.64, 0.28, C.amber]].forEach(([x, h, col]) => {
          this.poly([this.pt(dx + x, yb, base), this.pt(dx + x + 0.08, yb, base), this.pt(dx + x + 0.08, yb, base + h), this.pt(dx + x, yb, base + h)], col);
        });
      }
    } else {                // 成果：發表桌＋獎盃
      this.box(dx, dy + 0.65, 0, 1.0, 0.55, 0.6, g(shade(C.amber, 0.45)));
      if (!locked) {
        this.box(dx + 0.66, dy + 0.82, 0.6, 0.18, 0.18, 0.05, shade(C.amber, -0.35));
        this.box(dx + 0.71, dy + 0.87, 0.65, 0.08, 0.08, 0.12, shade(C.amber, -0.2));
        this.box(dx + 0.64, dy + 0.8, 0.77, 0.22, 0.22, 0.18, '#F2C14E');
      }
    }
  };

  IsoMap.prototype.drawScene = function (items) {
    // 地板（走道）
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const col = (i + j) % 2 ? C.cream : shade(C.cream, -0.04);
        this.poly([this.pt(i, j), this.pt(i + 1, j), this.pt(i + 1, j + 1), this.pt(i, j + 1)], col);
      }
    }
    this.poly([this.pt(0, GRID), this.pt(GRID, GRID), this.pt(GRID, GRID, -0.3), this.pt(0, GRID, -0.3)], shade(C.cream, -0.2));
    this.poly([this.pt(GRID, 0), this.pt(GRID, GRID), this.pt(GRID, GRID, -0.3), this.pt(GRID, 0, -0.3)], shade(C.cream, -0.32));

    // 後牆
    this.poly([this.pt(0, 0), this.pt(GRID, 0), this.pt(GRID, 0, 1.6), this.pt(0, 0, 1.6)], shade(C.navy, 0.62));
    this.poly([this.pt(0, 0), this.pt(0, GRID), this.pt(0, GRID, 1.6), this.pt(0, 0, 1.6)], shade(C.navy, 0.5));

    // 分區地毯、牆腳色帶、地板區名
    ZONES.forEach((z, i) => {
      const [x0, y0, x1, y1] = z.rect;
      const st = this.stations[i] ? this.stations[i].state : 'locked';
      const tint = st === 'locked' ? shade(z.tint, 0.35) : z.tint;
      const edge = shade(z.tint, -0.22);
      this.poly([this.pt(x0, y0), this.pt(x1, y0), this.pt(x1, y1), this.pt(x0, y1)], tint, edge);
      this.poly([this.pt(x0 + 0.08, y0 + 0.08), this.pt(x1 - 0.08, y0 + 0.08), this.pt(x1 - 0.08, y1 - 0.08), this.pt(x0 + 0.08, y1 - 0.08)], 'rgba(0,0,0,0)', 'rgba(255,255,255,.7)');
      if (z.wall.x0) this.wallRect('x0', z.wall.x0[0], z.wall.x0[1], 0, 0.22, edge);
      if (z.wall.y0) this.wallRect('y0', z.wall.y0[0], z.wall.y0[1], 0, 0.22, edge);
    });

    // 牆面佈置
    // 設計室：軟木板＋便利貼（左後牆）、窗（右後牆）
    this.wallRect('x0', 0.45, 2.35, 0.55, 1.35, '#D9B98A', shade('#D9B98A', -0.3));
    [[0.6, 1.05, C.amber], [0.95, 0.85, '#FFE08A'], [1.3, 1.08, C.teal], [1.65, 0.9, '#FFE08A'], [1.95, 1.05, C.amber], [1.1, 0.65, '#FFFFFF'], [1.75, 0.62, C.teal]]
      .forEach(([u, z, col]) => this.wallRect('x0', u, u + 0.24, z, z + 0.2, col));
    this.wallRect('y0', 0.5, 2.2, 0.6, 1.3, shade(C.teal, 0.6), shade(C.navy, 0.3));
    // 計畫室：白板＋時程路線（左後牆）
    this.wallRect('x0', 3.5, 5.3, 0.5, 1.35, '#FFFFFF', shade(C.navy, 0.35));
    const c = this.ctx;
    c.strokeStyle = C.navy; c.lineWidth = 2;
    c.beginPath();
    [[3.75, 0.75], [4.2, 0.95], [4.65, 0.85], [5.05, 1.12]].forEach(([u, z], k) => {
      const p = this.pt(0, u, z); if (k) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]);
    });
    c.stroke();
    [[3.75, 0.75, C.teal], [4.2, 0.95, C.teal], [4.65, 0.85, C.amber], [5.05, 1.12, C.amber]].forEach(([u, z, col]) => {
      const p = this.pt(0, u, z); c.fillStyle = col; c.beginPath(); c.arc(p[0], p[1], Math.max(2.5, this.tw * 0.05), 0, Math.PI * 2); c.fill();
    });
    // 教室：投影幕（右後牆）
    this.wallRect('y0', 3.2, 5.5, 0.45, 1.42, '#FFFFFF', shade(C.navy, 0.3));
    this.wallRect('y0', 3.4, 4.6, 1.2, 1.28, C.navy);
    [[3.5, 0.18, C.teal], [3.85, 0.32, C.teal], [4.2, 0.26, C.amber], [4.55, 0.42, C.amber]].forEach(([u, h, col]) => this.wallRect('y0', u, u + 0.22, 0.6, 0.6 + h, col));
    this.wallRect('y0', 4.95, 5.35, 0.65, 1.05, shade(C.teal, 0.5));
    // 查核區旁的窗（右後牆）
    this.wallRect('y0', 5.95, 6.8, 0.6, 1.3, shade(C.teal, 0.6), shade(C.navy, 0.3));

    // 可排序的家具（依 x+y 深度）
    items.push({ d: 0.5 + 6.4, f: () => this.plant(0.5, 6.4) });
    items.push({ d: 6.4 + 6.4, f: () => this.plant(6.4, 6.4) });
    items.push({ d: 2.25 + 0.4, f: () => this.plant(2.25, 0.4) });
    items.push({ d: 0.3 + 6.2, f: () => this.box(0.05, 5.75, 0, 0.5, 1.1, 1.25, shade(C.amber, -0.35)) });   // 書櫃
    items.push({ d: 1.15 + 5.42, f: () => this.chair(1.15, 5.42, shade(C.amber, -0.1)) });                  // 會議椅
    items.push({ d: 1.65 + 5.42, f: () => this.chair(1.65, 5.42, shade(C.amber, -0.1)) });
    items.push({ d: 3.3 + 1.25, f: () => this.chair(3.3, 1.25, shade(C.navy, 0.35)) });                    // 學員座位
    items.push({ d: 5.4 + 0.6, f: () => this.chair(5.4, 0.6, shade(C.navy, 0.35)) });
    items.push({ d: 5.4 + 1.2, f: () => this.chair(5.4, 1.2, shade(C.navy, 0.35)) });
    items.push({                                                                                              // 檔案櫃
      d: 6.45 + 3.0, f: () => {
        this.box(6.2, 2.8, 0, 0.5, 0.4, 0.95, shade(C.navy, 0.4));
        [0.3, 0.6].forEach((z) => this.poly([this.pt(6.28, 3.2, z), this.pt(6.62, 3.2, z), this.pt(6.62, 3.2, z + 0.04), this.pt(6.28, 3.2, z + 0.04)], shade(C.navy, 0.1)));
      }
    });
    items.push({                                                                                              // 成果看板
      d: 4.15 + 2.8, f: () => {
        this.box(3.95, 2.72, 0, 0.45, 0.12, 0.3, shade(C.navy, 0.3));
        this.poly([this.pt(3.95, 2.84, 0.3), this.pt(4.4, 2.84, 0.3), this.pt(4.4, 2.84, 1.15), this.pt(3.95, 2.84, 1.15)], '#FFFFFF', shade(C.navy, 0.3));
        [[4.0, 0.15, C.teal], [4.12, 0.28, C.teal], [4.24, 0.42, C.amber]].forEach(([x, h, col]) =>
          this.poly([this.pt(x, 2.84, 0.4), this.pt(x + 0.08, 2.84, 0.4), this.pt(x + 0.08, 2.84, 0.4 + h), this.pt(x, 2.84, 0.4 + h)], col));
      }
    });
    PARTITIONS.forEach((p) => {
      const mid = (p.from + p.to) / 2;
      items.push({ d: p.along === 'x' ? mid + p.at : p.at + mid, f: () => this.partition(p) });
    });
  };

  /* ---------- NPC 走位 ---------- */
  // list: [{id, station, spot:'host'|'guest', expr, tag}]
  // 換位置時沿走道走過去（不穿桌子、不瞬移）；tag = 在腳下顯示名牌
  IsoMap.prototype.setCast = function (list) {
    const seen = {};
    list.forEach((m) => {
      if (!LAYOUT[m.station]) return;
      seen[m.id] = true;
      let a = this.cast[m.id];
      if (!a) {
        const p = spotPos(m.station, m.spot);
        a = this.cast[m.id] = { x: p[0], y: p[1], facing: 1, station: m.station, spot: m.spot, route: [] };
      } else if (a.station !== m.station || a.spot !== m.spot) {
        if (REDUCE_MOTION) {
          const p = spotPos(m.station, m.spot); a.x = p[0]; a.y = p[1]; a.route = [];
        } else {
          a.route = route(a.station, a.spot, m.station, m.spot);
        }
        a.station = m.station; a.spot = m.spot;
      }
      a.expr = m.expr; a.tag = !!m.tag;
    });
    Object.keys(this.cast).forEach((id) => { if (!seen[id]) delete this.cast[id]; });
  };

  IsoMap.prototype.castMoving = function (id) {
    const a = this.cast[id];
    return !!(a && a.route && a.route.length);
  };

  IsoMap.prototype.updateCast = function (dt) {
    const speed = 3.6;   // 格／秒
    Object.keys(this.cast).forEach((id) => {
      const a = this.cast[id];
      let budget = speed * dt;
      a.moving = false;
      while (a.route.length && budget > 0) {
        const [tx, ty] = a.route[0];
        const dx = tx - a.x, dy = ty - a.y, dist = Math.hypot(dx, dy);
        if (dist <= budget) { a.x = tx; a.y = ty; budget -= dist; a.route.shift(); }
        else { a.x += dx / dist * budget; a.y += dy / dist * budget; budget = 0; }
        a.moving = true;
        const sdx = dx - dy;
        if (Math.abs(sdx) > 1e-4) a.facing = sdx < 0 ? -1 : 1;
      }
      if (!a.route.length && !a.moving) a.facing = 1;
    });
  };

  // 名牌：走動中與等待玩家的角色腳下顯示名字，讓玩家知道是誰、要去哪
  IsoMap.prototype.nameTag = function (id, a) {
    const ch = window.CHAR && window.CHAR.CHARACTERS[id];
    if (!ch) return;
    const c = this.ctx;
    const p = this.pt(a.x, a.y, 0);
    const fs = Math.max(11, Math.round(this.tw * 0.15));
    c.font = '700 ' + fs + 'px ' + FONT;
    const text = ch.name.replace(/（.*）/, '');
    const w = c.measureText(text).width + fs * 0.9, h = fs * 1.55;
    const waiting = a.tag && !a.route.length;
    c.fillStyle = waiting ? C.amber : 'rgba(31,58,95,.9)';
    roundRect(c, p[0] - w / 2, p[1] + 3, w, h, h / 2);
    c.fill();
    c.fillStyle = waiting ? C.navy : '#FFFFFF';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, p[0], p[1] + 3 + h / 2 + 1);
  };

  IsoMap.prototype.draw = function (t) {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    const dt = this.lastT ? Math.min(0.1, (t - this.lastT) / 1000) : 0;
    this.lastT = t;
    // 鏡頭平滑跟隨
    const ct = this.camTarget();
    this.camX += (ct - this.camX) * (REDUCE_MOTION ? 1 : Math.min(1, dt * 4));
    this.ox = this.w / 2 - this.camX;

    const items = [];
    this.drawScene(items);

    this.stations.forEach((s, i) => {
      const L = LAYOUT[i];
      const dx = L.desk[0], dy = L.desk[1];
      items.push({ d: dx + dy + 1.0, f: () => this.deskSet(i, dx, dy, s.state === 'locked') });
    });

    // NPC：有角色系統時依回合走位；否則沿用每站一位
    const castIds = Object.keys(this.cast);
    if (castIds.length) {
      this.updateCast(dt);
      castIds.forEach((id, k) => {
        const a = this.cast[id];
        const idle = REDUCE_MOTION ? 0 : (Math.sin(t / 650 + k * 1.7) + 1) * 0.025;
        const bob = a.moving ? Math.abs(Math.sin(t / 90)) * 0.1 : idle;
        items.push({ d: a.x + a.y - 0.3, f: () => this.actor(id, a.x, a.y, C.navy, { bob, expr: a.expr, flip: a.moving && a.facing < 0 }) });
      });
    } else {
      this.stations.forEach((s, i) => {
        const L = LAYOUT[i];
        const locked = s.state === 'locked';
        items.push({ d: L.desk[0] + L.desk[1] + 0.2, f: () => this.actor(s.npc, L.desk[0] + 0.5, L.desk[1] + 0.35, locked ? '#A7A196' : NPC_COLORS[i], { alpha: locked ? 0.5 : null }) });
      });
    }

    // 玩家
    this.updatePath(t);
    const moving = !!this.path;
    const bob = moving ? Math.abs(Math.sin(t / 90)) * 0.12 : 0;
    const flip = moving && this.facing < 0;
    items.push({ d: this.player.x + this.player.y + 0.05, f: () => this.actor('player', this.player.x, this.player.y, C.amber, { bob, flip }) });

    items.sort((a, b) => a.d - b.d).forEach((it) => it.f());

    // 名牌（在家具與人物之上）
    castIds.forEach((id) => { const a = this.cast[id]; if (a.route.length || a.tag) this.nameTag(id, a); });

    // 站點標籤（最上層）
    this.stations.forEach((s, i) => {
      const L = LAYOUT[i];
      const lp = [L.desk[0] + 0.5, L.desk[1] + 0.35, 3.0];
      // 未解鎖的站只顯示代號，避免標籤擠在一起；目前與已完成的站顯示完整分區名稱
      const full = s.id + ' ' + (ZONES[i] ? ZONES[i].name : s.name);
      const txt = s.state === 'locked' ? s.id : (s.state === 'done' ? '✓ ' : '') + full;
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
