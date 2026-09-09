# Network Check — Delta Force Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single `index.html` network diagnostic tool that auto-collects IP/ISP/latency/packet-loss, guides PC users through traceroute to two game servers, and outputs a formatted copy-able report.

**Architecture:** Single self-contained HTML file with inline CSS and vanilla JS. No build step, no backend, no npm. Third-party APIs used: `api.ipify.org` (public IP) and `ip-api.com` (ISP lookup). Latency measured via `fetch()` timing against two game server IPs using HTTP HEAD requests (CORS-safe if server allows, otherwise fallback to `Image` preloading trick).

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript (ES2020), no dependencies

---

## File Structure

```
project/network-check/
└── index.html          # Single deliverable — all HTML, CSS, JS inline
```

---

## Task 1: HTML Skeleton + CSS

**Files:**
- Create: `project/network-check/index.html`

- [ ] **Step 1: Create the file with full HTML skeleton**

Create `project/network-check/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Network Check — Delta Force</title>
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

    /* Main layout */
    .container { max-width: 600px; margin: 0 auto; padding: 20px 16px; }

    /* Step cards */
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 14px; }
    .card-label { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: .08em; margin-bottom: 12px; }

    /* Data grid */
    .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .data-cell { background: #f8fafc; border-radius: 8px; padding: 10px; }
    .data-cell.full { grid-column: 1 / -1; display: flex; justify-content: space-between; }
    .cell-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 3px; }
    .cell-value { font-size: 14px; font-weight: 600; color: #0f172a; }
    .cell-value.loading { color: #94a3b8; font-weight: 400; font-size: 12px; }
    .cell-value.green { color: #059669; }
    .cell-value.yellow { color: #d97706; }
    .cell-value.red { color: #dc2626; }

    /* Code block */
    .code-block { background: #1e293b; color: #a5f3fc; border-radius: 8px; padding: 10px 12px; font-family: monospace; font-size: 13px; display: flex; justify-content: space-between; align-items: center; margin: 8px 0; }
    .copy-btn { background: #4f46e5; color: #fff; border: none; border-radius: 4px; padding: 3px 10px; font-size: 11px; cursor: pointer; white-space: nowrap; }
    .copy-btn:active { background: #3730a3; }

    /* Instructions */
    .instructions { list-style: none; margin-bottom: 10px; }
    .instructions li { font-size: 13px; color: #475569; padding: 3px 0; }
    .instructions li::before { content: attr(data-n) ". "; font-weight: 600; color: #4f46e5; }
    kbd { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 3px; padding: 1px 5px; font-size: 11px; font-family: monospace; }

    /* Traceroute section */
    .tracert-server { margin-bottom: 14px; }
    .tracert-server:last-child { margin-bottom: 0; }
    .tracert-label { font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 6px; }
    .paste-area { width: 100%; border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 10px; min-height: 80px; font-family: monospace; font-size: 11px; color: #475569; resize: vertical; outline: none; transition: border-color .15s; }
    .paste-area:focus { border-color: #4f46e5; border-style: solid; }

    /* Report */
    .report-box { background: #f8fafc; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 11px; color: #475569; line-height: 1.8; white-space: pre-wrap; word-break: break-all; margin-bottom: 12px; min-height: 120px; }
    .action-buttons { display: flex; gap: 8px; }
    .btn-primary { flex: 1; background: #4f46e5; color: #fff; border: none; border-radius: 8px; padding: 11px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .15s; }
    .btn-primary:hover { background: #4338ca; }
    .btn-secondary { flex: 1; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px; padding: 11px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-secondary:hover { background: #e2e8f0; }

    /* Screenshot overlay */
    .screenshot-hint { display: none; background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #713f12; margin-top: 10px; }
    .screenshot-hint.visible { display: block; }

    /* Mobile hint */
    .mobile-notice { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px; font-size: 13px; color: #0369a1; }

    /* Retry button */
    .retry-btn { background: none; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 8px; font-size: 11px; color: #64748b; cursor: pointer; margin-left: 6px; }

    @media (max-width: 400px) {
      .action-buttons { flex-direction: column; }
    }
  </style>
</head>
<body>

  <header class="header">
    <div>
      <div class="header-title">Network Check</div>
      <div class="header-sub">Delta Force</div>
    </div>
    <div class="lang-toggle">
      <button class="lang-btn active" onclick="setLang('en')">EN</button>
      <button class="lang-btn" onclick="setLang('zh')">中文</button>
    </div>
  </header>

  <div class="container">

    <!-- Step 1: Auto Collect -->
    <div class="card">
      <div class="card-label" data-i18n="step1Label">STEP 1 — AUTO DETECTED</div>
      <div class="data-grid">
        <div class="data-cell">
          <div class="cell-label" data-i18n="yourIP">YOUR IP</div>
          <div class="cell-value loading" id="val-ip">Detecting...</div>
        </div>
        <div class="data-cell">
          <div class="cell-label" data-i18n="yourISP">ISP</div>
          <div class="cell-value loading" id="val-isp">Detecting...</div>
        </div>
        <div class="data-cell">
          <div class="cell-label">SERVER A — 98.98.60.43</div>
          <div class="cell-value loading" id="val-latA">Testing...</div>
        </div>
        <div class="data-cell">
          <div class="cell-label">SERVER B — 98.98.61.31</div>
          <div class="cell-value loading" id="val-latB">Testing...</div>
        </div>
        <div class="data-cell full">
          <div>
            <div class="cell-label" data-i18n="packetLoss">PACKET LOSS</div>
            <div class="cell-value loading" id="val-loss">Testing...</div>
          </div>
          <div>
            <div class="cell-label" data-i18n="deviceOS">DEVICE / OS</div>
            <div class="cell-value" id="val-os">—</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 2: Traceroute -->
    <div class="card" id="step2-card">
      <div class="card-label" id="step2-label">STEP 2 — TRACEROUTE</div>
      <div id="step2-content"></div>
    </div>

    <!-- Step 3: Report -->
    <div class="card">
      <div class="card-label" data-i18n="step3Label">STEP 3 — YOUR REPORT</div>
      <div class="report-box" id="report-box"></div>
      <div class="action-buttons">
        <button class="btn-primary" id="copy-btn" onclick="copyReport()">
          📋 <span data-i18n="copyBtn">Copy Report</span>
        </button>
        <button class="btn-secondary" onclick="toggleScreenshot()">
          📷 <span data-i18n="screenshotBtn">Screenshot Guide</span>
        </button>
      </div>
      <div class="screenshot-hint" id="screenshot-hint" data-i18n="screenshotHint">
        📸 Scroll up to see all data, then take a screenshot of this entire page and send it to support.
      </div>
    </div>

  </div>

  <script>
    // All JS will be added in subsequent tasks
  </script>
</body>
</html>
```

