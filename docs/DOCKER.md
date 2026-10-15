# Docker 安裝與設定說明

> 平常在客戶現場用的是**部署到網路上的版本**，用手機 / 平板開（見 [DEPLOY.md](DEPLOY.md)）。
> Docker 只是「在自己電腦上開一份」的方法，例如在辦公室用大螢幕準備專案。

## 1. 架構：一個容器

```
瀏覽器 ──► web（nginx，port 8080）──► 建置好的網頁檔案
```

- 沒有後端。所有計算、檢查、匯出都在瀏覽器裡完成。
- 建置映像時會先跑全部單元測試與型別檢查，失敗就不會產生映像。
- nginx 設定：直接開任何網址都會回到網頁（SPA fallback）、`/healthz` 健康檢查、gzip、靜態檔長快取、安全標頭。

## 專案資料存在哪裡？

存在**瀏覽器**裡，不在 Docker 裡，所以刪掉容器或映像都不影響。但要注意：

- 瀏覽器依「網址 + port」分開存：`http://localhost:8080` 和手機上的網址是**不同的兩份**，彼此看不到。
- 清除瀏覽器資料就會消失。
- 要換裝置、交給同事、或備份：到「專案」頁按「匯出專案檔」，另一邊按「匯入專案檔」。維修工單另外存，在「Maintenance」頁用「匯出工單」/「匯入工單檔」。

> **從 v1.1 升級**：以前存在 `./projects` 資料夾裡的 `.netlab.json` 檔還在，到「專案」頁用「匯入專案檔」一個一個匯入，
> 再按「存到專案庫」即可。舊檔裡的驗收結果會略過，其他資料都會保留。

## 2. 第一次安裝

需要 Docker Desktop（Mac / Windows）或 Docker Engine + Compose v2（Linux）。

```bash
cp .env.example .env            # 設定檔，可以不改
docker compose up -d --build    # 建置並在背景啟動
```

打開 http://localhost:8080 。`docker compose ps` 的 STATUS 要顯示 `healthy`。

## 3. 日常指令

| 要做的事 | 指令 |
| --- | --- |
| 啟動 | `docker compose up -d` |
| 更新到新版本（改過程式碼後） | `docker compose up -d --build` |
| 查看狀態 | `docker compose ps` |
| 看 log | `docker compose logs -f web` |
| 停止 | `docker compose down` |

## 4. 正式、測試、開發

| 檔案 | 用途 | 網頁 |
| --- | --- | --- |
| `docker-compose.yml` | 正式 | http://localhost:8080 |
| `docker-compose.test.yml` | 測試新版本（繼承正式設定，只換 port 和映像名稱） | http://localhost:8081 |
| `docker-compose.dev.yml` | 開發：改程式碼自動重新載入 | http://localhost:5173 |

```bash
docker compose -f docker-compose.test.yml up -d --build   # 測試環境
docker compose -f docker-compose.test.yml down
```

因為瀏覽器依 port 分開存資料，8081 的測試環境看不到 8080 的專案，互不影響。

## 5. 設定檔 `.env`

| 設定 | 預設 | 說明 |
| --- | --- | --- |
| `WEB_PORT` | `8080` | 網頁 port，被佔用時改成例如 `8088` |
| `WEB_BIND` | `127.0.0.1` | `127.0.0.1` 只有本機能開；`0.0.0.0` 同網段的電腦 / 手機也能開 |
| `TEST_WEB_PORT` | `8081` | 測試環境的 port |

改完執行 `docker compose up -d` 套用（不需要 `--build`）。

> 用 `WEB_BIND=0.0.0.0` 讓手機連 `http://<電腦 IP>:8080` 可以開網頁，但**不能**「加入主畫面」離線使用：
> 離線功能（Service Worker）只在 `https://` 或 `localhost` 才會啟用。手機請用 [DEPLOY.md](DEPLOY.md) 的方法。

## 6. 沒有網路的地方安裝

```bash
# 在有網路的地方
docker compose build
docker save netlab-web:latest | gzip > netlab-web.tar.gz

# 把 netlab-web.tar.gz、docker-compose.yml、.env 複製過去後
docker load < netlab-web.tar.gz
docker compose up -d
```

## 7. 常見問題

### 8080 port 被佔用
`.env` 改 `WEB_PORT=8088`，再 `docker compose up -d`。

### 更新後網頁還是舊版
網頁有離線快取，新版會在背景下載，**重新整理一次**就會換成新版。

### 專案不見了
確認網址和 port 跟之前一樣（`localhost:8080` 和 `127.0.0.1:8080` 也算不同網址）。如果瀏覽器資料被清掉，只能從匯出的專案檔匯入。

## 8. 檔案說明

| 檔案 | 說明 |
| --- | --- |
| `Dockerfile` | 建置網頁（先跑測試）→ 放進 nginx |
| `docker/nginx.conf.template` | nginx 設定 |
| `docker/security-headers.conf` | 安全標頭 |
| `docker-compose*.yml` | 正式 / 測試 / 開發 |
| `.env.example` | 設定範本 |
