/**
 * Cellar calendar sync (Google Apps Script)
 *
 * Keeps the "places left" count on the Cellar site in step with the
 * Google Calendar invites. Not part of the website: this file lives in the
 * repo only so it is versioned. Setup steps are in README.md next to it.
 *
 * How it works
 *   1. A calendar trigger runs syncAll() whenever an event in the Cellar
 *      calendar changes (a guest accepts, declines, is added or removed).
 *      An hourly trigger runs it too, as a safety net.
 *   2. syncAll() reads the tasting list from the site's public
 *      _data/tastings.yml and looks at the calendar's events from today to
 *      LOOKAHEAD_DAYS ahead.
 *   3. An event belongs to a tasting when it falls on the tasting's date
 *      (Geneva time) and its title matches the tasting title (at least
 *      half of the tasting title's significant words appear in the event
 *      title). Events that match on date but not on title are skipped and
 *      logged.
 *   4. Places taken = guests whose status is not "no" (yes, maybe and
 *      awaiting all count), excluding only the organiser account. The host
 *      counts like any other guest.
 *   5. When a count differs from the last one sent (or the last send is
 *      older than a day), it calls GitHub's repository_dispatch API with
 *      event type "availability-update". The GitHub Action then updates
 *      _data/availability.yml and the site redeploys.
 *
 * Script Properties (Project Settings > Script properties)
 *   GITHUB_TOKEN     fine-grained token, Contents read and write on
 *                    silviodirubbo/cellar (required)
 *   CALENDAR_ID      ID of the Cellar calendar (required)
 *   ORGANISER_EMAIL  the organiser account left out of the count (required)
 *   GITHUB_REPO      optional, defaults to silviodirubbo/cellar
 */

var DEFAULT_REPO = 'silviodirubbo/cellar';
var TIME_ZONE = 'Europe/Zurich';
var LOOKAHEAD_DAYS = 120;
var RESEND_AFTER_MS = 24 * 60 * 60 * 1000;
var STOP_WORDS = ['and', 'the', 'from', 'across', 'with', 'des', 'les', 'del', 'della', 'et'];

// ── Entry points ──────────────────────────────────────────────

/** Run once by hand: installs the calendar trigger and the hourly trigger. */
function setup() {
  var props = config_();
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onCalendarChange')
    .forUserCalendar(props.calendarId)
    .onEventUpdated()
    .create();
  ScriptApp.newTrigger('syncAll')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('Triggers installed for calendar ' + props.calendarId + '. Running a first sync.');
  syncAll();
}

/** Calendar trigger target. The event object does not say which event changed, so recount all. */
function onCalendarChange(e) {
  syncAll();
}

/** Recounts every upcoming tasting and dispatches the counts that changed. */
function syncAll() {
  run_(false, false);
}

/** Logs what would be sent, without calling GitHub or touching the stored counts. */
function dryRun() {
  run_(true, false);
}

/** Sends every current count again, even unchanged ones (the GitHub side ignores repeats). */
function forceResend() {
  run_(false, true);
}

// ── Core ──────────────────────────────────────────────────────

function run_(dry, force) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) {
    Logger.log('Another sync is running, skipping this one.');
    return;
  }
  try {
    var cfg = config_();
    var tastings = fetchTastings_(cfg.repo);
    var counts = countByTasting_(cfg, tastings);
    var store = PropertiesService.getScriptProperties();
    var now = Date.now();

    Object.keys(counts).forEach(function (slug) {
      var taken = counts[slug];
      var key = 'sent:' + slug;
      var last = null;
      try { last = JSON.parse(store.getProperty(key) || 'null'); } catch (err) { last = null; }
      var fresh = last && last.taken === taken && now - last.at < RESEND_AFTER_MS;
      if (fresh && !force) {
        Logger.log(slug + ': ' + taken + ' taken, unchanged');
        return;
      }
      if (dry) {
        Logger.log('[dry run] would send ' + slug + ': ' + taken + ' taken');
        return;
      }
      if (dispatch_(cfg, slug, taken)) {
        store.setProperty(key, JSON.stringify({ taken: taken, at: now }));
        Logger.log(slug + ': sent ' + taken + ' taken');
      }
    });
  } finally {
    lock.releaseLock();
  }
}