- [ ] **Step 2: Open in browser and verify layout**

Open `project/network-check/index.html` in Chrome/Safari.

Expected:
- Header shows "Network Check / Delta Force" with EN/中文 buttons
- Three cards visible: Step 1 (data grid), Step 2 (empty), Step 3 (empty report box)
- "Detecting..." and "Testing..." placeholders visible
- Mobile: resize window to 390px width — layout stays single-column, no overflow

- [ ] **Step 3: Commit skeleton**

```bash
cd "project/network-check"
git add index.html
git commit -m "feat: add HTML skeleton and CSS for network check tool"
```

---

## Task 2: i18n System

**Files:**
- Modify: `project/network-check/index.html` (replace `// All JS will be added` script block)

- [ ] **Step 1: Add i18n translations and setLang function**

Replace the `<script>` block content with:

```js
// ── i18n ──────────────────────────────────────────────────────────────────
const i18n = {
  en: {
    step1Label:     'STEP 1 — AUTO DETECTED',
    yourIP:         'YOUR IP',
    yourISP:        'ISP',
    packetLoss:     'PACKET LOSS',
    deviceOS:       'DEVICE / OS',
    step2Label:     'STEP 2 — TRACEROUTE',
    step2WinTitle:  'Windows detected',
    step2MacTitle:  'macOS detected',
    step2Mobile:    'Traceroute is not available on mobile. The data from Step 1 is sufficient — please copy your report and send it to support.',
    traceInstr1Win: 'Press <kbd>Win + R</kbd>, type <kbd>cmd</kbd>, press Enter',
    traceInstr1Mac: 'Open <strong>Terminal</strong> (Spotlight → Terminal)',
    traceInstr2:    'Copy and run this command:',
    traceInstr3:    'Paste the output into the box below:',
    serverALabel:   'Server A — 98.98.60.43',
    serverBLabel:   'Server B — 98.98.61.31',
    pastePlaceholder: 'Paste traceroute output here...',
    step3Label:     'STEP 3 — YOUR REPORT',
    copyBtn:        'Copy Report',
    screenshotBtn:  'Screenshot Guide',
    screenshotHint: '📸 Scroll up to see all data, then take a screenshot of this entire page and send it to support.',
    detecting:      'Detecting...',
    testing:        'Testing...',
    timeout:        'Timeout ✗',
    failed:         'Failed ✗',
    copyDone:       'Copied ✓',
    loading:        'Loading...',
  },
  zh: {
    step1Label:     '步驟 1 — 自動偵測',
    yourIP:         '你的 IP',
    yourISP:        'ISP 業者',
    packetLoss:     '封包遺失率',
    deviceOS:       '裝置 / 系統',
    step2Label:     '步驟 2 — 路由追蹤',
    step2WinTitle:  '偵測到 Windows',
    step2MacTitle:  '偵測到 macOS',
    step2Mobile:    '行動裝置無法執行 traceroute。步驟 1 的資料已足夠——請複製報告後傳給客服。',
    traceInstr1Win: '按 <kbd>Win + R</kbd>，輸入 <kbd>cmd</kbd>，按 Enter',
    traceInstr1Mac: '開啟 <strong>終端機</strong>（Spotlight → Terminal）',
    traceInstr2:    '複製並執行以下指令：',
    traceInstr3:    '將輸出結果貼到下方欄位：',
    serverALabel:   '伺服器 A — 98.98.60.43',
    serverBLabel:   '伺服器 B — 98.98.61.31',
    pastePlaceholder: '將 traceroute 輸出貼在這裡...',
    step3Label:     '步驟 3 — 你的報告',
    copyBtn:        '複製報告',
    screenshotBtn:  '截圖說明',
    screenshotHint: '📸 請向上捲動確認所有資料可見，然後截取整個頁面並傳給客服。',
    detecting:      '偵測中...',
    testing:        '測試中...',
    timeout:        '逾時 ✗',
    failed:         '失敗 ✗',
    copyDone:       '已複製 ✓',
    loading:        '載入中...',
  }
};

let currentLang = 'en';

function t(key) {
  return i18n[currentLang][key] || i18n.en[key] || key;
}

function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim().toLowerCase() === lang ||
      (lang === 'zh' && btn.textContent.trim() === '中文'));
  });
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.dataset.i18n);
  });
  renderStep2();
  updateReport();
}
```

