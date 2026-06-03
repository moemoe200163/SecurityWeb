# Sandbox Egress — 操作文件

> 本文件是 SecurityWeb sandbox（隔離執行環境）的 **操作入口**。
> 設計歷史請見 `docs/superpowers/specs/2026-06-02-phase19.3-sandbox-egress-policy-design.md`。
> 計畫請見 `docs/superpowers/plans/2026-06-02-phase19.3-sandbox-egress-policy.md`。

## 1. 用途

`securityweb-sandbox` 是一個獨立 container，內部跑受信任的安全掃描工具（nmap、sqlmap、nikto 等）。
Egress policy 限制它能往哪個目的地連線，避免工具被用來亂打外網。

## 2. Docker profile 行為

Sandbox **不在 default compose 範圍內**，要明確啟用 profile 才會跑。

| 命令 | 啟動內容 |
|------|----------|
| `docker compose up` | core app（frontend / backend / db）— **不啟 sandbox** |
| `docker compose --profile tools up` | core app + sandbox（**無 egress config 掛載**，走 lock-down） |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` | core app + dev override（backend / db port 暴露給 host）— **未啟 sandbox** |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile tools up` | core app + sandbox + dev override（sandbox volume 掛 `sandbox/egress.conf.example`） |

> **注意**：`docker-compose.dev.yml` 內的 header 註解寫的是 `--profile dev`，但實際 compose 檔內**沒有 `dev` profile**（`--profile dev` 為 no-op，與不帶一樣）。要啟 sandbox 是 `--profile tools`。建議另開 issue 清理 dev override 的 header 註解。

其他 profile（`bgp`、`edge`）與本文件無關，分別見 `docs/bgp-enhancement-plan.md` 與 `docs/nginx-setup.md`。

## 3. Egress policy precedence

讀取順序（高優先覆蓋低優先）：

1. **`/etc/sandbox/egress.conf`** — 容器內檔案（JSON）
2. **`$EGRESS_ALLOW`** — 環境變數（`cidr:port/proto,...`）
3. **Lock-down default** — 永遠允許 loopback、ESTABLISHED/RELATED 流量，以及 DNS（`/etc/resolv.conf` 內的 nameservers）

實作：`sandbox/egress-policy.sh`（容器啟動時跑）。

## 4. Config 格式

### 4.1 檔案（`/etc/sandbox/egress.conf`）

JSON，shape 與 `sandbox/egress.conf.example` 一致：

```json
{
  "_comment": "Example egress config for the sandbox. Copy to /etc/sandbox/egress.conf inside the container, or set EGRESS_ALLOW env var.",
  "allow": [
    { "cidr": "10.0.0.0/8", "ports": [80, 443], "proto": "tcp" }
  ],
  "allowIcmp": false
}
```

- `cidr` — IPv4 CIDR（拒絕 `0.0.0.0/0`）
- `proto` — `tcp` / `udp`（要帶 `ports`）/ `icmp`（不帶 `ports`，對整個 CIDR 放行 ICMP）
- `ports` — 1–65535 整數，tcp/udp 才需要
- `allowIcmp` — **全域** ICMP 開關：`true` 時對**任意**目的地放行 ICMP（不限 CIDR）。要 ICMP 限定目的地，請用 per-rule `proto: "icmp"`，例如：

  ```json
  { "cidr": "192.168.1.0/24", "proto": "icmp" }
  ```

### 4.2 環境變數（`EGRESS_ALLOW`）

逗號分隔 `cidr:port/proto`，例：

```text
EGRESS_ALLOW=10.0.0.0/8:443/tcp,192.168.1.0/24:53/udp
```

適合 CI / 一次性測試，不需建檔。

## 5. 啟動範例

### 5.1 只跑 core app（最常見）

```bash
docker compose up -d
```

### 5.2 跑 dev 模式（含 host port 暴露）

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### 5.3 跑 sandbox（生產 / 受控環境）

```bash
docker compose --profile tools up -d securityweb-sandbox
```

> **注意**：此時 sandbox 內**沒有**掛任何 egress config，會走 lock-down + DNS。允許的目標是空的，等於「sandbox 啟動但幾乎連不出去」。要先給 config 再啟。

