# 辦訓旅程：LTEM 互動遊戲

期中報告結尾的現場互動：同學掃 QR Code，用手機玩 10 回合 PDDRO 情境決策，成績寫進 Google 試算表。

- 純 HTML／CSS／JavaScript，免建置、免安裝、免登入
- 手機直式優先（360–430px），電腦開啟時以手機比例置中
- 等角 2.5D 辦公室地圖全部以程式繪製，無外部圖庫
- 題目在 `rounds.json`，改題目不用動程式

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html` `style.css` `game.js` `iso.js` | 遊戲本體 |
| `rounds.json` | 10 回合內容、站點、結局稱號、引用來源 |
| `config.js` | **唯一需要改的設定**：Apps Script 網址、遊戲網址 |
| `host.html` | 講者投影頁：大 QR Code、網址、10 分鐘倒數、下載 QR PNG |
| `apps-script/Code.gs` | Google 試算表後台程式（不會被網頁使用，可留在 repo） |

---

## 步驟 1：建立成績後台（Google 試算表 + Apps Script）

1. 用你的 Google 帳號新增一份試算表，例如命名「辦訓旅程成績」。
2. 選單 **擴充功能 → Apps Script**，刪掉預設內容，貼上 `apps-script/Code.gs` 全部內容，按儲存。
3. 上方函式選單選 **setup**，按 **執行**。第一次會要求授權：選你的帳號 → 進階 → 前往（不安全）→ 允許。
   執行後試算表會出現「成績」與「全班統計」兩個工作表。
4. 右上 **部署 → 新增部署作業**：
   - 類型：**網頁應用程式**
   - 執行身分：**我**
   - 誰可以存取：**任何人**（同學不需登入；他們只能送資料，看不到試算表）
5. 按部署，複製「網頁應用程式網址」（結尾是 `/exec`）。
6. 打開 `config.js`，貼到 `APPS_SCRIPT_URL: '這裡'`。

> 隱私：試算表本身維持只有你能開，不要分享。只收暱稱與作答，不收姓名學號。
> 之後若修改 Code.gs，要用 **部署 → 管理部署作業 → 編輯 → 版本：新版本** 重新部署，網址不變。

## 步驟 2：放上 GitHub Pages

1. 登入 GitHub，按右上 **+ → New repository**，名稱例如 `ltem-game`，選 **Public**，建立。
2. 在新 repo 頁面按 **uploading an existing file**，把本資料夾內所有檔案（含 `apps-script` 資料夾）拖進去，按 **Commit changes**。
3. repo 的 **Settings → Pages**：Source 選 **Deploy from a branch**，Branch 選 **main**、資料夾 **/(root)**，Save。
4. 約 1 分鐘後，網址會是 `https://你的帳號.github.io/ltem-game/`。
5. （可選）把這個網址填到 `config.js` 的 `GAME_URL`，重新上傳 `config.js`。

## 步驟 3：QR Code

- 開 `https://你的帳號.github.io/ltem-game/host.html`
  - 投影這一頁就是活動頁（QR Code＋網址＋倒數計時）
  - 按「下載 QR Code PNG」取得 `qr.png`，放進簡報 p39 之後的活動頁
- 也可以在本機打開 `host.html?url=遊戲網址` 產生 QR。

## 步驟 4：上台前一天測試

用 2–3 支手機（至少一支 iPhone Safari、一支 Android Chrome）：

1. 掃 QR Code → 輸入暱稱 → 玩完 10 回合
2. 結局畫面應顯示「✓ 成績已上傳」
3. 打開試算表確認「成績」有新的一列、「全班統計」有數字
4. 測完把「成績」工作表第 2 列以下的測試資料刪掉（表頭留著）

## 現場流程

1. 投影 `host.html`，按「開始計時」，給 10 分鐘
2. 時間到，切到試算表「全班統計」
3. 答對率低於 50% 的回合會標紅，挑最低的 1–2 回合帶大家討論

## 改題目

直接改 `rounds.json`（注意 JSON 格式：字串用雙引號、最後一項後面不加逗號），重新上傳即可。
每回合 3 個選項的分數必須是 10、5、0 各一個。

## 本機測試

```bash
python -m http.server 8765
```

瀏覽器開 `http://localhost:8765/`（直接雙擊 index.html 會因瀏覽器安全限制讀不到 rounds.json）。
未設定 `APPS_SCRIPT_URL` 時，結局會顯示「成績未上傳，請截圖給講者」，這是預期行為。

## 驗收清單（規格書第八節）

- [x] 10 回合可完整走完，總分正確（全最佳 100、全陷阱 0、混合 70／75 皆已驗證）
- [x] 選項每次隨機排序；每個選項都有回饋與出處，可展開查看
- [x] 手機尺寸（360×640、375×812）與電腦瀏覽器版面正常
- [x] 中途重新整理可繼續或重新開始，分數由作答紀錄重算不會錯亂
- [x] 網路失敗重試 2 次後提示「成績未上傳，請截圖給講者」
- [x] 同裝置同暱稱 1 分鐘內不重複寫入（前端＋後台雙重檢查）
- [x] 無外部圖庫素材（只載入 Google Fonts 的 Noto Sans TC；host.html 另載入 cdnjs 的 qrcodejs 1.0.0）
- [ ] 成績實際寫入試算表 ← 需完成步驟 1 後用手機實測
- [ ] iOS Safari、Android Chrome 實機測試 ← 需完成步驟 2 後實測
