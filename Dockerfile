# syntax=docker/dockerfile:1
# =============================================================================
# web 映像：前端網頁（Vue）+ nginx
# 由 docker compose 自動建置，一般不需要手動執行 docker build。
# =============================================================================

# ---- 第 1 階段：建置 ----
# 安裝套件 → 執行全部單元測試 → 打包網頁。
# 任何一個測試失敗，建置就會中止（不會產生有問題的映像）。
FROM node:22-alpine AS build
WORKDIR /app

# 先只複製 package*.json 再安裝，套件沒變時可以沿用快取，重建比較快
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm test && npm run build

# ---- 第 2 階段：執行 ----
# 只保留打包後的靜態檔案與 nginx，不含 Node.js 與原始碼，映像小很多。
FROM nginx:1.27-alpine AS runtime

# nginx 官方映像啟動時會把 templates/*.template 的 ${變數} 換成下面的值
ENV NGINX_LISTEN=80
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
# 健康檢查：docker compose ps 會顯示 healthy / unhealthy
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${NGINX_LISTEN##*:}/healthz" || exit 1