### 5.4 跑 sandbox + dev override（本地開發推薦）

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile tools up
```

dev override 會自動把 `sandbox/egress.conf.example` 掛進 sandbox，並設 `EGRESS_CONF` 指向它。

### 5.5 跑 sandbox + 自訂 egress

**推薦：直接編輯 config 檔**（compose 已把 `sandbox/egress.conf.example` 掛進容器，改檔重啟即可生效）：

```bash
# 1. 編輯本地檔
$EDITOR sandbox/egress.conf.example
# 2. 驗證
cd backend && npm run validate-egress
# 3. 重啟 sandbox
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile tools restart securityweb-sandbox
```

> **為什麼不建議用 host `EGRESS_ALLOW=... docker compose up`**：目前 `docker-compose.yml` 的 sandbox service 沒有在 `environment:` 內顯式引用 `EGRESS_ALLOW`，host env var 不會自動傳進容器。要讓 env var 走通，得先在 compose 加 `EGRESS_ALLOW: ${EGRESS_ALLOW:-}`（不在 22-A 範圍）。需要時直接編 `egress.conf.example` 是當前最簡路徑。

## 6. 驗證命令

### 6.1 驗證 egress config 格式

```bash
cd backend && npm run validate-egress
```

跑 `validateEgressConfig.ts`（Zod schema）對 `sandbox/egress.conf.example` 做靜態驗證。

### 6.2 跑 Bats 測試

```bash
bash sandbox/egress-tests/run_bats.sh
```

10 個 case 覆蓋：lockdown 拒絕、env 啟用、CIDR 驗證、`0.0.0.0/0` 拒絕、port range、proto validation、no-broad-NEW 等。JSON schema 驗證由 §6.1 `validate-egress` 負責（不在 Bats 內）。

### 6.3 DRY_RUN 看 iptables 規則（不實際套用）

```bash
DRY_RUN=1 EGRESS_CONF=/path/to/egress.conf EGRESS_ALLOW="" bash sandbox/egress-policy.sh
```

會把 iptables 規則打到 stdout，方便審查。

## 7. 安全注意事項

- **`0.0.0.0/0` 一律拒絕**：`egress-policy.sh` 與 `validateEgressConfig.ts` 兩處都會擋，不要試圖繞過。
- **Sandbox 需要 `NET_ADMIN` cap** 才能下 iptables 規則；`seccomp=unconfined` 已在 compose 設好。
- **不要把 `docker compose config` 全文貼進驗收報告 / 文件 / commit message**。`docker compose config` 會展開 `.env` 內所有 secrets，可能把 API key / DB password 寫入文件歷史。要查 compose 設定請用 `grep` / `yq` 只抓 `services.*.profiles`、`volumes`、`cap_add`、`resources` 等欄位。
- **不要在 egress config 內放明文 secrets**。egress 檔是會被掛載到容器、可被讀取的。
- **DNS 永遠放行**（lock-down default）。這代表 sandbox 仍可解析任意 domain — 這是為了讓工具能解析目標。如果需要更嚴，可加 `egress.conf` 內的 `dns` allowlist 規則（待 Phase 19.3 spec 內列為未來延伸）。

## 8. Troubleshooting

| 症狀 | 可能原因 | 解法 |
|------|----------|------|
| Sandbox 啟動後立刻 exit | iptables 沒權限 / `NET_ADMIN` 被擋 | 檢查 `docker inspect securityweb-sandbox` 的 `CapAdd` 是否含 `NET_ADMIN` |
| `Invalid CIDR` | 格式錯 | CIDR 格式為 `<ip>/<prefix>`，例如 `10.0.0.0/8`（不要帶 host bits 如 `10.0.0.1/24`，或非數字 prefix 如 `10.0.0.0/8a`） |
| `0.0.0.0/0 is forbidden` | 試圖 wildcard | 改成明確 CIDR，例如 `203.0.113.0/24` |
| `Invalid JSON` | egress.conf 語法錯 | 用 `jq . < sandbox/egress.conf.example` 驗證 |
| DNS 查詢失敗 | resolv.conf 在容器內為空 | 確認 container 網路設定（預設 bridge 即可） |
| Egress 規則不如預期 | precedence 被環境變數蓋掉 | 檢查 `EGRESS_ALLOW` 環境變數；想用檔案就清空它 |
| 開發時 E2E 測到 stale code | Docker 容器鏡像比 worktree 舊 | 重 build 對應 service 的 image，或用 `next dev --webpack` 跑 worktree 自己的 dev server（見 `specs/ACCEPTANCE.md` Turbopack caveat） |
| `DRY_RUN=1` 在 macOS host 只看到 1 行 | macOS host 直接跑 `bash sandbox/egress-policy.sh` 的行為與 Linux / Docker 內不一致（host 環境、路徑、`/etc/resolv.conf`、bash 版本都可能差） | 改在 Docker / Linux 環境跑（與正式部署路徑一致）；Bats 測試 10/10 全綠已驗證 Linux 路徑正確 |

## 9. 相關文件

- 設計：`docs/superpowers/specs/2026-06-02-phase19.3-sandbox-egress-policy-design.md`
- 計畫：`docs/superpowers/plans/2026-06-02-phase19.3-sandbox-egress-policy.md`
- 驗收：`specs/ACCEPTANCE.md` ## 13. Phase 19.3: Sandbox Egress Policy
- TODO：`specs/TODO.md` Phase 22
