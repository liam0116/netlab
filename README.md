# Server Engineer Network Lab

給伺服器 / 設備工程師的現場工具與 TCP/IP 學習網站：客戶專案規劃（IP、機櫃、佈線、流程圖、交付文件）、硬體維修工單，以及網路計算工具與新手教學。
所有 IPv4 計算都用真正的 32-bit bitwise 運算完成（`src/utils/network.ts`），並有 Unit Test 覆蓋。

目前版本：**v1.3.5**

## 手機 / 平板使用（主要用法）

這是**純前端網頁，沒有後端、沒有資料庫**。部署成靜態網站後，手機、平板直接開網址就能用；「加入主畫面」後**沒有網路也能用**（PWA）。

資料只存在**這台裝置的瀏覽器**裡，不會上傳。**匯出的檔案是唯一的備份**：

| 資料 | 備份檔 | 在哪裡匯出 / 匯入 |
| --- | --- | --- |
| 客戶專案（新建置） | `.netlab.json` | Project → Projects |
| 維修工單 | `.netlab-job.json` | Service → Maintenance |

📱 **部署與手機安裝步驟：[docs/DEPLOY.md](docs/DEPLOY.md)**

> v1.2.0 起移除了需要後端的功能（Network Checker 的 Ping / Port / Traceroute / DNS，以及 Acceptance 一鍵驗收），
> 因為瀏覽器本身不能 ping 或測 Port，現場也不會帶電腦。要測試請直接在客戶伺服器上打指令，
> Port Reference、Linux Commands、Troubleshooting 都有現成指令可以複製。

## 快速啟動

### 方法一：本機開發（Node.js 22+）
```bash
npm install
npm run dev          # 開發模式 http://localhost:5173（改程式碼會自動更新）
npm test             # Vitest 單元測試
npm run type-check   # vue-tsc 型別檢查
npm run build        # 型別檢查 + production build（含 PWA service worker），輸出在 dist/
npm run preview      # 預覽 build 結果
```
部署到子路徑（例如 GitHub Pages 的 `/<repo>/`）時用 `BASE_PATH=/<repo>/ npm run build`。

### 方法二：Docker（在自己電腦上開一份，不用裝 Node.js）
```bash
cp .env.example .env                                        # 設定檔（不改也可以）
docker compose up -d --build                                # 正式 http://localhost:8080
docker compose -f docker-compose.test.yml up -d --build     # 測試 http://localhost:8081（試新版本用）
docker compose down                                         # 停止
```
📘 Docker 中文說明：[docs/DOCKER.md](docs/DOCKER.md)

- 只有一個 `web` 容器：nginx 提供建置好的網頁。建置 Image 時會先跑全部測試與型別檢查，沒過就不會產生新版。
- nginx 設定了 SPA fallback、`/healthz`、gzip、靜態資源長快取與安全 headers。
- 瀏覽器依網址和 port 分開存資料：8080 和 8081 的專案、工單互相看不到。

| 檔案 | 環境 | 網址 |
| --- | --- | --- |
| `docker-compose.yml` | 正式 | http://localhost:8080 |
| `docker-compose.test.yml` | 測試（繼承正式設定） | http://localhost:8081 |
| `docker-compose.dev.yml` | 開發（hot reload） | http://localhost:5173 |

### 更新後看不到新版？
這是 PWA，瀏覽器會先用快取的舊版。重新整理一兩次即可；手機上把 App 關掉再開一次。資料不受更新影響。

## 功能（依側邊欄順序）

> **三種資料彼此分開**：
> - **Project**：一個客戶的新建置案子。底下的頁面共用同一份專案資料，彼此連動。
> - **Service**：已上線機器的維修工單，另外存放，清除或換專案都不會影響。
> - **Learn / Tools / Lab / Reference**：獨立的學習與計算工具，各自保存，不會改到客戶專案。

### Project · 專案
在辦公室準備好 → 現場用手機 / 平板照著做 → 匯出交付給客戶。

