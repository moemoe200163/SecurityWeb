# Nginx Reverse Proxy + WAF 設計規格

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 部署 Nginx Reverse Proxy 容器作為統一入口，提供 SSL/TLS 終止、WAF 防護、HTTP→HTTPS 自動重定向

**Architecture:**
```
Internet → Nginx:443 → Frontend:3000
                       → Backend:4000
         Nginx:80 → HTTP 自動重定向到 HTTPS
```

**Tech Stack:**
- OpenResty (Nginx + ModSecurity + Lua)
- Self-signed SSL certificates
- ModSecurity with OWASP Core Rule Set
- Docker Compose deployment

---

## 1. 服務配置

### 1.1 Nginx 容器

- **Image:** `openresty/openresty:alpine`
- **Ports:**
  - `80:80` - HTTP (自動重定向到 HTTPS)
  - `443:443` - HTTPS
- **Volumes:**
  - `./nginx/nginx.conf` → `/etc/nginx/nginx.conf`
  - `./nginx/ssl` → `/etc/nginx/ssl`
  - `./nginx/waf` → `/etc/nginx/waf`
- **Networks:** `securityweb`
- **Depends:** `frontend`, `backend`

### 1.2 網路架構變更

移除 frontend 和 backend 的直接 port 暴露：

| 服務 | 舊配置 | 新配置 |
|------|--------|--------|
| frontend | `3000:3000` | 僅內網 (`securityweb`) |
| backend | `4000:4000` | 僅內網 (`securityweb`) |
| nginx | 新增 | `80:80`, `443:443` |

---

## 2. SSL/TLS 配置

### 2.1 Self-signed 憑證生成

使用 OpenSSL 生成自我簽署憑證：

```bash
# 私鑰
openssl genrsa -out nginx/ssl/server.key 2048

# 憑證 (10年有效期)
openssl req -new -x509 \
  -key nginx/ssl/server.key \
  -out nginx/ssl/server.crt \
  -days 3650 \
  -subj "/CN=securityweb/O=SecurityWeb/L=Taipei"
```

### 2.2 SSL 配置參數

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1h;
```

---

## 3. WAF 配置

### 3.1 ModSecurity 設定

- **Engine:** ON (with anomaly scoring)
- **Rules:** OWASP Core Rule Set v3.3/3.4
- **Mode:** Prevention (正式防護模式)

### 3.2 OWASP Core Rule Set

```
/etc/nginx/waf/owasp-crs/
├── crs-setup.conf
└── rules/
    ├── REQUEST-900-EXCLUSION-RULES-BEFORE-CRS.conf
    ├── REQUEST-901-CRYPTO-CHALLENGE.conf
    ├── REQUEST-905-COMMON-EXCEPTIONS.conf
    ├── REQUEST-910-IP-REPUTATION.conf
    ├── REQUEST-911-METHOD-ENFORCEMENT.conf
    ├── REQUEST-912-DOS-PROTECTION.conf
    ├── REQUEST-913-SCANNER-DETECTION.conf
    ├── REQUEST-920-PROTOCOL-ENFORCEMENT.conf
    ├── REQUEST-921-PROTOCOL-ATTACK.conf
    ├── REQUEST-930-APPLICATION-ATTACK-LFI.conf
    ├── REQUEST-931-APPLICATION-ATTACK-RFI.conf
    ├── REQUEST-932-APPLICATION-ATTACK-RCE.conf
    ├── REQUEST-933-APPLICATION-ATTACK-PHP.conf
    ├── REQUEST-934-APPLICATION-ATTACK-GENERIC.conf
    ├── REQUEST-941-APPLICATION-ATTACK-XSS.conf
    ├── REQUEST-942-APPLICATION-ATTACK-SQLI.conf
    ├── REQUEST-943-APPLICATION-ATTACK-SESSION-FIXATION.conf
    └── RESPONSE-950-DATA-LEAKAGES.conf
```

### 3.3 自定義規則

位於 `nginx/waf/custom-rules.conf`：

```apache
# 允許滲透測試流量（不阻擋常見滲透測試工具的攻擊特徵）
SecRule REQUEST_URI "@contains /pentest" "id:1000,phase:1,pass,nolog,ctl:ruleRemoveById=941100"