/** Returns { slug: taken } for every upcoming tasting that has a matching calendar event. */
function countByTasting_(cfg, tastings) {
  var calendar = CalendarApp.getCalendarById(cfg.calendarId);
  if (!calendar) throw new Error('Calendar not found: ' + cfg.calendarId + '. Check CALENDAR_ID.');

  var start = new Date();
  start.setHours(0, 0, 0, 0);
  var end = new Date(start.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
  var events = calendar.getEvents(start, end);

  var byDate = {};
  tastings.forEach(function (t) { (byDate[t.date] = byDate[t.date] || []).push(t); });

  var counts = {};
  events.forEach(function (ev) {
    var date = Utilities.formatDate(ev.getStartTime(), TIME_ZONE, 'yyyy-MM-dd');
    var candidates = byDate[date];
    if (!candidates) return;

    var match = null;
    candidates.forEach(function (t) { if (!match && titleMatches_(t.title, ev.getTitle())) match = t; });
    if (!match) {
      Logger.log('Skipped "' + ev.getTitle() + '" on ' + date + ': date matches ' +
        candidates.map(function (t) { return '"' + t.title + '"'; }).join(', ') + ' but the title does not.');
      return;
    }
    if (counts.hasOwnProperty(match.slug)) {
      Logger.log('Warning: more than one event matches ' + match.slug + '; keeping the first.');
      return;
    }
    counts[match.slug] = takenPlaces_(ev, cfg.organiser);
  });
  return counts;
}

/** Guests whose status is not "no", without the organiser account. Never below 0. */
function takenPlaces_(ev, organiser) {
  var seen = {};
  var taken = 0;
  ev.getGuestList(true).forEach(function (guest) {
    var email = String(guest.getEmail() || '').trim().toLowerCase();
    if (!email || seen[email]) return;
    seen[email] = true;
    if (email === organiser) return;
    if (guest.getGuestStatus() === CalendarApp.GuestStatus.NO) return;
    taken++;
  });
  return Math.max(0, taken);
}

// ── Matching ──────────────────────────────────────────────────

function words_(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(function (w) { return w.length >= 3 && STOP_WORDS.indexOf(w) === -1; });
}

/** True when at least half of the tasting title's significant words appear in the event title. */
function titleMatches_(tastingTitle, eventTitle) {
  var wanted = words_(tastingTitle);
  if (wanted.length === 0) return false;
  var have = words_(eventTitle);
  var hits = wanted.filter(function (w) { return have.indexOf(w) !== -1; }).length;
  return hits >= Math.ceil(wanted.length / 2);
}

// ── Data in and out ───────────────────────────────────────────

/** Upcoming tastings with a fixed date, read from the site's _data/tastings.yml. */
function fetchTastings_(repo) {
  var url = 'https://raw.githubusercontent.com/' + repo + '/main/_data/tastings.yml?t=' + Date.now();
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('Could not read tastings.yml (HTTP ' + res.getResponseCode() + ').');
  }
  var text = res.getContentText();
  var starts = [];
  var re = /^- slug: (\S+)\s*$/gm;
  var m;
  while ((m = re.exec(text)) !== null) starts.push({ slug: m[1], index: m.index });

  var field = function (block, name) {
    var f = block.match(new RegExp('^ {2}' + name + ':\\s*(.*)$', 'm'));
    return f ? f[1].trim().replace(/^"(.*)"$/, '$1') : null;
  };

  return starts.map(function (s, i) {
    var block = text.slice(s.index, i + 1 < starts.length ? starts[i + 1].index : text.length);
    return {
      slug: s.slug,
      title: field(block, 'title'),
      date: field(block, 'date'),
      dateTbd: field(block, 'date_tbd') === 'true',
      status: field(block, 'status')
    };
  }).filter(function (t) {
    return t.status === 'upcoming' && !t.dateTbd && /^\d{4}-\d{2}-\d{2}$/.test(t.date || '');
  });
}

/** Calls repository_dispatch. Returns true on success (HTTP 204). */
function dispatch_(cfg, slug, taken) {
  var res = UrlFetchApp.fetch('https://api.github.com/repos/' + cfg.repo + '/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + cfg.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    payload: JSON.stringify({
      event_type: 'availability-update',
      client_payload: { slug: slug, taken: taken }
    }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code === 204) return true;
  Logger.log('GitHub refused the update for ' + slug + ' (HTTP ' + code + '): ' + res.getContentText());
  return false;
}

function config_() {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty('GITHUB_TOKEN');
  var calendarId = p.getProperty('CALENDAR_ID');
  var organiser = p.getProperty('ORGANISER_EMAIL');
  var missing = [];
  if (!token) missing.push('GITHUB_TOKEN');
  if (!calendarId) missing.push('CALENDAR_ID');
  if (!organiser) missing.push('ORGANISER_EMAIL');
  if (missing.length) throw new Error('Missing Script Properties: ' + missing.join(', '));
  return {
    token: token,
    calendarId: calendarId,
    organiser: organiser.trim().toLowerCase(),
    repo: p.getProperty('GITHUB_REPO') || DEFAULT_REPO
  };
}