| 功能 | 路徑 |
| --- | --- |
| **Projects**：客戶資訊、Logo、專案庫、匯出 / 匯入專案檔、範例專案（三層式架構：4 台 ESXi + FC SAN + 雙 FC Switch + MLAG Leaf）、清除整個專案 | `/project` |
| **IP Plan**：專案的 VLAN / 網段規劃；設備 IP 對照（每個網段有哪些設備、下一個可用 IP、IP 重複 / 設到 Network、Broadcast、Gateway / 不在網段內） | `/project/ip-plan` |
| **Rack Elevation 機櫃圖**：一鍵產生常見架構與所需設備（三層式、HCI、分離式 HCI、雙節點、Ceph、AI / GPU）；拖拉調整 U 位；檢查重疊、超出、PDU A/B 負載（含單路斷電）、重量；批次建立機櫃（例如 3 排 × 4 櫃 = A01…C04）；機房平面圖；匯出 SVG / PNG | `/project/rack` |
| **Cabling 佈線表**：Port 對接、線材、Access / Trunk、Bond；檢查 Port 重複、速度不符、線材長度、LACP 未跨兩台 Switch；匯出 CSV 與標籤 | `/project/cabling` |
| **Service Flows 服務互動圖**：服務與連線（協定 / Port），自動畫圖並產生防火牆開通申請表（CSV） | `/project/flows` |
| **Flowcharts 流程圖**：安裝 / 硬體維修 / VM 遷移 / 資料搬移 / 網路排查範本；適用對象（VM / 主機 / 系統）、插入步驟、上下移、複製；匯出 SVG / PNG | `/project/flowcharts` |
| **Config Generator 設定檔產生器**：netplan、nmcli（LACP Bond + VLAN）、Cisco / Arista、華為 VRP、BMC ipmitool、/etc/hosts | `/project/config` |
| **Handover Report 交付文件**：封面、摘要、IP 規劃、機櫃圖、設備清單、佈線、服務與防火牆、流程圖、簽收欄；沒有資料的章節預設不勾、封面缺客戶或專案名稱會提醒；列印 / 存成 PDF（機櫃與圖表不會被分頁切開） | `/project/report` |

### Service · 維修服務
專案是「新建置」的規劃；維修是對**已上線機器**的服務，所以工單另外存放，不會混進專案檔。

| 功能 | 路徑 |
| --- | --- |
| **Maintenance 維修作業**：見下方說明 | `/service/maintenance` |

- **工單**：客戶、地點、工程師、Case / RMA 編號、日期、說明。
- **作業項目**：移動（拆下 → 插到別台）、對調（例如左右互換）、拆下、安裝新品、原位更換；零件可選記憶體、硬碟、網卡、GPU、CPU、電源、風扇。
- **插槽**：可寫 `A1, A2`、範圍 `A1-A4`，或 `Bay 3`。
- **自動檢查**：數量對不上、插槽重複、插槽已被拆空或已插上。
- **各主機異動對照**：開機後應該看到的數量與容量（例如「+4，容量 +128 GB」），旁邊可以填實際看到的數字。
- **現場填寫**：開始 / 完成時間、現場紀錄；每一項可以打勾標示完成。
- **施工流程圖**：依工單自動產生（遷移 VM、關機 → 逐項施工 → 開機確認）。
- **列印 / 存成 PDF**：單張或全部工單一次印，每張從新的一頁開始。有填的內容直接印出，沒填的印成空白線可以手寫。可選附上流程圖，也可選附上客戶 / 工程師簽名欄（預設不印，放在最後）。
- **匯出 / 匯入工單檔**（`.netlab-job.json`）：v1.3.0 存在專案檔裡的舊工單也能讀出來。

### Learn · 學習
| 功能 | 路徑 |
| --- | --- |
| TCP/IP 互動教學：全部 20 章（Binary、IPv4、Subnet、Routing、VLAN、TCP…；動畫、步驟、隨機產生且答案由程式計算的小測驗） | `/learn` |
| TCP Three-way Handshake（HTTP 80 / HTTPS 443 / SSH 22 / MySQL 3306，序號正確計算） | `/learn/tcp-handshake` |
| **RAID**：RAID 0 / 1 / 5 / 6 / 10 互動動畫（逐塊寫入、點硬碟模擬故障、逐步還原動畫、整顆硬碟重建）、比較表、什麼情況選哪種、各廠牌在哪裡設定、小測驗 | `/learn/raid` |

### Tools · 工具
| 功能 | 路徑 |
| --- | --- |
| Subnet Calculator（可分享連結 `?ip=&cidr=`） | `/tools/subnet` |
| CIDR Converter（Mask ↔ /CIDR 動畫 + 對照表） | `/tools/cidr` |
| Binary Calculator（十進位 ↔ 二進位逐步動畫） | `/tools/binary` |
| Same Subnet Checker（含 Mask 不一致偵測） | `/tools/same-subnet` |
| Gateway Validator | `/tools/gateway` |
| IP Planner（獨立試算，不影響專案；可「套用到目前專案」）：VLAN Planner、VLSM | `/tools/ip-planner` |
| 現場計算機：資料搬移時間、RAID / Ceph 可用容量、電流 / UPS 供電時間 | `/tools/calculators` |

