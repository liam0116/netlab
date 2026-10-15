# 開發說明（給 AI / 新進開發者）

開始改程式前先讀這份。功能清單與啟動方式在 [README.md](README.md)；部署在 [docs/DEPLOY.md](docs/DEPLOY.md)、Docker 在 [docs/DOCKER.md](docs/DOCKER.md)。

## 這是什麼、給誰用
- 使用者是系統整合商（敦陽科技）的設備工程師：到客戶機房安裝伺服器 / 儲存、做硬體維修。
- 主要在**手機 / 平板**上用，機房常常**沒有網路**。
- 用途：在辦公室把專案準備好，到現場照著做，最後匯出 PDF / 檔案交給客戶。
- 同時要讓**完全新手**看得懂：用白話繁體中文說明，專有名詞保留工作上用的英文（VLAN、BMC、DIMM…）。

## 不能違反的原則
1. **沒有後端**。純前端 PWA，部署成靜態網站，所有功能都要能離線。不要加 API、伺服器、資料庫、外部服務、CDN。瀏覽器做不到的事（ping、測 Port），就產生指令讓使用者在客戶伺服器上執行。
2. **客戶資料只留在這台裝置**：存 localStorage，用匯出檔備份，不上傳、不送到任何網址，也不存帳號密碼。
3. **三種資料彼此分開**（使用者明確要求）：
   - **Project**（`/project/*`）：一個客戶的新建置案子。底下所有頁面共用 `useProjectStore`，彼此連動，存成 `.netlab.json`。
   - **Service**（`/service/*`）：已上線機器的維修工單，用 `useMaintenanceStore`，存成 `.netlab-job.json`。不可以放進專案檔。
   - **Learn / Tools / Lab / Reference**：獨立工具，各自保存，不會改到專案。例外是 IP Planner 可以「套用到目前專案」。
4. **最常用的放最前面**：主要按鈕放第一個；選項依業界常用程度排序，並補上常見的替代選項。
5. **空狀態要引導**：沒資料時說明下一步並給按鈕，不要顯示範例資料、`—`，或紅色錯誤。
6. **破壞性操作要按兩次**（`useConfirm`），不要用 `alert` / `confirm` 對話框。
7. **印出來的東西不能被分頁切開**：機櫃、圖表、表格列、簽名區都要處理。印給客戶的紙本，要留手寫欄位。

## 技術
Vue 3（`<script setup>` + TS）、Pinia（setup store）、vue-router、vue-i18n（Composition API）、Tailwind 4、Vite、vite-plugin-pwa、Vitest、vue-tsc、lucide 圖示。Node 22。

## src 結構與放置規則
```
src/
├── views/          頁面，一頁一個 *View.vue。只放畫面與互動，計算交給 utils
├── components/     common（通用）、project（專案與工單的圖、列印版）、network、tutorial、learn、lab、reference
├── composables/    跨頁共用邏輯：useConfirm、useMaintenanceText（工單句子的翻譯）…
├── stores/         Pinia：project、maintenance、planner（專案 / 工具兩個實例）、topology、settings、progress
├── utils/          純函式，不碰 DOM、不含語言文字；每個檔案都有 *.test.ts
├── types/          資料型別（project.ts 是專案檔與工單的格式）
├── data/           導覽（navigation.ts）、範例專案 / 工單、靜態資料
├── i18n/           locales/（UI 文字）、content/（教學、指令、流程圖範本等長內容）
└── router/
```
- **新的計算或檢查**：寫在 `utils/<主題>.ts`，加上 `utils/<主題>.test.ts`。錯誤回傳代碼（例如 `'count-mismatch'`）加參數，由 UI 用 i18n 翻譯。
- **新頁面**：
  - 在 `views/` 建頁面，`router/index.ts` 加路由，`data/navigation.ts` 加側邊欄項目。
  - `zh-TW.ts` / `en.ts` 的 `nav.items.<id>` 加名稱與說明（name、short、what、when）。
