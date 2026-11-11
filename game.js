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
      id: s.id, name: s.name, state: i < cs ? 'done' : i === cs ? 'active' : 'locked'
    })));
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
    map.walkTo(idx, () => openRound(nextRound()));
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
    $('avatar').style.background = ['#1F3A5F', '#2A9D8F', '#4C6B91', '#1D6E64', '#172C47'][si];
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
    head.textContent = (opt.score === 10 ? '最佳選擇！' : opt.score === 5 ? '部分正確' : '常見陷阱') + '　+' + opt.score + ' 分';
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
