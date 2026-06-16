// ── Configuration — fill these before deploying ───────────────────────────
const SHEET_ID        = '1upS5mcj3kpEX-CP_DpwJVyw_F4t1pQbqABZqiPOTLws';
const DRIVE_FOLDER_ID = '1ntyl6hnb7CdcXdOAO2Y1JKMABYeU32hu';
const SEATALK_WEBHOOK_URL = '';  // fill to enable SeaTalk notifications (B2 upgrade)

// Must match CONFIG.servers[].label in index.html (used for header row only)
const SERVER_LABELS = ['Server A', 'Server B'];

// ── Run once after deploy to create the header row ───────────────────────
function setup() {
  const sheet     = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  const traceHdrs = SERVER_LABELS.map(l => `Traceroute — ${l}`);
  const headers   = [
    'Submission Time', 'Issue Time', 'IP', 'ISP', 'City',
    'OS', 'Browser', 'Screen Resolution', 'Timezone', 'Connection Type',
    'Device Memory (GB)', 'CPU Cores',
    'Platform',
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

    // Save screenshots to Drive if present (supports multiple)
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

    // Build row — column order must match setup() headers
    const traces = payload.servers.map(s => s.traceroute || '—');
    const row    = [
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
