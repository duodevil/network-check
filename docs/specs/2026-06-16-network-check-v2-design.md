# Network Check — Phase 2 Production Redesign: Design Spec

**Date:** 2026-06-16
**Status:** Approved
**Replaces:** `2026-06-09-network-check-design.md` (Phase 1)

---

## Overview

A reusable, configurable single-file HTML network diagnostic tool for game players experiencing lag. Hosted on GitHub Pages. Players auto-collect diagnostics, run traceroute, and submit a full report (including mobile screenshot) to a Google Sheets via Google Apps Script — no player Google account required.

**Target users:** Game players (EN / ZH-TW), PC and mobile
**Delivery:** Single `index.html` on GitHub Pages, zero build step
**Operators:** GTO team reviews submissions in Google Sheets

---

## Goals

- Zero player installation required
- Configurable for different games, regions, and server IPs in under 5 minutes
- Collect richer device + network data than Phase 1
- Submit all data (text + optional screenshot) to Google Sheets via Apps Script
- Guide GTO through reverse ping workflow from within Sheets
- Support EN / ZH-TW with browser locale auto-detection

---

## Reusability — CONFIG Object

All game-specific settings live in a single `CONFIG` object at the top of `index.html`. Operators edit only this block to redeploy for a new game or region:

```js
const CONFIG = {
  game:   "Delta Force",           // shown in header and report
  region: "SEA",                   // shown in report
  appsScriptUrl: "https://...",    // paste deployed Apps Script Web App URL here

  servers: [
    { label: "Server A", ip: "98.98.60.43" },
    { label: "Server B", ip: "98.98.61.31" },
    // add more servers as needed — one object per server
  ],
};
```

All latency cards, traceroute commands, paste areas, and report sections are generated dynamically from `CONFIG.servers`. Adding a third server = one extra line in the array.

---

## Architecture

```
[GitHub Pages]              [Player Browser]              [Google Cloud]
index.html  ←──────────→   Auto-collect + UI  ──POST──→  Apps Script Web App
                                                               │
                                                         ┌─────┴──────┐
                                                      Google         Google
                                                      Sheets         Drive
                                                    (text data)   (screenshots)
```

**Data flow:**
1. Page loads → auto-detect browser locale → set language
2. Auto-collect runs: IP, ISP, latency to all servers, packet loss, device info
3. Player follows Step 2 (traceroute guide) — PC: copy-paste command; mobile: Network Analyzer app + screenshot upload
4. Player fills Step 3: issue occurrence time (optional)
5. Player reads disclaimer in Step 4 → clicks "I Agree and Submit"
6. Frontend sends single POST to Apps Script: JSON (text fields) + base64 image (mobile only)
7. Apps Script writes row to Sheets + saves screenshot to Drive (link in same row) + auto-fills ping command column
8. Submit button locks: "Submitted ✓"

---

## Data Collected

### Auto-collected (no player action)

| Field | Source | Notes |
|-------|--------|-------|
| Public IPv4 | `https://ipinfo.io/json` | HTTPS, free tier |
| ISP | `ipinfo.io` `.org` field | |
| City | `ipinfo.io` `.city` field | |
| Server latency × N | Image ping (`new Image()`) | One card per `CONFIG.servers` entry |
| Packet loss % | 20-ping measurement, 500ms interval | Shown as live progress |
| OS / Browser | `navigator.userAgent` parsing | |
| Screen resolution | `screen.width × screen.height` | |
| Timezone | `Intl.DateTimeFormat().resolvedOptions().timeZone` | |
| Connection type | `navigator.connection.effectiveType` | Chrome/Android only; "—" elsewhere |
| Device memory | `navigator.deviceMemory` | Approximate: 0.5/1/2/4/8 GB |
| CPU cores | `navigator.hardwareConcurrency` | Thread count |
| Submission timestamp | Generated at submit time | UTC+8 |
| Platform | PC / iOS / Android | Derived from OS detection + tab selection |
| Language used | `en` / `zh` | |