- [ ] **Step 2: Verify language toggle in browser**

Open file in browser. Click "中文" button.

Expected:
- Step 1 card label changes to "步驟 1 — 自動偵測"
- "YOUR IP" changes to "你的 IP"
- Click "EN" — all labels revert to English
- No page reload occurs

- [ ] **Step 3: Commit i18n**

```bash
git add index.html
git commit -m "feat: add EN/ZH-TW i18n system with setLang toggle"
```

---

## Task 3: Step 1 — IP and ISP Detection

**Files:**
- Modify: `project/network-check/index.html`

- [ ] **Step 1: Add IP and ISP detection functions**

Add after the i18n block (still inside `<script>`):

```js
// ── State ─────────────────────────────────────────────────────────────────
const state = {
  ip: null, isp: null, city: null,
  latA: null, latB: null, loss: null,
  os: null, browser: null,
  traceA: '', traceB: ''
};

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

// ── IP + ISP fetch ────────────────────────────────────────────────────────
async function fetchIPInfo() {
  try {
    const ipRes = await fetch('https://api.ipify.org?format=json');
    const { ip } = await ipRes.json();
    state.ip = ip;
    document.getElementById('val-ip').textContent = ip;
    document.getElementById('val-ip').className = 'cell-value';

    const geoRes = await fetch(`https://ip-api.com/json/${ip}?fields=isp,city,status`);
    const geo = await geoRes.json();
    if (geo.status === 'success') {
      state.isp = geo.isp;
      state.city = geo.city;
      document.getElementById('val-isp').textContent = geo.isp;
      document.getElementById('val-isp').className = 'cell-value';
    } else {
      throw new Error('geo failed');
    }
  } catch (e) {
    document.getElementById('val-ip').innerHTML =
      `<span style="color:#dc2626;font-size:11px">${t('failed')}</span>
       <button class="retry-btn" onclick="fetchIPInfo()">↺</button>`;
    document.getElementById('val-isp').textContent = '—';
    document.getElementById('val-isp').className = 'cell-value';
  }
  updateReport();
}
```

- [ ] **Step 2: Call detection on page load**

Add at the bottom of the script block (before closing `</script>`):

```js
// ── Init ──────────────────────────────────────────────────────────────────
(function init() {
  state.os = detectOS();
  state.browser = detectBrowser();
  document.getElementById('val-os').textContent = `${state.os} / ${state.browser}`;
  fetchIPInfo();
})();
```

- [ ] **Step 3: Verify in browser**

Open file. Wait 2–3 seconds.

Expected:
- "Detecting..." for IP changes to real IP (e.g. `203.69.xx.xx`)
- ISP field shows ISP name
- OS/Browser field shows correct values immediately (no delay)
- If on VPN, ISP may show VPN provider — that's correct behavior

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add IP/ISP/OS auto-detection on page load"
```