IP Planner：
- **兩種配置方式**：VLSM（由需求最大的開始緊密排列）與 VLAN 對齊（第 3 段 = VLAN ID，例如 VLAN 10 → `10.10.10.0/27`）。
- **即時建議 CIDR 並說明原因**，例如 20 Hosts + 1 Gateway = 21 → /27，因為 2^5 − 2 = 30。
- **Gateway 與預留**：可設定 Gateway 位置（第一個 / 最後一個可用位址）與預留成長比例。
- **匯出**：Copy（TSV，可直接貼到 Excel）、CSV（UTF-8 BOM，Excel 中文不亂碼）、JSON。
- **一鍵送到 Network Simulator**：自動建立 Router、Switch 與各 VLAN 的範例主機。

### Lab · 實驗室
| 功能 | 路徑 |
| --- | --- |
| Network Topology Simulator（拖拉、連線、IP / Gateway / VLAN 設定與即時檢查，可匯出 JSON） | `/lab/network` |
| Packet Simulator（ARP、Switch、Gateway、Router、NAT 封包流向，含 Frame Header） | `/lab/packet` |

### Reference · 參考資料
| 功能 | 路徑 |
| --- | --- |
| Device Guide：機櫃每種設備（伺服器、Leaf / Spine / 管理交換器、NAS、儲存、防火牆、配線架、UPS、KVM、盲板）是什麼、放第幾 U、怎麼接線、常見錯誤 | `/reference/devices` |
| Linux Command Toolkit（13 類、56 個指令：用途、範例、正常 / 異常輸出、常見問題） | `/reference/linux` |
| Port Reference（搜尋、IANA 範圍、在伺服器上檢查與開放 Port 的指令） | `/reference/ports` |
| Troubleshooting Wizard（「Server 無法上網」逐步排查與診斷） | `/reference/troubleshooting` |

### 其他
- **Dashboard**（`/`）：quick ipcalc，以及每個功能的「這是什麼 / 什麼時候用」。
- **右上角設定**：**Learning Mode** / **Engineer Mode**、**語言**（繁體中文 / English）、Dark / Light Mode。
- **簡報模式**：右上角螢幕圖示，隱藏選單與學習提示，方便展示給客戶；按 Esc 離開。
- **匯入檢查**：匯入的檔案會逐欄檢查與清理；v1.1 含驗收結果的舊專案檔也能匯入（驗收資料會略過）。
- **匯出版面**：圖片（SVG / PNG）與 PDF 一律用淺色版面，不受深色主題影響。

## 多語系（i18n）

- 使用 `vue-i18n`（Composition API）。第一次開啟時依瀏覽器語言決定，之後記住使用者的選擇。
- 側邊欄的功能名稱固定用工作上常用的英文，下方附上目前語言的名稱。
- UI 文字：`src/i18n/locales/zh-TW.ts`（主要語系，也是型別定義）與 `en.ts`；各階段新增的文字放在 `<locale>.phase2.ts`、`.phase4.ts`、`.phase5.ts`（專案）、`.phase6.ts`（維修工單），由主檔合併。
- 教學與參考內容：`src/i18n/content/`（tutorials、raid、devices、linux、ports、troubleshooting、flowcharts）。內容含計算出的數值與 `|` 等字元，因此用 TS 模組而非 i18n 訊息。
- `src/utils/` 不含任何語言文字，驗證錯誤回傳 message key，由 UI 翻譯。

新增語言：
1. 複製 `src/i18n/locales/en.ts` 與各個 `en.phase*.ts` 為新檔並翻譯（型別會檢查漏掉的 key）。
2. 複製 `src/i18n/content/` 裡的 `*.en.ts` 並翻譯；`flowcharts.ts` 的範本文字直接在檔案裡加上新語系。
3. 在 `src/i18n/index.ts` 的 `SUPPORTED_LOCALES` 與 `messages`、`src/i18n/content/index.ts` 加上新語系。
4. `npm test` 會檢查 key 是否一致、訊息能否正確編譯、教學步驟數是否對齊。

