/**
 * 辦訓旅程：成績後台（Google Apps Script）
 * 1. 在試算表：擴充功能 → Apps Script，貼上本檔全部內容並儲存
 * 2. 先執行一次 setup()（會要求授權），建立「成績」與「全班統計」工作表
 * 3. 部署 → 新增部署作業 → 類型：網頁應用程式
 *    執行身分：我；誰可以存取：任何人 → 複製結尾為 /exec 的網址
 */

var SHEET = '成績';
var STATS = '全班統計';
var ROUNDS = 10;

function headers_() {
  var h = ['時間戳記', '暱稱', '總分', '耗時（秒）'];
  for (var i = 1; i <= ROUNDS; i++) { h.push('R' + i + ' 選項', 'R' + i + ' 得分'); }
  h.push('R1-R10 選項原文', '裝置ID', '裝置時間');
  return h;
}

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  var h = headers_();
  sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
  sh.setFrozenRows(1);

  var st = ss.getSheetByName(STATS) || ss.insertSheet(STATS);
  st.clear();
  var rows = [
    ['項目', '數值'],
    ['參加人數', '=COUNTA(' + SHEET + '!B2:B)'],
    ['平均分數', '=IFERROR(ROUND(AVERAGE(' + SHEET + '!C2:C),1),0)'],
    ['最高分', '=IFERROR(MAX(' + SHEET + '!C2:C),0)'],
    ['最低分', '=IFERROR(MIN(' + SHEET + '!C2:C),0)'],
    ['', ''],
    ['回合', '答對率（選最佳）', '部分正確比例', '常見陷阱比例', '平均得分']
  ];
  st.getRange(1, 1, 5, 2).setValues(rows.slice(0, 5));
  st.getRange(7, 1, 1, 5).setValues([rows[6]]);
  for (var i = 1; i <= ROUNDS; i++) {
    var col = columnLetter_(4 + i * 2); // R1 得分在 F 欄
    var rng = SHEET + '!' + col + '2:' + col;
    st.getRange(7 + i, 1, 1, 5).setFormulas([[
      '="第 ' + i + ' 回合"',
      '=IFERROR(COUNTIF(' + rng + ',10)/COUNT(' + rng + '),0)',
      '=IFERROR(COUNTIF(' + rng + ',5)/COUNT(' + rng + '),0)',
      '=IFERROR(COUNTIF(' + rng + ',0)/COUNT(' + rng + '),0)',
      '=IFERROR(ROUND(AVERAGE(' + rng + '),1),0)'
    ]]);
  }
  st.getRange(8, 2, ROUNDS, 3).setNumberFormat('0%');
  st.getRange(1, 1, 1, 2).setFontWeight('bold');
  st.getRange(7, 1, 1, 5).setFontWeight('bold');
  st.setColumnWidth(1, 120);
  st.setColumnWidths(2, 4, 150);
  // 答對率加條件格式：最低的回合一眼可見
  var rule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0.5).setBackground('#FBE7E2').setFontColor('#9B3B27')
    .setRanges([st.getRange(8, 2, ROUNDS, 1)]).build();
  st.setConditionalFormatRules([rule]);
}

function columnLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var d = JSON.parse(e.postData.contents);
    var nick = String(d.nickname || '').slice(0, 20);
    var device = String(d.deviceId || '').slice(0, 40);
    var answers = Array.isArray(d.answers) ? d.answers : [];
    if (!nick || answers.length !== ROUNDS) return json_({ ok: false, error: 'bad payload' });

    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET);
    if (!sh) { setup(); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET); }
    var now = new Date();
    var idCol = headers_().length - 1; // 裝置ID 欄（1-based）

    // 防重複：同一裝置 + 同一暱稱，1 分鐘內只保留第一筆
    var last = sh.getLastRow();
    if (last > 1) {
      var start = Math.max(2, last - 49);
      var recent = sh.getRange(start, 1, last - start + 1, idCol).getValues();
      for (var r = 0; r < recent.length; r++) {
        var row = recent[r];
        if (row[1] === nick && row[idCol - 1] === device && now - new Date(row[0]) < 60000) {
          return json_({ ok: true, duplicate: true });
        }
      }
    }

    // 分數一律在後台重算，避免前端資料錯亂
    var totalScore = 0;
    var out = [now, nick, 0, Number(d.durationSec) || ''];
    var texts = [];
    for (var i = 0; i < ROUNDS; i++) {
      var a = answers[i] || {};
      var s = [0, 5, 10].indexOf(Number(a.score)) >= 0 ? Number(a.score) : 0;
      totalScore += s;
      out.push(String(a.choice || ''), s);
      texts.push('R' + (i + 1) + '：' + String(a.text || '').slice(0, 80));
    }
    out[2] = totalScore;
    out.push(texts.join('\n'), device, String(d.clientTime || ''));
    sh.appendRow(out);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, service: '辦訓旅程成績後台' });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