# Rate Limiting - 每分鐘 100 請求
SecRule IP:REPUTATION_SCORE "@eq 0" "id:2000,phase:1,pass,nolog,setvar:tx.rate=+1"
SecAction "id:2001,phase:1,pass,nolog,initcol:ip=global"

# 阻擋明顯恶意请求
SecRule ARGS "@contains <script" "id:3000,phase:2,deny,status:403"
```

---

## 4. Nginx 配置文件結構

### 4.1 主配置 (nginx.conf)

```nginx
worker_processes auto;
error_log /dev/stderr warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # SSL 設定
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /dev/stdout main;

    # ModSecurity
    modsecurity on;
    modsecurity_rules_file /etc/nginx/waf/crs-setup.conf;

    # 上游服務
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:4000;
    }

    # HTTP 伺服器 (80) - 重定向到 HTTPS
    server {
        listen 80 default_server;
        server_name _;

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS 伺服器 (443)
    server {
        listen 443 ssl default_server;
        server_name _;

        ssl_certificate /etc/nginx/ssl/server.crt;
        ssl_certificate_key /etc/nginx/ssl/server.key;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Backend API
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket (如果有的話)
        location /ws/ {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```

---

## 5. 檔案結構

```
securityweb/
├── nginx/
│   ├── nginx.conf              # 主配置
│   ├── ssl/
│   │   ├── server.crt          # SSL 憑證
│   │   └── server.key          # SSL 私鑰
│   └── waf/
│       ├── crs-setup.conf      # OWASP CRS 設定
│       └── custom-rules.conf   # 自定義規則
├── docker-compose.yml          # 更新
└── docs/superpowers/specs/    # 本 spec
```

---

## 6. docker-compose.yml 變更

```yaml
nginx:
  image: openresty/openresty:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/ssl:/etc/nginx/ssl:ro
    - ./nginx/waf:/etc/nginx/waf:ro
  depends_on:
    frontend:
      condition: service_healthy
    backend:
      condition: service_started
  networks:
    - securityweb
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 512M
      reservations:
        cpus: '0.1'
        memory: 128M

# 移除 frontend 和 backend 的 port 映射
frontend:
  # ports:  # 移除 "3000:3000"
  networks:
    - securityweb

backend:
  # ports:  # 移除 "4000:4000"
  networks:
    - securityweb
```

---

## 7. 測試計畫

### 7.1 本地端測試

| 測試項目 | 預期結果 |
|----------|----------|
| HTTP 訪問 `http://localhost:80` | 301 重定向到 HTTPS |
| HTTPS 訪問 `https://localhost:443` | 正常載入頁面 |
| 直接訪問 `http://localhost:3000` | 應無法連接（port 已移除） |
| 直接訪問 `http://localhost:4000` | 應無法連接（port 已移除） |
| WAF 阻擋 SQL 注入測試 | 403 Forbidden |
| Rate limiting 超限 | 429 Too Many Requests |

### 7.2 驗證命令

```bash
# 測試 HTTP 重定向
curl -I http://localhost:80

# 測試 HTTPS（忽略 self-signed 憑證警告）
curl -k https://localhost:443

# 測試 WAF (SQL 注入)
curl -k https://localhost:443/api/test?id=1' OR '1'='1

# 測試 API 直接存取被阻擋
curl http://localhost:4000/api/test  # 應無法連接
```

---

## 8. 已知限制

1. **Self-signed 憑證警告：** 瀏覽器會顯示不安全警告，生產環境需替換為正式憑證
2. **滲透測試流量：** WAF 可能會標記正常的滲透測試流量，需要使用 `custom-rules.conf` 調整
3. **內網使用：** 適用於本地/內網環境，不適用於需要 Let's Encrypt 的對外服務

---

## 9. 實作順序

1. 創建 `nginx/` 目錄結構
2. 生成 SSL 憑證
3. 下載 OWASP Core Rule Set
4. 編寫 `nginx.conf`
5. 編寫 WAF 配置
6. 更新 `docker-compose.yml`
7. 測試部署
