// ── Configuration ─────────────────────────────────────────────────────────
const SHEET_ID        = '1upS5mcj3kpEX-CP_DpwJVyw_F4t1pQbqABZqiPOTLws';
const DRIVE_FOLDER_ID = '1ntyl6hnb7CdcXdOAO2Y1JKMABYeU32hu';
const SEATALK_WEBHOOK_URL = '';  // fill to enable SeaTalk notifications (B2 upgrade)
const REPORT_TIMEZONE = 'Asia/Taipei';  // timezone the Submission Time column is reported in

// ── Input limits ──────────────────────────────────────────────────────────
// The Web App is deployed to "Anyone", so anything can POST here directly.
// The frontend mirrors these rules for UX; THIS is the actual boundary.
const MAX_PAYLOAD_CHARS    = 14 * 1024 * 1024;
const MAX_FIELD_CHARS      = 200;
const MAX_TRACE_CHARS      = 20000;
const MAX_SCREENSHOTS      = 4;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const RATE_LIMIT_SECONDS   = 30;

const REPORT_HEADERS = [
  'Submission Time', 'Issue Time', 'IP', 'Country Code', 'ISP', 'City',
  'Open ID', 'Nickname',
  'OS', 'Browser', 'Screen Resolution', 'Timezone', 'Connection Type',
  'Device Memory (GB)', 'CPU Cores',
  'Platform', 'Region',
  'Traceroute',
  'Screenshot URL', 'Language', 'Ping Command',
  'Reverse Ping Result', 'Status',
];

// ── Run once to create IP_Region template and default sheets ──────────────
function setup() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  if (!ss.getSheetByName('IP_Region')) {
    const cfg = ss.insertSheet('IP_Region');
    cfg.getRange(1, 1, 1, 4).setValues([['Prefix', 'Server Name', 'IP', 'Country Codes (comma-separated)']]);
    cfg.setFrozenRows(1);
    cfg.getRange(1, 1, 1, 4).setFontWeight('bold');
    cfg.getRange(2, 1, 2, 4).setValues([
      ['SG', 'SG_Server1', '98.98.60.43', 'SG,MY,ID,PH,VN,TW'],
      ['SG', 'SG_Server2', '98.98.61.31', 'SG,MY,ID,PH,VN,TW'],
    ]);
  }

  getOrCreateSheet(ss, 'Other');
}

// ── Serve IP_Region config as JSON (GET) ──────────────────────────────────
function doGet(e) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('IP_Region');
    if (!sheet) return jsonOut([]);

    const rows   = sheet.getDataRange().getValues();
    const config = rows.slice(1)
      .filter(r => r[0] && r[2])
      .map(r => ({
        prefix:    String(r[0]).trim(),
        name:      String(r[1]).trim(),
        ip:        String(r[2]).trim(),
        countries: String(r[3]).split(',').map(c => c.trim().toUpperCase()).filter(Boolean),
      }));
    return jsonOut(config);
  } catch (err) {
    return jsonOut({ error: err.toString() });
  }
}

// ── Input hardening ───────────────────────────────────────────────────────
// Sheets evaluates a cell starting with = + - @ as a formula, so a submitted
// =IMPORTXML(...) would run when a GTO member opens the sheet and could leak
// other rows. Neutralise it with a leading apostrophe (not shown in the cell).
function cellSafe(value, maxLen) {
  const s = String(value === null || value === undefined ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, maxLen || MAX_FIELD_CHARS)
    .trim();
  if (!s) return '—';
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

// The Ping Command column is pasted into a shell by an operator, so an IP that
// is not strictly an address must never reach it
function isValidIp(value) {
  const s = String(value || '').trim();
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (v4) return v4.slice(1).every(n => Number(n) <= 255);
  return s.indexOf(':') !== -1 && /^[0-9A-Fa-f:.]{2,45}$/.test(s);
}

// Trust the file's own magic bytes, never the client-supplied mimeType —
// otherwise text/html lands in Drive on a public link as a phishing page
function imageKind(b) {
  if (b.length > 3  && b[0] === -1 && b[1] === -40 && b[2] === -1) return 'jpg';
  if (b.length > 8  && b[0] === -119 && b[1] === 80 && b[2] === 78 && b[3] === 71) return 'png';
  if (b.length > 12 && b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70
                    && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80) return 'webp';
  if (b.length > 12 && b[4] === 102 && b[5] === 116 && b[6] === 121 && b[7] === 112) return 'heic';
  return null;
}

function rateLimited(key) {
  const cache = CacheService.getScriptCache();
  if (cache.get('rl_' + key)) return true;
  cache.put('rl_' + key, '1', RATE_LIMIT_SECONDS);
  return false;
}

// Only prefixes configured in IP_Region may become sheets
function allowedRegions(ss) {
  const sheet = ss.getSheetByName('IP_Region');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1)
    .map(r => String(r[0]).trim()).filter(String);
}

