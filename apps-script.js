// ── Configuration ─────────────────────────────────────────────────────────
const SHEET_ID        = '1upS5mcj3kpEX-CP_DpwJVyw_F4t1pQbqABZqiPOTLws';
const DRIVE_FOLDER_ID = '1ntyl6hnb7CdcXdOAO2Y1JKMABYeU32hu';
const SEATALK_WEBHOOK_URL = '';  // fill to enable SeaTalk notifications (B2 upgrade)

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

// ── Save report (POST) ────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    // Screenshots → Drive
    let screenshotUrl = '—';
    if (payload.screenshots && payload.screenshots.length) {
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const urls   = payload.screenshots.map((s, i) => {
        const filename = `${payload.submissionTime}_${payload.ip}_${i + 1}.jpg`.replace(/[: ]/g, '-');
        const blob     = Utilities.newBlob(Utilities.base64Decode(s.data), s.mimeType, filename);
        const file     = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        return file.getUrl();
      });
      screenshotUrl = urls.join('\n');
    }

    // Traceroutes → single formatted cell
    const traceText = (payload.servers || [])
      .filter(s => s.traceroute)
      .map(s => `[${s.label} — ${s.ip}]\n${s.traceroute}`)
      .join('\n\n') || '—';

    // Route to correct sheet by region
    const sheetName = String(payload.region || 'Other').trim() || 'Other';
    const ss        = SpreadsheetApp.openById(SHEET_ID);
    const sheet     = getOrCreateSheet(ss, sheetName);

    sheet.appendRow([
      payload.submissionTime,
      payload.issueTime      || '—',
      payload.ip             || '—',
      payload.countryCode    || '—',
      payload.isp            || '—',
      payload.city           || '—',
      payload.openId         || '—',
      payload.nickname       || '—',
      payload.os             || '—',
      payload.browser        || '—',
      payload.screen         || '—',
      payload.timezone       || '—',
      payload.connectionType || '—',
      payload.deviceMemory   || '—',
      payload.cpuCores       || '—',
      payload.platform       || '—',
      sheetName,
      traceText,
      screenshotUrl,
      payload.language       || 'en',
      `ping -c 20 ${payload.ip}`,
      '',        // Reverse Ping Result — GTO fills manually
      'Pending', // Status
    ]);

    if (SEATALK_WEBHOOK_URL) {
      UrlFetchApp.fetch(SEATALK_WEBHOOK_URL, {
        method:      'post',
        contentType: 'application/json',
        payload:     JSON.stringify({
          tag:  'text',
          text: { content: `[Network Check] New report\nIP: ${payload.ip} (${payload.countryCode || '?'})\nOpen ID: ${payload.openId || '—'}\nIssue time: ${payload.issueTime || 'unknown'}\nPlatform: ${payload.platform}\nRun: ping -c 20 ${payload.ip}` }
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
