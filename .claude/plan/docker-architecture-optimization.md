# SecurityWeb Docker 架構優化計劃

## 目標
優化 Docker Compose 服務分層、修復 N+1 查詢、降低資源占用、提高安全性。

## 現狀分析

### 已完成（從上次對話）
- ✅ `requirements-bgp.txt` - Python 依賴已創建
- ✅ `Dockerfile-bgp-consumer` - 獨立 Python 鏡像
- ✅ `backend/Dockerfile` - 已添加 websockets/sqlalchemy/psycopg2
- ✅ `bgp-consumer.py` - 已修復 transaction（`engine.begin()`）
- ✅ `docker-compose.yml` - 已添加 bgp-consumer（但缺少 profiles）

### 待修復問題

| 優先級 | 問題 | 位置 |
|--------|------|------|
| P0 | nginx/sandbox/frontend 沒有 profiles，會預設啟動 | docker-compose.yml |
| P1 | N+1 查詢 - 每筆記錄調用一次 `checkHijackSuspicion()` | bgp.ts:170-192 |
| P1 | BGP 寫入沒有 batch 化 | bgp-consumer.py |
| P2 | backend 掛載 Docker socket（安全風險） | docker-compose.yml:42 |
| P2 | Postgres 資源占用過高（本機開發） | docker-compose.yml:114-155 |
| P2 | nginx 未設定 profiles | docker-compose.yml |

---

## 實施計劃

### Step 1: 修復 docker-compose.yml profiles

**目標**：日常開發只啟動核心三服務（db, backend, frontend），其餘按需啟動。

**修改**：
```yaml
frontend:
  profiles: ["edge"]  # 新增

nginx:
  profiles: ["edge"]   # 新增

sandbox:
  profiles: ["tools"]  # 已有，但需確認
```

**啟動方式**：
- 日常開發：`docker compose up db backend frontend`
- 完整服務：`docker compose --profile edge up`
- BGP 消費者：`docker compose --profile bgp up db backend frontend bgp-consumer`
- 工具模式：`docker compose --profile tools up`

---

### Step 2: 修復 N+1 查詢優化

**問題**：在 `bgp.ts:170-192`，每次查詢都對每筆記錄執行：
```typescript
const suspicion = await checkHijackSuspicion(r.prefix, r.originAsn, r.timestamp);
```
這導致 N 筆記錄 = N 次 DB 查詢。

**優化方案**：
1. 先一次查詢所有相關 prefix + originASN 的歷史數據
2. 在記憶體中建立 map
3. 用 map 判斷 hijack suspicion

**預期改動** (`backend/src/routes/bgp.ts`)：
- 新增 `batchCheckHijackSuspicion()` 函數
- 替換 `Promise.all(records.map(async (r) => checkHijackSuspicion(...)))` 為批量查詢

---

### Step 3: 降低 Postgres 資源占用（可選，本機開發）

**當前配置**（過重）：
```yaml
cpus: '1.0'
memory: 1G
shared_buffers=384MB
max_connections=40
```

**建議配置**（本機開發）：
```yaml
cpus: '0.75'
memory: 768M
# postgres command:
#   -c shared_buffers=128MB
#   -c max_connections=20
#   -c work_mem=4MB
```

---

### Step 4: 移除 Docker socket（安全性）

**風險**：backend 以 root 運行並掛載 `/var/run/docker.sock`

**選項 A**：完全移除，讓 sandbox 獨立管理
**選項 B**：保留但限制為只讀

建議選項 B（影響較小），改為：
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

---

### Step 5: BGP 寫入 batch 化（可選）

當前：每條 update 即時寫入
建議：每 100 條或每 5 秒 flush 一次

---

## 實施順序

1. **Step 1** - 修改 profiles（高優先級，立即可做）
2. **Step 2** - N+1 優化（高優先級，需修改 bgp.ts）
3. **Step 3** - Postgres 資源（可選，低優先級）
4. **Step 4** - Docker socket（可選，中優先級）
5. **Step 5** - Batch 寫入（可選，低優先級）

---

## 關鍵文件

| 文件 | 操作 | 描述 |
|------|------|------|
| `docker-compose.yml` | 修改 | 添加 profiles |
| `backend/src/routes/bgp.ts` | 修改 | N+1 查詢優化 |

---

## 驗證方式

1. `docker compose config` - 確認 compose 有效
2. `docker compose up -d db backend frontend` - 確認只啟動核心三件
3. `curl http://localhost:4000/api/bgp/query` - 確認 API 正常
4. 確認 `bgp-consumer` 不在預設啟動清單

---

## 風險與緩解

| 風險 | 緩解 |
|------|------|
| profiles 語法錯誤 | 先用 `docker compose config` 驗證 |
| N+1 優化引入新 bug | 寫測試驗證相同輸出 |
| 移除 docker socket 影響功能 | 確認 sandbox 獨立可用 |