- **改資料格式**（`types/project.ts`）：
  - `utils/projectFile.ts` 或 `utils/maintenanceFile.ts` 的解析要同步改。匯入檔一律視為不可信：每個欄位檢查型別、限制長度、給預設值。
  - **舊檔案一定要能匯入**，並加測試。
- **元件慣例**：所有輸入欄位都要有 `<label for>` 或 `aria-label`，按鈕要有文字或 `aria-label`。

## 資料保存（localStorage key）
| Key | 內容 |
| --- | --- |
| `netlab.project` | 目前專案（不含 IP 規劃） |
| `netlab.planner` | 目前專案的 IP 規劃 |
| `netlab.projects` | 專案庫 |
| `netlab.projectOpen` | 目前專案從哪一筆專案庫打開 |
| `netlab.maintenance` | 維修工單 |
| `netlab.plannerTool` | Tools → IP Planner 的試算 |
| `netlab.topology` | Lab 拓撲 |
| `netlab.locale` / `netlab.theme` / `netlab.mode` / `netlab.completedChapters` | 設定與學習進度 |

- **不要改 key 名稱**，使用者的資料會不見。
- **格式變更**：在 store 載入時做一次性轉換。例如 v1.3.0 存在專案裡的工單，會在 `main.ts` 啟動時搬到 `netlab.maintenance`。

## i18n
- `zh-TW.ts` 是主要語系，也是型別來源；`en.ts` 必須有完全相同的 key（`i18n.test.ts` 會檢查）。
- 新增的文字放在 `<locale>.phase*.ts`，由主檔合併：phase5 是專案相關，phase6 是維修工單。
- 訊息裡不能有 `|`、`@`（vue-i18n 特殊字元）；需要這些字元的長內容放 `i18n/content/*.ts`。
- `utils/` 裡不放任何語言文字。

## 畫面與列印
- **顏色**：用 CSS 變數 token（`bg`、`fg`、`muted`、`accent`、`ok`、`warn`、`err` 與對應的 `-soft`），不要寫死色碼，深色與淺色主題都要能看。
- **列印**：要印的區塊加 `.paper` class（強制淺色），`print:hidden` 用來隱藏控制項。
- **分頁**：
  - 不能被切開的區塊加 `break-inside: avoid`。
  - 圖用 inline-block，在 `@media print` 設 `max-height` 縮到一頁內。
  - 每張工單用 `break-before: page` 另起一頁。
- **匯出 SVG / PNG**：用 `utils/svgExport.ts`。圖要用 inline style 加 CSS 變數，匯出才會正確。
- **手機寬度（390px）**：不能出現橫向捲動。

## 驗證流程（每次改完都要做，不能只跑單元測試）
1. `npx vitest run`、`npx vue-tsc --noEmit -p tsconfig.app.json`。
2. 測試環境：`docker compose -f docker-compose.test.yml up -d --build`，開 http://localhost:8081。
   - 這是 PWA，測試前先清掉 service worker 和快取，不然會看到舊版。
3. **用瀏覽器實際點過**：改到的每個按鈕、輸入錯誤值、空資料、手機寬度。
4. **有列印的功能**要實際產生 PDF 檢查分頁：用 headless Chrome 的 `Page.printToPDF`，再轉成圖片來看。
5. 正式環境：`docker compose up -d --build`（:8080）。測試環境用完要關掉。

## 版本與部署
- 版本號在 `package.json`（側邊欄左下角會顯示），每次發布要加版號，並同步改 README 的「目前版本」與版本紀錄。
- 推到 `main` 後，GitHub Actions 會自動測試、建置，並部署到 https://liam0116.github.io/netlab/（`BASE_PATH=/netlab/`）。
- 使用者要求時才 commit / push。

## 與使用者溝通
- 用繁體中文，技術名詞保留英文。
- 回報時要寫清楚哪些有實際驗證、哪些沒有，發現的問題也要說。
- 範例資料用常見的企業架構：三層式 vSphere + FC SAN（`data/demoProject.ts`）、記憶體調整工單（`data/demoMaintenance.ts`）。
