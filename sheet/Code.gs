// Freckled Fork Fortunes: submissions endpoint.
// Bound to Sheet 1QmZoqbxPWT3hYueJT3MUGpsYOrSB3i3K2Ciu7Gdp-Yw. Deploy as a web app, execute as Me, access Anyone.
// The page POSTs a JSON string as text/plain (no CORS preflight). Retries are safe: a row with the same
// (email, fortune_seed) is written once.

var SHEET_ID = '1QmZoqbxPWT3hYueJT3MUGpsYOrSB3i3K2Ciu7Gdp-Yw';
var COLUMNS = ['submitted_at', 'name', 'email', 'news_opt_in', 'birthday', 'sign', 'rating', 'dishes',
  'dish_ways', 'note', 'card_id', 'card_title', 'fortune_seed', 'device', 'source'];
var MAX_FIELD = 1000;

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.website) return reply_({ ok: true }); // honeypot: bots fill the hidden field
    if (!body.name || !body.fortune_seed) return reply_({ ok: false, error: 'missing name or seed' });

    lock.waitLock(10000);
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
    if (isDuplicate_(sheet, String(body.email || ''), String(body.fortune_seed))) {
      return reply_({ ok: true, duplicate: true });
    }
    var row = COLUMNS.map(function (key) {
      var v = body[key];
      if (Array.isArray(v)) v = v.join(', ');
      if (v === undefined || v === null) v = '';
      v = String(v).slice(0, MAX_FIELD);
      // Neutralise formula injection: a cell starting with = + - @ is stored as text.
      return /^[=+\-@]/.test(v) ? "'" + v : v;
    });
    sheet.appendRow(row);
    return reply_({ ok: true });
  } catch (err) {
    return reply_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

function doGet() {
  return reply_({ ok: true, service: 'freckled-fork-fortunes' });
}

function isDuplicate_(sheet, email, seed) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var emailCol = COLUMNS.indexOf('email') + 1;
  var seedCol = COLUMNS.indexOf('fortune_seed') + 1;
  var start = Math.max(2, last - 500); // recent rows only; enough for one evening
  var n = last - start + 1;
  var emails = sheet.getRange(start, emailCol, n, 1).getValues();
  var seeds = sheet.getRange(start, seedCol, n, 1).getValues();
  for (var i = 0; i < n; i++) {
    if (String(seeds[i][0]) === seed && String(emails[i][0]) === email) return true;
  }
  return false;
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