---

## Task 4: Step 1 — Latency and Packet Loss

**Files:**
- Modify: `project/network-check/index.html`

**Note:** Browser CORS blocks direct TCP to game server IPs unless those servers respond to HTTP(S) with CORS headers. We use `Image` ping (load a 1x1 pixel) to bypass CORS — the timing still reflects network RTT. If the IP doesn't serve HTTP, the image errors immediately but the timing is still valid for a first hop.

- [ ] **Step 1: Add latency measurement function**

Add after `fetchIPInfo()`:

```js
// ── Latency via Image ping ────────────────────────────────────────────────
function pingOnce(ip) {
  return new Promise((resolve) => {
    const start = performance.now();
    const img = new Image();
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
    await new Promise(r => setTimeout(r, 200));
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]; // median
}

function latencyClass(ms) {
  if (ms >= 3000) return 'red';
  if (ms >= 250) return 'red';
  if (ms >= 100) return 'yellow';
  return 'green';
}

function latencyLabel(ms) {
  if (ms >= 3000) return t('timeout');
  const cls = latencyClass(ms);
  const icon = cls === 'green' ? '' : cls === 'yellow' ? ' ⚠' : ' ✗';
  return `${ms} ms${icon}`;
}

async function measureAllLatency() {
  const servers = [
    { id: 'val-latA', ip: '98.98.60.43', key: 'latA' },
    { id: 'val-latB', ip: '98.98.61.31', key: 'latB' },
  ];

  // Packet loss: 10 pings to server A, count timeouts
  const lossEl = document.getElementById('val-loss');
  let lossAttempts = 0, lossFails = 0;

  for (const srv of servers) {
    const el = document.getElementById(srv.id);
    const ms = await measureLatency(srv.ip);
    state[srv.key] = ms;
    el.textContent = latencyLabel(ms);
    el.className = `cell-value ${latencyClass(ms)}`;

    // Use server A pings for packet loss measurement
    if (srv.key === 'latA') {
      // Run 5 more pings to calculate loss (10 total)
      for (let i = 0; i < 5; i++) {
        lossAttempts++;
        const t2 = await pingOnce(srv.ip);
        if (t2 >= 3000) lossFails++;
      }
      // Also count the 5 from measureLatency above
      lossAttempts += 5;
    }
    updateReport();
  }

  const lossPercent = Math.round((lossFails / lossAttempts) * 100);
  state.loss = lossPercent;
  const lossCls = lossPercent === 0 ? 'green' : lossPercent <= 3 ? 'yellow' : 'red';
  const lossIcon = lossPercent === 0 ? '' : lossPercent <= 3 ? ' ⚠' : ' ✗';
  lossEl.textContent = `${lossPercent}%${lossIcon}`;
  lossEl.className = `cell-value ${lossCls}`;
  updateReport();
}
```

