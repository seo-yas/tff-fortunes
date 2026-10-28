// Freckled Fork Fortunes: submissions endpoint.
// Bound to Sheet 1QmZoqbxPWT3hYueJT3MUGpsYOrSB3i3K2Ciu7Gdp-Yw. Deploy as a web app, execute as Me, access Anyone.
// The page POSTs a JSON string as text/plain (no CORS preflight) and reads the reply: it drops a queued row only on ok.
// Retries are safe: a row with the same (email, fortune_seed) is written once, checked across the whole sheet under a lock.

var SHEET_ID = '1QmZoqbxPWT3hYueJT3MUGpsYOrSB3i3K2Ciu7Gdp-Yw';
var COLUMNS = ['submitted_at', 'name', 'email', 'news_opt_in', 'birthday', 'sign', 'rating', 'dishes',
  'dish_ways', 'note', 'card_id', 'card_title', 'fortune_seed', 'device', 'source'];
var MAX_FIELD = 1000;

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return reply_({ ok: false, retry: false, error: 'bad json' });
  }
  if (body.website) return reply_({ ok: true }); // honeypot: bots fill the hidden field
  if (!body.name || !body.fortune_seed) return reply_({ ok: false, retry: false, error: 'missing name or seed' });

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var sheet = submissionsSheet_();
    if (isDuplicate_(sheet, String(body.email || ''), String(body.fortune_seed))) {
      return reply_({ ok: true, duplicate: true });
    }
    var row = COLUMNS.map(function (key) {
      var v = body[key];
      if (Array.isArray(v)) v = v.join(', ');
      if (v === undefined || v === null) v = '';
      v = String(v).slice(0, MAX_FIELD);
      // Formula injection: a cell starting with = + - @ (or a tab/CR) is stored as text.
      return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
    });
    sheet.appendRow(row);
    SpreadsheetApp.flush(); // commit before the lock is released, so the next request's duplicate check sees this row
    return reply_({ ok: true });
  } catch (err) {
    return reply_({ ok: false, error: String(err) }); // the page keeps the row and retries
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

function doGet() {
  return reply_({ ok: true, service: 'freckled-fork-fortunes' });
}

// The tab whose first header cell is submitted_at (tab order does not matter); created with the header if none exists.
function submissionsSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getLastRow() >= 1 && String(sheets[i].getRange(1, 1).getValue()) === 'submitted_at') return sheets[i];
  }
  var first = sheets[0];
  if (first.getLastRow() === 0) {
    first.appendRow(COLUMNS);
    return first;
  }
  var sheet = ss.insertSheet('submissions');
  sheet.appendRow(COLUMNS);
  return sheet;
}

function isDuplicate_(sheet, email, seed) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var emailCol = COLUMNS.indexOf('email') + 1;
  var seedCol = COLUMNS.indexOf('fortune_seed') + 1;
  var n = last - 1; // every data row: one evening is a few hundred rows, well inside one range read
  var emails = sheet.getRange(2, emailCol, n, 1).getValues();
  var seeds = sheet.getRange(2, seedCol, n, 1).getValues();
  for (var i = 0; i < n; i++) {
    if (String(seeds[i][0]) === seed && String(emails[i][0]) === email) return true;
  }
  return false;
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
