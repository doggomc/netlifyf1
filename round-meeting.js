/* ═══════════════ ROUND → OPENF1 MEETING KEY ═══════════════
   The Performance view's race-control feed is fetched from OpenF1 by
   meeting_key, and meeting keys are allocated per season — so a hand-written
   table of them is only ever right for the season it was captured from.

   The previous resolver fell back to `1280 + round`, which is not a rule that
   holds for any season: in 2026 it pointed round 16 at Singapore, round 17 at
   Austin, and round 23 at a meeting_key that does not exist. The feed therefore
   showed the wrong Grand Prix's race control (or nothing at all) for the whole
   back half of the calendar, silently, because an empty array looks the same as
   "no messages yet".

   Resolution order:
     1. the round's real race date, matched against OpenF1's own meeting list
        (fetched once per session by app.js) — survives new seasons, relocated
        races and mid-season calendar changes;
     2. the static table below, captured from live OpenF1 data for the 2026
        calendar this site's `schedule` describes;
     3. nothing — the caller skips the request rather than guessing a key.

   Pure and dependency-free so it can be tested offline against a recorded
   OpenF1 payload: scripts/round-meeting-check.js. */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FreeF1RoundMeeting = api;
})(typeof window !== 'undefined' ? window : null, function () {
  /* Captured 2026-10-06 from /api/openf1/meetings?year=2026. Note the site's
     calendar has no Bahrain/Saudi Arabian rounds, so from round 4 the keys are
     +2 ahead of a naive count of OpenF1 meetings. */
  const ROUND_MEETING_KEYS = {
    1: 1279, 2: 1280, 3: 1281, 4: 1284, 5: 1285, 6: 1286, 7: 1287, 8: 1288,
    9: 1289, 10: 1290, 11: 1291, 12: 1292, 13: 1293, 14: 1294, 15: 1295,
    16: 1308, 17: 1296, 18: 1297, 19: 1298, 20: 1299, 21: 1300, 22: 1301, 23: 1302
  };

  /* A Grand Prix weekend's meeting starts on the Friday of its race weekend, so
     the gap between a round's race date and its meeting's date_start is two
     days. Four leaves room for schedule shifts without reaching a neighbouring
     event (the next-closest meeting is two weeks away). */
  const MATCH_WINDOW_MS = 4 * 86_400_000;

  const raceDateOf = (event) => {
    const sessions = Array.isArray(event?.sessions) ? event.sessions : [];
    const race = sessions.find((s) => s.slug === 'race') || sessions[sessions.length - 1];
    const at = Date.parse(race?.start || '');
    return Number.isFinite(at) ? at : null;
  };

  /* schedule: app.js's SCHEDULE (§5) — [{ round, sessions:[{ slug, start }] }]
     meetings: OpenF1 /meetings payload — [{ meeting_key, date_start }]
     Returns { [round]: meeting_key } for every round that matches inside the
     window. Rounds it cannot match are omitted on purpose. */
  function resolveMeetingKeyByDate(schedule, meetings) {
    const rows = (Array.isArray(meetings) ? meetings : [])
      .map((m) => ({ key: Number(m?.meeting_key), at: Date.parse(m?.date_start || '') }))
      .filter((m) => Number.isFinite(m.key) && Number.isFinite(m.at));
    const out = {};
    if (!rows.length || !Array.isArray(schedule)) return out;
    for (const event of schedule) {
      const raceAt = raceDateOf(event);
      if (raceAt === null) continue;
      let best = null;
      for (const row of rows) {
        const gap = Math.abs(row.at - raceAt);
        if (!best || gap < best.gap) best = { key: row.key, gap };
      }
      if (best && best.gap <= MATCH_WINDOW_MS) out[event.round] = best.key;
    }
    return out;
  }

  return { ROUND_MEETING_KEYS, MATCH_WINDOW_MS, resolveMeetingKeyByDate, raceDateOf };
});