### Player-provided

| Field | How | Required? |
|-------|-----|-----------|
| Traceroute output (per server) | Paste into textarea (PC only) | Optional |
| Screenshot | File upload (mobile only) | Optional |
| Issue occurrence time | Date + time picker | Optional |

---

## Feature Breakdown

### Step 1 — Auto Detected

Runs on page load. 2-column card grid, same visual style as Phase 1. Cards generated dynamically:
- IP, ISP (row 1)
- One card per server latency (dynamic, wraps to grid)
- Packet loss (full width, shows live progress `X% (N/20)` while running)
- OS/Browser, Screen Resolution (row)
- Timezone, Connection Type (row)
- Device Memory, CPU Cores (row)

Latency color: green < 100ms, yellow ⚠ 100–250ms, red ✗ > 250ms or timeout
Packet loss color: green 0%, yellow ⚠ 1–3%, red ✗ > 3%

### Step 2 — Traceroute Guide

Platform tabs: **[PC] [iOS] [Android]** — auto-selected by OS detection, player can override.

**PC tab (Windows detected):**
- Instructions: Win+R → cmd → Enter
- For each server in `CONFIG.servers`: dark code block with command + [Copy] button, followed by paste textarea
- Note: "Wait until at least hop 15 before pasting results"

**PC tab (macOS detected):**
- Instructions: Open Terminal
- Same per-server command blocks (`traceroute <ip>`) + paste areas

**iOS tab:**
1. Download Network Analyzer from App Store [link]
2. Open app → Tools → Route tab → enter IP → tap Start (top right)
3. Wait for results → take a screenshot
4. [📷 Upload Screenshot] button → shows thumbnail preview after upload

**Android tab:**
- Same as iOS with Google Play Store link

### Step 3 — Issue Details

Single field:
- Label: "When did the issue occur?"
- Input: date picker + time picker (two separate inputs, both optional)
- Sublabel: "Approximate time is fine — leave blank if unsure"

### Step 4 — Submit

Disclaimer box (bordered, clearly separated):
> By submitting this report, you agree to share your network diagnostic data including your IP address, device information, and the above results with [Game Name] support team for the purpose of investigating connectivity issues. This data will not be shared with third parties.

Primary button: **"I Agree and Submit"**
- On click: validates (at minimum IP must have loaded), sends POST, shows spinner
- On success: button becomes **"Submitted ✓"** (disabled, green)
- On error: shows error message, button re-enables for retry

---

## Apps Script Design

Deployed as Web App (Execute as: Me, Access: Anyone).

