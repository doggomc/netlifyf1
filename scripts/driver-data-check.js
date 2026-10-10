#!/usr/bin/env node
'use strict';

/* Offline checks for the canonical 2026 roster and the browser integration.
   Run with: node scripts/driver-data-check.js */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const data = require(path.join(root, 'driver-data.js'));
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app.css'), 'utf8');
const checks = [];
const check = (label, fn) => {
  try {
    fn();
    checks.push({ label, pass: true });
  } catch (error) {
    checks.push({ label, pass: false, detail: error.message });
  }
};

check('2026 roster has 22 unique drivers across 11 teams', () => {
  assert.equal(data.ROSTER.length, 22);
  assert.equal(new Set(data.ROSTER.map((driver) => driver.id)).size, 22);
  assert.equal(new Set(data.ROSTER.map((driver) => driver.code)).size, 22);
  const teamCounts = data.ROSTER.reduce((counts, driver) => {
    counts[driver.teamId] = (counts[driver.teamId] || 0) + 1;
    return counts;
  }, {});
  assert.equal(Object.keys(teamCounts).length, 11);
  for (const count of Object.values(teamCounts)) assert.equal(count, 2);
});

check('2026 new/renamed driver ids resolve canonically', () => {
  assert.equal(data.findDriver('maxverstappen').id, 'max_verstappen');
  assert.equal(data.findDriver('arvidlindblad').id, 'arvid_lindblad');
  assert.equal(data.findDriver('kimi_antonelli').id, 'antonelli');
  assert.equal(data.findDriver('andrea_kimi_antonelli').id, 'antonelli');
});

check('display-name matching handles nicknames, initials, codes and diacritics', () => {
  assert.equal(data.findDriverByName('Kimi Antonelli').id, 'antonelli');
  assert.equal(data.findDriverByName('K. Antonelli').id, 'antonelli');
  assert.equal(data.findDriverByName('L. Norris').id, 'norris');
  assert.equal(data.findDriverByName('HUL').id, 'hulkenberg');
  assert.equal(data.findDriverByName('Nico Hülkenberg').id, 'hulkenberg');
  assert.equal(data.findDriverByName('Perez').id, 'perez');
  assert.equal(data.findDriverByName('Unknown Driver'), null);
});

check('team aliases normalize 2026 constructor naming', () => {
  assert.equal(data.teamIdFor('Red Bull Racing'), 'redbull');
  assert.equal(data.teamIdFor('Racing Bulls F1 Team'), 'racingbulls');
  assert.equal(data.teamIdFor('Audi'), 'audi');
  assert.equal(data.teamIdFor('Cadillac F1 Team'), 'cadillac');
  assert.equal(data.teamIdFor('Mercedes-AMG Petronas F1 Team'), 'mercedes');
  assert.equal(data.teamIdFor('Visa Cash App Racing Bulls F1 Team'), 'racingbulls');
  assert.equal(data.teamIdFor('Audi Revolut F1 Team'), 'audi');
});

check('standings enrichment preserves live values and fills every roster driver', () => {
  const liveMax = {
    position: '1', points: '287', wins: '7',
    Driver: { driverId: 'maxverstappen', givenName: 'Max', familyName: 'Verstappen', code: 'VER' },
    Constructors: [{ constructorId: 'red_bull', name: 'Red Bull Racing' }]
  };
  const liveUnknown = {
    position: '23', points: '0', wins: '0',
    Driver: { driverId: 'test_driver', givenName: 'Test', familyName: 'Driver', code: 'TST' },
    Constructors: [{ constructorId: 'test', name: 'Test Team' }]
  };
  const rows = data.enrichStandings([liveMax, liveUnknown]);
  assert.equal(rows.length, 23);
  assert.equal(rows[0].Driver.driverId, 'max_verstappen');
  assert.equal(rows[0].position, '1');
  assert.equal(rows[0].points, '287');
  assert.equal(rows[0].Constructors[0].name, 'Red Bull Racing');
  assert.equal(rows[0]._hasStandings, true);
  assert.ok(rows.some((row) => row.Driver.driverId === 'antonelli' && row._hasStandings === false));
  assert.ok(rows.some((row) => row.Driver.driverId === 'test_driver' && row.position === '23'));
});

check('driver data script loads before app.js and feature state markup exists', () => {
  const dataAt = html.indexOf('/driver-data.js');
  const appAt = html.indexOf('/app.js?');
  assert.ok(dataAt >= 0 && appAt > dataAt, 'driver-data.js must load before app.js');
  for (const id of ['driverGridStatus', 'driverOverlay', 'driverProfile', 'standingsLoading', 'sessionsResultsLoading', 'sessionsResultsRetry', 'perfDataState', 'perfRetry']) {
    assert.ok(html.includes(`id="${id}"`), `missing ${id}`);
  }
});

check('frontend uses live roster, ticketed live timing, and accessible retry states', () => {
  for (const marker of [
    'DRIVER_DATA.enrichStandings(list)',
    'DRIVER_DATA.findDriverByName(rawName)',
    'fetchLiveTiming()',
    "`${PUBLIC_API}/api/live/timing`",
    'schedulePerformanceRefresh(round, sessionType)',
    "aria-live=\"polite\""
  ]) {
    const haystack = marker.startsWith('aria-live') ? html : app;
    assert.ok(haystack.includes(marker), `missing integration marker: ${marker}`);
  }
  assert.ok(!/https?:\/\/api\.openf1\.org/i.test(app), 'browser must use the FreeF1 OpenF1 proxy');
});

check('mobile styles retain two-column driver cards and scrollable timing table', () => {
  assert.match(css, /@media\s*\(\s*max-width\s*:\s*480px\s*\)[\s\S]*?\.drivers\s*\{[^}]*grid-template-columns:\s*repeat\(2,1fr\)/);
  assert.match(css, /\.perf-table-wrap\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /@media\s*\(\s*max-width\s*:\s*560px\s*\)[\s\S]*?\.dp-tiles\s*\{[^}]*grid-template-columns:\s*repeat\(2,1fr\)/);
  assert.match(css, /\.perf-data-state\[hidden\]\s*\{\s*display:\s*none/);
});

let failed = 0;
for (const result of checks) {
  if (!result.pass) failed++;
  console.log(`  ${result.pass ? 'ok  ' : 'FAIL'}  ${result.label}${result.pass ? '' : ` → ${result.detail}`}`);
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
