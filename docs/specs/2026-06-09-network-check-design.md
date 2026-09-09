# Network Check — Delta Force: Design Spec

**Date:** 2026-06-09  
**Status:** Approved

---

## Overview

A single-file HTML tool (no backend, no installation required) for game players experiencing lag. Automatically collects network diagnostics and guides users through a traceroute, then produces a formatted report for handoff to ISP or data center operators.

**Target users:** English-speaking players on PC and mobile  
**Delivery:** Single `index.html` file, hosted statically

---

## Goals

- Collect player network info with zero manual steps (Step 1)
- Guide PC players through traceroute with minimal friction (Step 2)
- Produce a copy-able + screenshot-friendly report (Step 3)
- Support EN / ZH-TW language toggle

---

## Architecture

Single self-contained HTML file:
- No backend required for auto-collection (uses third-party IP lookup API)
- No npm, no build step — open in browser and it works
- All logic in vanilla JS inline

---

## Feature Breakdown

### Step 1 — Auto Collect (zero user action)

Runs immediately on page load. Displays results in a 2-column card grid.

| Field | Source |
|-------|--------|
| Public IPv4 | `https://api.ipify.org?format=json` |
| ISP + City | `https://ip-api.com/json/{ip}` |
| Server A latency (98.98.60.43) | `fetch()` timing × 5 pings, median |
| Server B latency (98.98.61.31) | `fetch()` timing × 5 pings, median |
| Packet loss % | Count failed fetches out of 10 attempts |
| OS / Browser | `navigator.userAgent` parsing |
| Timestamp | `new Date()`, formatted with UTC+8 offset |

Latency color coding:
- Green: < 100ms
- Yellow ⚠: 100–250ms  
- Red ✗: > 250ms or failed

Packet loss color coding:
- Green: 0%
- Yellow ⚠: 1–3%
- Red ✗: > 3%

### Step 2 — Guided Traceroute

OS is detected from `navigator.userAgent`. Instructions adapt per platform:

| Platform | Commands shown | Instructions |
|----------|---------------|--------------|
| Windows | `tracert 98.98.60.43` then `tracert 98.98.61.31` | Win+R → cmd → paste command |
| macOS | `traceroute 98.98.60.43` then `traceroute 98.98.61.31` | Open Terminal → paste command |
| Android / iOS | — | Message: "Traceroute not available on mobile. Step 1 data is sufficient." |

UX details:
- Two commands shown sequentially (Server A first, then Server B), each with its own "Copy" button
- Two separate textareas for paste-back (one per server)
- Minimal instructions: 3 numbered steps, plain language

### Step 3 — Report Output

Auto-generated text block, updates live as user pastes traceroute.

Report format (plain text, copy-paste friendly):
```
[Network Check — Delta Force]
Time: YYYY-MM-DD HH:MM:SS UTC+8
IP: xxx.xxx.xxx.xxx | ISP: [name] | City: [city]
OS: [os] | Browser: [browser]
---
Server A (98.98.60.43): [X]ms
Server B (98.98.61.31): [X]ms
Packet Loss: [X]%
---
TRACEROUTE TO 98.98.60.43:
[pasted content or "Not provided"]
---
TRACEROUTE TO 98.98.61.31:
[pasted content or "Not provided"]
```

Two action buttons:
- **Copy Report** — copies plain text to clipboard, button label changes to "Copied ✓" for 2 seconds
- **Screenshot Guide** — scrolls to and highlights the report block, shows overlay: "Take a screenshot of this area and send to support"

---

## UI Design

**Style:** Clean & Minimal, Light background  
**Primary color:** Indigo `#4f46e5`  
**Font:** System sans-serif  
**Layout:** Single column, max-width 600px, centered  
**Mobile:** Fully responsive, same single-column layout

### Structure
```
[Header: title + language toggle]
[Step 1 card: auto-collected data grid]
[Step 2 card: traceroute guide + paste area]
[Step 3 card: formatted report + action buttons]
```

---

## Internationalisation

Two languages: English (default) and 繁體中文  
Toggle button in header (EN / 中文).  
All UI strings stored in a `translations` object in JS:

```js
const i18n = {
  en: { step1: "AUTO DETECTED", ... },
  zh: { step1: "自動偵測", ... }
}
```

Switching language re-renders all UI text without page reload.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| IP API fails | Show "Unable to detect" with retry button |
| Server ping fails (timeout 3s) | Show "Timeout ✗" in red |
| User on mobile (no traceroute) | Step 2 shows informational message instead of instructions |
| Clipboard API blocked | Fallback: select all text in report textarea |

---

## Out of Scope

- Backend / server storage of reports
- User accounts or history
- Automatic traceroute execution (browser security limitation)
- iOS / Android traceroute (no browser API available)
