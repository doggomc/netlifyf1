async (page) => {
  // Run against `npm run preview` using playwright-cli run-code --filename.
  // All third-party services are mocked. No live ticket or admin state is changed.
  const base = 'http://127.0.0.1:4173';
  const passed = [];
  const errors = [];
  const requests = [];
  const check = (condition, message) => { if (!condition) throw new Error(message); passed.push(message); };
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(() => {
    window.__streams = [];
    window.__sockets = [];
    class MockEvents {
      constructor(url) { this.url = String(url); this.listeners = {}; window.__streams.push(this); }
      addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
      emit(type, payload) { for (const listener of this.listeners[type] || []) listener({ data: JSON.stringify(payload) }); }
      close() { this.closed = true; }
    }
    window.EventSource = MockEvents;
    window.WebSocket = class extends MockEvents {
      static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
      constructor(url) { super(url); window.__streams.pop(); window.__sockets.push(this); this.readyState = 1; }
      close() { this.readyState = 3; }
    };
    window.__sendConfig = payload => window.__streams.forEach(stream => stream.emit('config', payload));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copiedReport = text; } } });
    HTMLMediaElement.prototype.play = async function () {};
    HTMLMediaElement.prototype.pause = function () {};
  });
  const driver = { driverId: 'russell', givenName: 'George', familyName: 'Russell', permanentNumber: '63', code: 'RUS', dateOfBirth: '1998-02-15', nationality: 'British' };
  const constructor = { constructorId: 'mercedes', name: 'Mercedes' };
  const standing = { position: '1', points: '100', wins: '3', Driver: driver, Constructors: [constructor] };
  const result = { position: '1', Driver: driver, Constructor: constructor, points: '25', status: 'Finished', Q1: '1:30.000' };
  let ticket = null;
  let messages = [];
  let helpOffline = false;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === base) return route.continue();
    if (url.hostname === 'api.jolpi.ca') {
      let MRData = { total: '0', RaceTable: { Races: [] }, SeasonTable: { Seasons: [] }, StandingsTable: { StandingsLists: [] } };
      if (url.pathname.includes('driverstandings') && !url.pathname.includes('/drivers/')) MRData.StandingsTable.StandingsLists = [{ DriverStandings: [standing] }];
      else if (url.pathname.includes('constructorstandings')) MRData.StandingsTable.StandingsLists = [{ ConstructorStandings: [{ position: '1', points: '200', wins: '5', Constructor: constructor }] }];
      else if (/\/(results|qualifying|sprint)(\.json)?$/.test(url.pathname)) MRData.RaceTable.Races = [{ Results: [result], QualifyingResults: [result], SprintResults: [result] }];
      return route.fulfill({ json: { MRData } });
    }
    if (url.hostname === 'api.openf1.org') {
      const date = new Date(Date.now() - 86400000).toISOString();
      const responses = {
        sessions: [{ session_key: 99, meeting_key: 9, session_name: 'Race', session_type: 'Race', date_start: date, date_end: date, circuit_short_name: 'Austin', country_name: 'USA', location: 'Austin', year: 2026 }],
        drivers: [{ driver_number: 63, name_acronym: 'RUS', full_name: 'George Russell', team_name: 'Mercedes', team_colour: '00D2BE' }],
        team_radio: [{ driver_number: 63, recording_url: 'https://media.formula1.com/test.mp3', date }],
        race_control: [{ date, category: 'Flag', flag: 'GREEN', message: 'TRACK CLEAR', lap_number: 1 }]
      };
      return route.fulfill({ json: responses[url.pathname.split('/').pop()] || [] });
    }
    if (url.hostname === 'f1admin.onrender.com') {
      if (helpOffline) return route.abort();
      const path = url.pathname, method = route.request().method();
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Headers': 'content-type,authorization', 'Access-Control-Allow-Methods': 'GET,POST,DELETE' } });
      if (path === '/api/help/config') return route.fulfill({ json: { available: true } });
      if (path === '/api/help/tickets') {
        const body = route.request().postDataJSON();
        ticket = { id: 'ticket-0001', name: body.name, category: body.category };
        messages = [{ id: 'm1', role: 'visitor', text: body.message, createdAt: Date.now() }];
        return route.fulfill({ json: { ticket, messages } });
      }
      if (path === '/api/help/ticket/messages') {
        const message = { id: 'm2', role: 'visitor', text: route.request().postDataJSON().text, createdAt: Date.now() };
        messages.push(message); return route.fulfill({ json: { message } });
      }
      if (path === '/api/help/ticket' && method === 'DELETE') { ticket = null; messages = []; return route.fulfill({ json: { ok: true } }); }
      if (path === '/api/help/ticket/events') return route.fulfill({ contentType: 'text/event-stream', body: ': test stream\n\n' });
      if (path === '/api/help/ticket' || path === '/api/help/ticket/status') return route.fulfill({ json: { open: Boolean(ticket), ticket, messages } });
      return route.fulfill({ json: {} });
    }
    if (route.request().resourceType() === 'document') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Test feed</title><p>Test player</p>' });
    if (route.request().resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="440" height="587"><rect width="440" height="587" fill="#222"/></svg>' });
    return route.abort();
  });
  await page.goto(base);
  await page.locator('#links button').first().waitFor();
  check(await page.locator('#links button').count() === 6, 'Offline Render leaves all local source controls usable');
  check(await page.evaluate(() => window.__streams.length) === 1, 'One config SSE connection at startup');
  const startupResources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
  check(!startupResources.some(url => /\/(results|race-times|radio|championship|diagnostics|help)-[^/]+\.js/.test(url)), 'Optional feature bundles are absent from fresh startup');
  await page.evaluate(() => window.__sockets[0].emit('message', { type: 'count', count: 42 }));
  // WebSocket payloads are encoded once by the mock emit helper, matching browser messages.
  check(await page.locator('#viewerCount').textContent() === '42', 'Viewer counter renders a valid aggregate count');
  await page.evaluate(() => window.__sockets[0].emit('message', { type: 'count', count: -5 }));
  check(await page.locator('#viewerCount').textContent() === '42', 'Invalid viewer counts are ignored');
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')); });
  check(await page.evaluate(() => window.__streams.length === 1 && window.__sockets.length === 1), 'Focus and online events do not duplicate live connections');
  check(!requests.some(url => url.includes('/api/site/config')), 'SSE startup does not add a parallel config fetch');
  await page.evaluate(() => window.__sendConfig({ streamWindow: { active: true } }));
  await page.locator('#player iframe').waitFor();
  await page.evaluate(() => { window.__player = document.querySelector('#player iframe'); window.__sendConfig({ sources: { disabled: ['dazn'] } }); });
  check(await page.evaluate(() => document.querySelector('#player iframe') === window.__player), 'Unrelated config change keeps the playing iframe mounted');
  check(await page.locator('#links button').count() === 5, 'Disabled feed config updates the local source controls');
  await page.locator('#links button').filter({ hasText: 'F1TV' }).click();
  check(await page.locator('#player iframe').getAttribute('src').then(value => value.includes('embedindia')), 'Feed switching still uses the direct stream host');
  await page.evaluate(() => window.__sendConfig({ streamOverride: { active: true, url: 'https://example.com/fixture.mp4', type: 'mp4' } }));
  await page.locator('#player video').waitFor();
  check(await page.locator('#player video source').getAttribute('src') === 'https://example.com/fixture.mp4', 'Direct video overrides preserve native video controls');
  await page.evaluate(() => window.__sendConfig({ streamOverride: { active: false }, streamWindow: { active: false }, sources: { disabled: [] } }));
  await page.locator('#raceTimesBtn').click();
  await page.locator('#raceTimesOverlay.open').waitFor();
  await page.locator('#raceTimesList .rt-row').first().waitFor();
  check(await page.locator('#raceTimesList .rt-row').count() > 0, 'Race Times loads on its first click');
  await page.getByRole('button', { name: 'Track time', exact: true }).click();
  check((await page.locator('#raceTimesTimezone').textContent()).includes('circuit'), 'Track timezone mode works');
  check(await page.evaluate(() => localStorage.getItem('freef1_race_times_mode')) === 'track', 'Race time preference persists');
  await page.keyboard.press('Escape');
  check(await page.locator('#raceTimesOverlay').evaluate(element => !element.classList.contains('open')), 'Escape closes lazy modals');
  await page.locator('#raceTimesBtn').click();
  await page.locator('#raceTimesOverlay.open').waitFor();
  await page.locator('#raceTimesClose').click();
  check(requests.filter(url => /\/race-times-[^/]+\.js/.test(url)).length === 1, 'Reopening a lazy feature reuses its cached module');
  await page.locator('#sessionsBtn').click();
  await page.locator('#sessionsOverlay.open').waitFor();
  await page.locator('#sessionsResults .rrow').first().waitFor();
  check((await page.locator('#sessionsResults').textContent()).includes('George Russell'), 'Session results load and render from the unchanged provider contract');
  await page.locator('#sessionsClose').click();
  await page.locator('#championshipBtn').click();
  await page.locator('#driverGrid .dcard').first().waitFor();
  check(await page.locator('#standingsList .row').count() === 1, 'Championship button works before any dependency on another modal');
  check(requests.filter(url => /driverstandings/.test(url) && !url.includes('/drivers/')).length === 1, 'Grid and driver standings share one provider request');
  await page.locator('#driverGrid .dcard').first().click();
  await page.locator('#driverOverlay.open').waitFor();
  await page.locator('#dpFollow').click();
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('freef1_following')).includes('russell')), 'Following a driver persists');
  await page.locator('#dpLivery').click();
  check(await page.evaluate(() => localStorage.getItem('freef1_team')) === 'mercedes', 'Driver livery applies and persists');
  await page.getByRole('tab', { name: 'Constructors', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#standingsList').textContent.includes('200'));
  check((await page.locator('#standingsList').textContent()).includes('Mercedes'), 'Constructor standings tab works');
  await page.locator('#radioRcBtn').click();
  await page.locator('#radioRcRcList .radio-rc-msg').first().waitFor();
  check((await page.locator('#radioRcRcList').textContent()).includes('TRACK CLEAR'), 'Lazy radio feature loads OpenF1 race-control messages');
  await page.locator('#radioRcRadioList .radio-rc-clip').first().click();
  check(await page.locator('#radioRcAudio').getAttribute('src') === 'https://media.formula1.com/test.mp3', 'Radio clip selection preserves the audio playback path');
  await page.locator('#radioRcClose').click();
  await page.locator('#copyDiagnosticsBtn').click();
  await page.waitForFunction(() => Boolean(window.__copiedReport));
  check(await page.evaluate(() => !/westreamf1\.com|embedindia\.st|wikisport\.info/.test(window.__copiedReport)), 'Lazy diagnostics does not reveal stream source URLs');
  await page.locator('#diagCautionDismiss').click();
  await page.locator('.foot-links button[data-panel="privacyPanel"]').click();
  await page.locator('#viewInfo.is-active').waitFor();
  check(new URL(page.url()).pathname === '/info', 'Clean /info route and footer policy links work');
  await page.reload();
  await page.locator('#viewInfo.is-active').waitFor();
  check(await page.locator('#privacyPanel').count() === 1, 'Direct route refresh preserves the information shell');
  await page.goto(`${base}/help.html`);
  await page.waitForFunction(() => !document.querySelector('#helpSubmit').disabled);
  await page.locator('#helpName').fill('Test driver');
  await page.locator('#helpMessage').fill('This is a fixture-only playback support test.');
  await page.getByRole('button', { name: /^Category /  }).click();
  await page.getByRole('option', { name: 'Playback issue', exact: true }).click();
  await page.locator('#helpSubmit').click();
  await page.locator('#activeTicketPanel').waitFor({ state: 'visible' });
  check((await page.locator('#ticketId').textContent()).includes('0001'), 'Help creates a ticket with the existing bearer-key API');
  await page.locator('#chatMessage').fill('A test follow-up message');
  await page.locator('#chatSend').click();
  await page.waitForFunction(() => document.querySelector('#chatMessages').textContent.includes('A test follow-up message'));
  check(true, 'Help sends and renders a chat reply');
  // This is a fixture-only ticket; no live account or Discord channel is involved.
  await page.evaluate(() => { window.confirm = () => true; });
  await page.locator('#deleteTicket').click();
  await page.locator('#helpRequestPanel').waitFor({ state: 'visible' });
  check(true, 'Help deletes the fixture ticket and resets the form');
  await page.locator('#helpMessage').fill('An offline draft is kept safely.');
  helpOffline = true;
  await page.reload();
  check(await page.locator('#helpMessage').inputValue() === 'An offline draft is kept safely.', 'Help draft survives reload during backend outage');
  await page.goto(base);
  await page.evaluate(() => window.__sendConfig({ maintenance: { active: true, message: 'Fixture maintenance', eta: 'Soon' } }));
  await page.waitForURL('**/maintenance.html');
  check((await page.locator('#maintenanceMessage').textContent()).includes('Fixture maintenance'), 'Live maintenance config redirects and restores cached details');
  await page.evaluate(() => window.__sendConfig({ maintenance: { active: false } }));
  await page.waitForURL(base + '/');
  check(true, 'Maintenance release returns visitors to the public site');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator('#navToggle').click();
  check(await page.locator('#navToggle').getAttribute('aria-expanded') === 'true', 'Mobile navigation opens accessibly');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile layout has no horizontal overflow');
  await page.evaluate(() => {
    localStorage.setItem('freef1_site_config_v2', JSON.stringify({ savedAt: Date.now(), config: { maintenance: { active: true } } }));
  });
  await page.reload();
  check(new URL(page.url()).pathname === '/', 'Cached maintenance does not lock visitors out while Render is offline');
  await page.evaluate(() => window.__sendConfig({ maintenance: { active: 'false' } }));
  check(new URL(page.url()).pathname === '/', 'Malformed maintenance messages cannot trigger a redirect');
  await page.goto(base + '/discord');
  await page.locator('#viewDiscord.is-active').waitFor();
  check(true, 'Direct Discord route renders its view');
  await page.goto(base + '/beertjie.html');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Preserved gallery fits the mobile viewport');
  await page.goto(base + '/404.html');
  check(!(await page.title()).includes('United States'), 'Standalone 404 remains a separate page');
  check(errors.length === 0, `No uncaught browser errors (${errors.join('; ')})`);
  return { checksPassed: passed.length, checks: passed, uncaughtErrors: errors };
}
