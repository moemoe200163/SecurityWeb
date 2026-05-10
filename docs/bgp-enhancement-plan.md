# Plan: 資安 ASN 情報查詢工具 - BGP 頁面強化

## 目標
將 `/threat/bgp` 從「BGP 路由監控平台」重新定位為「資安 ASN 情報查詢工具」

## 優先任務

### Phase 1: ASN Org/Country 顯示
**目標**: 在 BGP 記錄表格中顯示組織名稱和國家

#### Task 1.1: 補完 bgp-sync.py
- 從 RIPEstat API 取得 AS 國家/組織資訊
- 寫入 `BgpAsnInfo` 表的 `name` 和 `country` 欄位
- 欄位：`asn`, `name`, `country`

#### Task 1.2: 修改 bgp-consumer.py
- 寫入時從 `BgpAsnInfo` 帶入 `country`
- 使用記憶體緩存機制避免频繁查庫

#### Task 1.3: 修改前端顯示
- 在表格中新增「組織名稱」和「國家」欄位
- 國家顯示國旗 emoji

#### Task 1.4: 驗證
- 確認資料庫有正確的 Org/Country 資料
- 確認前端顯示正確

---

### Phase 2: WHOIS 彈窗
**目標**: 點擊 ASN 可看到詳細 WHOIS 資訊

#### Task 2.1: 建立 WHOIS API 端點
- `GET /api/bgp/whois/:asn`
- 使用 RIPEstat API 查詢 AS 詳細資訊
- 快取結果 24 小時

#### Task 2.2: 前端實作 Modal
- 點擊 ASN 欄位 → 彈出 Modal
- 顯示：ASN、Org Name、Country、Abuse Contact、註冊資訊等

---

### Phase 3: Hijack 疑似標記
**目標**: 標記可能的路由劫持

#### Task 3.1: 分析 Hijack 判斷邏輯
- 同一前綴短時間內不同 Origin ASN
- 新 Origin ASN 與歷史主要 ASN 不同

#### Task 3.2: 修改 BGP 查詢 API
- 回傳額外欄位：`hijack_suspicion` (boolean)
- `suspicion_level`: none / low / medium / high

#### Task 3.3: 前端顯示
- 表格中標記 Hijack 記錄
- 顯示警告图标和顏色區分

---

### Phase 4: 穩定性指標
**目標**: 顯示 ASN 的路由穩定性

#### Task 4.1: 計算穩定性
- 統計該 ASN 近 24 小時的前綴變動次數
- `stability_score`: 0-100
- `is_stable`: boolean

#### Task 4.2: 前端顯示
- 顯示穩定/中度活躍/高活躍標籤

---

## 驗證步驟
1. 確認所有 Docker services 運行正常
2. 手動測試 `/threat/bgp` 頁面
3. 確認資料正確寫入資料庫
4. 確認前端顯示正確

## Critical Files
- `frontend/src/app/threat/bgp/page.tsx`
- `backend/src/routes/bgp.ts`
- `backend/scripts/bgp-consumer.py`
- `backend/scripts/bgp-sync.py`
- `backend/prisma/schema.prisma`