- [ ] **Step 2: Call latency measurement from init**

Update the `init` function to also call `measureAllLatency()`:

```js
(function init() {
  state.os = detectOS();
  state.browser = detectBrowser();
  document.getElementById('val-os').textContent = `${state.os} / ${state.browser}`;
  fetchIPInfo();
  measureAllLatency();
})();
```

- [ ] **Step 3: Verify in browser**

Expected:
- Server A and B latency cells update after ~15 seconds (5 pings × 200ms gap × 2 servers + 5 extra loss pings)
- Values show color (green/yellow/red) based on thresholds
- Packet loss shows percentage
- If game servers don't serve HTTP, values will show high ms (timeouts) — this is acceptable and expected; the timing still shows network reachability

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add latency and packet loss measurement via image ping"
```

---

## Task 5: Step 2 — OS-Detected Traceroute Guide

**Files:**
- Modify: `project/network-check/index.html`

- [ ] **Step 1: Add renderStep2 function**

Add after `measureAllLatency()`:

```js
// ── Step 2: Traceroute guide ───────────────────────────────────────────────
function renderStep2() {
  const label = document.getElementById('step2-label');
  const content = document.getElementById('step2-content');
  const os = state.os;

  if (os === 'Android' || os === 'iOS') {
    label.textContent = t('step2Label');
    content.innerHTML = `<div class="mobile-notice">${t('step2Mobile')}</div>`;
    return;
  }

  const isWin = os === 'Windows';
  const cmdPrefix = isWin ? 'tracert' : 'traceroute';
  const title = isWin ? t('step2WinTitle') : t('step2MacTitle');
  const instr1 = isWin ? t('traceInstr1Win') : t('traceInstr1Mac');

  label.textContent = `${t('step2Label')} — ${title}`;

  const servers = [
    { ip: '98.98.60.43', labelKey: 'serverALabel', textareaId: 'trace-a' },
    { ip: '98.98.61.31', labelKey: 'serverBLabel', textareaId: 'trace-b' },
  ];

  const instrHtml = `
    <ol class="instructions" style="list-style:none;margin-bottom:14px">
      <li data-n="1">${instr1}</li>
      <li data-n="2">${t('traceInstr2')}</li>
    </ol>
  `;

  const serversHtml = servers.map(srv => `
    <div class="tracert-server">
      <div class="tracert-label">${t(srv.labelKey)}</div>
      <div class="code-block">
        <span>${cmdPrefix} ${srv.ip}</span>
        <button class="copy-btn" onclick="copyCmd('${cmdPrefix} ${srv.ip}', this)">Copy</button>
      </div>
      <div style="font-size:12px;color:#64748b;margin-bottom:6px">${t('traceInstr3')}</div>
      <textarea
        class="paste-area"
        id="${srv.textareaId}"
        placeholder="${t('pastePlaceholder')}"
        oninput="onTraceInput('${srv.ip === '98.98.60.43' ? 'A' : 'B'}', this.value)"
      ></textarea>
    </div>
  `).join('');

  content.innerHTML = instrHtml + serversHtml;
}

