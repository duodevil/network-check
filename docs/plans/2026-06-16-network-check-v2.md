# Network Check Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready single-file HTML network diagnostic tool that auto-collects player data, guides traceroute, accepts mobile screenshot upload, and submits everything to Google Sheets via Apps Script — with a CONFIG object that lets operators redeploy for any game or region in minutes.

**Architecture:** Static `project/network-check/index.html` (GitHub Pages), no build step. All server IPs and game info live in a top-level `CONFIG` object. Google Apps Script Web App receives a single POST with JSON payload + optional base64 screenshot, writes to Google Sheets and Google Drive.

**Tech Stack:** Vanilla HTML/CSS/JS, Google Apps Script (separate file), ipinfo.io (free HTTPS), image ping for latency, FileReader API for screenshots.

---

### Task 1: HTML Skeleton + CSS

**Files:**
- Create: `project/network-check/index.html`

- [ ] **Step 1: Create the file with CONFIG, full CSS, and 4-step HTML skeleton**

Create `project/network-check/index.html` with the following content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Network Check</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #0f172a; min-height: 100vh; }

    /* Header */
    .header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 10; }
    .header-title { font-weight: 700; font-size: 16px; color: #1e293b; }
    .header-sub { font-size: 11px; color: #94a3b8; margin-top: 1px; }
    .lang-toggle { display: flex; gap: 4px; }
    .lang-btn { border: none; border-radius: 4px; padding: 4px 12px; font-size: 12px; cursor: pointer; font-weight: 600; transition: background .15s; }
    .lang-btn.active { background: #4f46e5; color: #fff; }
    .lang-btn:not(.active) { background: #f1f5f9; color: #64748b; }

    /* Layout */
    .container { max-width: 600px; margin: 0 auto; padding: 20px 16px; }

    /* Cards */
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 14px; }
    .card-label { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: .08em; margin-bottom: 12px; }

    /* Data grid */
    .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .data-cell { background: #f8fafc; border-radius: 8px; padding: 10px; }
    .data-cell.full { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 8px; }
    .cell-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 3px; }
    .cell-value { font-size: 13px; font-weight: 600; color: #0f172a; }
    .cell-value.loading { color: #94a3b8; font-weight: 400; font-size: 12px; }
    .cell-value.green { color: #059669; }
    .cell-value.yellow { color: #d97706; }
    .cell-value.red { color: #dc2626; }

    /* Platform tabs */
    .platform-tabs { display: flex; gap: 4px; margin-bottom: 14px; }
    .platform-tab { border: none; border-radius: 5px; padding: 4px 14px; font-size: 11px; font-weight: 600; cursor: pointer; transition: background .15s; }
    .platform-tab.active { background: #4f46e5; color: #fff; }
    .platform-tab:not(.active) { background: #f1f5f9; color: #64748b; }
    .platform-tab:not(.active):hover { background: #e2e8f0; }

    /* Code block */
    .code-block { background: #1e293b; color: #a5f3fc; border-radius: 8px; padding: 10px 12px; font-family: monospace; font-size: 13px; display: flex; justify-content: space-between; align-items: center; margin: 8px 0; }
    .copy-btn { background: #4f46e5; color: #fff; border: none; border-radius: 4px; padding: 3px 10px; font-size: 11px; cursor: pointer; white-space: nowrap; }
    .copy-btn:active { background: #3730a3; }

    /* Instructions */
    .instructions { list-style: none; margin-bottom: 10px; }
    .instructions li { font-size: 13px; color: #475569; padding: 3px 0; }
    .instructions li::before { content: attr(data-n) ". "; font-weight: 600; color: #4f46e5; }
    kbd { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 3px; padding: 1px 5px; font-size: 11px; font-family: monospace; }

    /* Traceroute */
    .tracert-server { margin-bottom: 14px; }
    .tracert-server:last-child { margin-bottom: 0; }
    .tracert-label { font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 6px; }
    .paste-area { width: 100%; border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 10px; min-height: 80px; font-family: monospace; font-size: 11px; color: #475569; resize: vertical; outline: none; transition: border-color .15s; }
    .paste-area:focus { border-color: #4f46e5; border-style: solid; }

    /* Retry */
    .retry-btn { background: none; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 8px; font-size: 11px; color: #64748b; cursor: pointer; margin-left: 6px; }

    /* Screenshot upload */
    .upload-area { border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px 16px; text-align: center; margin: 12px 0; }
    .upload-btn { background: #4f46e5; color: #fff; border: none; border-radius: 6px; padding: 9px 20px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .upload-preview { max-width: 100%; border-radius: 8px; margin-top: 10px; display: none; max-height: 200px; object-fit: contain; }
    .upload-error { font-size: 11px; color: #dc2626; margin-top: 6px; display: none; }

    /* Issue time */
    .issue-label { display: block; font-size: 13px; color: #1e293b; font-weight: 600; margin-bottom: 8px; }
    .issue-inputs { display: flex; gap: 8px; margin-bottom: 6px; }
    .issue-input { flex: 1; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 9px 12px; font-size: 13px; color: #0f172a; outline: none; background: #f8fafc; min-width: 0; }
    .issue-input:focus { border-color: #4f46e5; background: #fff; }
    .issue-sublabel { font-size: 11px; color: #94a3b8; }

    /* Disclaimer */
    .disclaimer { background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 12px; font-size: 12px; color: #713f12; line-height: 1.6; margin-bottom: 12px; }

    /* Submit */
    .btn-submit { width: 100%; background: #4f46e5; color: #fff; border: none; border-radius: 8px; padding: 13px; font-size: 14px; font-weight: 700; cursor: pointer; transition: background .15s; }
    .btn-submit:hover:not(:disabled) { background: #4338ca; }
    .btn-submit:disabled { cursor: default; }
    .submit-error { margin-top: 8px; font-size: 12px; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 10px; display: none; }

    @media (max-width: 400px) {
      .issue-inputs { flex-direction: column; }
    }
  </style>
</head>
<body>

  <header class="header">
    <div>
      <div class="header-title" id="header-game">Network Check</div>
      <div class="header-sub" id="header-region"></div>
    </div>
    <div class="lang-toggle">
      <button class="lang-btn" onclick="setLang('en')">EN</button>
      <button class="lang-btn" onclick="setLang('zh')">中文</button>
    </div>
  </header>

  <div class="container">

    <!-- Step 1: Auto Detected -->
    <div class="card">
      <div class="card-label" data-i18n="step1Label">STEP 1 — AUTO DETECTED</div>
      <div class="data-grid" id="data-grid">
        <div class="data-cell">
          <div class="cell-label" data-i18n="yourIP">YOUR IP</div>
          <div class="cell-value loading" id="val-ip">…</div>
        </div>
        <div class="data-cell">
          <div class="cell-label" data-i18n="yourISP">ISP</div>
          <div class="cell-value loading" id="val-isp">…</div>
        </div>
        <!-- server latency cards injected here by renderServerCards() -->
        <div id="server-latency-cards" style="display:contents"></div>
        <div class="data-cell full">
          <div>
            <div class="cell-label" data-i18n="packetLoss">PACKET LOSS</div>
            <div class="cell-value loading" id="val-loss">…</div>
          </div>
          <div>
            <div class="cell-label" data-i18n="deviceOS">DEVICE / OS</div>
            <div class="cell-value" id="val-os">—</div>
          </div>
        </div>
        <div class="data-cell">
          <div class="cell-label" data-i18n="screenRes">SCREEN</div>
          <div class="cell-value" id="val-screen">—</div>
        </div>
        <div class="data-cell">
          <div class="cell-label" data-i18n="timezoneLabel">TIMEZONE</div>
          <div class="cell-value" id="val-timezone">—</div>
        </div>
        <div class="data-cell">
          <div class="cell-label" data-i18n="connectionType">CONNECTION</div>
          <div class="cell-value" id="val-connection">—</div>
        </div>
        <div class="data-cell">
          <div class="cell-label" data-i18n="deviceMemory">MEMORY</div>
          <div class="cell-value" id="val-memory">—</div>
        </div>
        <div class="data-cell">
          <div class="cell-label" data-i18n="cpuCores">CPU CORES</div>
          <div class="cell-value" id="val-cpu">—</div>
        </div>
      </div>
    </div>

    <!-- Step 2: Traceroute -->
    <div class="card" id="step2-card">
      <div class="card-label" id="step2-label">STEP 2 — TRACEROUTE</div>
      <div id="step2-content"></div>
    </div>

    <!-- Step 3: Issue Details -->
    <div class="card">
      <div class="card-label" data-i18n="step3Label">STEP 3 — ISSUE DETAILS</div>
      <label class="issue-label" data-i18n="issueTimeLabel">When did the issue occur?</label>
      <div class="issue-inputs">
        <input type="date" id="issue-date" class="issue-input">
        <input type="time" id="issue-time" class="issue-input">
      </div>
      <div class="issue-sublabel" data-i18n="issueTimeSub">Approximate time is fine — leave blank if unsure</div>
    </div>

    <!-- Step 4: Submit -->
    <div class="card">
      <div class="card-label" data-i18n="step4Label">STEP 4 — SUBMIT</div>
      <div class="disclaimer" data-i18n="disclaimerText">By submitting this report, you agree to share your network diagnostic data including your IP address, device information, and the results above with the support team for the purpose of investigating connectivity issues. This data will not be shared with third parties.</div>
      <button class="btn-submit" id="submit-btn" onclick="submitReport()" data-i18n="submitBtn">I Agree and Submit</button>
      <div class="submit-error" id="submit-error"></div>
    </div>

  </div>

  <script>
    // ── CONFIG (edit this block to redeploy for a new game/region) ────────────
    const CONFIG = {
      game:   'Delta Force',
      region: 'SEA',
      appsScriptUrl: '',   // paste your Apps Script Web App URL here after deploying

      servers: [
        { label: 'Server A', ip: '98.98.60.43' },
        { label: 'Server B', ip: '98.98.61.31' },
      ],
    };
    // ─────────────────────────────────────────────────────────────────────────
  </script>
</body>
</html>
```

- [ ] **Step 2: Open in browser and verify skeleton renders**

Open `project/network-check/index.html` in Chrome. You should see:
- Header with "Network Check" and EN/中文 buttons
- 4 grey cards with placeholder labels
- No JS errors in console

- [ ] **Step 3: Commit**

```bash
git add "project/network-check/index.html"
git commit -m "feat: add Phase 2 HTML skeleton and CSS"
```

---

### Task 2: i18n System + Language Auto-Detection

**Files:**
- Modify: `project/network-check/index.html` — add i18n inside `<script>`

- [ ] **Step 1: Add i18n object and functions after the CONFIG block**

Inside `<script>`, after the closing `};` of CONFIG, add:

```js
// ── i18n ─────────────────────────────────────────────────────────────────
const i18n = {
  en: {
    step1Label:      'STEP 1 — AUTO DETECTED',
    yourIP:          'YOUR IP',
    yourISP:         'ISP',
    packetLoss:      'PACKET LOSS',
    deviceOS:        'DEVICE / OS',
    screenRes:       'SCREEN',
    timezoneLabel:   'TIMEZONE',
    connectionType:  'CONNECTION',
    deviceMemory:    'MEMORY',
    cpuCores:        'CPU CORES',
    step2Label:      'STEP 2 — TRACEROUTE',
    traceInstr1Win:  'Press <kbd>Win + R</kbd>, type <kbd>cmd</kbd>, press Enter',
    traceInstr1Mac:  'Open <strong>Terminal</strong> (Spotlight → Terminal)',
    traceInstr2:     'Copy and run this command:',
    traceInstr3:     'Paste the output into the box below:',
    traceHint:       '⏳ Please wait until at least hop 15 appears before pasting.',
    pastePlaceholder:'Paste traceroute output here...',
    iosStep1:        'Download <strong>Network Analyzer: net tools</strong> from the App Store (free)',
    iosStep2:        'Open app → tap <strong>Tools</strong> at the bottom bar',
    iosStep3:        'Select the <strong>Route</strong> tab → enter the IP below → tap <strong>Start</strong> (top right)',
    iosStep4:        '⏳ Wait until at least 15 hops appear',
    iosStep5:        'Take a screenshot of the result screen',
    iosIPsLabel:     'Run Route for each IP:',
    iosAppStoreBtn:  '⬇ Download on App Store',
    androidStep1:    'Search <strong>Network Analyzer</strong> on Google Play and install (free)',
    androidStep2:    'Open app → tap <strong>Tools</strong> → select <strong>Route</strong> tab',
    androidStep3:    'Enter the IP below → tap <strong>Start</strong>',
    androidStep4:    '⏳ Wait until at least 15 hops appear',
    androidStep5:    'Take a screenshot of the result screen',
    androidIPsLabel: 'Run Route for each IP:',
    androidPlayBtn:  '⬇ Get on Google Play',
    uploadScreenshot:'📷 Upload Screenshot',
    uploadSizeError: 'File too large (max 10 MB). Please compress and try again.',
    uploadPreviewAlt:'Screenshot preview',
    step3Label:      'STEP 3 — ISSUE DETAILS',
    issueTimeLabel:  'When did the issue occur?',
    issueTimeSub:    'Approximate time is fine — leave blank if unsure',
    step4Label:      'STEP 4 — SUBMIT',
    disclaimerText:  'By submitting this report, you agree to share your network diagnostic data including your IP address, device information, and the results above with the support team for the purpose of investigating connectivity issues. This data will not be shared with third parties.',
    submitBtn:       'I Agree and Submit',
    submitting:      'Submitting…',
    submittedBtn:    'Submitted ✓',
    submitError:     'Submission failed. Please try again.',
    submitErrorNoIP: 'Please wait for IP detection to complete before submitting.',
    detecting:       'Detecting…',
    testing:         'Testing…',
    timeout:         'Timeout ✗',
    failed:          'Failed ✗',
  },
  zh: {
    step1Label:      '步驟 1 — 自動偵測',
    yourIP:          '你的 IP',
    yourISP:         'ISP 業者',
    packetLoss:      '封包遺失率',
    deviceOS:        '裝置 / 系統',
    screenRes:       '螢幕解析度',
    timezoneLabel:   '時區',
    connectionType:  '連線類型',
    deviceMemory:    '記憶體',
    cpuCores:        'CPU 核心數',
    step2Label:      '步驟 2 — 路由追蹤',
    traceInstr1Win:  '按 <kbd>Win + R</kbd>，輸入 <kbd>cmd</kbd>，按 Enter',
    traceInstr1Mac:  '開啟<strong>終端機</strong>（Spotlight → Terminal）',
    traceInstr2:     '複製並執行以下指令：',
    traceInstr3:     '將輸出結果貼到下方欄位：',
    traceHint:       '⏳ 請等到至少出現第 15 跳（hop 15）後再貼上結果。',
    pastePlaceholder:'將 traceroute 輸出貼在這裡…',
    iosStep1:        '從 App Store 下載 <strong>Network Analyzer: net tools</strong>（免費）',
    iosStep2:        '開啟 app → 點選底部 <strong>Tools</strong>',
    iosStep3:        '選擇 <strong>Route</strong> 分頁 → 輸入下方 IP → 點右上角 <strong>Start</strong>',
    iosStep4:        '⏳ 等到至少出現第 15 跳（hop 15）',
    iosStep5:        '對結果截圖',
    iosIPsLabel:     '請對每個 IP 分別執行 Route：',
    iosAppStoreBtn:  '⬇ 前往 App Store 下載',
    androidStep1:    '在 Google Play 搜尋 <strong>Network Analyzer</strong> 並安裝（免費）',
    androidStep2:    '開啟 app → 點選 <strong>Tools</strong> → 選擇 <strong>Route</strong> 分頁',
    androidStep3:    '輸入下方 IP → 點 <strong>Start</strong>',
    androidStep4:    '⏳ 等到至少出現第 15 跳（hop 15）',
    androidStep5:    '對結果截圖',
    androidIPsLabel: '請對每個 IP 分別執行 Route：',
    androidPlayBtn:  '⬇ 前往 Google Play 下載',
    uploadScreenshot:'📷 上傳截圖',
    uploadSizeError: '檔案過大（最大 10 MB），請壓縮後再試。',
    uploadPreviewAlt:'截圖預覽',
    step3Label:      '步驟 3 — 問題詳情',
    issueTimeLabel:  '問題發生時間？',
    issueTimeSub:    '大概時間即可，不確定可留空',
    step4Label:      '步驟 4 — 提交',
    disclaimerText:  '提交此報告即表示您同意與客服團隊分享您的網路診斷資料，包含 IP 位址、裝置資訊及上述測試結果，僅用於排查連線問題。這些資料不會分享給第三方。',
    submitBtn:       '我同意並提交',
    submitting:      '提交中…',
    submittedBtn:    '已提交 ✓',
    submitError:     '提交失敗，請再試一次。',
    submitErrorNoIP: '請等待 IP 偵測完成後再提交。',
    detecting:       '偵測中…',
    testing:         '測試中…',
    timeout:         '逾時 ✗',
    failed:          '失敗 ✗',
  }
};

let currentLang = 'en';

function t(key) {
  return i18n[currentLang][key] || i18n.en[key] || key;
}

function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick') === `setLang('${lang}')`);
  });
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.dataset.i18n);
  });
  document.getElementById('step2-label').textContent = t('step2Label');
  renderStep2();
}
```

- [ ] **Step 2: Add language auto-detection in init (placeholder init — will be expanded in later tasks)**

After the i18n block, add:

```js
// ── Init (expanded in later tasks) ───────────────────────────────────────
(function init() {
  // Auto-detect language
  const browserLang = navigator.language || 'en';
  const detectedLang = (browserLang.startsWith('zh-TW') || browserLang.startsWith('zh-HK')) ? 'zh' : 'en';
  setLang(detectedLang);

  // Set header from CONFIG
  document.getElementById('header-game').textContent = CONFIG.game;
  document.getElementById('header-region').textContent = CONFIG.region;
})();
```

- [ ] **Step 3: Verify in browser**

Open the file. EN/中文 toggle buttons should work. Click 中文 — all `data-i18n` labels should switch to Chinese. Click EN — switches back. Header shows "Delta Force" and "SEA". No console errors.

- [ ] **Step 4: Commit**

```bash
git add "project/network-check/index.html"
git commit -m "feat: add i18n system with browser locale auto-detection"
```

---

### Task 3: State Object + Device Info Collection

**Files:**
- Modify: `project/network-check/index.html`

- [ ] **Step 1: Add state object after the i18n block (before init)**

```js
// ── State ─────────────────────────────────────────────────────────────────
const state = {
  ip: null, isp: null, city: null,
  latencies: {},    // { '98.98.60.43': 145, ... }
  loss: null,
  os: null, browser: null,
  screen: null, timezone: null, connectionType: null,
  deviceMemory: null, cpuCores: null,
  traces: {},       // { '98.98.60.43': 'text...', ... }
  screenshot: null, // { data: 'base64...', mimeType: 'image/jpeg' }
  platformTab: null,
};
```

- [ ] **Step 2: Add OS/browser detection functions after the state object**

```js
// ── OS / Browser detection ────────────────────────────────────────────────
function detectOS() {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad/i.test(ua)) return 'iOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

function detectBrowser() {
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua)) return 'Safari';
  return 'Browser';
}
```

- [ ] **Step 3: Add collectDeviceInfo() function**

```js
// ── Device info ───────────────────────────────────────────────────────────
function collectDeviceInfo() {
  state.os      = detectOS();
  state.browser = detectBrowser();
  document.getElementById('val-os').textContent = `${state.os} / ${state.browser}`;
  document.getElementById('val-os').className = 'cell-value';

  state.screen = `${screen.width}x${screen.height}`;
  document.getElementById('val-screen').textContent = state.screen;
  document.getElementById('val-screen').className = 'cell-value';

  state.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('val-timezone').textContent = state.timezone;
  document.getElementById('val-timezone').className = 'cell-value';

  const conn = navigator.connection;
  state.connectionType = conn ? (conn.effectiveType || '—') : '—';
  document.getElementById('val-connection').textContent = state.connectionType;
  document.getElementById('val-connection').className = 'cell-value';

  state.deviceMemory = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : '—';
  document.getElementById('val-memory').textContent = state.deviceMemory;
  document.getElementById('val-memory').className = 'cell-value';

  state.cpuCores = navigator.hardwareConcurrency || '—';
  document.getElementById('val-cpu').textContent = String(state.cpuCores);
  document.getElementById('val-cpu').className = 'cell-value';
}
```

- [ ] **Step 4: Call collectDeviceInfo() in init**

Replace the init IIFE with:

```js
(function init() {
  const browserLang = navigator.language || 'en';
  const detectedLang = (browserLang.startsWith('zh-TW') || browserLang.startsWith('zh-HK')) ? 'zh' : 'en';
  setLang(detectedLang);

  document.getElementById('header-game').textContent = CONFIG.game;
  document.getElementById('header-region').textContent = CONFIG.region;

  collectDeviceInfo();
})();
```

- [ ] **Step 5: Verify in browser**

Open file. DEVICE / OS, SCREEN, TIMEZONE, CONNECTION, MEMORY, CPU CORES cells should all show real values (not "—"). Open DevTools console and run `state` — verify `state.os`, `state.browser`, `state.screen`, `state.timezone` are populated.

- [ ] **Step 6: Commit**

```bash
git add "project/network-check/index.html"
git commit -m "feat: add state object and device info collection"
```

---

### Task 4: IP/ISP Fetch + Dynamic Server Latency Cards + Packet Loss

**Files:**
- Modify: `project/network-check/index.html`

- [ ] **Step 1: Add renderServerCards() to generate latency cells from CONFIG.servers**

Add after collectDeviceInfo():

```js
// ── Step 1: dynamic server cards ─────────────────────────────────────────
function renderServerCards() {
  const container = document.getElementById('server-latency-cards');
  container.innerHTML = CONFIG.servers.map(srv => {
    const id = `val-lat-${srv.ip.replace(/\./g, '-')}`;
    return `
      <div class="data-cell">
        <div class="cell-label">${srv.label.toUpperCase()} — ${srv.ip}</div>
        <div class="cell-value loading" id="${id}">${t('testing')}</div>
      </div>
    `;
  }).join('');
}
```

- [ ] **Step 2: Add IP fetch, latency, and packet loss functions**

```js
// ── IP + ISP ──────────────────────────────────────────────────────────────
async function fetchIPInfo() {
  try {
    const res = await fetch('https://ipinfo.io/json');
    const data = await res.json();
    state.ip   = data.ip;
    state.isp  = data.org  || '—';
    state.city = data.city || '—';
    document.getElementById('val-ip').textContent  = data.ip;
    document.getElementById('val-ip').className    = 'cell-value';
    document.getElementById('val-isp').textContent = data.org || '—';
    document.getElementById('val-isp').className   = 'cell-value';
  } catch {
    document.getElementById('val-ip').innerHTML =
      `<span style="color:#dc2626;font-size:11px">${t('failed')}</span>` +
      `<button class="retry-btn" onclick="fetchIPInfo()">↺</button>`;
    document.getElementById('val-isp').textContent = '—';
    document.getElementById('val-isp').className   = 'cell-value';
  }
}

// ── Latency via image ping ────────────────────────────────────────────────
function pingOnce(ip) {
  return new Promise(resolve => {
    const start = performance.now();
    const img   = new Image();
    const timer = setTimeout(() => { img.src = ''; resolve(3000); }, 3000);
    img.onload = img.onerror = () => {
      clearTimeout(timer);
      resolve(Math.round(performance.now() - start));
    };
    img.src = `http://${ip}/favicon.ico?_=${Date.now()}`;
  });
}

async function measureLatency(ip, reps = 5) {
  const times = [];
  for (let i = 0; i < reps; i++) {
    times.push(await pingOnce(ip));
    if (i < reps - 1) await new Promise(r => setTimeout(r, 200));
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

function latencyClass(ms) {
  if (ms >= 3000) return 'red';
  if (ms > 250)   return 'red';
  if (ms >= 100)  return 'yellow';
  return 'green';
}

function latencyLabel(ms) {
  if (ms >= 3000) return t('timeout');
  const cls  = latencyClass(ms);
  const icon = cls === 'green' ? '' : cls === 'yellow' ? ' ⚠' : ' ✗';
  return `${ms} ms${icon}`;
}

async function measureAllLatency() {
  for (const srv of CONFIG.servers) {
    const id = `val-lat-${srv.ip.replace(/\./g, '-')}`;
    const el = document.getElementById(id);
    const ms = await measureLatency(srv.ip);
    state.latencies[srv.ip] = ms;
    el.textContent = latencyLabel(ms);
    el.className   = `cell-value ${latencyClass(ms)}`;
  }
}

// ── Packet loss (20 pings) ────────────────────────────────────────────────
async function measurePacketLoss() {
  const lossEl = document.getElementById('val-loss');
  const total  = 20;
  let fails    = 0;
  const targetIp = CONFIG.servers[0].ip;

  for (let i = 0; i < total; i++) {
    const ms = await pingOnce(targetIp);
    if (ms >= 3000) fails++;
    const done = i + 1;
    const pct  = Math.round((fails / done) * 100);
    lossEl.textContent = `${pct}% (${done}/${total})`;
    lossEl.className   = 'cell-value loading';
    if (i < total - 1) await new Promise(r => setTimeout(r, 500));
  }

  const lossPercent = Math.round((fails / total) * 100);
  state.loss = lossPercent;
  const lossCls  = lossPercent === 0 ? 'green' : lossPercent <= 3 ? 'yellow' : 'red';
  const lossIcon = lossPercent === 0 ? '' : lossPercent <= 3 ? ' ⚠' : ' ✗';
  lossEl.textContent = `${lossPercent}%${lossIcon}`;
  lossEl.className   = `cell-value ${lossCls}`;
}
```

- [ ] **Step 3: Call all collection functions from init**

Replace the init IIFE:

```js
(function init() {
  const browserLang  = navigator.language || 'en';
  const detectedLang = (browserLang.startsWith('zh-TW') || browserLang.startsWith('zh-HK')) ? 'zh' : 'en';
  setLang(detectedLang);

  document.getElementById('header-game').textContent   = CONFIG.game;
  document.getElementById('header-region').textContent = CONFIG.region;

  collectDeviceInfo();
  renderServerCards();
  fetchIPInfo();
  measureAllLatency().then(() => measurePacketLoss());
})();
```

- [ ] **Step 4: Verify in browser**

Open file. Server latency cards should appear (one per entry in CONFIG.servers) and cycle through "Testing…" → colored value. Packet loss shows live counter `0% (1/20)` → … → final value. IP and ISP populate after a second.

Open console and verify: `state.ip`, `state.latencies`, `state.loss` all populated after load completes.

- [ ] **Step 5: Commit**

```bash
git add "project/network-check/index.html"
git commit -m "feat: dynamic server latency cards, IP fetch, packet loss"
```

---

### Task 5: Step 2 — PC Traceroute Guide (Dynamic)

**Files:**
- Modify: `project/network-check/index.html`

- [ ] **Step 1: Add helper functions and renderStep2() for PC tab**

Add after the packet loss function:

```js
// ── Step 2: platform detection helpers ───────────────────────────────────
function getActivePlatform() {
  const autoTab = (state.os === 'iOS' || state.os === 'Android') ? state.os : 'PC';
  return state.platformTab || autoTab;
}

function setPlatform(tab) {
  const autoTab = (state.os === 'iOS' || state.os === 'Android') ? state.os : 'PC';
  state.platformTab = (tab === autoTab) ? null : tab;
  renderStep2();
}

function copyCmd(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

function onTraceInput(ip, value) {
  state.traces[ip] = value;
}

// ── renderStep2 ───────────────────────────────────────────────────────────
function renderStep2() {
  const label   = document.getElementById('step2-label');
  const content = document.getElementById('step2-content');
  const active  = getActivePlatform();

  label.textContent = t('step2Label');

  const tabsHtml = `
    <div class="platform-tabs">
      <button class="platform-tab ${active === 'PC' ? 'active' : ''}" onclick="setPlatform('PC')">PC / Mac</button>
      <button class="platform-tab ${active === 'iOS' ? 'active' : ''}" onclick="setPlatform('iOS')">iOS</button>
      <button class="platform-tab ${active === 'Android' ? 'active' : ''}" onclick="setPlatform('Android')">Android</button>
    </div>
  `;

  if (active === 'PC') {
    const desktopOS = (state.os === 'iOS' || state.os === 'Android') ? 'Windows' : (state.os || 'Windows');
    const isWin     = desktopOS !== 'macOS';
    const cmdPrefix = isWin ? 'tracert' : 'traceroute';
    const instr1    = isWin ? t('traceInstr1Win') : t('traceInstr1Mac');

    const instrHtml = `
      <ol class="instructions" style="list-style:none;margin-bottom:14px">
        <li data-n="1">${instr1}</li>
        <li data-n="2">${t('traceInstr2')}</li>
      </ol>
    `;

    const serversHtml = CONFIG.servers.map(srv => {
      const tid = `trace-${srv.ip.replace(/\./g, '-')}`;
      const cmd = `${cmdPrefix} ${srv.ip}`;
      return `
        <div class="tracert-server">
          <div class="tracert-label">${srv.label} — ${srv.ip}</div>
          <div class="code-block">
            <span>${cmd}</span>
            <button class="copy-btn" onclick="copyCmd('${cmd}', this)">Copy</button>
          </div>
          <div style="font-size:12px;color:#64748b;margin-bottom:4px">${t('traceInstr3')}</div>
          <div style="font-size:11px;color:#d97706;margin-bottom:6px">${t('traceHint')}</div>
          <textarea
            class="paste-area"
            id="${tid}"
            placeholder="${t('pastePlaceholder')}"
            oninput="onTraceInput('${srv.ip}', this.value)"
          ></textarea>
        </div>
      `;
    }).join('');

    content.innerHTML = tabsHtml + instrHtml + serversHtml;

    // Restore previously pasted content after re-render
    CONFIG.servers.forEach(srv => {
      const el = document.getElementById(`trace-${srv.ip.replace(/\./g, '-')}`);
      if (el && state.traces[srv.ip]) el.value = state.traces[srv.ip];
    });
    return;
  }

  // Mobile tabs rendered in Task 6 — placeholder for now
  content.innerHTML = tabsHtml + `<p style="color:#64748b;font-size:13px">Mobile guide coming in Task 6.</p>`;
}
```

- [ ] **Step 2: Call renderStep2() from init**

Add `renderStep2();` inside the init IIFE, after `collectDeviceInfo()`:

```js
(function init() {
  const browserLang  = navigator.language || 'en';
  const detectedLang = (browserLang.startsWith('zh-TW') || browserLang.startsWith('zh-HK')) ? 'zh' : 'en';
  setLang(detectedLang);

  document.getElementById('header-game').textContent   = CONFIG.game;
  document.getElementById('header-region').textContent = CONFIG.region;

  collectDeviceInfo();
  renderStep2();
  renderServerCards();
  fetchIPInfo();
  measureAllLatency().then(() => measurePacketLoss());
})();
```

- [ ] **Step 3: Also call renderStep2() from setLang() so tabs re-render on language switch**

The setLang function already calls `renderStep2()` — verify this is present in the setLang body (added in Task 2).

- [ ] **Step 4: Verify in browser**

On Windows: Step 2 should show `tracert 98.98.60.43` and `tracert 98.98.61.31` each with a Copy button and paste textarea. On Mac: shows `traceroute` commands. Paste some text in textarea → switch language → paste should persist. Click iOS tab → shows placeholder. Click PC tab → paste still there. Console: `state.traces` updates as you type.

- [ ] **Step 5: Commit**

```bash
git add "project/network-check/index.html"
git commit -m "feat: Step 2 PC traceroute guide with dynamic server list"
```

---

### Task 6: Step 2 — Mobile Guide + Screenshot Upload

**Files:**
- Modify: `project/network-check/index.html`

- [ ] **Step 1: Add screenshot upload handler after onTraceInput()**

```js
// ── Screenshot upload ─────────────────────────────────────────────────────
function handleScreenshotUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const errEl = document.getElementById('upload-error');
  if (file.size > 10 * 1024 * 1024) {
    errEl.textContent = t('uploadSizeError');
    errEl.style.display = 'block';
    input.value = '';
    return;
  }
  errEl.style.display = 'none';

  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    state.screenshot = {
      data:     dataUrl.split(',')[1],
      mimeType: file.type,
    };
    const preview = document.getElementById('upload-preview');
    preview.src          = dataUrl;
    preview.style.display = 'block';
    preview.alt           = t('uploadPreviewAlt');
  };
  reader.readAsDataURL(file);
}
```

- [ ] **Step 2: Replace the mobile placeholder in renderStep2() with full iOS/Android guide**

Find the section in `renderStep2()` that says:
```js
// Mobile tabs rendered in Task 6 — placeholder for now
content.innerHTML = tabsHtml + `<p style="color:#64748b;font-size:13px">Mobile guide coming in Task 6.</p>`;
```

Replace it with:

```js
  const isIOS   = active === 'iOS';
  const steps   = isIOS
    ? ['iosStep1','iosStep2','iosStep3','iosStep4','iosStep5']
    : ['androidStep1','androidStep2','androidStep3','androidStep4','androidStep5'];
  const ipsLabel = t(isIOS ? 'iosIPsLabel' : 'androidIPsLabel');
  const storeUrl = isIOS
    ? 'https://apps.apple.com/app/network-analyzer/id562315041'
    : 'https://play.google.com/store/apps/details?id=net.techet.netanalyzerlite.an';
  const storeBtn = t(isIOS ? 'iosAppStoreBtn' : 'androidPlayBtn');

  const stepsHtml = steps.map((key, i) => `
    <li data-n="${i + 1}" ${i === 3 ? 'style="color:#d97706"' : ''}>${t(key)}</li>
  `).join('');

  const ipsHtml = CONFIG.servers.map(srv => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:10px;font-weight:700;color:#94a3b8">${srv.label}</span>
      <span style="font-family:monospace;font-size:13px;color:#0f172a;flex:1">${srv.ip}</span>
      <button class="copy-btn" onclick="copyCmd('${srv.ip}', this)">Copy</button>
    </div>
  `).join('');

  const previewSrc = state.screenshot ? `data:${state.screenshot.mimeType};base64,${state.screenshot.data}` : '';
  const previewVis = state.screenshot ? 'block' : 'none';

  content.innerHTML = tabsHtml + `
    <ol class="instructions" style="list-style:none;margin-bottom:14px">${stepsHtml}</ol>
    <div style="background:#f8fafc;border-radius:8px;padding:10px;margin-bottom:12px">
      <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">${ipsLabel}</div>
      ${ipsHtml}
    </div>
    <a href="${storeUrl}" target="_blank"
       style="display:block;background:#4f46e5;color:#fff;text-align:center;border-radius:8px;padding:10px;font-size:13px;font-weight:600;text-decoration:none;margin-bottom:12px">
      ${storeBtn}
    </a>
    <div class="upload-area">
      <label class="upload-btn" for="screenshot-input">${t('uploadScreenshot')}</label>
      <input type="file" id="screenshot-input" accept="image/*" style="display:none"
             onchange="handleScreenshotUpload(this)">
      <div class="upload-error" id="upload-error"></div>
      <img class="upload-preview" id="upload-preview"
           src="${previewSrc}" style="display:${previewVis}"
           alt="${t('uploadPreviewAlt')}">
    </div>
  `;
```

- [ ] **Step 3: Verify in browser**

Click iOS tab → see 5-step guide with Network Analyzer steps, IP list with Copy buttons, App Store download link, and an upload area. Click Upload Screenshot → file picker opens. Select an image under 10MB → thumbnail appears below. Select image over 10MB → error message appears. Switch back to PC tab → paste areas still there. Switch to iOS again → thumbnail still showing (state preserved).

- [ ] **Step 4: Commit**

```bash
git add "project/network-check/index.html"
git commit -m "feat: Step 2 mobile guide with screenshot upload and preview"
```

---

### Task 7: Step 3 Issue Time + Step 4 Disclaimer + Submit

**Files:**
- Modify: `project/network-check/index.html`

- [ ] **Step 1: Add timestamp formatter, issue time helper, and submit handler after the upload handler**

```js
// ── Timestamp ─────────────────────────────────────────────────────────────
function formatTimestamp() {
  const now    = new Date();
  const offset = 8 * 60;
  const local  = new Date(now.getTime() + (offset - now.getTimezoneOffset()) * 60000);
  return local.toISOString().replace('T', ' ').slice(0, 19) + ' UTC+8';
}

function buildIssueTime() {
  const d = document.getElementById('issue-date').value;
  const ti = document.getElementById('issue-time').value;
  return [d, ti].filter(Boolean).join(' ');
}

// ── Submit ────────────────────────────────────────────────────────────────
function showSubmitError(msg) {
  const el = document.getElementById('submit-error');
  el.textContent    = msg;
  el.style.display  = 'block';
}

function hideSubmitError() {
  document.getElementById('submit-error').style.display = 'none';
}

async function submitReport() {
  const btn = document.getElementById('submit-btn');

  if (!state.ip) {
    showSubmitError(t('submitErrorNoIP'));
    return;
  }
  hideSubmitError();

  const payload = {
    submissionTime: formatTimestamp(),
    issueTime:      buildIssueTime(),
    ip:             state.ip,
    isp:            state.isp            || '—',
    city:           state.city           || '—',
    os:             state.os             || '—',
    browser:        state.browser        || '—',
    screen:         state.screen         || '—',
    timezone:       state.timezone       || '—',
    connectionType: state.connectionType || '—',
    deviceMemory:   state.deviceMemory   || '—',
    cpuCores:       String(state.cpuCores || '—'),
    servers:        CONFIG.servers.map(srv => ({
      label:      srv.label,
      ip:         srv.ip,
      latency:    state.latencies[srv.ip] !== undefined ? state.latencies[srv.ip] : null,
      traceroute: state.traces[srv.ip] || '',
    })),
    packetLoss: state.loss,
    platform:   getActivePlatform(),
    language:   currentLang,
    screenshot: state.screenshot || null,
  };

  // Dev mode: log payload when URL not configured
  if (!CONFIG.appsScriptUrl) {
    console.log('[Dev] Apps Script URL not set. Payload:', JSON.stringify(payload, null, 2));
    btn.textContent       = t('submittedBtn');
    btn.style.background  = '#059669';
    btn.disabled          = true;
    return;
  }

  btn.disabled     = true;
  btn.textContent  = t('submitting');

  try {
    await fetch(CONFIG.appsScriptUrl, {
      method: 'POST',
      mode:   'no-cors',   // Apps Script CORS quirk — response is opaque but data is received
      body:   JSON.stringify(payload),
    });
    btn.textContent      = t('submittedBtn');
    btn.style.background = '#059669';
  } catch (err) {
    btn.disabled    = false;
    btn.textContent = t('submitBtn');
    showSubmitError(t('submitError') + ' (' + err.message + ')');
  }
}
```

- [ ] **Step 2: Verify in browser — full flow test**

1. Let the page load fully (wait for packet loss to finish)
2. Leave issue date/time blank
3. Click "I Agree and Submit"
4. Since `CONFIG.appsScriptUrl` is empty, button should turn green ("Submitted ✓") and console should print the full payload JSON
5. Verify in console: `servers` array has correct IPs and latencies, `ip` is populated, `platform` is correct

- [ ] **Step 3: Test error state**

Reload page. Immediately click submit before IP loads. Should see "Please wait for IP detection…" error message in red below the button.

- [ ] **Step 4: Test language switch**

Switch to 中文. Step 4 disclaimer and button should switch to Chinese. Submit button label should now say "我同意並提交".

- [ ] **Step 5: Commit**

```bash
git add "project/network-check/index.html"
git commit -m "feat: issue time input, disclaimer, and submit handler"
```

---

### Task 8: Apps Script Backend

**Files:**
- Create: `project/network-check/apps-script.js`

This file is **not run locally** — it is copy-pasted into the Google Apps Script editor at [script.google.com](https://script.google.com). It is stored here for version control.

- [ ] **Step 1: Create the Apps Script file**

Create `project/network-check/apps-script.js`:

```js
// ── Configuration — fill these before deploying ───────────────────────────
const SHEET_ID        = '';  // from Google Sheets URL: /d/<SHEET_ID>/edit
const DRIVE_FOLDER_ID = '';  // from Google Drive folder URL: /folders/<ID>
const SEATALK_WEBHOOK_URL = '';  // fill to enable SeaTalk notifications (B2 upgrade)

// Must match CONFIG.servers[].label in index.html (used for header row only)
const SERVER_LABELS = ['Server A', 'Server B'];

// ── Run once after deploy to create the header row ───────────────────────
function setup() {
  const sheet      = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  const latHeaders = SERVER_LABELS.map(l => `${l} Latency (ms)`);
  const traceHdrs  = SERVER_LABELS.map(l => `Traceroute — ${l}`);
  const headers    = [
    'Submission Time', 'Issue Time', 'IP', 'ISP', 'City',
    'OS', 'Browser', 'Screen Resolution', 'Timezone', 'Connection Type',
    'Device Memory (GB)', 'CPU Cores',
    ...latHeaders,
    'Packet Loss (%)', 'Platform',
    ...traceHdrs,
    'Screenshot URL', 'Language', 'Ping Command',
    'Reverse Ping Result', 'Status',
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
}

// ── Main handler ──────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    // Save screenshot to Drive if present
    let screenshotUrl = '—';
    if (payload.screenshot) {
      const folder   = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const filename = `${payload.submissionTime}_${payload.ip}.jpg`.replace(/[: ]/g, '-');
      const blob     = Utilities.newBlob(
        Utilities.base64Decode(payload.screenshot.data),
        payload.screenshot.mimeType,
        filename
      );
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      screenshotUrl = file.getUrl();
    }

    // Build row — column order must match setup() headers
    const latencies = payload.servers.map(s => s.latency !== null ? s.latency : '—');
    const traces    = payload.servers.map(s => s.traceroute || '—');
    const row       = [
      payload.submissionTime,
      payload.issueTime      || '—',
      payload.ip             || '—',
      payload.isp            || '—',
      payload.city           || '—',
      payload.os             || '—',
      payload.browser        || '—',
      payload.screen         || '—',
      payload.timezone       || '—',
      payload.connectionType || '—',
      payload.deviceMemory   || '—',
      payload.cpuCores       || '—',
      ...latencies,
      payload.packetLoss !== null ? payload.packetLoss : '—',
      payload.platform       || '—',
      ...traces,
      screenshotUrl,
      payload.language       || 'en',
      `ping -c 20 ${payload.ip}`,
      '',         // Reverse Ping Result — GTO fills this manually
      'Pending',  // Status — GTO updates to 'Done'
    ];

    SpreadsheetApp.openById(SHEET_ID).getActiveSheet().appendRow(row);

    // SeaTalk webhook — B2 upgrade. Fill SEATALK_WEBHOOK_URL above to activate.
    if (SEATALK_WEBHOOK_URL) {
      const msg = {
        tag:  'text',
        text: {
          content: `[Network Check] New report\nIP: ${payload.ip}\nIssue time: ${payload.issueTime || 'unknown'}\nPlatform: ${payload.platform}\nRun: ping -c 20 ${payload.ip}`
        }
      };
      UrlFetchApp.fetch(SEATALK_WEBHOOK_URL, {
        method:      'post',
        contentType: 'application/json',
        payload:     JSON.stringify(msg),
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add "project/network-check/apps-script.js"
git commit -m "feat: add Apps Script backend with setup() and doPost()"
```

---

### Task 9: End-to-End Test + Deploy Walkthrough

**Files:**
- Modify: `project/network-check/index.html` (fill CONFIG.appsScriptUrl after deploying)

This task guides you through the one-time Google Cloud setup and verifies the full data flow.

- [ ] **Step 1: Create Google Sheets**

1. Go to [sheets.new](https://sheets.new) — creates a blank Sheet
2. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/`**`<SHEET_ID>`**`/edit`
3. Note it — you will paste into `apps-script.js`

- [ ] **Step 2: Create Google Drive folder for screenshots**

1. Go to [drive.google.com](https://drive.google.com) → New → Folder → name it "Network Check Screenshots"
2. Open the folder → copy the folder ID from URL: `https://drive.google.com/drive/folders/`**`<FOLDER_ID>`**

- [ ] **Step 3: Deploy Apps Script**

1. Go to [script.google.com](https://script.google.com) → New Project
2. Rename project to "Network Check"
3. Delete all default code in the editor
4. Copy the entire contents of `project/network-check/apps-script.js`
5. Paste into the editor
6. Fill in `SHEET_ID` and `DRIVE_FOLDER_ID` with the values from Steps 1-2
7. Save (Ctrl+S)
8. Run `setup` function: click the function dropdown at top → select `setup` → click Run
   - Grant permissions when prompted (allow access to Sheets and Drive)
   - Check your Google Sheets — row 1 should now have bold headers
9. Deploy: click **Deploy** → **New deployment**
   - Type: Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click Deploy → copy the **Web App URL**

- [ ] **Step 4: Configure index.html**

Open `project/network-check/index.html`. Find:
```js
appsScriptUrl: '',   // paste your Apps Script Web App URL here after deploying
```
Replace the empty string with your Web App URL:
```js
appsScriptUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
```

- [ ] **Step 5: Full submission test**

1. Open `project/network-check/index.html` in browser
2. Wait for all Step 1 data to populate (IP, latencies, packet loss)
3. On PC: paste any dummy text in the Server A traceroute textarea
4. Set issue date to today, time to 10:00
5. Click "I Agree and Submit" → button should show "Submitting…" then turn green "Submitted ✓"
6. Open Google Sheets → verify a new row appeared with all columns populated
7. Verify "Ping Command" column shows `ping -c 20 <your-ip>`
8. Verify "Status" column shows "Pending"

- [ ] **Step 6: Test screenshot upload (mobile simulation)**

1. In Chrome DevTools, toggle mobile device emulation (iPhone)
2. Click iOS tab in Step 2
3. Click "Upload Screenshot" → select any image from your computer
4. Thumbnail preview should appear
5. Submit → check Drive folder for the uploaded image, check Sheets row for Drive URL

- [ ] **Step 7: Commit final version**

```bash
git add "project/network-check/index.html"
git commit -m "feat: complete Phase 2 — wire CONFIG.appsScriptUrl for live submission"
```

- [ ] **Step 8: Push to GitHub and enable GitHub Pages**

```bash
git push origin main
```

Then in GitHub repo settings → Pages → Source: Deploy from branch → Branch: main → Folder: `/project/network-check` → Save. Your tool will be live at `https://<username>.github.io/<repo>/project/network-check/`.

---

## Self-Review Checklist

**Spec coverage:**
- ✅ CONFIG object for multi-game reuse
- ✅ Language auto-detect + manual toggle (EN/ZH-TW)
- ✅ Step 1: IP, ISP, latency (dynamic per CONFIG.servers), packet loss, OS/browser, screen, timezone, connection type, device memory, CPU cores
- ✅ Step 2 PC: traceroute commands + paste areas, dynamic per CONFIG.servers
- ✅ Step 2 mobile: Network Analyzer guide + screenshot upload + thumbnail preview
- ✅ Step 3: Issue time input (date + time, optional)
- ✅ Step 4: Disclaimer + submit button, locks on success
- ✅ Apps Script: doPost() writes text to Sheets + image to Drive + auto-fills Ping Command column
- ✅ GTO workflow: Ping Command auto-generated, Reverse Ping Result + Status columns pre-created
- ✅ SeaTalk stub (SEATALK_WEBHOOK_URL = '' blocks execution, fill to activate)
- ✅ Error handling: IP fail → retry button; submit fail → re-enables button; screenshot > 10MB → blocked
- ✅ Dev mode: no-op submit when appsScriptUrl empty (logs payload to console)
- ✅ GitHub Pages deploy instructions

**Type consistency:**
- `state.latencies[srv.ip]` — used consistently in Task 4 (write) and Task 7 (read payload)
- `state.traces[srv.ip]` — used consistently in Task 5 (write via onTraceInput) and Task 7 (read payload)
- `state.screenshot` shape `{ data, mimeType }` — consistent between Task 6 (write) and Task 7 + Apps Script (read)
- `getActivePlatform()` — defined in Task 5, used in Task 7
- `currentLang` — defined in Task 2, used in Task 7 (payload.language)
- `CONFIG.servers[0].ip` for packet loss in Task 4 — packet loss always uses first server IP as target