```js
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);

  // Save screenshot to Drive if present
  let screenshotUrl = "";
  if (payload.screenshot) {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const blob = Utilities.newBlob(
      Utilities.base64Decode(payload.screenshot.data),
      payload.screenshot.mimeType,
      `${payload.submissionTime}_${payload.ip}.jpg`
    );
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    screenshotUrl = file.getUrl();
  }

  // Append row to Sheets
  const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  sheet.appendRow([
    payload.submissionTime,
    payload.issueTime || "—",
    payload.ip,
    payload.isp,
    payload.city,
    payload.os,
    payload.browser,
    payload.screen,
    payload.timezone,
    payload.connectionType || "—",
    payload.deviceMemory || "—",
    payload.cpuCores || "—",
    ...payload.servers.map(s => s.latency),   // one column per server
    payload.packetLoss,
    payload.platform,
    ...payload.servers.map(s => s.traceroute || "—"),  // one column per server
    screenshotUrl || "—",
    payload.language,
    `ping -c 20 ${payload.ip}`,   // auto-generated GTO ping command
  ]);

  // SeaTalk webhook (future B2 upgrade — fill URL to activate)
  const SEATALK_WEBHOOK_URL = "";
  if (SEATALK_WEBHOOK_URL) {
    sendSeaTalkNotification(payload.ip, payload.issueTime);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

**Configuration constants in Apps Script:**
```js
const SHEET_ID = "...";         // Google Sheets ID from URL
const DRIVE_FOLDER_ID = "...";  // Google Drive folder ID for screenshots
```

---

## Google Sheets Structure

Header row (row 1, frozen):

| Col | Field | Filled by |
|-----|-------|-----------|
| A | Submission Time | Apps Script |
| B | Issue Time | Player |
| C | IP | Auto |
| D | ISP | Auto |
| E | City | Auto |
| F | OS | Auto |
| G | Browser | Auto |
| H | Screen Resolution | Auto |
| I | Timezone | Auto |
| J | Connection Type | Auto |
| K | Device Memory (GB) | Auto |
| L | CPU Cores | Auto |
| M+ | Server N Latency (ms) | Auto — dynamic per CONFIG |
| … | Packet Loss (%) | Auto |
| … | Platform | Auto |
| … | Traceroute — Server N | Player (PC) |
| … | Screenshot URL | Apps Script |
| … | Language | Auto |
| … | **Ping Command** | Apps Script (auto) |
| … | **Reverse Ping Result** | GTO (manual) |
| … | **Status** | GTO (manual: Pending / Done) |

> Note: Server-dependent columns (latency, traceroute) expand dynamically based on number of servers. Apps Script and frontend must agree on column order.

---

## GTO Reverse Ping Workflow (B1)

1. Open Google Sheets → filter **Status = Pending**
2. Copy value from **Ping Command** column (e.g. `ping -c 20 203.69.xx.xx`)
3. SSH into game server → paste and run
4. Copy result → paste into **Reverse Ping Result** column
5. Set **Status** = Done

**Future B2 upgrade:** Fill `SEATALK_WEBHOOK_URL` in Apps Script → each new submission auto-posts to SeaTalk channel with player IP, issue time, and ping command. GTO responds in channel thread.

---

## Internationalisation

Auto-detect on load:
```js
const browserLang = navigator.language || "en";
const defaultLang = (browserLang.startsWith("zh-TW") || browserLang.startsWith("zh-HK"))
  ? "zh" : "en";
```

Manual toggle: EN / 中文 buttons in header. All strings in `i18n` object, `t(key)` function, `data-i18n` attributes on DOM elements. Language switch re-renders without page reload.

---

## UI Design

Same visual style as Phase 1 (Clean & Minimal):
- Primary color: Indigo `#4f46e5`
- Font: System sans-serif
- Layout: single column, max-width 600px, centered
- Fully responsive — same layout on mobile

**Page structure:**
```
[Header: Game + Region + Language toggle]
[Step 1: Auto-collected data grid]
[Step 2: Platform tabs + traceroute guide / screenshot upload]
[Step 3: Issue time input]
[Step 4: Disclaimer + Submit button]
```

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| IP lookup fails | "Unable to detect" + retry button |
| Server ping timeout (3s) | "Timeout ✗" in red |
| Screenshot too large (> 10MB) | Show error below upload button, block submit |
| Apps Script returns error | Show error message, re-enable submit button |
| Clipboard blocked | Fallback: select all text in code block |
| `navigator.connection` unavailable | Show "—" in Connection Type cell |

---

## Anti-Spam

Submit button is disabled and shows "Submitted ✓" after a successful submission for the lifetime of the page session. No cross-session or IP-based deduplication (kept simple per decision B).

---

## Deployment Steps (one-time, guided)

1. Create Google Sheets with header row
2. Create Google Drive folder for screenshots
3. Create Apps Script project, paste `doPost()` code, fill `SHEET_ID` + `DRIVE_FOLDER_ID`
4. Deploy Apps Script as Web App — copy URL
5. Fill `CONFIG.appsScriptUrl` in `index.html`
6. Push `index.html` to GitHub repo → enable GitHub Pages

---

## Out of Scope

- Automatic traceroute execution in browser (OS limitation — impossible without native app)
- Player accounts or submission history
- Backend deduplication
- Real-time GTO dashboard (future B3 consideration)