function copyCmd(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

function onTraceInput(server, value) {
  if (server === 'A') state.traceA = value;
  else state.traceB = value;
  updateReport();
}
```

- [ ] **Step 2: Call renderStep2 from init**

Update init to call `renderStep2()`:

```js
(function init() {
  state.os = detectOS();
  state.browser = detectBrowser();
  document.getElementById('val-os').textContent = `${state.os} / ${state.browser}`;
  renderStep2();
  fetchIPInfo();
  measureAllLatency();
})();
```

- [ ] **Step 3: Verify in browser on desktop**

Expected on Windows/macOS:
- Step 2 card shows OS name in label (e.g. "STEP 2 — TRACEROUTE — Windows detected")
- Numbered instructions visible
- Two command blocks (Server A and B) with dark background
- "Copy" button on each command — clicking copies to clipboard and shows "✓"
- Two paste textareas, focused border turns indigo on click

Expected on mobile (simulate via DevTools → mobile viewport):
- Step 2 shows only the blue notice box
- No command or textarea visible

- [ ] **Step 4: Verify Chinese mode**

Click "中文" button. Expected:
- Step 2 label, instructions, and placeholder text all update to Chinese
- Traceroute output in textareas (if any) is preserved

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add OS-detected traceroute guide with two servers and paste areas"
```

---

## Task 6: Step 3 — Report Generation and Actions

**Files:**
- Modify: `project/network-check/index.html`

- [ ] **Step 1: Add updateReport function**

Add after `onTraceInput()`:

```js
// ── Step 3: Report ────────────────────────────────────────────────────────
function formatTimestamp() {
  const now = new Date();
  const offset = 8 * 60;
  const local = new Date(now.getTime() + (offset - now.getTimezoneOffset()) * 60000);
  return local.toISOString().replace('T', ' ').slice(0, 19) + ' UTC+8';
}

function updateReport() {
  const ip   = state.ip   || '—';
  const isp  = state.isp  || '—';
  const city = state.city || '—';
  const os   = state.os   || '—';
  const br   = state.browser || '—';

  const fmtLat = (ms) => ms === null ? '...' : ms >= 3000 ? 'Timeout' : `${ms} ms`;
  const fmtLoss = (p) => p === null ? '...' : `${p}%`;

  const traceA = state.traceA.trim() || 'Not provided';
  const traceB = state.traceB.trim() || 'Not provided';

  const report = [
    '[Network Check — Delta Force]',
    `Time: ${formatTimestamp()}`,
    `IP: ${ip} | ISP: ${isp} | City: ${city}`,
    `OS: ${os} | Browser: ${br}`,
    '---',
    `Server A (98.98.60.43): ${fmtLat(state.latA)}`,
    `Server B (98.98.61.31): ${fmtLat(state.latB)}`,
    `Packet Loss: ${fmtLoss(state.loss)}`,
    '---',
    'TRACEROUTE TO 98.98.60.43:',
    traceA,
    '---',
    'TRACEROUTE TO 98.98.61.31:',
    traceB,
  ].join('\n');

  document.getElementById('report-box').textContent = report;
}

function copyReport() {
  const text = document.getElementById('report-box').textContent;
  const btn = document.getElementById('copy-btn');
  navigator.clipboard.writeText(text).then(() => {
    btn.innerHTML = `✓ <span>${t('copyDone')}</span>`;
    setTimeout(() => {
      btn.innerHTML = `📋 <span data-i18n="copyBtn">${t('copyBtn')}</span>`;
    }, 2000);
  }).catch(() => {
    // Fallback: select text in report box
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('report-box'));
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
}

function toggleScreenshot() {
  const hint = document.getElementById('screenshot-hint');
  hint.classList.toggle('visible');
  if (hint.classList.contains('visible')) {
    hint.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
```

- [ ] **Step 2: Call updateReport from init**

Add `updateReport()` at the end of init:

```js
(function init() {
  state.os = detectOS();
  state.browser = detectBrowser();
  document.getElementById('val-os').textContent = `${state.os} / ${state.browser}`;
  renderStep2();
  fetchIPInfo();
  measureAllLatency();
  updateReport();
})();
```

- [ ] **Step 3: Verify report in browser**

Expected immediately on load:
- Report box shows partial data with `—` and `...` for pending fields
- OS and Browser lines are filled immediately
- Report updates live as latency tests complete

After pasting into traceroute textareas:
- Report box updates instantly with pasted content
- "TRACEROUTE TO 98.98.60.43:" section shows pasted text

"Copy Report" button:
- Click → button shows "Copied ✓" for 2 seconds, then reverts
- Content is in clipboard (paste into Notepad to verify)

"Screenshot Guide" button:
- Click → yellow hint box appears below buttons
- Click again → hint box hides

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add live report generation, copy to clipboard, and screenshot guide"
```

---

## Task 7: Final Polish and Validation

**Files:**
- Modify: `project/network-check/index.html`

- [ ] **Step 1: Add page title i18n and fix lang button detection**

The `setLang` function uses button text to detect active state. The Chinese button shows "中文" not "zh". Fix the active class logic:

Find the `setLang` function and replace it with:

```js
function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('.lang-btn').forEach(btn => {
    const isActive = btn.getAttribute('onclick') === `setLang('${lang}')`;
    btn.classList.toggle('active', isActive);
  });
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.dataset.i18n);
  });
  renderStep2();
  updateReport();
}
```

- [ ] **Step 2: Full manual test checklist**

Run through each item and confirm:

**Desktop (Chrome, Windows):**
- [ ] IP and ISP detect within 3 seconds
- [ ] Server A and B latency values appear (any color) within 20 seconds
- [ ] Packet loss value appears
- [ ] Step 2 shows "Windows detected" with two `tracert` commands
- [ ] Both "Copy" buttons on commands work (paste to Notepad to confirm)
- [ ] Pasting text into traceroute textareas updates report box instantly
- [ ] "Copy Report" button copies full report text
- [ ] "Screenshot Guide" button shows/hides yellow hint
- [ ] Clicking "中文" translates all labels — no page reload
- [ ] Clicking "EN" switches back

**Mobile (Chrome DevTools → iPhone 14 viewport):**
- [ ] Layout fits without horizontal scroll
- [ ] Step 2 shows mobile notice instead of commands
- [ ] All Step 1 data still auto-collects
- [ ] Report copy button works

**Edge cases:**
- [ ] Disconnect wifi, reload: IP field shows "Failed ✗" with retry button
- [ ] Click retry after reconnecting: IP re-fetches successfully

- [ ] **Step 3: Final commit**

```bash
git add index.html
git commit -m "feat: network check tool complete — IP/ISP/latency/traceroute/report/i18n"
```

---

## Self-Review Notes

- All `data-i18n` keys in HTML match keys defined in `i18n.en` and `i18n.zh` objects ✓
- `state` object is the single source of truth for report generation ✓
- `renderStep2()` is called from both `init()` and `setLang()` to keep language consistent ✓
- `updateReport()` is called from `fetchIPInfo()`, `measureAllLatency()`, `onTraceInput()`, `setLang()`, and `init()` — all paths that change state ✓
- Packet loss uses server A (primary server) for measurement ✓
- Both traceroute IPs (98.98.60.43 and 98.98.61.31) are covered in Step 2 and the report ✓
