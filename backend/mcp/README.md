# MCP 服務器

Model Context Protocol (MCP) 服務器，用於威脅情報查詢。

## 概述

本目錄包含兩個 MCP 服務器：
- **VirusTotal MCP** - IP、域名、檔案雜湊信譽查詢
- **Brave Search MCP** - 安全相關網頁和圖片搜索

## 快速開始

### 1. 配置環境變數

```bash
# 在 backend 目錄創建 .env 文件
cp ../.env .env

# 或直接設置環境變數
export VIRUSTOTAL_API_KEY="your-virustotal-api-key"
export BRAVE_SEARCH_API_KEY="your-brave-search-api-key"
```

### 2. 構建服務器

```bash
cd servers/virustotal
npm install
npm run build

cd ../brave-search
npm install
npm run build
```

### 3. 測試單個服務器

```bash
# 測試 VirusTotal (需要 API key)
cd servers/virustotal
VIRUSTOTAL_API_KEY="your-key" node dist/index.js
# 輸入測試：{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lookup_ip","arguments":{"ip":"1.1.1.1"}}}

# 測試 Brave Search (需要 API key)
cd servers/brave-search
BRAVE_SEARCH_API_KEY="your-key" node dist/index.js
# 輸入測試：{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"web_search","arguments":{"query":"security advisory"}}}
```

## 服務器工具

### VirusTotal MCP

| 工具 | 描述 | 參數 |
|------|------|------|
| `lookup_ip` | 查詢 IP 地址信譽 | `ip`: IP 地址 |
| `lookup_domain` | 查詢域名信譽 | `domain`: 域名 |
| `lookup_hash` | 查詢檔案雜湊 | `hash`: MD5/SHA1/SHA256 |

### Brave Search MCP

| 工具 | 描述 | 參數 |
|------|------|------|
| `web_search` | 網頁搜索 | `query`: 搜索關鍵詞, `count`: 返回數量 |
| `image_search` | 圖片搜索 | `query`: 搜索關鍵詞, `count`: 返回數量 |

## API Keys

### VirusTotal
- 免費方案：每天 500 次請求
- 註冊：https://www.virustotal.com/gui/join-us
- 文檔：https://developers.virustotal.com/reference

### Brave Search
- 免費方案：每月 2000 次請求
- 註冊：https://brave.com/search/api/
- 文檔：https://api.search.brave.com/app/documentation/web-search/get-started

## MCP 整合

這些服務器遵循 MCP 協議，可以與任何 MCP 客戶端整合：

1. Claude Desktop
2. Cursor AI
3. 其他 MCP 兼容客戶端

### Claude Desktop 配置

在 `~/Library/Application Support/Claude/claude_desktop_config.json` 添加：

```json
{
  "mcpServers": {
    "virustotal": {
      "command": "node",
      "args": ["/path/to/SecurityWeb/backend/mcp/servers/virustotal/dist/index.js"],
      "env": {
        "VIRUSTOTAL_API_KEY": "your-api-key"
      }
    },
    "brave-search": {
      "command": "node",
      "args": ["/path/to/SecurityWeb/backend/mcp/servers/brave-search/dist/index.js"],
      "env": {
        "BRAVE_SEARCH_API_KEY": "your-api-key"
      }
    }
  }
}
```

## 架構

```
┌─────────────────────────────────────┐
│         Frontend (Next.js)          │
└─────────────┬───────────────────────┘
              │ API
              ▼
┌─────────────────────────────────────┐
│         Backend (Fastify)           │
│  ┌───────────────────────────────┐  │
│  │     MiniMax Adapter           │  │
│  │  (威脅情報分析 Multi-Agent)   │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
              │
              │ MCP 協議 (stdio)
              ▼
┌─────────────────────────────────────┐
│       MCP Servers                   │
│  ┌─────────────┐ ┌─────────────┐  │
│  │ VirusTotal  │ │ Brave Search│  │
│  └─────────────┘ └─────────────┘  │
└─────────────────────────────────────┘
```

## 未來擴展

- [ ] 添加 OTX (AlienVault OTX) 威脅情報
- [ ] 添加 Shodan 設備搜索
- [ ] 添加 AbuseIPDB IP 黑名單查詢
- [ ] 整合 SOAR 自動化腳本生成
