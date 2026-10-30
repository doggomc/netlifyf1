import PRELOADED_SESSION_RESULTS from '../data/session-results.json';
import type { FeatureContext } from '../app';
import { $ } from '../services/dom';
export function init(ctx: FeatureContext) {
const { schedule, store, fetchWithTimeout, scheduleAnimationFrame, hexFor, inkOn, escapeHtml, openModal, closeModal } = ctx;
/* ═══════════════ 17. SHARED CLASSIFICATION & SESSION RESULTS MODAL ═══════════════ */


const sessionResultsCache = new Map();
if (typeof PRELOADED_SESSION_RESULTS === "object") {
  for (const [key, val] of Object.entries(PRELOADED_SESSION_RESULTS)) {
    sessionResultsCache.set(key, { results: val, rcMessages: [], at: Date.now() });
  }
}

function getAvailableResultEvents() {
  const now = Date.now();
  const pastOrCurrent = schedule.filter((ev) => {
    const firstSess = ev.sessions[0];
    return firstSess && Date.parse(firstSess.start) <= now + 2 * 3600e3;
  });
  return pastOrCurrent.length ? pastOrCurrent : [schedule[0]];
}

function getAvailableResultSessions(ev) {
  const now = Date.now();
  const list = [];

  // 1. Qualifying
  const qSess = ev.sessions.find((s) => s.slug === "qualifying");
  if (qSess && Date.parse(qSess.start) <= now + 2.5 * 3600e3) {
    list.push({ value: "qualifying", label: "Qualifying" });
  }

  // 2. Sprint (ONLY if sprint weekend and started)
  if (ev.sprint) {
    const spSess = ev.sessions.find((s) => s.slug === "sprint");
    if (spSess && Date.parse(spSess.start) <= now + 2.5 * 3600e3) {
      list.push({ value: "sprint", label: "Sprint" });
    }
  }

  // 3. Race (Classification)
  const raceSess = ev.sessions.find((s) => s.slug === "race");
  if (raceSess && Date.parse(raceSess.start) <= now + 2.5 * 3600e3) {
    list.push({ value: "results", label: "Race (Classification)" });
  }

  if (!list.length) {
    list.push({ value: "results", label: "Race (Classification)" });
  }
  return list;
}

async function fetchSessionClassification(round, sessionType = "results") {
  const cacheKey = `${round}_${sessionType}`;
  const memoryHit = sessionResultsCache.get(cacheKey);
  if (memoryHit && memoryHit.results?.length) return memoryHit.results;

  // Check localStorage
  try {
    const raw = store.get(`freef1_perf_${cacheKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.results) && parsed.results.length) {
        sessionResultsCache.set(cacheKey, { results: parsed.results, rcMessages: parsed.rcMessages || [], at: parsed.at });
        return parsed.results;
      }
    }
  } catch (_) {}

  // Fetch from Jolpica Ergast
  try {
    const endpoint = sessionType === "race" ? "results" : sessionType;
    const jolpicaUrl = `https://api.jolpi.ca/ergast/f1/2026/${round}/${endpoint}.json`;
    const r = await fetchWithTimeout(jolpicaUrl, { cache: "no-store" }, 5000);
    if (r.ok) {
      const data = await r.json();
      const race = data.MRData?.RaceTable?.Races?.[0];
      if (race) {
        const list = race.Results || race.QualifyingResults || race.SprintResults;
        if (Array.isArray(list) && list.length) {
          const existing = sessionResultsCache.get(cacheKey) || {};
          const entry = { ...existing, results: list, at: Date.now() };
          sessionResultsCache.set(cacheKey, entry);
          try { store.set(`freef1_perf_${cacheKey}`, JSON.stringify(entry)); } catch (_) {}
          return list;
        }
      }
    }
  } catch (_) {}
  return [];
}

// ── Session Results Modal Engine ──
const sOverlay = $("sessionsOverlay");
const sRace = $("sessionRaceSelect");
const sType = $("sessionTypeSelect");
const sLoad = $("sessionsResultsLoading");
const sRes = $("sessionsResults");
let sessionResultsRequest = 0;

function fadeInSessionContent(element) {
  if (!element) return;
  element.classList.remove("results-fade-in");
  scheduleAnimationFrame(() => {
    if (element.isConnected) element.classList.add("results-fade-in");
  });
}

function setSessionResultsLoading(isLoading) {
  if (!sLoad) return;
  if (isLoading) {
    sLoad.style.display = "block";
    fadeInSessionContent(sLoad);
  } else {
    sLoad.style.display = "none";
    sLoad.classList.remove("results-fade-in");
  }
}

function loadSeasonRaces() {
  if (!sRace) return;
  const availableEvents = getAvailableResultEvents();
  // Sort descending: latest round first (Round 15 Baku first!)
  const list = availableEvents.slice().sort((a, b) => Number(b.round) - Number(a.round));
  sRace.replaceChildren(...list.map((ev) => {
    const option = document.createElement("option");
    option.value = String(ev.round);
    option.textContent = `Round ${ev.round} · ${ev.name} (${ev.locality})`;
    return option;
  }));
  if (list.length) sRace.value = String(list[0].round);
  updateSessionTypeOptions();
  loadSessionResults();
}

function updateSessionTypeOptions() {
  if (!sRace || !sType) return;
  const round = Number(sRace.value);
  const ev = schedule.find((e) => e.round === round) || schedule[0];
  const sessions = getAvailableResultSessions(ev);

  sType.replaceChildren(...sessions.map((s) => {
    const opt = document.createElement("option");
    opt.value = s.value;
    opt.textContent = s.label;
    return opt;
  }));

  const hasCurrent = sessions.some((s) => s.value === sType.value);
  if (!hasCurrent) {
    sType.value = sessions.at(-1).value;
  }
}

async function loadSessionResults() {
  if (!sRace || !sType || !sRes) return;
  const requestId = ++sessionResultsRequest;
  const round = Number(sRace.value);
  const type = sType.value;
  if (!round) {
    setSessionResultsLoading(false);
    sRes.innerHTML = "<div class=\"state\">Select a race first.</div>";
    fadeInSessionContent(sRes);
    return;
  }

  // Instant check from cache
  const cacheKey = `${round}_${type}`;
  const cached = sessionResultsCache.get(cacheKey);
  if (cached && cached.results?.length) {
    setSessionResultsLoading(false);
    renderModalSessionResults(cached.results, type);
    return;
  }

  setSessionResultsLoading(true);
  sRes.replaceChildren();
  sRes.classList.remove("results-fade-in");

  const results = await fetchSessionClassification(round, type);
  // A fast session/race change may start another request before this one returns.
  if (requestId !== sessionResultsRequest) return;
  setSessionResultsLoading(false);

  if (!results || !results.length) {
    sRes.innerHTML = "<div class=\"state\">No results published for this session yet.</div>";
    fadeInSessionContent(sRes);
    return;
  }
  renderModalSessionResults(results, type);
}

function renderModalSessionResults(results, type) {
  if (!sRes) return;
  const isQuali = type === "qualifying";
  const fragment = document.createDocumentFragment();

  results.forEach((result) => {
    const element = document.createElement("div");
    element.className = "rrow";

    const teamName = result.Constructor?.name || "";
    const rtColor = hexFor(teamName);
    element.style.setProperty("--race-team", rtColor);
    element.style.setProperty("--race-team-ink", inkOn(rtColor));

    let time = "-";
    if (isQuali) {
      time = result.Q3 || result.Q2 || result.Q1 || "-";
    } else {
      time = result.Time?.time || result.status || "-";
      if (result.position !== "1" && result.Time?.time && !result.Time.time.startsWith("+")) {
        time = `+${result.Time.time}`;
      }
    }

    const pts = (!isQuali && result.points && Number(result.points) > 0) ? ` · +${result.points} PTS` : "";
    const driverName = `${result.Driver?.givenName || ""} ${result.Driver?.familyName || ""}`.trim();

    element.innerHTML = `
      <div class="pos">${escapeHtml(result.position || "-")}</div>
      <div class="who">
        <b>${escapeHtml(driverName)}</b>
        <small>${escapeHtml(teamName)}${pts}</small>
      </div>
      <div class="rtime mono">${escapeHtml(time)}</div>
    `;
    fragment.appendChild(element);
  });
  sRes.replaceChildren(fragment);
  fadeInSessionContent(sRes);
}

$("sessionsBtn")?.addEventListener("click", () => {
  openModal(sOverlay);
  loadSeasonRaces();
});
$("sessionsClose")?.addEventListener("click", () => closeModal(sOverlay));
sRace?.addEventListener("change", () => {
  updateSessionTypeOptions();
  loadSessionResults();
});
sType?.addEventListener("change", loadSessionResults);



return {};
}
