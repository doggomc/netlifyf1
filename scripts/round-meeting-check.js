#!/usr/bin/env node
'use strict';

/* Guards the round → OpenF1 meeting_key resolution that feeds the Performance
   view's race-control panel.

   The bug this locks down: the resolver used to fall back to `1280 + round`
   after its 15-entry table ran out, which pointed rounds 16-23 of 2026 at the
   wrong Grand Prix (round 23 at a meeting_key that does not exist). Because an
   empty feed and a "no messages yet" feed look identical, nothing ever failed
   loudly — the panel just showed another race's messages.

   Runs offline against a recorded OpenF1 /meetings payload, so it costs nothing
   and still catches a stale table when the calendar moves.

   Checks:
     1. the module resolves every round of the site's schedule by race date;
     2. those resolutions agree with the committed static table (which is what
        the site falls back to when the live lookup is unavailable);
     3. no two rounds resolve to the same meeting;
     4. every resolved key exists in OpenF1's own meeting list;
     5. app.js no longer guesses a key, and asks the resolver first. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const api = require(path.join(root, 'round-meeting.js'));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'openf1-meetings-2026.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

const checks = [];
const check = (label, pass, detail = '') => checks.push({ label, pass: Boolean(pass), detail });

/* The schedule is a literal inside app.js (plain <script>, no module system), so
   read it out of the source rather than duplicating 23 rounds here. */
function readSchedule(source) {
  const block = /const schedule=\[([\s\S]*?)\n\];/.exec(source);
  assert(block, 'app.js: could not find the schedule literal — has it been renamed?');
  const events = [];
  for (const m of block[1].matchAll(/\{round:(\d+),slug:"([^"]+)",name:"([^"]+)"/g)) {
    const rest = block[1].slice(m.index, block[1].indexOf('\n', m.index));
    const race = /\{slug:"race",name:"Race",start:"([^"]+)"/.exec(rest);
    events.push({ round: Number(m[1]), slug: m[2], name: m[3], raceStart: race ? race[1] : null });
  }
  return events;
}

const schedule = readSchedule(appSource);
check('app.js schedule parsed', schedule.length >= 20, `${schedule.length} rounds`);
check('every round has a race date', schedule.every(e => e.raceStart), schedule.filter(e => !e.raceStart).map(e => e.round).join(', '));

/* The resolver takes app.js's own shape: [{ round, sessions:[{ slug, start }] }] */
const asSessions = schedule.map(e => ({ round: e.round, sessions: [{ slug: 'race', start: e.raceStart }] }));
const resolved = api.resolveMeetingKeyByDate(asSessions, fixture);

check('every round resolves to a meeting by date',
  schedule.every(e => resolved[e.round]),
  `unresolved: ${schedule.filter(e => !resolved[e.round]).map(e => e.round).join(', ') || 'none'}`);

const tableMismatches = schedule
  .filter(e => api.ROUND_MEETING_KEYS[e.round] && api.ROUND_MEETING_KEYS[e.round] !== resolved[e.round])
  .map(e => `round ${e.round}: table=${api.ROUND_MEETING_KEYS[e.round]} date-match=${resolved[e.round]}`);
check('the static table agrees with the date match for every round it covers',
  tableMismatches.length === 0, tableMismatches.join(' | '));

check('the static table covers every round of the schedule',
  schedule.every(e => api.ROUND_MEETING_KEYS[e.round]),
  `missing: ${schedule.filter(e => !api.ROUND_MEETING_KEYS[e.round]).map(e => e.round).join(', ') || 'none'}`);

const keys = schedule.map(e => resolved[e.round]);
check('no two rounds resolve to the same meeting', new Set(keys).size === keys.length,
  `${new Set(keys).size} distinct keys for ${keys.length} rounds`);

const known = new Set(fixture.map(m => m.meeting_key));
check('every resolved key exists in the OpenF1 meeting list',
  keys.every(k => known.has(k)),
  `unknown: ${keys.filter(k => !known.has(k)).join(', ') || 'none'}`);

/* A spot check with names, so a calendar reshuffle cannot pass by shifting every
   key by the same amount. */
const expectedNames = { 1: 'Australian Grand Prix', 15: 'Azerbaijan Grand Prix', 17: 'Singapore Grand Prix', 23: 'Abu Dhabi Grand Prix' };
const nameErrors = Object.entries(expectedNames).filter(([round, name]) => {
  const meeting = fixture.find(m => m.meeting_key === resolved[Number(round)]);
  return !meeting || !String(meeting.meeting_name || meeting.meeting_official_name || '').includes(name.replace(' Grand Prix', ''));
}).map(([round, name]) => `round ${round} ≠ ${name}`);
check('spot-checked rounds land on the right Grand Prix', nameErrors.length === 0, nameErrors.join(' | '));

/* Read the code, not the prose: comments in app.js explain the old fallback by
   name, so strip them before asserting it is gone. */
const appCode = appSource
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/[^\n]*/gm, ' ');
check('app.js resolves the key through the module instead of guessing',
  /await resolveMeetingKey\(round\)/.test(appCode) && /FreeF1RoundMeeting/.test(appCode) && !/1280 \+ round/.test(appCode),
  'expects await resolveMeetingKey(round) and no `1280 + round` fallback in code');

/* app.js keeps its own copy so the feed survives a failed module load; the two
   must never disagree. */
function readInlineTable(source) {
  const block = /const ROUND_MEETING_KEYS = \{([\s\S]*?)\n\};/.exec(source);
  assert(block, 'app.js: could not find the inline ROUND_MEETING_KEYS literal');
  const table = {};
  for (const m of block[1].matchAll(/(\d+):\s*(\d+)/g)) table[Number(m[1])] = Number(m[2]);
  return table;
}
const inline = readInlineTable(appSource);
const drift = Object.keys(api.ROUND_MEETING_KEYS)
  .filter(r => inline[r] !== api.ROUND_MEETING_KEYS[r])
  .map(r => `round ${r}: app.js=${inline[r]} module=${api.ROUND_MEETING_KEYS[r]}`);
check('the inline table in app.js matches round-meeting.js exactly',
  drift.length === 0 && Object.keys(inline).length === Object.keys(api.ROUND_MEETING_KEYS).length,
  `${drift.join(' | ') || 'keys differ in count'} (app.js ${Object.keys(inline).length} vs module ${Object.keys(api.ROUND_MEETING_KEYS).length})`);
check('the inline table also agrees with the live date match',
  schedule.every(e => inline[e.round] === resolved[e.round]),
  schedule.filter(e => inline[e.round] !== resolved[e.round]).map(e => `round ${e.round}`).join(', '));

check('index.html loads round-meeting.js before app.js',
  (() => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const moduleAt = html.indexOf('round-meeting.js');
    const appAt = html.indexOf('/app.js?');
    return moduleAt !== -1 && appAt !== -1 && moduleAt < appAt;
  })(), 'script order matters: the module must define window.FreeF1RoundMeeting first');

let failed = 0;
for (const c of checks) {
  if (!c.pass) failed++;
  console.log(`  ${c.pass ? 'ok  ' : 'FAIL'}  ${c.label}${c.pass || !c.detail ? '' : `  →  ${c.detail}`}`);
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