## 專案結構
```
src/
├── components/
│   ├── common/      # Layout、側邊欄、輸入元件、StatusBanner、CopyButton…
│   ├── network/     # BitGrid、Binary / Mask 動畫、SubnetRangeBar、拓撲 SVG…
│   ├── tutorial/    # TutorialVisual、QuizCard
│   ├── learn/       # RAID 模擬與還原動畫
│   ├── lab/         # PacketDiagram、TopologyCanvas
│   ├── reference/   # CommandCard
│   └── project/     # 機櫃圖、機房平面圖、設備編輯、服務圖、流程圖、維修工單列印版
├── composables/     # useStepPlayer、useTutorials、useConfirm（按兩次確認）、useMaintenanceText…
├── data/            # navigation（側邊欄）、tutorials、demoProject（範例專案）、demoMaintenance（範例工單）…
├── i18n/            # vue-i18n 設定、locales/（UI 文字）、content/（教學內容、流程圖範本）
├── router/
├── stores/          # project（專案）、maintenance（維修工單）、planner、topology、settings、progress
├── types/           # app、network、project（專案與工單）、topology、tutorial
├── utils/
│   ├── network.ts         # 所有 IPv4 計算（純函式，與 UI 分離）
│   ├── mac.ts             # MAC 驗證、OUI、I/G 與 U/L bit
│   ├── routing.ts         # Longest Prefix Match、`ip route` 解析
│   ├── packetFlow.ts      # 封包流向（同網段 / 跨網段 / NAT / Gateway 錯誤）
│   ├── topology.ts        # 拓撲設定檢查（VLAN mismatch、Gateway、重複 IP…）
│   ├── switching.ts       # Switch MAC 學習
│   ├── tcp.ts             # TCP 交握與 seq / ack 計算
│   ├── ports.ts           # Port 搜尋
│   ├── planner.ts         # VLSM / VLAN 對齊規劃、CSV / JSON / TSV 匯出、轉成拓撲
│   ├── rack.ts            # 機櫃 U 位、PDU A/B 與斷電負載、重量檢查
│   ├── cabling.ts         # 佈線檢查（Port、速度、線材、Bond / MLAG、VLAN）
│   ├── flows.ts           # 服務互動、防火牆申請表
│   ├── flowchart.ts       # 流程圖驗證與分層排版
│   ├── configgen.ts       # netplan / nmcli / Switch / BMC 設定產生
│   ├── calculators.ts     # 搬移時間、儲存容量、電力 / UPS
│   ├── projectFile.ts     # 專案檔序列化與匯入驗證
│   ├── maintenance.ts     # 維修工單：插槽解析、衝突檢查、各主機異動、產生流程圖
│   ├── maintenanceFile.ts # 工單檔匯出 / 匯入（和專案檔分開）
│   ├── svgExport.ts       # 圖表匯出 SVG / PNG（固定淺色）
│   └── quiz.ts            # 小測驗題目產生器（答案由上述模組計算）
└── views/           # 每個頁面一個 *View.vue
docker/              # nginx 設定範本、安全標頭
docs/DEPLOY.md       # 部署成靜態網站、手機 / 平板安裝與離線使用
docs/DOCKER.md       # Docker 中文設定說明
.github/workflows/   # 推到 main 自動測試、建置並部署到 GitHub Pages
.env.example         # Docker 設定範本（中文註解）
```

## 邊界情況
- `/31`：依 RFC 3021 視為點對點鏈路，2 個位址皆可用。
- `/32`：單一主機，Usable = 1。
- 有前導 0 的 IP（如 `010.1.1.1`）視為錯誤，避免八進位歧義。
- 非連續的 Mask（如 `255.0.255.0`）會被拒絕。

## 版本紀錄
- **v1.3（2026-10）**：
  - 新增 Service · 維修工單，和專案分開存放，可列印 / 存成 PDF。
  - 流程圖新增適用對象、插入步驟、複製，以及硬體維修、VM 遷移範本。
  - 交付文件的機櫃與圖表不會被分頁切開。
  - 範例專案改為三層式架構。
  - 側邊欄改成 Project、Service 在最上面。
- **v1.2**：移除後端，改為純前端 PWA，可部署成靜態網站在手機 / 平板離線使用。
- **v1.1**：Phase 1 ~ 4（學習章節、計算工具、Lab 模擬器、參考資料、IP Planner），以及 Project 現場工具（專案庫、機櫃、佈線、服務互動、流程圖、設定檔、交付文件）。
