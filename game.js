(function () {
  'use strict';

  const CFG = window.LTEM_CONFIG || {};
  const KEY = 'ltem_game_state_v1';
  const $ = (id) => document.getElementById(id);
  const LETTERS = ['A', 'B', 'C'];
  const TYPE = { 10: '最佳', 5: '部分正確', 0: '常見陷阱' };

  let DATA = null;
  let map = null;
  let state = null;           // 持久化：{nick, startAt, answers:[{opt,score}], finished, uploaded}
  let busy = false;           // 走路或對話中
  let shownRound = 0;         // 對話框目前顯示的回合（1-based）

  /* ---------- 儲存 ---------- */
  function load() {
    try { return JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 忽略 */ }
  }
  function clearSave() {
    try { sessionStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
  }
  function deviceId() {
    try {
      let id = localStorage.getItem('ltem_device');
      if (!id) {
        id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        localStorage.setItem('ltem_device', id);
      }
      return id;
    } catch (e) { return 'nostore'; }
  }

  /* ---------- 計算 ---------- */
  const total = () => state.answers.reduce((s, a) => s + (a ? a.score : 0), 0);
  const nextRound = () => state.answers.length;                 // 0-based
  const stationOfRound = (ri) => DATA.stations.findIndex((s) => s.rounds.indexOf(ri + 1) >= 0);
  const currentStation = () => (nextRound() >= DATA.rounds.length ? DATA.stations.length : stationOfRound(nextRound()));

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 1800);
  }

  /* ---------- HUD ---------- */
  function renderHud() {
    $('score').textContent = total();
    const done = state ? state.answers.length : 0;
    const shown = !$('dialog').hidden && shownRound ? shownRound : Math.min(done + 1, 10);
    $('roundInfo').textContent = '第 ' + shown + ' / 10 回合';
    const cs = state ? currentStation() : 0;
    $('progress').innerHTML = DATA.stations.map((s, i) => {
      const cls = i < cs ? 'done' : i === cs ? 'active' : '';
      return '<li class="' + cls + '"><b>' + (i < cs ? '✓' : esc(s.id)) + '</b>' + esc(s.name) + '</li>';
    }).join('');
    map.setStations(DATA.stations.map((s, i) => ({
      id: s.id, name: s.name, state: i < cs ? 'done' : i === cs ? 'active' : 'locked',
      npc: charOf(DATA.rounds[s.rounds[0] - 1])     // 沒有角色系統時的備援：該站第一回合的角色
    })));
    // 對話框開著時不移動角色，等關閉後才讓玩家看到角色走過去
    if ($('dialog').hidden) map.setCast(buildCast(cs));
    if (cs < DATA.stations.length) {
      const s = DATA.stations[cs];
      $('goBtn').textContent = (state.answers.length ? '前往' : '出發：') + s.label + '・' + s.name + ' ' + s.en;
      $('mapCta').hidden = false;
    } else {
      $('mapCta').hidden = true;
    }
  }

  /* ---------- 地圖互動 ---------- */
  function goStation(idx) {
    if (busy || !state || !state.nick || state.finished || !$('start').hidden) return;
    const cs = currentStation();
    if (idx !== cs) {
      if (idx > cs) toast('請先完成「' + DATA.stations[cs].name + '」站');
      else toast('這一站已完成');
      return;
    }
    busy = true;
    $('mapCta').hidden = true;
    map.walkTo(idx, () => {
      // 對話角色還在走過來時，等他到桌邊再開始對話（最多等 4 秒）
      const sid = charOf(DATA.rounds[nextRound()]);
      const t0 = Date.now();
      const go = () => {
        if (sid && map.castMoving(sid) && Date.now() - t0 < 4000) { setTimeout(go, 120); return; }
        openRound(nextRound());
      };
      go();
    });
  }

  /* ---------- 角色立繪（只影響畫面，不讀寫遊戲狀態） ---------- */
  const CH = window.CHAR || null;
  const charOf = (r) => (CH && r ? CH.forRole(r.role) : null);

  // 地圖走位：每位 NPC 平時在自己的駐點；某一站開始時，這一站會出場的外站角色先走到該站桌邊，
  // 整站結束才走回去。只在換站時移動，避免同一站內來回走動。
  function buildCast(cs) {
    if (!CH || !DATA) return [];
    const ri = state ? nextRound() : 0;
    const speaker = (!state || state.finished || ri >= DATA.rounds.length) ? null : charOf(DATA.rounds[ri]);
    const st = DATA.stations[cs];
    const visiting = st ? st.rounds.map((n) => charOf(DATA.rounds[n - 1])) : [];
    const cast = [];
    Object.keys(CH.CHARACTERS).forEach((id) => {
      const home = CH.CHARACTERS[id].home;
      if (!home) return;
      let station = home.station, spot = home.spot;
      if (st && visiting.indexOf(id) >= 0 && home.station !== cs) { station = cs; spot = 'guest'; }
      cast.push({
        id, station, spot,
        expr: home.station < cs && station === home.station ? 'happy' : 'neutral',
        tag: id === speaker
      });
    });
    return cast;
  }

  function setPortrait(cid, expr, enter, fallbackColor) {
    const img = $('portraitImg'), av = $('avatar'), box = $('portrait');
    const useFallback = () => {
      img.hidden = true; av.hidden = false; box.classList.remove('has-img');
      $('speaker').classList.remove('has-img');
      if (fallbackColor) av.style.background = fallbackColor;
    };
    if (!cid) { useFallback(); return; }
    img.onerror = useFallback;
    img.src = CH.image(cid, 'bust', expr).src;
    img.hidden = false; av.hidden = true;
    box.classList.add('has-img');
    $('speaker').classList.add('has-img');
    if (fallbackColor) av.style.background = fallbackColor;
    const cls = enter ? 'enter' : 'swap';
    img.classList.remove('enter', 'swap');
    void img.offsetWidth;                // 重新觸發動畫
    img.classList.add(cls);
  }

  /* ---------- 對話 ---------- */
  function openRound(ri) {
    const r = DATA.rounds[ri];
    const si = stationOfRound(ri);
    const st = DATA.stations[si];
    shownRound = r.round;
    $('dialog').hidden = false;
    renderHud();
    $('stationTag').textContent = st.label + '｜' + st.name + ' ' + st.en + '　第 ' + r.round + ' / 10 回合';
    $('stationTag').title = 'TTQS 指標：' + st.ttqs;
    $('role').textContent = r.role;
    $('line').textContent = r.line;
    setPortrait(charOf(r), CH ? CH.opening(r.round) : 'neutral', true, ['#1F3A5F', '#2A9D8F', '#4C6B91', '#1D6E64', '#172C47'][si]);
    $('fbFace').hidden = true;
    const order = shuffle([0, 1, 2]);
    $('options').innerHTML = order.map((oi, k) =>
      '<button class="opt" data-oi="' + oi + '"><span class="k">' + LETTERS[k] + '</span><span class="tx">' +
      esc(r.options[oi].text) + '</span></button>').join('');
    $('options').querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => choose(ri, +b.dataset.oi, b)));
    $('feedback').hidden = true;
    $('dialog').hidden = false;
    $('sheetInner').scrollTop = 0;
    map.cv.setAttribute('aria-hidden', 'true');
  }

  function choose(ri, oi, btn) {
    if (state.answers.length !== ri) return;          // 防連點
    const r = DATA.rounds[ri];
    const opt = r.options[oi];
    state.answers.push({ opt: oi, score: opt.score });
    save();
    renderHud();

    $('options').querySelectorAll('.opt').forEach((b) => {
      b.disabled = true;
      if (b === btn) {
        b.classList.add('picked');
        b.insertAdjacentHTML('beforeend', '<span class="pts">+' + opt.score + '</span>');
      }
    });
    const head = $('fbHead');
    head.className = 'fb-head s' + opt.score;
    $('fbText').textContent = (opt.score === 10 ? '最佳選擇！' : opt.score === 5 ? '部分正確' : '常見陷阱') + '　+' + opt.score + ' 分';
    // 角色表情回應（只換圖，不影響分數與存檔）
    const cid = charOf(r);
    if (cid) {
      const expr = CH.reaction(r.round, opt.score);
      setPortrait(cid, expr, false);
      $('fbFace').src = CH.image(cid, 'bust', expr).src;
      $('fbFace').hidden = false;
    }
    $('fbWhy').textContent = opt.feedback;
    $('fbAll').innerHTML = r.options.map((o) =>
      '<div class="fb-item"><div class="t"><span class="tag s' + o.score + '">' + TYPE[o.score] + ' ' + o.score + '</span>' +
      esc(o.text) + '</div><div>' + esc(o.feedback) + '</div></div>').join('');
    $('fbAll').parentElement.open = false;
    const last = ri === DATA.rounds.length - 1;
    const stationEnds = last || stationOfRound(ri + 1) !== stationOfRound(ri);
    $('nextBtn').textContent = last ? '看結局' : stationEnds ? '完成本站' : '下一回合';
    $('feedback').hidden = false;
    setTimeout(() => $('feedback').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  function next() {
    const ri = nextRound();
    if (ri >= DATA.rounds.length) { closeDialog(); finish(); return; }
    if (stationOfRound(ri) === stationOfRound(ri - 1)) { openRound(ri); return; }
    closeDialog();
    const done = DATA.stations[stationOfRound(ri - 1)];
    toast('✓ ' + done.name + '站完成！前往下一站');
  }

  function closeDialog() {
    $('dialog').hidden = true;
    map.cv.removeAttribute('aria-hidden');
    busy = false;
    renderHud();
  }

  /* ---------- 全部題目與答案（結局後查閱／下載） ---------- */
  // 每回合列出情境台詞與三個選項（依分數由高到低），標示同學自己的選擇與回饋出處
  function answerSheetHtml() {
    return DATA.rounds.map((r, i) => {
      const st = DATA.stations[stationOfRound(i)];
      const mine = state && state.answers[i];
      const opts = r.options.map((o, oi) => ({ o, oi })).sort((a, b) => b.o.score - a.o.score).map(({ o, oi }) => {
        const picked = !!mine && mine.opt === oi;
        return '<li class="as-opt' + (picked ? ' picked' : '') + '"><div class="as-head"><span class="tag s' + o.score + '">' +
          TYPE[o.score] + ' ' + o.score + ' 分</span>' + (picked ? '<span class="mine">你的選擇</span>' : '') + '</div>' +
          '<div class="as-text">' + esc(o.text) + '</div><div class="as-fb">' + esc(o.feedback) + '</div></li>';
      }).join('');
      return '<section class="as-round"><h3>第 ' + r.round + ' 回合｜' + esc(st.name) + ' ' + esc(st.en) + '｜' + esc(r.role) + '</h3>' +
        '<p class="as-line">' + esc(r.line) + '</p><ol class="as-opts">' + opts + '</ol></section>';
    }).join('');
  }

  function toggleAllAnswers() {
    const box = $('allAnswers'), btn = $('reviewAllBtn');
    const open = box.hidden;
    if (open && !box.innerHTML) box.innerHTML = answerSheetHtml();
    box.hidden = !open;
    btn.textContent = open ? '收合題目＆答案' : '查閱所有題目＆答案';
    btn.setAttribute('aria-expanded', String(open));
    if (open) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 產生可離線開啟的 HTML 檔（手機與電腦都能直接用瀏覽器打開）
  function downloadAnswers() {
    const sc = total();
    const end = DATA.endings.find((e) => sc >= e.min && sc <= e.max) || DATA.endings[DATA.endings.length - 1];
    const d = new Date();
    const date = d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
    const css = 'body{margin:0;background:#F6F1E7;color:#1B2B40;font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;line-height:1.65}' +
      'main{max-width:760px;margin:0 auto;padding:20px 16px 40px}h1{color:#1F3A5F;font-size:24px;margin:4px 0}' +
      '.k{color:#2A9D8F;font-weight:700;font-size:13px}.meta{background:#fff;border-radius:12px;padding:10px 14px;margin:12px 0 18px;font-size:15px}' +
      '.as-round{background:#fff;border-radius:14px;padding:14px 16px;margin:0 0 14px}.as-round h3{margin:0 0 6px;font-size:16px;color:#1F3A5F}' +
      '.as-line{margin:0 0 10px;font-weight:700}.as-opts{list-style:none;margin:0;padding:0}' +
      '.as-opt{border:1px solid #E2DACB;border-radius:10px;padding:8px 12px;margin-top:8px}.as-opt.picked{border:2px solid #1F3A5F}' +
      '.as-head{display:flex;gap:8px;align-items:center;margin-bottom:2px}.tag{font-size:12px;font-weight:900;color:#fff;padding:0 8px;border-radius:999px}' +
      '.tag.s10{background:#2A9D8F}.tag.s5{background:#D98A3D}.tag.s0{background:#C2553F}.mine{font-size:12px;font-weight:900;color:#1F3A5F}' +
      '.as-text{font-weight:700}.as-fb{color:#5B6676;font-size:14px}.refs{font-size:12px;color:#5B6676;word-break:break-word}' +
      '.credit{text-align:center;font-size:12px;color:#5B6676;margin-top:20px}';
    const doc = '<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>辦訓旅程｜題目與答案</title><style>' + css + '</style></head><body><main>' +
      '<div class="k">B組報告 · LTEM 互動遊戲</div><h1>' + esc(DATA.title) + '｜題目與答案</h1>' +
      '<div class="meta">暱稱：' + esc(state.nick) + '｜總分：' + sc + ' / 100｜' + esc(end.title) + '｜' + date + '<br>' +
      '每回合選項依分數排列：最佳 10 分、部分正確 5 分、常見陷阱 0 分；外框加粗的是你的選擇。</div>' +
      answerSheetHtml() +
      '<div class="refs"><b>引用來源</b>' + DATA.references.map((t) => '<p>' + esc(t) + '</p>').join('') + '<p>' + esc(DATA.note) + '</p></div>' +
      '<p class="credit">Create By Alex Wu</p></main></body></html>';
    const name = '辦訓旅程_題目與答案_' + String(state.nick).replace(/[\\/:*?"<>|\s]/g, '') + '.html';
    try {
      const url = URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('已開始下載；沒有反應時請改按「查閱所有題目＆答案」');
    } catch (e) {
      toast('這個瀏覽器無法下載，已為你展開所有題目＆答案');
      if ($('allAnswers').hidden) toggleAllAnswers();
    }
  }

  /* ---------- 結局 ---------- */
  function finish() {
    state.finished = true;
    if (!state.endAt) state.endAt = Date.now();
    save();
    const sc = total();
    const end = DATA.endings.find((e) => sc >= e.min && sc <= e.max) || DATA.endings[DATA.endings.length - 1];
    $('endScore').textContent = sc;
    $('endTitle').textContent = end.title;
    $('endText').textContent = end.text;

    // 最常卡住的構面：失分最多（同分取較前面）
    const lost = DATA.stations.map((s) => s.rounds.reduce((acc, n) => acc + (10 - state.answers[n - 1].score), 0));
    const maxLost = Math.max.apply(null, lost);
    if (maxLost === 0) {
      $('weakStation').textContent = '沒有卡關，十回合全部最佳！';
    } else {
      const names = DATA.stations.filter((s, i) => lost[i] === maxLost).map((s) => s.name + ' ' + s.en);
      $('weakStation').textContent = names.join('、') + '（失 ' + maxLost + ' 分）';
    }
    const wrong = DATA.rounds.map((r, i) => ({ r, a: state.answers[i] })).filter((x) => x.a.score < 10);
    $('reviewList').innerHTML = wrong.length ? wrong.map((x) => {
      const best = x.r.options.find((o) => o.score === 10);
      const st = DATA.stations[stationOfRound(x.r.round - 1)];
      return '<div class="review"><div class="r">第 ' + x.r.round + ' 回合｜' + esc(st.name) + '｜' + esc(x.r.role) +
        '（你得 ' + x.a.score + ' 分）</div><div><b>正解：</b>' + esc(best.text) + '</div><div>' + esc(best.feedback) + '</div></div>';
    }).join('') : '';
    $('refs').innerHTML = DATA.references.map((t) => '<p>' + esc(t) + '</p>').join('');
    $('allAnswers').hidden = true;
    $('allAnswers').innerHTML = '';
    $('reviewAllBtn').textContent = '查閱所有題目＆答案';
    $('reviewAllBtn').setAttribute('aria-expanded', 'false');
    $('end').hidden = false;
    $('end').scrollTop = 0;
    renderHud();
    submit();
  }

  /* ---------- 成績上傳 ---------- */
  function setUpload(cls, msg) {
    const u = $('uploadStatus');
    u.className = 'upload ' + cls;
    u.textContent = msg;
  }

  function payload() {
    return {
      nickname: state.nick,
      total: total(),
      durationSec: Math.round(((state.endAt || Date.now()) - state.startAt) / 1000),
      deviceId: deviceId(),
      clientTime: new Date().toISOString(),
      answers: state.answers.map((a, i) => ({
        round: i + 1,
        choice: TYPE[a.score],
        text: DATA.rounds[i].options[a.opt].text,
        score: a.score
      }))
    };
  }

  function recentlySent(nick) {
    try {
      const s = JSON.parse(localStorage.getItem('ltem_sent') || 'null');
      return s && s.nick === nick && Date.now() - s.at < 60000;
    } catch (e) { return false; }
  }
  function markSent(nick) {
    try { localStorage.setItem('ltem_sent', JSON.stringify({ nick, at: Date.now() })); } catch (e) { /* 忽略 */ }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function post(url, body) {
    const ctrl = window.AbortController ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 10000) : null;
    try {
      // text/plain + no-cors：不觸發 CORS 預檢，Apps Script 照常收到資料
      await fetch(url, {
        method: 'POST', mode: 'no-cors', cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body, signal: ctrl ? ctrl.signal : undefined
      });
    } finally { if (timer) clearTimeout(timer); }
  }

  async function submit() {
    const failMsg = '成績未上傳，請截圖給講者（暱稱：' + state.nick + '，總分 ' + total() + '）';
    if (state.uploaded) { setUpload('ok', '✓ 成績已上傳'); return; }
    if (recentlySent(state.nick)) { state.uploaded = true; save(); setUpload('ok', '✓ 成績已上傳（1 分鐘內不重複送出）'); return; }
    const url = (CFG.APPS_SCRIPT_URL || '').trim();
    if (!url) { setUpload('fail', failMsg + '｜尚未設定後台網址'); return; }
    setUpload('', '成績上傳中…');
    const body = JSON.stringify(payload());
    for (let i = 0; i < 3; i++) {                     // 1 次 + 重試 2 次
      try {
        await post(url, body);
        state.uploaded = true; save(); markSent(state.nick);
        setUpload('ok', '✓ 成績已上傳');
        return;
      } catch (e) {
        if (i < 2) await sleep(1000 * (i + 1));
      }
    }
    setUpload('fail', failMsg);
  }

  /* ---------- 開始／續玩 ---------- */
  function begin(nick) {
    state = { nick, startAt: Date.now(), answers: [], finished: false, uploaded: false };
    save();
    $('start').hidden = true;
    map.placePlayer(-1);
    renderHud();
  }

  function resume() {
    if (!state || !state.nick) return;
    $('start').hidden = true;
    const ri = nextRound();
    map.placePlayer(ri > 0 ? stationOfRound(ri - 1) : -1);
    renderHud();
    if (state.finished || ri >= DATA.rounds.length) finish();
  }

  function showStart() {
    const saved = load();
    $('end').hidden = true;
    $('dialog').hidden = true;
    $('start').hidden = false;
    busy = false;
    const valid = saved && Array.isArray(saved.answers) && saved.answers.length <= DATA.rounds.length &&
      saved.answers.every((a, i) => a && DATA.rounds[i].options[a.opt] && DATA.rounds[i].options[a.opt].score === a.score);
    if (valid && saved.answers.length > 0) {
      state = saved;
      $('startForm').hidden = true;
      $('resumeBox').hidden = false;
      $('resumeBtn').textContent = saved.finished ? '查看我的結果（' + saved.nick + '）'
        : '繼續上次進度（' + saved.nick + '，已完成 ' + saved.answers.length + ' 回合）';
    } else {
      if (saved) clearSave();
      state = { nick: '', startAt: Date.now(), answers: [], finished: false };
      $('startForm').hidden = false;
      $('resumeBox').hidden = true;
    }
    map.placePlayer(-1);
    renderHud();
  }

  /* ---------- 初始化 ---------- */
  async function init() {
    try {
      const res = await fetch('rounds.json', { cache: 'no-cache' });
      DATA = await res.json();
    } catch (e) {
      document.body.innerHTML = '<p style="color:#fff;padding:20px">題目載入失敗，請重新整理頁面。</p>';
      return;
    }
    $('gameTitle').textContent = DATA.title;
    $('gameSub').textContent = DATA.subtitle;
    $('gameNote').textContent = DATA.note;

    if (CH) {
      const ids = ['player'];
      DATA.rounds.forEach((r) => { const id = charOf(r); if (id && ids.indexOf(id) < 0) ids.push(id); });
      CH.preload(ids);
    }
    map = new window.IsoMap($('map'));
    const ro = window.ResizeObserver ? new ResizeObserver(() => map.resize()) : null;
    if (ro) ro.observe($('stage')); else window.addEventListener('resize', () => map.resize());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => map.resize());

    $('map').addEventListener('click', (ev) => {
      const r = $('map').getBoundingClientRect();
      const i = map.hit(ev.clientX - r.left, ev.clientY - r.top);
      if (i >= 0) goStation(i);
    });
    $('goBtn').addEventListener('click', () => goStation(currentStation()));
    $('nextBtn').addEventListener('click', next);
    $('startForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const nick = $('nick').value.trim().slice(0, 12);
      if (!nick) { $('nick').focus(); return; }
      $('nick').blur();
      begin(nick);
    });
    $('resumeBtn').addEventListener('click', resume);
    $('restartBtn').addEventListener('click', () => { clearSave(); showStart(); });
    $('downloadBtn').addEventListener('click', downloadAnswers);
    $('reviewAllBtn').addEventListener('click', toggleAllAnswers);
    $('againBtn').addEventListener('click', () => {
      const nick = state.nick;
      clearSave();
      showStart();
      $('nick').value = nick;
    });

    showStart();
  }

  init();
})();
