# 部署成網站，用手機 / 平板在現場使用

這個網頁是**純前端**：沒有後端、不需要資料庫，所有計算都在手機的瀏覽器裡完成。
部署到免費的靜態網站服務後，手機打開網址、「加入主畫面」，之後在客戶機房**沒有網路也能開**。

## 資料存在哪裡？（一定要看）

- 專案只存在**這支手機的這個瀏覽器**裡，不會上傳到任何地方。
- 換手機、換瀏覽器、清除瀏覽器資料，都會看不到。
- **唯一的備份是匯出的檔案**：專案在「Projects」頁「匯出專案檔」（`.netlab.json`），維修工單在「Maintenance」頁「匯出工單」（`.netlab-job.json`）。重要的案子做完請匯出，存到「檔案」App、雲端硬碟或傳給自己。
- 在電腦上準備好的專案，要到手機上用：電腦「匯出專案檔」→ 傳到手機（AirDrop、雲端硬碟、Email）→ 手機「匯入專案檔」。
- **iPhone / iPad 一定要「加入主畫面」再用**：一般 Safari 分頁的網站資料，太久沒開可能會被系統清掉；加到主畫面的 App 不會。

## 方法 A：GitHub Pages（已經設定好）

`.github/workflows/deploy-pages.yml` 會在每次推到 `main` 時自動測試、建置、部署。

1. 在 GitHub 建立一個 repo，把這個專案推上去。
2. repo → **Settings → Pages → Source** 選 **GitHub Actions**。
3. 到 **Actions** 分頁等「Deploy to GitHub Pages」跑完（約 1～2 分鐘）。
4. 網址是 `https://<你的帳號>.github.io/<repo 名稱>/`；repo 名稱取 `<你的帳號>.github.io` 的話，網址就是 `https://<你的帳號>.github.io/`。

> 免費帳號的 GitHub Pages 需要 **public repo**（程式碼公開）。專案資料不在程式碼裡，所以客戶資料不會外流；
> 但如果程式碼本身不想公開，請用方法 B。

## 方法 B：Cloudflare Pages（repo 可以是 private）

1. 登入 Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**，選這個 repo。
2. 建置設定：
   - Framework preset：`Vue` 或 `None`
   - Build command：`npm run build`
   - Build output directory：`dist`
   - 環境變數：`NODE_VERSION` = `22`
3. 儲存後自動部署，網址是 `https://<名稱>.pages.dev`。之後推到 `main` 會自動更新。

Cloudflare Pages 會自動把找不到的路徑導回網頁，不需要額外設定。

## 手機安裝（加入主畫面）

**iPhone / iPad（Safari）**
1. 用 Safari 打開網址（一定要 Safari，其他瀏覽器在 iOS 不能安裝）。
2. 按下方「分享」按鈕 → **加入主畫面**。
3. 從主畫面的 Netlab 圖示打開。

**Android（Chrome）**
1. 用 Chrome 打開網址。
2. 右上角「⋮」→ **安裝應用程式**（或「加到主畫面」）。

### 確認離線可以用

裝好後**先在有網路的地方完整打開一次**（讓它下載所有檔案），然後開飛航模式，從主畫面打開，
點幾個頁面（例如 Subnet Calculator、機櫃圖）確認都能開。

## 更新版本

推新版程式到 `main` 後，網站會自動部署。手機上的 App 下次**有網路時打開**會在背景下載新版，
關掉再開一次就是新版。專案資料不受更新影響。

## 自己建置（不用 GitHub / Cloudflare）

```bash
npm ci
npm run build                     # 網站在根目錄（/）
BASE_PATH=/netlab/ npm run build  # 網站在子路徑（/netlab/）
```

把 `dist/` 整個資料夾放到任何靜態網站伺服器即可。伺服器需要：
- 找不到的路徑回傳 `index.html`（SPA fallback），否則直接開 `/project/rack` 或重新整理會 404。
- 使用 `https://`，否則手機不能安裝、也不能離線使用。
