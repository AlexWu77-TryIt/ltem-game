/* 角色視覺系統：程式繪製的原創向量 Q 版角色
 * 同一份角色定義同時產生「地圖全身小人」與「對話半身立繪」，確保兩者外觀一致。
 * 只負責畫面，不讀寫任何遊戲狀態、分數或存檔。
 */
(function () {
  'use strict';

  /* ---------- 共用美術規範（所有角色一致） ---------- */
  const STYLE = {
    ink: '#22324A',          // 描邊色
    stroke: 3.5,             // 描邊粗細（以 200×300 畫布為準）
    skin: '#F7D6B8',
    skinShade: '#E6B590',
    blush: '#F29A86',
    mouth: '#9C3D3D',
    tongue: '#E7837A',
    white: '#FFFFFF'
  };

  /* ---------- 角色定義 ---------- */
  // 新增角色只要在這裡加一筆，並在 ROLE_MAP 對應 rounds.json 的 role 字串
  const CHARACTERS = {
    player: {
      name: '你｜資深訓練專員',
      traits: ['側分短髮', '琥珀色外套', '青綠識別證掛繩'],
      hairStyle: 'sweep', hair: '#4A3426',
      jacket: '#F4A261', shirt: '#FFF7EC', pants: '#2C3E5A', shoes: '#3A2A22',
      acc: ['lanyard']
    },
    trainingManager: {
      name: '教育訓練主管',
      traits: ['頭頂髮髻', '圓框眼鏡', '青綠西裝外套＋深藍領帶', '手拿評鑑資料夾'],
      hairStyle: 'bun', hair: '#2B2F3A',
      jacket: '#2A9D8F', shirt: '#FFFFFF', pants: '#1F3A5F', shoes: '#22324A',
      acc: ['glasses', 'tie', 'clipboard']
    }
  };

  // rounds.json 的 role → 角色 id；未對應的角色沿用原本的方塊造型
  const ROLE_MAP = {
    '教育訓練主管': 'trainingManager'
  };

  // 表情設定：開場表情依台詞情境；作答後依回饋內容（可逐回合覆寫）
  const OPENING = { 3: 'neutral', 5: 'thinking', 8: 'surprised' };
  const REACTION_DEFAULT = { 10: 'happy', 5: 'thinking', 0: 'surprised' };
  const REACTION_BY_ROUND = {};   // 例：{ 8: { 10: 'happy', 5: 'thinking', 0: 'surprised' } }

  /* ---------- SVG 組件 ---------- */
  const S = STYLE;
  const line = (d, w, color) => `<path d="${d}" fill="none" stroke="${color || S.ink}" stroke-width="${w || S.stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const shape = (d, fill, w) => `<path d="${d}" fill="${fill}" stroke="${S.ink}" stroke-width="${w || S.stroke}" stroke-linejoin="round"/>`;
  const ell = (cx, cy, rx, ry, fill, w, extra) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${w === 0 ? '' : ` stroke="${S.ink}" stroke-width="${w || S.stroke}"`}${extra || ''}/>`;

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // 粗線手臂：外框＋袖子色＋手
  function arm(points, color) {
    const d = 'M' + points.map((p) => p.join(',')).join(' L');
    const end = points[points.length - 1];
    return line(d, 25, S.ink) + line(d, 18, color) +
      ell(end[0], end[1], 10, 10, S.skin, 3);
  }

  function hairBack(c) {
    let s = '';
    if (c.hairStyle === 'bun') {
      s += ell(100, 30, 21, 19, c.hair);
      s += ell(100, 30, 12, 10, shade(c.hair, 0.12), 0);
    }
    s += shape('M36,104 Q28,36 100,28 Q172,36 164,104 Q162,122 150,126 L150,96 Q100,74 50,96 L50,126 Q38,122 36,104 Z', c.hair);
    return s;
  }

  function hairFront(c) {
    let s;
    if (c.hairStyle === 'bun') {
      // 中分瀏海
      s = shape('M40,100 Q40,40 100,36 Q160,40 160,100 Q152,76 134,64 Q118,76 100,58 Q82,76 66,64 Q48,76 40,100 Z', c.hair);
      s += line('M62,56 Q76,44 94,42', 5, 'rgba(255,255,255,.35)');
    } else {
      // 側分短髮
      s = shape('M40,98 Q42,40 100,34 Q154,38 162,92 Q150,72 130,66 Q124,82 104,86 Q112,72 108,62 Q88,80 62,80 Q50,86 40,98 Z', c.hair);
      s += line('M58,62 Q72,46 92,42', 5, 'rgba(255,255,255,.35)');
    }
    return s;
  }

  function eyes(expr, dy) {
    const L = 78, R = 122, Y = 104;
    let s = '';
    if (expr === 'happy') {
      s += line(`M${L - 8},${Y + 2} Q${L},${Y - 8} ${L + 8},${Y + 2}`, 4);
      s += line(`M${R - 8},${Y + 2} Q${R},${Y - 8} ${R + 8},${Y + 2}`, 4);
    } else {
      const ox = expr === 'thinking' ? 3 : 0, oy = expr === 'thinking' ? -2 : 0;
      const rx = expr === 'surprised' ? 7.5 : expr === 'thinking' ? 6 : 6.5;
      const ry = expr === 'surprised' ? 10 : expr === 'thinking' ? 7.5 : 8.5;
      [L, R].forEach((x) => {
        s += ell(x + ox, Y + oy, rx, ry, S.ink, 0);
        s += ell(x + ox + 2.2, Y + oy - 3, 2.4, 2.4, S.white, 0);
        if (expr === 'surprised') s += ell(x + ox - 2, Y + oy + 4, 1.2, 1.2, S.white, 0);
      });
    }
    // 眉毛
    const b = {
      neutral: ['M68,86 Q78,82 88,86', 'M112,86 Q122,82 132,86'],
      happy: ['M68,82 Q78,77 88,82', 'M112,82 Q122,77 132,82'],
      thinking: ['M68,87 L88,85', 'M112,81 Q122,72 132,79'],
      surprised: ['M68,79 Q78,70 88,79', 'M112,79 Q122,70 132,79']
    }[expr];
    s += `<g transform="translate(0,${dy})">` + line(b[0]) + line(b[1]) + '</g>';
    return s;
  }

  function mouth(expr) {
    switch (expr) {
      case 'happy':
        return shape('M89,121 Q100,138 111,121 Z', S.mouth, 3) + ell(100, 130, 5, 2.6, S.tongue, 0);
      case 'thinking':
        return line('M94,127 Q100,124 107,126');
      case 'surprised':
        return ell(100, 127, 5.5, 7, S.mouth, 3);
      default:
        return line('M93,124 Q100,129 107,124');
    }
  }

  function face(c, expr) {
    const glasses = c.acc.indexOf('glasses') >= 0;
    let s = '';
    s += ell(64, 118, 8, 5, S.blush, 0, ` opacity="${expr === 'happy' ? 0.6 : 0.38}"`);
    s += ell(136, 118, 8, 5, S.blush, 0, ` opacity="${expr === 'happy' ? 0.6 : 0.38}"`);
    s += eyes(expr, glasses ? -6 : 0);
    s += mouth(expr);
    if (expr === 'surprised') s += shape('M171,66 Q178,78 171,83 Q164,78 171,66 Z', '#9ED8F0', 2.5);
    return s;
  }

  function glasses() {
    return ell(78, 104, 15, 14, 'rgba(255,255,255,.14)', 3) + ell(122, 104, 15, 14, 'rgba(255,255,255,.14)', 3) +
      line('M93,102 Q100,98 107,102', 3) + line('M63,100 L44,96', 3) + line('M137,100 L156,96', 3);
  }

  function body(c, expr, view) {
    let s = '';
    // 腿與鞋（半身立繪會被裁掉，但保留以維持同一份定義）
    s += `<rect x="75" y="222" width="21" height="58" rx="8" fill="${c.pants}" stroke="${S.ink}" stroke-width="${S.stroke}"/>`;
    s += `<rect x="104" y="222" width="21" height="58" rx="8" fill="${c.pants}" stroke="${S.ink}" stroke-width="${S.stroke}"/>`;
    s += ell(84, 284, 15, 8, c.shoes) + ell(116, 284, 15, 8, c.shoes);
    // 脖子
    s += `<rect x="89" y="134" width="22" height="20" rx="6" fill="${S.skinShade}" stroke="${S.ink}" stroke-width="${S.stroke}"/>`;
    // 外套
    s += shape('M58,172 Q58,150 100,146 Q142,150 142,172 L147,228 Q100,238 53,228 Z', c.jacket);
    s += `<path d="M126,152 Q139,156 140,172 L144,227 Q136,230 128,231 Q132,190 126,152 Z" fill="${S.ink}" opacity=".13"/>`;
    // 襯衫 V 領與翻領
    s += shape('M86,148 L100,180 L114,148 Z', c.shirt, 3);
    s += line('M86,148 L97,196', 2.6) + line('M114,148 L103,196', 2.6);
    if (c.acc.indexOf('tie') >= 0) s += shape('M95,150 L105,150 L107,160 L100,190 L93,160 Z', '#1F3A5F', 2.6);
    if (c.acc.indexOf('lanyard') >= 0) {
      s += line('M88,150 L100,186 L112,150', 4, '#1D7F73');
      s += `<rect x="89" y="184" width="22" height="27" rx="3" fill="${S.white}" stroke="${S.ink}" stroke-width="2.6"/>`;
      s += `<rect x="93" y="189" width="14" height="4" rx="1" fill="#2A9D8F"/>`;
      s += `<rect x="93" y="197" width="14" height="2.6" rx="1" fill="#C9D3DD"/><rect x="93" y="202" width="10" height="2.6" rx="1" fill="#C9D3DD"/>`;
    }
    // 左手（畫面左側）
    if (c.acc.indexOf('clipboard') >= 0) {
      s += arm([[62, 162], [54, 196], [66, 210]], c.jacket);
      s += `<g transform="rotate(-8 46 214)"><rect x="28" y="190" width="34" height="44" rx="4" fill="#C98B4E" stroke="${S.ink}" stroke-width="3"/>`;
      s += `<rect x="32" y="197" width="26" height="33" rx="2" fill="${S.white}"/>`;
      s += `<rect x="38" y="186" width="14" height="8" rx="2" fill="#8F9AA6" stroke="${S.ink}" stroke-width="2.4"/>`;
      s += `<rect x="35" y="203" width="18" height="2.6" fill="#2A9D8F"/><rect x="35" y="209" width="20" height="2.4" fill="#C9D3DD"/><rect x="35" y="214" width="15" height="2.4" fill="#C9D3DD"/></g>`;
      s += ell(66, 210, 10, 10, S.skin, 3);
    } else {
      s += arm([[62, 162], [50, 212]], c.jacket);
    }
    // 右手：思考時托下巴（只在立繪），其餘自然下垂
    const thinkingPose = expr === 'thinking' && view === 'bust';
    if (!thinkingPose) s += arm([[138, 162], [150, 212]], c.jacket);
    return { pre: s, thinkingPose };
  }

  function head(c, expr) {
    let s = '';
    s += ell(40, 104, 10, 11, S.skin, 3) + ell(160, 104, 10, 11, S.skin, 3);
    s += ell(100, 94, 60, 54, S.skin);
    s += `<path d="M48,120 Q100,156 152,120 Q140,146 100,148 Q60,146 48,120 Z" fill="${S.skinShade}" opacity=".35"/>`;
    s += face(c, expr);
    s += hairFront(c);
    if (c.acc.indexOf('glasses') >= 0) s += glasses();
    return s;
  }

  /* 產生 SVG 字串
   * view: 'full' 全身（地圖用，200×300，腳底在 y=292）
   *       'bust' 半身（對話立繪，2:3）
   */
  function svg(id, opts) {
    const c = CHARACTERS[id];
    if (!c) return '';
    const o = opts || {};
    const view = o.view || 'full';
    const expr = o.expr || 'neutral';
    const vb = view === 'bust' ? '26 6 148 222' : '0 0 200 300';
    let s = '';
    if (view === 'full') s += ell(100, 290, 46, 8, S.ink, 0, ' opacity=".14"');
    s += hairBack(c);
    const b = body(c, expr, view);
    s += b.pre;
    s += head(c, expr);
    if (b.thinkingPose) s += arm([[138, 164], [152, 198], [128, 150]], c.jacket);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${view === 'bust' ? 512 : 256}" height="${view === 'bust' ? 768 : 384}">${s}</svg>`;
  }

  function dataUrl(id, opts) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(id, opts));
  }

  /* ---------- 圖像快取（Canvas 用） ---------- */
  const imgCache = {};
  const spriteCache = {};

  function image(id, view, expr) {
    const key = id + '|' + view + '|' + expr;
    if (!imgCache[key]) {
      const img = new Image();
      img.decoding = 'async';
      img._ok = false; img._err = false;
      img.onload = () => { img._ok = true; };
      img.onerror = () => { img._err = true; };
      img.src = dataUrl(id, { view, expr });
      imgCache[key] = img;
    }
    return imgCache[key];
  }

  // 地圖用：依顯示高度（CSS px）× dpr 預先點陣化，避免每幀重新解析 SVG
  // 回傳 {canvas, w, h, ax, ay} 或 null（尚未載入／失敗 → 呼叫端退回方塊人）
  function mapSprite(id, expr, cssH, dpr) {
    if (!CHARACTERS[id]) return null;
    const ph = Math.max(8, Math.round(cssH * dpr));
    const key = id + '|' + expr + '|' + ph;
    if (spriteCache[key]) return spriteCache[key];
    const img = image(id, 'full', expr);
    if (!img._ok) return null;
    const pw = Math.round(ph * 200 / 300);
    const cv = document.createElement('canvas');
    cv.width = pw; cv.height = ph;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, pw, ph);
    const sp = { canvas: cv, w: pw / dpr, h: ph / dpr, ax: (100 / 200) * (pw / dpr), ay: (292 / 300) * (ph / dpr) };
    spriteCache[key] = sp;
    return sp;
  }

  function preload(ids) {
    ids.forEach((id) => {
      ['neutral', 'happy'].forEach((e) => image(id, 'full', e));
      ['neutral', 'happy', 'thinking', 'surprised'].forEach((e) => image(id, 'bust', e));
    });
  }

  window.CHAR = {
    STYLE, CHARACTERS, EXPRESSIONS: ['neutral', 'happy', 'thinking', 'surprised'],
    svg, dataUrl, image, mapSprite, preload,
    forRole: (role) => ROLE_MAP[role] || null,
    opening: (round) => OPENING[round] || 'neutral',
    reaction: (round, score) => ((REACTION_BY_ROUND[round] || {})[score]) || REACTION_DEFAULT[score] || 'neutral'
  };
})();
