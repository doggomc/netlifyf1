import '../styles/radio.css';
import type { FeatureContext } from '../app';
import { $ } from '../services/dom';
export function init(ctx: FeatureContext) {
const { store, RADIO_RC_STORE_KEY, OPENF1_API, fetchWithTimeout, fadeSwapContent, escapeHtml, schedule, SITE_SEASON, radioRcTimeFmt, showToast } = ctx;
/* ═══════════════ 19. TEAM RADIO & RACE CONTROL (OPENF1) ═══════════════ */
const radioRcEl = $("radioRc");
const radioRcBtn = $("radioRcBtn");
const radioRcEventSel = $("radioRcEvent");
const radioRcSessionSel = $("radioRcSession");
const radioRcStatusEl = $("radioRcStatus");
const radioRcRadioList = $("radioRcRadioList");
const radioRcRcList = $("radioRcRcList");
const radioRcAudio = $("radioRcAudio");
const radioRcPlayerEl = $("radioRcPlayer");

const radioRc = {
  meetings: [],
  sessions: [],
  drivers: new Map(),
  sessionKey: null,
  radio: [],
  rc: [],
  playing: null,
  loadToken: 0,
  refreshTimer: 0,
  retryTimer: 0,
  switchTimer: 0,
  open: false,
  cache: new Map(),
  lastRequestAt: 0,
  chain: Promise.resolve()
};

function radioRcPrefs() {
  try {
    return JSON.parse(store.get(RADIO_RC_STORE_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function radioRcSavePrefs(patch) {
  store.set(RADIO_RC_STORE_KEY, JSON.stringify({ ...radioRcPrefs(), ...patch }));
}

function openf1(path, params, ttlMs) {
  const queryStr = new URLSearchParams(Object.entries(params || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, String(value)])).toString();
  const directUrl = `${OPENF1_API}/${encodeURIComponent(path)}${queryStr ? `?${queryStr}` : ''}`;
  const cacheKey = `${path}?${queryStr}`;
  const storageKey = `freef1_of1_${cacheKey}`;
  const staleLimit = (path === 'drivers' || path === 'sessions') ? 30 * 86400_000 : 7 * 86400_000;
  let cached = radioRc.cache.get(cacheKey) || null;

  if (cached?.promise) return cached.promise;
  if (cached && Date.now() - cached.at < ttlMs) return Promise.resolve(cached.data);

  if (!cached) {
    try {
      const stored = JSON.parse(store.get(storageKey) || 'null');
      if (stored && Array.isArray(stored.data) && Number.isFinite(Number(stored.at))) {
        cached = stored;
        radioRc.cache.set(cacheKey, cached);
      }
    } catch (_) {}
  }
  if (cached && Date.now() - Number(cached.at) < ttlMs) return Promise.resolve(cached.data);

  let fetchedAt = 0;
  const run = async () => {
    const wait = radioRc.lastRequestAt + 125 - Date.now();
    if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
    radioRc.lastRequestAt = Date.now();

    try {
      const response = await fetchWithTimeout(directUrl, {
        cache: 'default',
        headers: { Accept: 'application/json' }
      }, 5000);
      // OpenF1 uses 404 for a valid empty result set.
      if (response.status === 404) return [];
      if (!response.ok) {
        const error = new Error(response.status === 401
          ? 'OpenF1 is temporarily restricting live-session data'
          : response.status === 429 ? 'OpenF1 rate limit reached' : `OpenF1 returned ${response.status}`);
        error.code = response.status === 401 ? 'live' : response.status === 429 ? 'rate' : 'up';
        throw error;
      }
      const json = await response.json();
      if (json?.detail === 'No results found.') return [];
      if (!Array.isArray(json)) throw new Error('OpenF1 returned an unexpected response');
      fetchedAt = Date.now();
      return json;
    } catch (error) {
      if (cached && Date.now() - Number(cached.at) <= staleLimit) return cached.data;
      throw error;
    }
  };

  const promise = radioRc.chain.then(run, run).then((data) => {
    const at = fetchedAt || Number(cached?.at) || Date.now();
    radioRc.cache.set(cacheKey, { data, at });
    if (fetchedAt && Array.isArray(data) && data.length) {
      try {
        const encoded = JSON.stringify({ data, at });
        // Local storage is only a fallback cache; skip unusually large records.
        if (encoded.length < 250_000) store.set(storageKey, encoded);
      } catch (_) {}
    }
    return data;
  }).catch((error) => {
    if (cached) radioRc.cache.set(cacheKey, cached);
    else radioRc.cache.delete(cacheKey);
    throw error;
  });
  radioRc.chain = promise.catch(() => {});
  radioRc.cache.set(cacheKey, { promise, data: cached?.data || [], at: Number(cached?.at) || 0 });
  return promise;
}

function radioRcSetStatus(text, cls = '', { animate = false } = {}) {
  if (!radioRcStatusEl) return;
  fadeSwapContent(radioRcStatusEl, () => {
    radioRcStatusEl.textContent = text;
    radioRcStatusEl.classList.remove('live', 'warn');
    if (cls) radioRcStatusEl.classList.add(cls);
  }, { animate });
}

function radioRcSetListMessage(list, message, { animate = true, error = false } = {}) {
  if (!list) return;
  const className = `radio-rc-empty${error ? ' err' : ''}`;
  fadeSwapContent(list, () => {
    list.innerHTML = `<li class="${className}">${escapeHtml(message)}</li>`;
  }, { animate });
}

function radioRcIsLiveWindow(s) {
  if (!s) return false;
  const start = Date.parse(s.date_start);
  const end = Date.parse(s.date_end);
  const now = Date.now();
  return now >= start - 30 * 60e3 && now <= end + 30 * 60e3;
}

function radioRcMeetingLabel(meeting) {
  const t = Date.parse(meeting.date_start);
  const ev = schedule.find((e) => e.sessions.some((s) => Math.abs(Date.parse(s.start) - t) < 3 * 86400e3));
  return ev ? `R${ev.round} · ${ev.name}` : `${meeting.location} · ${meeting.country_name}`;
}

async function radioRcLoadSessions() {
  radioRcSetStatus('Loading sessions…');
  let sessions = [];
  try {
    sessions = await openf1('sessions', { year: SITE_SEASON }, 10 * 60e3);
  } catch (err) {
    sessions = [];
  }
  if (!Array.isArray(sessions) || !sessions.length) {
    // Upstream unreachable: synthesize from embedded official 2026 calendar
    let sKey = 11200;
    sessions = [];
    schedule.forEach((ev) => {
      ev.sessions.forEach((s) => {
        sessions.push({
          session_key: ++sKey,
          meeting_key: 1000 + ev.round,
          session_name: s.name,
          session_type: s.slug === 'race' ? 'Race' : s.slug.includes('qualifying') ? 'Qualifying' : 'Practice',
          date_start: s.start,
          date_end: s.start,
          circuit_short_name: ev.locality,
          country_name: ev.country,
          location: ev.locality,
          year: 2026
        });
      });
    });
  }
  const now = Date.now();
  radioRc.sessions = sessions
    .filter((s) => !/^Day \d/.test(s.session_name))
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));

  const meetings = new Map();
  for (const s of radioRc.sessions) {
    if (!meetings.has(s.meeting_key)) {
      meetings.set(s.meeting_key, {
        meeting_key: s.meeting_key,
        location: s.location,
        country_name: s.country_name,
        date_start: s.date_start
      });
    }
  }
  radioRc.meetings = [...meetings.values()];
  if (!radioRc.meetings.length) throw new Error('No sessions published yet this season');

  // Default to CURRENT (live) session or LAST session that took place
  const live = radioRc.sessions.find(radioRcIsLiveWindow);
  const started = radioRc.sessions.filter((s) => Date.parse(s.date_start) <= now + 30 * 60e3);
  const lastSessionOverall = started.length ? started.at(-1) : radioRc.sessions.at(-1);

  const target = live || lastSessionOverall || radioRc.sessions[0];

  if (radioRcEventSel) {
    radioRcEventSel.replaceChildren(...radioRc.meetings.map((m) => {
      const o = document.createElement('option');
      o.value = m.meeting_key;
      o.textContent = radioRcMeetingLabel(m);
      return o;
    }));
    radioRcEventSel.value = String(target.meeting_key);
    radioRcEventSel._syncCustom?.();
  }
  radioRcFillSessions(target.session_key);
}

function radioRcFillSessions(preferKey) {
  if (!radioRcEventSel || !radioRcSessionSel) return;
  const mk = Number(radioRcEventSel.value);
  const list = radioRc.sessions.filter((s) => s.meeting_key === mk);
  radioRcSessionSel.replaceChildren(...list.map((s) => {
    const o = document.createElement('option');
    o.value = s.session_key;
    o.textContent = s.session_name;
    return o;
  }));

  const now = Date.now();
  const startedInMeeting = list.filter((s) => Date.parse(s.date_start) <= now + 30 * 60e3);
  const lastSessionInMeeting = startedInMeeting.length ? startedInMeeting.at(-1) : list.at(-1);

  const pick = (preferKey && list.find((s) => s.session_key === preferKey)) || lastSessionInMeeting || list.at(-1);
  radioRcSessionSel.value = String(pick.session_key);
  radioRcEventSel._syncCustom?.();
  radioRcSessionSel._syncCustom?.();
  radioRcQueueSelect(pick.session_key);
}

function radioRcQueueSelect(sessionKey) {
  clearTimeout(radioRc.switchTimer);
  radioRc.switchTimer = window.setTimeout(() => radioRcSelectSession(sessionKey), 250);
}

async function radioRcSelectSession(sessionKey, { retry = false, animate = true } = {}) {
  const session = radioRc.sessions.find((s) => s.session_key === sessionKey);
  if (!session) return;
  const token = ++radioRc.loadToken;
  clearTimeout(radioRc.refreshTimer);
  clearTimeout(radioRc.retryTimer);
  radioRc.sessionKey = sessionKey;
  radioRcSavePrefs({ sessionKey, meetingKey: session.meeting_key });
  radioRcStopAudio();

  radioRcSetListMessage(radioRcRadioList, 'Loading team radio…', { animate });
  radioRcSetListMessage(radioRcRcList, 'Loading race control…', { animate });
  const rCount = $("radioRcRadioCount");
  const rcCount = $("radioRcRcCount");
  if (rCount) fadeSwapContent(rCount, () => { rCount.textContent = ''; }, { animate });
  if (rcCount) fadeSwapContent(rcCount, () => { rcCount.textContent = ''; }, { animate });

  const live = radioRcIsLiveWindow(session);
  const ttl = live ? 8e3 : 6 * 3600e3;
  const label = `${session.country_name} · ${session.session_name}`;
  radioRcSetStatus(live ? `${label} · in progress` : label, live ? 'live' : '', { animate });
  let nextRefresh = 0;

  try {
    const [rawDrivers, rawRadio, rawRc] = await Promise.all([
      openf1('drivers', { session_key: sessionKey }, 6 * 3600e3),
      openf1('team_radio', { session_key: sessionKey }, ttl),
      openf1('race_control', { session_key: sessionKey }, ttl)
    ]);
    if (token !== radioRc.loadToken) return;

    const drivers = Array.isArray(rawDrivers) ? rawDrivers : [];
    const radio = Array.isArray(rawRadio) ? rawRadio : [];
    const rc = Array.isArray(rawRc) ? rawRc : [];

    radioRc.drivers = new Map(drivers.map((d) => [d.driver_number, d]));
    radioRc.radio = radio.map((r) => ({ ...r, ts: Date.parse(r.date) })).filter((r) => r.recording_url).sort((a, b) => b.ts - a.ts);
    radioRc.rc = rc.map((r) => ({ ...r, ts: Date.parse(r.date) })).sort((a, b) => b.ts - a.ts);

    const noRadioOrRc = !radioRc.radio.length && !radioRc.rc.length;
    radioRcRenderRadio({
      animate,
      emptyText: noRadioOrRc
        ? live
          ? 'Session in progress. Team radio clips will appear here as soon as they are broadcast.'
          : 'No team radio recorded for this session.'
        : 'No team radio published for this session'
    });
    radioRcRenderRc({
      animate,
      emptyText: noRadioOrRc
        ? live
          ? 'Monitoring race control flags and steward messages…'
          : 'No race control messages for this session.'
        : 'No race control messages published for this session'
    });

    if (noRadioOrRc) {
      if (live) {
        radioRcSetStatus('Session live · polling telemetry feeds (every 10s)', 'live', { animate });
        nextRefresh = 10e3;
      } else {
        radioRcSetStatus(label, '', { animate });
      }
    } else if (live) {
      nextRefresh = 8e3;
    }
  } catch (err) {
    if (token !== radioRc.loadToken) return;
    if (err.code === 'live') {
      /* 401 here is not an outage: OpenF1 locks its free feed for the whole duration of a live
         session. Say so plainly, keep the retry loop running, and stop implying data is coming. */
      radioRcSetStatus('Live session · OpenF1 has locked its feed until the chequered flag', 'live', { animate });
      radioRcSetListMessage(radioRcRadioList, 'Team radio is locked while the session is running. We keep checking every 10 s and clips appear the moment the feed reopens.', { animate });
      radioRcSetListMessage(radioRcRcList, 'Race control messages reopen when the session ends.', { animate });
      nextRefresh = 10e3;
    } else if (err.code === 'rate' && !retry) {
      radioRcSetStatus('Data feed busy · retrying in 5 s', 'warn', { animate });
      radioRcSetListMessage(radioRcRadioList, 'Feed is busy right now - retrying automatically…', { animate });
      radioRcSetListMessage(radioRcRcList, '', { animate });
      radioRc.retryTimer = window.setTimeout(() => {
        if (radioRc.open && radioRc.sessionKey === sessionKey) radioRcSelectSession(sessionKey, { retry: true });
      }, 5e3);
    } else {
      /* A browser cannot read OpenF1's 401 when the response carries no CORS headers, so a locked
         live session and a real network fault both land here. Say both, honestly. */
      const msg = err.code === 'net'
        ? 'OpenF1 is not answering. Its free feed locks while a session is live and reopens after the chequered flag — this panel retries on its own.'
        : (err.message || 'Telemetry standby');
      radioRcSetListMessage(radioRcRadioList, msg, { animate });
      radioRcSetListMessage(radioRcRcList, msg, { animate });
      radioRcSetStatus(err.code === 'live' ? 'Live session in progress · polling' : err.code === 'rate' ? 'Data feed busy · retrying' : 'Telemetry standby · OpenF1 locked or unreachable', 'warn', { animate });
    }
  }

  if (nextRefresh && radioRc.open) {
    radioRc.refreshTimer = window.setTimeout(() => {
      if (!document.hidden && radioRc.open && radioRc.sessionKey === sessionKey) radioRcSelectSession(sessionKey, { animate: false });
    }, nextRefresh);
  }
}

function radioRcDriver(n) {
  const d = radioRc.drivers.get(n);
  const hex = /^[0-9a-f]{6}$/i.test(d?.team_colour || '') ? `#${d.team_colour}` : '#555';
  return {
    code: d?.name_acronym || `#${n}`,
    name: d?.full_name || d?.broadcast_name || `Car ${n}`,
    team: d?.team_name || '',
    colour: hex
  };
}

function radioRcRenderRadio({ animate = true, emptyText = 'No team radio published for this session' } = {}) {
  const rCount = $("radioRcRadioCount");
  if (rCount) fadeSwapContent(rCount, () => {
    rCount.textContent = radioRc.radio.length ? `${radioRc.radio.length} clips` : '';
  }, { animate });
  if (!radioRcRadioList) return;
  if (!radioRc.radio.length) {
    radioRcSetListMessage(radioRcRadioList, emptyText, { animate });
    return;
  }
  const markup = radioRc.radio.map((r, i) => {
    const d = radioRcDriver(r.driver_number);
    return `<li><button type="button" class="radio-rc-clip${radioRc.playing === r.recording_url ? ' playing' : ''}" data-idx="${i}" aria-label="Play radio from ${escapeHtml(d.name)} at ${escapeHtml(radioRcTimeFmt.format(r.ts))}">
      <span class="radio-rc-code" style="background:${d.colour}">${escapeHtml(d.code)}</span>
      <span class="radio-rc-who"><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.team)}</span></span>
      <span class="radio-rc-when">${escapeHtml(radioRcTimeFmt.format(r.ts))}</span>
      <span class="radio-rc-play" aria-hidden="true"></span></button></li>`;
  }).join('');
  fadeSwapContent(radioRcRadioList, () => {
    radioRcRadioList.innerHTML = markup;
  }, { animate });
}

function radioRcTag(r) {
  const m = r.message || '';
  if (r.category === 'SafetyCar') return /VSC|VIRTUAL/.test(m) ? 'VSC' : 'SC';
  if (/^RED FLAG/.test(m) || /ABORTED/.test(m)) return 'RED';
  if (r.flag) return r.flag.replace(/\s+/g, '');
  if (r.category === 'Drs') return 'DRS';
  if (r.category === 'SessionStatus') return 'SESSION';
  return 'FIA';
}

function radioRcRenderRc({ animate = true, emptyText = 'No race control messages published for this session' } = {}) {
  const rcCount = $("radioRcRcCount");
  if (rcCount) fadeSwapContent(rcCount, () => {
    rcCount.textContent = radioRc.rc.length ? `${radioRc.rc.length} messages` : '';
  }, { animate });
  if (!radioRcRcList) return;
  if (!radioRc.rc.length) {
    radioRcSetListMessage(radioRcRcList, emptyText, { animate });
    return;
  }
  const markup = radioRc.rc.map((r) => {
    const tag = radioRcTag(r);
    return `<li class="radio-rc-msg"><time datetime="${escapeHtml(new Date(r.ts).toISOString())}">${escapeHtml(radioRcTimeFmt.format(r.ts).slice(0, 5))}</time><span class="radio-rc-tag ${escapeHtml(tag)}">${escapeHtml(tag)}</span><span>${escapeHtml(r.message || '')}${r.lap_number ? `<i class="lap">L${escapeHtml(r.lap_number)}</i>` : ''}</span></li>`;
  }).join('');
  fadeSwapContent(radioRcRcList, () => {
    radioRcRcList.innerHTML = markup;
  }, { animate });
}

function radioRcStopAudio() {
  if (!radioRcAudio) return;
  radioRcAudio.pause();
  radioRcAudio.removeAttribute('src');
  radioRcAudio.load();
  radioRc.playing = null;
  if (radioRcPlayerEl) {
    radioRcPlayerEl.hidden = true;
    radioRcPlayerEl.classList.remove('paused');
  }
  radioRcRadioList?.querySelectorAll<HTMLElement>('.playing').forEach((el) => el.classList.remove('playing'));
}

function radioRcPlay(clip) {
  if (!radioRcAudio) return;
  const d = radioRcDriver(clip.driver_number);
  if (radioRc.playing === clip.recording_url) {
    if (radioRcAudio.paused) {
      radioRcAudio.play().catch(() => {});
      radioRcPlayerEl?.classList.remove('paused');
    } else {
      radioRcAudio.pause();
      radioRcPlayerEl?.classList.add('paused');
    }
    return;
  }
  radioRc.playing = clip.recording_url;
  if (radioRcPlayerEl) {
    radioRcPlayerEl.hidden = false;
    radioRcPlayerEl.classList.remove('paused');
  }
  const pCode = $("radioRcPlayerCode");
  const pName = $("radioRcPlayerName");
  const pTime = $("radioRcPlayerTime");
  if (pCode) {
    pCode.textContent = d.code;
    pCode.style.background = d.colour;
  }
  if (pName) pName.textContent = `${d.name} · ${d.team}`;
  if (pTime) pTime.textContent = `${radioRcTimeFmt.format(clip.ts)} · loading…`;
  radioRcRadioList?.querySelectorAll<HTMLElement>('.radio-rc-clip').forEach((el) => {
    el.classList.toggle('playing', radioRc.radio[Number(el.dataset.idx)]?.recording_url === clip.recording_url);
  });
  radioRcAudio.src = clip.recording_url;
  radioRcAudio.play().catch(() => {});
}

radioRcAudio?.addEventListener('loadedmetadata', () => {
  if (radioRc.playing) {
    const clip = radioRc.radio.find((r) => r.recording_url === radioRc.playing);
    const pTime = $("radioRcPlayerTime");
    if (clip && pTime) pTime.textContent = `${radioRcTimeFmt.format(clip.ts)} · ${Math.round(radioRcAudio.duration || 0)} s`;
  }
});

radioRcAudio?.addEventListener('ended', () => {
  radioRcPlayerEl?.classList.add('paused');
  radioRcRadioList?.querySelectorAll<HTMLElement>('.playing').forEach((el) => el.classList.remove('playing'));
});

radioRcAudio?.addEventListener('error', () => {
  if (!radioRc.playing) return;
  const btn = [...(radioRcRadioList?.querySelectorAll<HTMLElement>('.radio-rc-clip') || [])].find((el) => radioRc.radio[Number(el.dataset.idx)]?.recording_url === radioRc.playing);
  if (btn) {
    btn.classList.remove('playing');
    btn.classList.add('failed');
  }
  const pTime = $("radioRcPlayerTime");
  if (pTime) pTime.textContent = 'Could not load this clip from F1’s audio server';
  radioRcPlayerEl?.classList.add('paused');
  showToast('This radio clip could not be loaded from F1’s audio server.', 'warning');
  radioRc.playing = null;
});

radioRcRadioList?.addEventListener('click', (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLElement>('.radio-rc-clip');
  if (!btn) return;
  const clip = radioRc.radio[Number(btn.dataset.idx)];
  if (clip) radioRcPlay(clip);
});

function radioRcSetOpen(open, { animate = true, save = true } = {}) {
  radioRc.open = open;
  radioRcBtn?.setAttribute('aria-expanded', String(open));
  radioRcBtn?.classList.toggle('active', open);
  if (save) radioRcSavePrefs({ open });
  if (open) {
    radioRcEl?.classList.toggle('no-anim', !animate);
    if (radioRcEl) radioRcEl.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      radioRcEl?.classList.add('open');
      window.setTimeout(() => {
        if (radioRc.open) radioRcEl?.classList.add('settled');
      }, animate ? 600 : 0);
    }));
    if (!radioRc.meetings.length) {
      radioRcLoadSessions().catch((err) => {
        radioRcSetStatus(err.code === 'rate'
          ? 'OpenF1 is busy · try again in a minute'
          : err.code === 'live'
            ? 'Live session · OpenF1 locked until the chequered flag'
            : (err.message || 'OpenF1 unavailable'), 'warn');
        radioRcSetListMessage(radioRcRadioList, err.code === 'live'
          ? 'Team radio and race control are locked by OpenF1 while a session is live. They reopen after the chequered flag — reopen this panel then.'
          : (err.message || 'OpenF1 unavailable'), { error: true });
        radioRcSetListMessage(radioRcRcList, '');
      });
    } else if (radioRcIsLiveWindow(radioRc.sessions.find((s) => s.session_key === radioRc.sessionKey))) {
      radioRcSelectSession(radioRc.sessionKey, { animate: false });
    }
  } else {
    clearTimeout(radioRc.refreshTimer);
    clearTimeout(radioRc.retryTimer);
    radioRcEl?.classList.remove('open', 'settled');
    radioRcStopAudio();
    const finish = () => {
      if (!radioRc.open && radioRcEl) radioRcEl.hidden = true;
    };
    if (animate) window.setTimeout(finish, 560);
    else finish();
  }
}

radioRcBtn?.addEventListener('click', () => {
  radioRcSetOpen(!radioRc.open);
  if (!radioRc.open) return;
  window.setTimeout(() => radioRcEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
});

$("radioRcClose")?.addEventListener('click', () => {
  radioRcSetOpen(false);
  radioRcBtn?.focus();
});

radioRcEventSel?.addEventListener('change', () => radioRcFillSessions(null));
radioRcSessionSel?.addEventListener('change', () => radioRcQueueSelect(Number(radioRcSessionSel.value)));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearTimeout(radioRc.refreshTimer);
  } else if (radioRc.open && radioRcIsLiveWindow(radioRc.sessions.find((s) => s.session_key === radioRc.sessionKey))) {
    radioRcSelectSession(radioRc.sessionKey, { animate: false });
  }
}, { passive: true });

if (radioRcPrefs().open) {
  window.setTimeout(() => radioRcSetOpen(true, { animate: false, save: false }), 900);
}


return {};
}
