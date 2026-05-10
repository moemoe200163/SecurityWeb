# 移除 Mock 模擬數據方案

## 目標

確保所有 AI 處理都使用真實 MiniMax API，禁止任何模擬/ Mock 數據 fallback。

---

## 需要修改的文件

### 1. mockAIService.ts (移除或標記)

**位置**: `backend/src/services/mockAIService.ts`

**修改**:
- [ ] 刪除文件，或
- [ ] 移到 `backend/src/services/mock-only/` 目錄
- [ ] 在 AGENTS.md 中標記為「僅開發測試用」

---

### 2. minimaxAdapter.ts (移除 getMockAIResponse)

**位置**: `backend/src/services/minimaxAdapter.ts:602`

**修改**:
```typescript
// ❌ 當前：回退到 mock
private getMockAIResponse(messages: MiniMaxMessage[]): string {
  // ...
}

// ✅ 應該：拋出錯誤
if (!MINIMAX_API_KEY) {
  throw new Error('請設定 MINIMAX_API_KEY 環境變數');
}
```

---

### 3. threat.ts (移除 simulation 模式)

**位置**: `backend/src/routes/threat.ts:84`

**修改**:
- [ ] 移除 `requestMode: z.enum(['simulation', 'live'])`
- [ ] 移除 `runThreatSimulation()` 函數
- [ ] 移除相關 API 端點

---

### 4. pentest.ts (移除 simulation 模式)

**位置**: `backend/src/routes/pentest.ts:119`

**修改**:
- [ ] 移除 `requestMode: 'simulation'` 支持
- [ ] 移除 `runPentestSimulation()` 函數
- [ ] 移除 simulation 分支

---

### 5. ipReputation.ts (移除 mock fallback)

**位置**: `backend/src/routes/ipReputation.ts:345, 374`

**修改**:
```typescript
// ❌ 當前：返回 mock 數據
if (noData) {
  return mockData;
}

// ✅ 應該：直接返回空或拋出錯誤
if (!ipData) {
  return reply.status(404).send({ error: 'IP not found' });
}
```

---

## 執行順序

```
1. minimaxAdapter.ts - 移除 getMockAIResponse (最關鍵)
        ↓
2. threat.ts - 移除 simulation 模式
        ↓
3. pentest.ts - 移除 simulation 模式
        ↓
4. ipReputation.ts - 移除 mock fallback
        ↓
5. mockAIService.ts - 移除或隔離
```

---

## 驗證方式

修改後測試：

```bash
# 1. 確認無 simulation 模式
curl -s "http://localhost:4000/api/threat/investigate" | grep simulation
# 預期：404 或錯誤

# 2. 確認無 API Key 時會錯誤
docker exec securityweb-backend-1 env | grep MINIMAX_API_KEY
# 預期：應該有值

# 3. 確認 mock AIService 未被使用
grep -r "mockAIService" backend/src/
# 預期：無結果或僅在開発目錄
```

---

## 相關文件

- `backend/AGENTS.md` - 已更新標記禁止 Mock
- `.claude/SECURITY_WEB_rules.md` - 禁止 Mock 規則