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

  /* ---------- 角色定義 ----------
   * hairStyle: sweep 側分短髮｜bun 頭頂髮髻｜neat 俐落短髮｜spiky 豎立短髮｜long 及肩長髮｜bob 鮑伯頭｜curly 捲髮
   * hold: 左手物品（clipboard 資料夾板｜tablet 平板｜folder 文件夾｜notebook 筆記本）
   * rightHold: 右手物品（phone 手機｜marker 白板筆）
   * home: 地圖上的駐點 {station: 0~4 對應 P/D/Do/R/O, spot: 'host' 桌前 | 'guest' 桌邊}
   */
  const CHARACTERS = {
    player: {
      name: '你｜資深訓練專員',
      desc: '玩家扮演的資深訓練專員，走完 PDDRO 五站。琥珀色是玩家專屬色，地圖、進度條與按鈕都使用同色，方便一眼認出自己。',
      traits: ['側分短髮', '琥珀色外套', '青綠識別證掛繩'],
      hairStyle: 'sweep', hair: '#4A3426',
      jacket: '#F4A261', shirt: '#FFF7EC', pants: '#2C3E5A', shoes: '#3A2A22',
      lanyard: '#1D7F73'
    },
    hrDirector: {
      name: '人資長', rounds: [1, 8, 10],
      desc: '第 1、8、10 回合。訂下培訓方向，查核時想省評鑑預算，最後要求「所有課程都做到 Tier 8」。駐點：成果發表區。',
      traits: ['銀灰俐落短髮', '深藍正式西裝', '琥珀色口袋巾與胸針', '手拿平板'],
      hairStyle: 'neat', hair: '#8E97A6',
      jacket: '#1F3A5F', shirt: '#FFFFFF', pants: '#1A2F4D', shoes: '#22324A',
      tie: '#2A9D8F', pocket: '#F4A261', hold: 'tablet',
      home: { station: 4, spot: 'host' }
    },
    demandManager: {
      name: '需求單位主管', rounds: [2, 7, 9],
      desc: '業務部經理，第 2、7、9 回合。急著開課、認為遷移是學員自己的事，也最想把績效成長寫成訓練成果。駐點：計畫會議室。',
      traits: ['豎立短髮', '白襯衫捲袖＋深藍背心', '右手拿手機'],
      hairStyle: 'spiky', hair: '#3B2A20',
      jacket: '#34506F', sleeve: '#FFFFFF', shirt: '#FFFFFF', pants: '#2C3E5A', shoes: '#3A2A22',
      tie: '#F4A261', rightHold: 'phone',
      home: { station: 0, spot: 'host' }
    },
    trainingManager: {
      name: '教育訓練主管', rounds: [4],
      desc: '第 4 回合；第 6 回合也有一句台詞。在意人力與時間成本，想省掉課後再測與持續提醒。駐點：數據查核區。',
      traits: ['頭頂髮髻', '圓框眼鏡', '青綠西裝外套＋深藍領帶', '手拿評鑑資料夾'],
      hairStyle: 'bun', hair: '#2B2F3A',
      jacket: '#2A9D8F', shirt: '#FFFFFF', pants: '#1F3A5F', shoes: '#22324A',
      glasses: true, tie: '#1F3A5F', hold: 'clipboard',
      home: { station: 3, spot: 'host' }
    },
    externalTrainer: {
      name: '外部訓練單位講師', rounds: [3],
      desc: '第 3 回合。準備用情境題評量學員的面談決策。駐點：課程設計室。',
      traits: ['及肩長髮', '頭戴式麥克風', '藍灰外套', '右手拿白板筆'],
      hairStyle: 'long', hair: '#5A3A2A',
      jacket: '#4C6B91', shirt: '#FFF7EC', pants: '#2C3E5A', shoes: '#3A2A22',
      headset: true, rightHold: 'marker',
      home: { station: 1, spot: 'host' }
    },
    vendorContact: {
      name: '外部訓練單位窗口', rounds: [5],
      desc: '第 6 回合。結案時拿出簽到表與滿意度 4.8 分。駐點：訓練教室。',
      traits: ['鮑伯頭＋琥珀色髮帶', '淺青綠外套', '琥珀色廠商識別證', '手拿文件夾'],
      hairStyle: 'bob', hair: '#6B4A2E', headband: '#F4A261',
      jacket: '#7FC3B8', shirt: '#FFFFFF', pants: '#1F3A5F', shoes: '#22324A',
      lanyard: '#D9822B', hold: 'folder',
      home: { station: 2, spot: 'host' }
    },
    trainee: {
      name: '受訓學員（新任主管）', rounds: [6],
      desc: '第 6 回合。坦白說沒有 HR 提醒，大概會忘了做面談。駐點：訓練教室學員座位。',
      traits: ['捲髮', '灰藍外套＋琥珀色領帶', '手拿筆記本'],
      hairStyle: 'curly', hair: '#2E2420',
      jacket: '#7A8BA6', shirt: '#FFFFFF', pants: '#2C3E5A', shoes: '#3A2A22',
      tie: '#F4A261', hold: 'notebook',
      home: { station: 2, spot: 'guest' }
    }
  };

  // rounds.json 的 role → 角色 id
  const ROLE_MAP = {
    '人資長': 'hrDirector',
    '需求單位主管': 'demandManager',
    '教育訓練主管': 'trainingManager',
    '外部講師': 'externalTrainer',
    '外部訓練單位講師': 'externalTrainer',
    '受訓學員': 'trainee',
    '外部訓練單位窗口': 'vendorContact',
    '受訓學員（新任主管）': 'trainee'
  };

  // 開場表情：依台詞情境
  const OPENING = {
    1: 'neutral',    // 人資長：你打算從哪裡開始規劃？
    2: 'neutral',    // 需求主管：下週就要開課，評鑑目標之後再談
    3: 'thinking',   // 講師：情境題該怎麼出？
    4: 'thinking',   // 教育訓練主管：隔三天再演練，成本太高
    5: 'happy',      // 窗口：出席率 100%、滿意度 4.8
    6: 'thinking',   // 學員：HR 不提醒大概會忘
    7: 'neutral',    // 需求主管：學員回來不用，跟我無關
    8: 'thinking',   // 人資長：預算有限，只看部門績效
    9: 'happy',      // 需求主管：直接寫成訓練成果吧！
    10: 'happy'      // 人資長：所有課程都要做到 Tier 8！
  };
  // 作答後：依得分（最符合 LTEM→被說服而肯定、部分符合→還在思考、較不符合→情境出現問題）
  const REACTION_DEFAULT = { 10: 'happy', 6: 'thinking', 3: 'surprised' };
  const REACTION_BY_ROUND = {};   // 可逐回合覆寫，例：{ 4: { 10: 'thinking' } }

  /* ---------- SVG 組件 ---------- */
  const S = STYLE;
  const line = (d, w, color) => `<path d="${d}" fill="none" stroke="${color || S.ink}" stroke-width="${w || S.stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const shape = (d, fill, w) => `<path d="${d}" fill="${fill}" stroke="${S.ink}" stroke-width="${w || S.stroke}" stroke-linejoin="round"/>`;
  const ell = (cx, cy, rx, ry, fill, w, extra) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${w === 0 ? '' : ` stroke="${S.ink}" stroke-width="${w || S.stroke}"`}${extra || ''}/>`;
  const rect = (x, y, w, h, r, fill, sw) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${sw === 0 ? '' : ` stroke="${S.ink}" stroke-width="${sw || S.stroke}"`}/>`;
  const HL = 'rgba(255,255,255,.35)';

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // 粗線手臂：外框＋袖子色＋手
  function arm(points, color, noHand) {
    const d = 'M' + points.map((p) => p.join(',')).join(' L');
    const end = points[points.length - 1];
    return line(d, 25, S.ink) + line(d, 18, color) + (noHand ? '' : ell(end[0], end[1], 10, 10, S.skin, 3));
  }

  const BACK_STD = 'M36,104 Q28,36 100,28 Q172,36 164,104 Q162,122 150,126 L150,96 Q100,74 50,96 L50,126 Q38,122 36,104 Z';
  const BACK_SHORT = 'M38,102 Q30,38 100,30 Q170,38 162,102 Q160,112 154,114 L152,94 Q100,76 48,94 L46,114 Q40,112 38,102 Z';

  function hairBack(c) {
    let s = '';
    switch (c.hairStyle) {
      case 'bun':
        s += ell(100, 30, 21, 19, c.hair);
        s += ell(100, 30, 12, 10, shade(c.hair, 0.12), 0);
        s += shape(BACK_STD, c.hair);
        break;
      case 'long':
        s += shape('M34,104 Q26,34 100,28 Q174,34 166,104 L174,184 Q154,198 134,186 L132,122 Q100,104 68,122 L66,186 Q46,198 26,184 Z', c.hair);
        break;
      case 'bob':
        s += shape('M34,104 Q26,34 100,28 Q174,34 166,104 L170,142 Q152,154 136,142 L136,110 Q100,92 64,110 L64,142 Q48,154 30,142 Z', c.hair);
        break;
      case 'neat': case 'spiky': case 'curly':
        s += shape(BACK_SHORT, c.hair);
        break;
      default:
        s += shape(BACK_STD, c.hair);
    }
    return s;
  }

  function hairFront(c) {
    let s;
    switch (c.hairStyle) {
      case 'bun':     // 中分瀏海
        s = shape('M40,100 Q40,40 100,36 Q160,40 160,100 Q152,76 134,64 Q118,76 100,58 Q82,76 66,64 Q48,76 40,100 Z', c.hair);
        s += line('M62,56 Q76,44 94,42', 5, HL);
        break;
      case 'neat':    // 俐落旁分
        s = shape('M40,96 Q40,40 100,34 Q160,40 160,96 Q156,74 144,64 Q120,58 84,66 Q60,72 50,82 Q44,88 40,96 Z', c.hair);
        s += line('M84,66 Q96,48 112,40', 2.5, shade(c.hair, -0.35));
        s += line('M120,46 Q138,48 150,60', 5, HL);
        break;
      case 'spiky':   // 豎立短髮
        s = shape('M40,98 Q36,54 56,42 L60,22 L76,36 L86,14 L100,32 L114,14 L124,36 L140,22 L144,44 Q164,56 160,98 Q150,78 132,72 Q100,82 70,72 Q50,78 40,98 Z', c.hair);
        s += line('M66,46 Q78,38 92,38', 5, HL);
        break;
      case 'long':    // 斜瀏海
        s = shape('M40,104 Q40,40 100,34 Q160,40 160,104 Q150,70 122,60 Q96,80 60,76 Q46,88 40,104 Z', c.hair);
        s += line('M60,58 Q74,44 94,40', 5, HL);
        break;
      case 'bob':     // 齊瀏海＋髮帶
        s = shape('M40,100 Q40,40 100,34 Q160,40 160,100 L156,84 Q100,76 44,84 Z', c.hair);
        if (c.headband) s += line('M44,70 Q100,26 156,70', 8, S.ink) + line('M44,70 Q100,26 156,70', 5, c.headband);
        s += line('M62,80 Q64,90 62,96', 2.2, shade(c.hair, -0.3)) + line('M138,80 Q136,90 138,96', 2.2, shade(c.hair, -0.3));
        break;
      case 'curly':   // 捲髮
        s = shape('M38,98 Q30,70 44,58 Q42,40 62,38 Q70,24 88,30 Q100,18 114,30 Q132,24 140,40 Q160,42 158,60 Q170,72 162,98 Q156,84 146,80 Q140,90 128,84 Q118,92 106,84 Q94,92 84,84 Q72,92 64,82 Q54,90 48,82 Q42,90 38,98 Z', c.hair);
        s += line('M70,44 Q76,40 82,44', 4, HL) + line('M104,36 Q110,32 116,36', 4, HL);
        break;
      default:        // sweep 側分短髮
        s = shape('M40,98 Q42,40 100,34 Q154,38 162,92 Q150,72 130,66 Q124,82 104,86 Q112,72 108,62 Q88,80 62,80 Q50,86 40,98 Z', c.hair);
        s += line('M58,62 Q72,46 92,42', 5, HL);
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
    let s = '';
    s += ell(64, 118, 8, 5, S.blush, 0, ` opacity="${expr === 'happy' ? 0.6 : 0.38}"`);
    s += ell(136, 118, 8, 5, S.blush, 0, ` opacity="${expr === 'happy' ? 0.6 : 0.38}"`);
    s += eyes(expr, c.glasses ? -6 : 0);
    s += mouth(expr);
    if (expr === 'surprised') s += shape('M171,66 Q178,78 171,83 Q164,78 171,66 Z', '#9ED8F0', 2.5);
    return s;
  }

  function glasses() {
    return ell(78, 104, 15, 14, 'rgba(255,255,255,.14)', 3) + ell(122, 104, 15, 14, 'rgba(255,255,255,.14)', 3) +
      line('M93,102 Q100,98 107,102', 3) + line('M63,100 L44,96', 3) + line('M137,100 L156,96', 3);
  }

  function headset() {
    return line('M40,104 Q36,62 70,46', 3.2) + rect(32, 96, 12, 18, 5, '#2C3E5A', 2.6) +
      line('M40,112 Q50,134 82,130', 3) + ell(84, 130, 4, 4, '#2C3E5A', 2.4);
  }

  // 左手拿的物品（畫在手臂之後、手之前）
  function heldItem(kind) {
    const g = (inner) => `<g transform="rotate(-8 46 214)">${inner}</g>`;
    switch (kind) {
      case 'clipboard':
        return g(rect(28, 190, 34, 44, 4, '#C98B4E', 3) + rect(32, 197, 26, 33, 2, S.white, 0) +
          rect(38, 186, 14, 8, 2, '#8F9AA6', 2.4) +
          rect(35, 203, 18, 2.6, 0, '#2A9D8F', 0) + rect(35, 209, 20, 2.4, 0, '#C9D3DD', 0) + rect(35, 214, 15, 2.4, 0, '#C9D3DD', 0));
      case 'tablet':
        return g(rect(27, 192, 36, 44, 5, '#1F3A5F', 3) + rect(31, 197, 28, 34, 2, '#9ED8F0', 0) +
          rect(35, 222, 5, 6, 0, '#2A9D8F', 0) + rect(42, 216, 5, 12, 0, '#2A9D8F', 0) + rect(49, 210, 5, 18, 0, '#F4A261', 0));
      case 'folder':
        return g(rect(32, 186, 26, 30, 2, S.white, 2.4) + rect(27, 194, 36, 42, 3, '#4C6B91', 3) +
          rect(31, 200, 14, 4, 1, '#F4A261', 0));
      case 'notebook':
        return g(rect(28, 192, 34, 42, 3, '#FFF7EC', 3) + rect(28, 192, 7, 42, 2, '#F4A261', 3) +
          rect(39, 202, 18, 2.4, 0, '#C9D3DD', 0) + rect(39, 208, 18, 2.4, 0, '#C9D3DD', 0) + rect(39, 214, 12, 2.4, 0, '#C9D3DD', 0));
      default: return '';
    }
  }

  // 右手拿的物品（手在 150,212）
  function rightItem(kind) {
    switch (kind) {
      case 'phone':
        return `<g transform="rotate(10 152 206)">${rect(143, 188, 17, 28, 4, '#22324A', 2.6)}${rect(146, 192, 11, 18, 2, '#9ED8F0', 0)}</g>`;
      case 'marker':
        return `<g transform="rotate(-30 150 206)">${rect(146, 184, 9, 30, 3, '#F4A261', 2.6)}${rect(146, 184, 9, 7, 2, '#2C3E5A', 0)}</g>`;
      default: return '';
    }
  }

  function body(c, expr, view) {
    const sleeve = c.sleeve || c.jacket;
    let s = '';
    // 腿與鞋
    s += rect(75, 222, 21, 58, 8, c.pants) + rect(104, 222, 21, 58, 8, c.pants);
    s += ell(84, 284, 15, 8, c.shoes) + ell(116, 284, 15, 8, c.shoes);
    // 脖子
    s += rect(89, 134, 22, 20, 6, S.skinShade);
    // 外套／背心
    s += shape('M58,172 Q58,150 100,146 Q142,150 142,172 L147,228 Q100,238 53,228 Z', c.jacket);
    s += `<path d="M126,152 Q139,156 140,172 L144,227 Q136,230 128,231 Q132,190 126,152 Z" fill="${S.ink}" opacity=".13"/>`;
    // 襯衫 V 領與翻領
    s += shape('M86,148 L100,180 L114,148 Z', c.shirt, 3);
    s += line('M86,148 L97,196', 2.6) + line('M114,148 L103,196', 2.6);
    if (c.tie) s += shape('M95,150 L105,150 L107,160 L100,190 L93,160 Z', c.tie, 2.6);
    if (c.pocket) s += shape('M118,170 L130,168 L126,177 Z', c.pocket, 2.2) + ell(80, 168, 3.2, 3.2, c.pocket, 2);
    if (c.lanyard) {
      s += line('M88,150 L100,186 L112,150', 4, c.lanyard);
      s += rect(89, 184, 22, 27, 3, S.white, 2.6);
      s += rect(93, 189, 14, 4, 1, c.lanyard, 0);
      s += rect(93, 197, 14, 2.6, 1, '#C9D3DD', 0) + rect(93, 202, 10, 2.6, 1, '#C9D3DD', 0);
    }
    // 左手（畫面左側）
    if (c.hold) {
      s += arm([[62, 162], [54, 196], [66, 210]], sleeve, true);
      s += heldItem(c.hold);
      s += ell(66, 210, 10, 10, S.skin, 3);
    } else {
      s += arm([[62, 162], [50, 212]], sleeve);
    }
    // 右手：思考時托下巴（只在立繪），其餘自然下垂
    const thinkingPose = expr === 'thinking' && view === 'bust';
    if (!thinkingPose) {
      if (c.rightHold) {
        s += arm([[138, 162], [150, 212]], sleeve, true) + rightItem(c.rightHold) + ell(150, 212, 10, 10, S.skin, 3);
      } else {
        s += arm([[138, 162], [150, 212]], sleeve);
      }
    }
    return { pre: s, thinkingPose };
  }

  function head(c, expr) {
    let s = '';
    s += ell(40, 104, 10, 11, S.skin, 3) + ell(160, 104, 10, 11, S.skin, 3);
    s += ell(100, 94, 60, 54, S.skin);
    s += `<path d="M48,120 Q100,156 152,120 Q140,146 100,148 Q60,146 48,120 Z" fill="${S.skinShade}" opacity=".35"/>`;
    s += face(c, expr);
    s += hairFront(c);
    if (c.glasses) s += glasses();
    if (c.headset) s += headset();
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
    if (b.thinkingPose) s += arm([[138, 164], [152, 198], [128, 150]], c.sleeve || c.jacket);
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