// ── Save report (POST) ────────────────────────────────────────────────────
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return jsonOut({ status: 'error', message: 'empty request' });
    if (e.postData.contents.length > MAX_PAYLOAD_CHARS) return jsonOut({ status: 'error', message: 'payload too large' });

    let payload;
    try { payload = JSON.parse(e.postData.contents); }
    catch (err) { return jsonOut({ status: 'error', message: 'malformed json' }); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return jsonOut({ status: 'error', message: 'malformed payload' });
    }

    const ip = isValidIp(payload.ip) ? String(payload.ip).trim() : '';
    if (rateLimited(ip || 'anonymous')) return jsonOut({ status: 'error', message: 'too many submissions' });

    const submissionTime = Utilities.formatDate(new Date(), REPORT_TIMEZONE, "yyyy-MM-dd HH:mm:ss 'UTC'Z");
    const ss             = SpreadsheetApp.openById(SHEET_ID);

    // Route to correct sheet by region — unknown regions must not create sheets
    const requested = String(payload.region || '').trim();
    const sheetName = allowedRegions(ss).indexOf(requested) !== -1 ? requested : 'Other';
    const sheet     = getOrCreateSheet(ss, sheetName);

    // Screenshots → Drive
    let screenshotUrl = '—';
    const shots = Array.isArray(payload.screenshots) ? payload.screenshots.slice(0, MAX_SCREENSHOTS) : [];
    const urls  = [];
    shots.forEach((s, i) => {
      if (!s || typeof s.data !== 'string') return;
      let bytes;
      try { bytes = Utilities.base64Decode(s.data); } catch (err) { return; }
      if (bytes.length > MAX_SCREENSHOT_BYTES) return;
      const kind = imageKind(bytes);
      if (!kind) return;
      const name = `${submissionTime}_${ip || 'unknown'}_${i + 1}.${kind}`.replace(/[:+ ]/g, '-');
      const mime = kind === 'jpg' ? 'image/jpeg' : 'image/' + kind;
      const file = DriveApp.getFolderById(DRIVE_FOLDER_ID)
        .createFile(Utilities.newBlob(bytes, mime, name));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      urls.push(file.getUrl());
    });
    if (urls.length) screenshotUrl = urls.join('\n');

    // Traceroutes → single formatted cell
    const traceText = cellSafe((Array.isArray(payload.servers) ? payload.servers : [])
      .filter(s => s && s.traceroute)
      .map(s => `[${String(s.label).slice(0, 60)} — ${String(s.ip).slice(0, 45)}]\n${String(s.traceroute)}`)
      .join('\n\n'), MAX_TRACE_CHARS);

    sheet.appendRow([
      submissionTime,
      cellSafe(payload.issueTime, 120),
      cellSafe(payload.ip, 60),
      cellSafe(payload.countryCode, 8),
      cellSafe(payload.isp, 120),
      cellSafe(payload.city, 60),
      cellSafe(payload.openId, 100),
      cellSafe(payload.nickname, 60),
      cellSafe(payload.os, 40),
      cellSafe(payload.browser, 40),
      cellSafe(payload.screen, 30),
      cellSafe(payload.timezone, 60),
      cellSafe(payload.connectionType, 40),
      cellSafe(payload.deviceMemory, 20),
      cellSafe(payload.cpuCores, 20),
      cellSafe(payload.platform, 20),
      sheetName,
      traceText,
      screenshotUrl,
      cellSafe(payload.language, 8),
      ip ? `ping -c 20 ${ip}` : 'no valid IP — do not run',
      '',        // Reverse Ping Result — GTO fills manually
      'Pending', // Status
    ]);

    if (SEATALK_WEBHOOK_URL) {
      UrlFetchApp.fetch(SEATALK_WEBHOOK_URL, {
        method:      'post',
        contentType: 'application/json',
        payload:     JSON.stringify({
          tag:  'text',
          text: { content: `[Network Check] New report\nIP: ${ip || 'invalid'} (${cellSafe(payload.countryCode, 8)})\nOpen ID: ${cellSafe(payload.openId, 100)}\nIssue time: ${cellSafe(payload.issueTime, 120)}\nPlatform: ${cellSafe(payload.platform, 20)}\nRun: ${ip ? 'ping -c 20 ' + ip : 'n/a'}` }
        }),
      });
    }

    return jsonOut({ status: 'ok' });
  } catch (err) {
    return jsonOut({ status: 'error', message: err.toString() });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, REPORT_HEADERS.length).setValues([REPORT_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, REPORT_HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
