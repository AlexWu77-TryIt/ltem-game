# 辦訓旅程：LTEM 互動遊戲

期中報告結尾的現場互動：同學掃 QR Code，用手機玩 10 回合 PDDRO 情境決策（規格書第 2 版：暖身題 3＋兩難題 7，每題 10／6／3 分）。

不使用後台。滿分 100 分的同學舉手、把結局畫面給講者看，依畫面上的「完成時間」先後：前 3 位各得老師卡片 2 張，第 4–10 位各 1 張（最多 10 位），每張加 1 分。

- 純 HTML／CSS／JavaScript，免建置、免安裝、免登入
- 手機直式優先（360–430px），電腦開啟時以手機比例置中
- 等角 2.5D 辦公室地圖全部以程式繪製，無外部圖庫
- 題目在 `rounds.json`，改題目不用動程式

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html` `style.css` `game.js` `iso.js` | 遊戲本體 |
| `rounds.json` | 10 回合內容、站點、結局稱號、引用來源 |
| `config.js` | 遊戲公開網址（host.html 產生 QR 用） |
| `host.html` | 講者投影頁：大 QR Code、網址、10 分鐘倒數、下載 QR PNG |

---

## 步驟 1：放上 GitHub Pages

1. 登入 GitHub，按右上 **+ → New repository**，名稱例如 `ltem-game`，選 **Public**，建立。
2. 在新 repo 頁面按 **uploading an existing file**，把本資料夾內所有檔案拖進去，按 **Commit changes**。
3. repo 的 **Settings → Pages**：Source 選 **Deploy from a branch**，Branch 選 **main**、資料夾 **/(root)**，Save。
4. 約 1 分鐘後，網址會是 `https://你的帳號.github.io/ltem-game/`。
5. （可選）把這個網址填到 `config.js` 的 `GAME_URL`，重新上傳 `config.js`。

## 步驟 2：QR Code

- 開 `https://你的帳號.github.io/ltem-game/host.html`
  - 投影這一頁就是活動頁（QR Code＋網址＋倒數計時）
  - 按「下載 QR Code PNG」取得 `qr.png`，放進簡報 p39 之後的活動頁
- 也可以在本機打開 `host.html?url=遊戲網址` 產生 QR。

## 步驟 3：上台前一天測試

用 2–3 支手機（至少一支 iPhone Safari、一支 Android Chrome）：

1. 掃 QR Code → 輸入暱稱 → 玩完 10 回合
2. 全選最佳答案，結局應出現金框「🏆 滿分！」卡片，顯示暱稱、完成時間、用時、本機第幾次作答，以及每秒跳動的「現在時間」

## 現場流程

1. 投影 `host.html`，按「開始計時」，給 10 分鐘
2. 滿分同學舉手出示結局畫面；依「完成時間」排序發卡（「現在時間」會跳動，可分辨是即時畫面而非轉傳截圖）
3. 時間到，挑 1–2 個兩難題帶大家討論

## 改題目

直接改 `rounds.json`（注意 JSON 格式：字串用雙引號、最後一項後面不加逗號），重新上傳即可。
每回合 3 個選項的分數必須是 10、6、3 各一個；`type` 為「暖身題」或「兩難題」，`dilemma` 為兩難題括號內的取捨說明。

## 本機測試

```bash
python -m http.server 8765
```

瀏覽器開 `http://localhost:8765/`（直接雙擊 index.html 會因瀏覽器安全限制讀不到 rounds.json）。

## 驗收清單（規格書第 2 版第八節；成績後台已依需求取消）

- [x] 10 回合可完整走完，總分正確（每題 10／6／3，滿分 100、最低 30）
- [x] 選項每次隨機排序；每個選項都有回饋與出處，可展開查看
- [x] 手機尺寸與電腦瀏覽器版面正常
- [x] 中途重新整理可繼續或重新開始，分數由作答紀錄重算不會錯亂
- [x] 無外部圖庫素材（只載入 Google Fonts 的 Noto Sans TC；host.html 另載入 cdnjs 的 qrcodejs 1.0.0）
- [ ] iOS Safari、Android Chrome 實機測試
