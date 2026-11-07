/* Dual-source Formula 1 timing engine for /live-timing:
   1. Official F1 SignalR Core WebSocket (wss://livetiming.formula1.com/signalrcore)
      using \x1e record-separated JSON frames and live state-delta merging.
   2. OpenF1 REST feed (https://api.openf1.org/v1) for instant final classification
      between sessions and automatic fallback when SignalR is idle or blocked. */

import { slugify } from '../data/slugs';

export const F1_SIGNALR_URL = 'wss://livetiming.formula1.com/signalrcore';
export const F1_STATIC_BASE = 'https://livetiming.formula1.com/static/';
const RECORD_SEP = '\x1e';

export const F1_TOPICS = [
  'Heartbeat', 'SessionInfo', 'SessionStatus', 'TrackStatus', 'LapCount',
  'ExtrapolatedClock', 'TopThree', 'RaceControlMessages', 'DriverList',
  'TimingData', 'TimingAppData', 'TimingStats', 'WeatherData', 'TeamRadio',
] as const;

export type CellTone = '' | 'fastest' | 'pb';
export type TrackFlagClass = 'flag-idle' | 'flag-green' | 'flag-yellow' | 'flag-sc' | 'flag-red';

export type TimingCell = { text: string; tone?: CellTone };

export type TimingRow = {
  num: string;
  pos: string;
  tla: string;
  lastName: string;
  fullName: string;
  driverHref: string;
  teamColor: string;
  isOut: boolean;
  /** 7 numeric columns:
      Race/Sprint:    [Gap, Interval, Last lap, Best lap, S1, S2, S3]
      Practice/Quali: [Best lap, Gap, Interval, Last lap, S1, S2, S3] */
  cells: [TimingCell, TimingCell, TimingCell, TimingCell, TimingCell, TimingCell, TimingCell];
  tyre: { code: string; age: string } | null;
  tail: string;
};

export type RaceControlItem = {
  time: string;
  lap: string;
  dotCls: string;
  message: string;
};

export type RadioClipItem = {
  num: string;
  tla: string;
  lastName: string;
  fullName: string;
  teamColor: string;
  headshotUrl: string;
  time: string;
  url: string;
};

export type TimingSnapshot = {
  source: 'f1live' | 'openf1';
  sessionKey?: number;
  meetingKey?: number;
  isLive: boolean;
  isRace: boolean;
  statusText: string;
  meetingName: string;
  sessionName: string;
  subtitleParts: string[];
  startMs: number | null;
  track: { label: string; cls: TrackFlagClass };
  clock: { label: 'Remaining' | 'Lap'; value: string };
  weather: { air: string; track: string; humidity: string; wind: string; rain: boolean } | null;
  rows: TimingRow[];
  raceControlTotal: number;
  raceControl: RaceControlItem[];
  radio: RadioClipItem[];
};

const TEAM_COLOR: Record<string, string> = {
  McLaren: '#FF8000',
  Ferrari: '#DC0000',
  'Red Bull': '#1E41FF',
  'Red Bull Racing': '#1E41FF',
  Mercedes: '#00D2BE',
  Williams: '#005AFF',
  'Aston Martin': '#006F62',
  'Alpine F1 Team': '#FF0080',
  Alpine: '#FF0080',
  'Haas F1 Team': '#B6BABD',
  Haas: '#B6BABD',
  Audi: '#E62213',
  Sauber: '#00E701',
  'RB F1 Team': '#6692FF',
  'Racing Bulls': '#6692FF',
  'Cadillac F1 Team': '#B4A07A',
  Cadillac: '#B4A07A',
};

const TRACK_STATUS_MAP: Record<string, { label: string; cls: TrackFlagClass }> = {
  '1': { label: 'Track clear', cls: 'flag-green' },
  '2': { label: 'Yellow flag', cls: 'flag-yellow' },
  '3': { label: 'Track clear', cls: 'flag-green' },
  '4': { label: 'Safety car', cls: 'flag-sc' },
  '5': { label: 'Red flag', cls: 'flag-red' },
  '6': { label: 'Virtual safety car', cls: 'flag-sc' },
  '7': { label: 'VSC ending', cls: 'flag-yellow' },
};

export function tyreCode(compound: unknown): string {
  const map: Record<string, string> = {
    SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W',
  };
  return map[String(compound ?? '').toUpperCase()] ?? '?';
}

export function normalizeHex(hex?: string, teamName?: string): string {
  if (teamName && TEAM_COLOR[teamName]) return TEAM_COLOR[teamName];
  const cleaned = String(hex ?? '').replace(/^#/, '').trim();
  return /^[0-9a-fA-F]{6}$/.test(cleaned) ? `#${cleaned}` : '#7e8188';
}

export function formatLapSeconds(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || sec <= 0) return '';
  const mins = Math.floor(sec / 60);
  const rem = sec - mins * 60;
  if (mins > 0) {
    const whole = Math.floor(rem);
    const ms = Math.round((rem - whole) * 1000);
    if (ms === 1000) return formatLapSeconds(sec + 0.0004);
    return `${mins}:${String(whole).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
  return rem.toFixed(3);
}

export function formatSectorSeconds(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || sec <= 0) return '';
  return sec.toFixed(3);
}

export function parseLapTimeMs(value: unknown): number {
  if (!value) return Infinity;
  const match = String(value).trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!match) return Infinity;
  return (Number(match[1] || 0) * 60 + Number(match[2])) * 1000;
}

export function formatRemainingMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const timeShortFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
function fmtTime(iso?: string | null): string {
  if (!iso) return '';
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const ts = Date.parse(normalized);
  return Number.isFinite(ts) ? timeShortFmt.format(ts) : '';
}

export function rcDotClass(flag?: string | null, category?: string | null, message?: string | null): string {
  const joined = `${flag ?? ''} ${category ?? ''} ${message ?? ''}`.toUpperCase();
  if (/RED/.test(flag ?? '') || /RED FLAG/.test(joined)) return 'is-red';
  if (/YELLOW|DOUBLE YELLOW|SAFETY|VSC/.test(joined)) return 'is-amber';
  if (/GREEN|CLEAR/.test(flag ?? '')) return 'is-green';
  if (/BLUE/.test(flag ?? '')) return 'is-blue';
  if (/CHEQUERED/.test(flag ?? '') || /CHEQUERED/.test(joined)) return 'is-white';
  return 'is-muted';
}

/** Recursive SignalR state patcher matching F1's TimingData delta semantics. */
export function mergeF1Delta(current: unknown, patch: unknown): unknown {
  if (patch === null || typeof patch !== 'object') return patch;
  if (Array.isArray(patch)) return patch.map((item) => mergeF1Delta(undefined, item));
  const base: Record<string, unknown> = (current !== null && typeof current === 'object' && !Array.isArray(current))
    ? { ...(current as Record<string, unknown>) }
    : Array.isArray(current)
      ? [...current] as unknown as Record<string, unknown>
      : {};

  for (const [key, val] of Object.entries(patch as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (key === '_deleted' && Array.isArray(val)) {
      for (const delKey of val) delete base[String(delKey)];
      continue;
    }
    if (Array.isArray(base)) {
      const idx = Number(key);
      if (Number.isInteger(idx) && idx >= 0) {
        (base as unknown[])[idx] = mergeF1Delta((base as unknown[])[idx], val);
      }
    } else {
      base[key] = mergeF1Delta(base[key], val);
    }
  }
  return base;
}

function valuesList<T>(val: unknown): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean) as T[];
  if (typeof val === 'object') return Object.values(val as Record<string, T>).filter(Boolean);
  return [];
}

function parseGmtOffsetMs(offset?: string): number {
  if (!offset) return 0;
  const neg = offset.startsWith('-');
  const [hh, mm] = offset.replace(/^[+-]/, '').split(':').map(Number);
  return (neg ? -1 : 1) * ((hh || 0) * 60 + (mm || 0)) * 60_000;
}

export function extrapolatedRemainingMs(state: Record<string, any>, now: number = Date.now()): number | null {
  const clock = state?.ExtrapolatedClock;
  if (!clock?.Remaining) return null;
  const parts = String(clock.Remaining).split(':').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  let rem = ((parts[0] * 60 + parts[1]) * 60 + parts[2]) * 1000;
  if (clock.Extrapolating && clock.Utc) {
    const ref = Date.parse(clock.Utc);
    if (Number.isFinite(ref)) rem -= now - ref;
  }
  return Math.max(0, rem);
}

const f1Tone = (entry: any): CellTone =>
  entry?.OverallFastest ? 'fastest' : entry?.PersonalFastest ? 'pb' : '';

export function snapshotFromF1State(state: Record<string, any>, now: number = Date.now()): TimingSnapshot | null {
  const info = state?.SessionInfo;
  if (!info) return null;

  const isRace = info.Type === 'Race' || /Sprint$/i.test(String(info.Name ?? ''));
  const rawStatus = String(state?.SessionStatus?.Status || info.SessionStatus || '');
  const isLive = rawStatus === 'Started';
  const isFinished = /Finished|Finalised|Ends/i.test(rawStatus);
  const sessionName = String(info.Name ?? 'Session');
  const meetingName = String(info.Meeting?.Name ?? 'Formula 1');

  const statusText = isLive
    ? `Live · ${sessionName}`
    : isFinished
      ? `Final classification · ${sessionName}`
      : `${sessionName} · waiting for start`;

  const subtitleParts = [
    ...new Set([info.Meeting?.Circuit?.ShortName, info.Meeting?.Location].filter(Boolean).map(String)),
  ];
  const startMs = info.StartDate
    ? Date.parse(`${info.StartDate}Z`) - parseGmtOffsetMs(info.GmtOffset)
    : null;

  const trackEntry = TRACK_STATUS_MAP[String(state?.TrackStatus?.Status ?? '')];
  const track = isLive && trackEntry
    ? trackEntry
    : isFinished
      ? { label: 'Chequered flag', cls: 'flag-idle' as TrackFlagClass }
      : { label: 'Track status', cls: 'flag-idle' as TrackFlagClass };

  const lapCount = state?.LapCount;
  const remMs = extrapolatedRemainingMs(state, now);
  const clock: TimingSnapshot['clock'] = lapCount?.TotalLaps
    ? { label: 'Lap', value: `${lapCount.CurrentLap ?? 0}/${lapCount.TotalLaps}` }
    : { label: 'Remaining', value: remMs !== null ? formatRemainingMs(remMs) : '--:--' };

  const wd = state?.WeatherData;
  const weather = wd && wd.AirTemp !== undefined
    ? {
        air: String(wd.AirTemp),
        track: String(wd.TrackTemp ?? '—'),
        humidity: String(wd.Humidity ?? '—'),
        wind: String(wd.WindSpeed ?? '—'),
        rain: String(wd.Rainfall) === '1' || Number(wd.Rainfall) > 0,
      }
    : null;

  const linesObj = state?.TimingData?.Lines ?? {};
  const driversObj = state?.DriverList ?? {};
  const appLines = state?.TimingAppData?.Lines ?? {};
  const partIdx = Math.max(0, (Number(state?.TimingData?.SessionPart) || 1) - 1);

  const entries = Object.entries(linesObj)
    .map(([num, line]: [string, any]) => ({ num, line }))
    .filter((item) => item.line && item.line.Position)
    .sort((a, b) => Number(a.line.Position) - Number(b.line.Position));

  const overallBestMs = Math.min(
    ...entries.map(({ line }) =>
      parseLapTimeMs(line.BestLapTime?.Value || line.BestLapTimes?.[partIdx]?.Value)),
  );

  const rows: TimingRow[] = entries.map(({ num, line }) => {
    const drv = driversObj[num] ?? {};
    const first = String(drv.FirstName ?? '').trim();
    const last = String(drv.LastName ?? '').trim();
    const full = String(drv.FullName || `${first} ${last}`.trim() || `Car ${num}`);
    const isOut = Boolean(line.Retired || line.Stopped || line.KnockedOut);
    const pitFlag = line.InPit ? 'PIT' : line.PitOut ? 'OUT' : isOut ? (line.KnockedOut ? 'KO' : 'OUT') : '';

    const stints = valuesList<any>(appLines[num]?.Stints);
    const lastStint = stints[stints.length - 1];
    const tyre = lastStint
      ? { code: tyreCode(lastStint.Compound), age: String(lastStint.TotalLaps ?? '') }
      : null;

    const sectors = valuesList<any>(line.Sectors);
    const sectorCell = (idx: number): TimingCell => {
      const s = sectors[idx] ?? {};
      return { text: String(s.Value || s.PreviousValue || ''), tone: f1Tone(s) };
    };

    const bestVal = String(line.BestLapTime?.Value || line.BestLapTimes?.[partIdx]?.Value || '');
    const bestTone: CellTone = bestVal && parseLapTimeMs(bestVal) === overallBestMs ? 'fastest' : '';
    const lastLap = line.LastLapTime ?? {};
    const lastCell: TimingCell = { text: String(lastLap.Value || ''), tone: f1Tone(lastLap) };

    let c0: TimingCell;
    let c1: TimingCell;
    let c2: TimingCell;
    let c3: TimingCell;

    if (isRace) {
      const leaderGap = String(line.Position) === '1'
        ? `LAP ${lapCount?.CurrentLap ?? line.NumberOfLaps ?? ''}`.trim()
        : String(line.GapToLeader ?? '');
      c0 = { text: pitFlag || leaderGap };
      c1 = { text: String(line.Position) === '1' ? '' : String(line.IntervalToPositionAhead?.Value ?? '') };
      c2 = lastCell;
      c3 = { text: bestVal, tone: bestTone };
    } else {
      const stats = Array.isArray(line.Stats) ? (line.Stats[partIdx] ?? {}) : (line.Stats?.[partIdx] ?? {});
      c0 = { text: bestVal, tone: bestTone };
      c1 = {
        text: pitFlag || (String(line.Position) === '1'
          ? ''
          : String(line.TimeDiffToFastest || stats.TimeDiffToFastest || '')),
      };
      c2 = {
        text: String(line.Position) === '1'
          ? ''
          : String(line.TimeDiffToPositionAhead || line.TimeDifftoPositionAhead || stats.TimeDiffToPositionAhead || ''),
      };
      c3 = lastCell;
    }

    return {
      num,
      pos: String(line.Position),
      tla: String(drv.Tla || num),
      lastName: last,
      fullName: full,
      driverHref: first && last ? `/drivers/${slugify(`${first} ${last}`)}/` : '/drivers.html',
      teamColor: normalizeHex(drv.TeamColour, drv.TeamName),
      isOut,
      cells: [c0, c1, c2, c3, sectorCell(0), sectorCell(1), sectorCell(2)],
      tyre,
      tail: String(isRace ? (line.NumberOfPitStops ?? '') : (line.NumberOfLaps ?? '')),
    };
  });

  const allRc = valuesList<any>(state?.RaceControlMessages?.Messages);
  const raceControl: RaceControlItem[] = allRc.slice(-40).reverse().map((msg) => ({
    time: fmtTime(msg.Utc),
    lap: msg.Lap ? `Lap ${msg.Lap}` : '',
    dotCls: rcDotClass(msg.Flag, msg.Category, msg.Message),
    message: String(msg.Message ?? ''),
  }));

  const allRadio = valuesList<any>(state?.TeamRadio?.Captures);
  const sessionPath = info.Path ? String(info.Path) : '';
  const radio: RadioClipItem[] = sessionPath
    ? allRadio.slice(-12).reverse().map((clip) => {
        const drv = driversObj[clip.RacingNumber] ?? {};
        const first = String(drv.FirstName ?? '').trim();
        const last = String(drv.LastName ?? '').trim();
        return {
          num: String(clip.RacingNumber ?? ''),
          tla: String(drv.Tla || clip.RacingNumber || ''),
          lastName: last,
          fullName: String(drv.FullName || `${first} ${last}`.trim() || `Car ${clip.RacingNumber}`),
          teamColor: normalizeHex(drv.TeamColour, drv.TeamName),
          headshotUrl: String(drv.HeadshotUrl ?? ''),
          time: fmtTime(clip.Utc),
          url: `${F1_STATIC_BASE}${sessionPath}${clip.Path}`,
        };
      })
    : [];

  return {
    source: 'f1live',
    isLive,
    isRace,
    statusText,
    meetingName,
    sessionName,
    subtitleParts,
    startMs: Number.isFinite(startMs) ? startMs : null,
    track,
    clock,
    weather,
    rows,
    raceControlTotal: allRc.length,
    raceControl,
    radio,
  };
}

/* ═══════════════ OPENF1 ADAPTER ═══════════════ */

export type OpenF1Session = {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  circuit_short_name?: string;
  country_name?: string;
  location?: string;
};

export type OpenF1Bundle = {
  session: OpenF1Session;
  drivers: any[];
  results: any[];
  laps: any[];
  stints: any[];
  intervals?: any[];
  positions?: any[];
  weather: any[];
  raceControl: any[];
  radio: any[];
};

function pickQualiBest(duration: unknown): number | null {
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) return duration;
  if (Array.isArray(duration)) {
    const valid = duration.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
    if (valid.length > 0) return valid[valid.length - 1];
  }
  return null;
}

function formatGapVal(gap: unknown): string {
  if (gap === null || gap === undefined || gap === 0 || gap === '0') return '';
  if (Array.isArray(gap)) {
    for (let i = gap.length - 1; i >= 0; i--) {
      if (gap[i] !== null && gap[i] !== undefined) return formatGapVal(gap[i]);
    }
    return '';
  }
  if (typeof gap === 'number') {
    return gap > 0 ? `+${gap.toFixed(3)}` : '';
  }
  const str = String(gap).trim();
  if (!str || str === '0' || str === '0.0') return '';
  return str.startsWith('+') ? str : `+${str}`;
}

export function snapshotFromOpenF1(bundle: OpenF1Bundle, now: number = Date.now()): TimingSnapshot {
  const { session } = bundle;
  const isRace = session.session_type === 'Race' || /^Sprint$/i.test(session.session_name);
  const startMs = Date.parse(session.date_start);
  const endMs = Date.parse(session.date_end);
  const hasChequered = bundle.raceControl.some((m) =>
    /CHEQUERED/i.test(`${m.flag ?? ''} ${m.message ?? ''}`));
  const isLive = !hasChequered
    && bundle.results.length === 0
    && Number.isFinite(startMs)
    && now >= startMs - 5 * 60_000
    && (!Number.isFinite(endMs) || now <= endMs + 45 * 60_000);

  const meetingName = session.country_name === 'Brazil'
    ? 'São Paulo Grand Prix'
    : session.country_name
      ? `${session.country_name} Grand Prix`
      : session.location || 'Formula 1';

  const statusText = isLive
    ? `Live · ${session.session_name}`
    : `Final classification · ${session.session_name}`;

  const driverMap = new Map<number, any>();
  for (const d of bundle.drivers) {
    if (typeof d.driver_number === 'number') driverMap.set(d.driver_number, d);
  }

  /* Group laps & stints per driver and compute overall + personal fastest marks. */
  type LapSummary = {
    lapsCount: number;
    bestLap: number | null;
    bestLapObj: any | null;
    lastLap: number | null;
    lastLapObj: any | null;
    pbS1: number;
    pbS2: number;
    pbS3: number;
  };
  const lapByDriver = new Map<number, LapSummary>();
  let overallBestLap = Infinity;
  let overallS1 = Infinity;
  let overallS2 = Infinity;
  let overallS3 = Infinity;

  for (const lap of bundle.laps) {
    const num = Number(lap.driver_number);
    if (!Number.isFinite(num)) continue;
    let rec = lapByDriver.get(num);
    if (!rec) {
      rec = {
        lapsCount: 0, bestLap: null, bestLapObj: null,
        lastLap: null, lastLapObj: null,
        pbS1: Infinity, pbS2: Infinity, pbS3: Infinity,
      };
      lapByDriver.set(num, rec);
    }
    const lapNo = Number(lap.lap_number) || 0;
    if (lapNo > rec.lapsCount) rec.lapsCount = lapNo;

    const s1 = typeof lap.duration_sector_1 === 'number' && lap.duration_sector_1 > 0 ? lap.duration_sector_1 : Infinity;
    const s2 = typeof lap.duration_sector_2 === 'number' && lap.duration_sector_2 > 0 ? lap.duration_sector_2 : Infinity;
    const s3 = typeof lap.duration_sector_3 === 'number' && lap.duration_sector_3 > 0 ? lap.duration_sector_3 : Infinity;
    if (s1 < rec.pbS1) rec.pbS1 = s1;
    if (s2 < rec.pbS2) rec.pbS2 = s2;
    if (s3 < rec.pbS3) rec.pbS3 = s3;
    if (s1 < overallS1) overallS1 = s1;
    if (s2 < overallS2) overallS2 = s2;
    if (s3 < overallS3) overallS3 = s3;

    const dur = typeof lap.lap_duration === 'number' && lap.lap_duration > 0 ? lap.lap_duration : null;
    if (dur !== null) {
      rec.lastLap = dur;
      rec.lastLapObj = lap;
      if (rec.bestLap === null || dur < rec.bestLap) {
        rec.bestLap = dur;
        rec.bestLapObj = lap;
      }
      if (dur < overallBestLap) overallBestLap = dur;
    }
  }

  const stintsByDriver = new Map<number, any[]>();
  for (const st of bundle.stints) {
    const num = Number(st.driver_number);
    if (!Number.isFinite(num)) continue;
    const list = stintsByDriver.get(num) ?? [];
    list.push(st);
    stintsByDriver.set(num, list);
  }
  for (const list of stintsByDriver.values()) {
    list.sort((a, b) => (Number(a.stint_number) || 0) - (Number(b.stint_number) || 0));
  }

  /* Order drivers: use session_result if available, else latest position feed, else best lap. */
  type OrderedEntry = {
    driverNum: number;
    posLabel: string;
    isOut: boolean;
    outBadge: string;
    lapsCompleted: number;
    resultDuration: unknown;
    resultGap: unknown;
    intervalText: string;
  };

  const ordered: OrderedEntry[] = [];
  if (bundle.results.length > 0) {
    const sorted = [...bundle.results].sort((a, b) => {
      const pa = typeof a.position === 'number' ? a.position : 999;
      const pb = typeof b.position === 'number' ? b.position : 999;
      if (pa !== pb) return pa - pb;
      return (Number(b.number_of_laps) || 0) - (Number(a.number_of_laps) || 0);
    });
    for (let idx = 0; idx < sorted.length; idx++) {
      const r = sorted[idx];
      const outBadge = r.dsq ? 'DSQ' : r.dns ? 'DNS' : r.dnf ? 'DNF' : '';
      const isQualiKo = !isRace && session.session_type === 'Qualifying'
        && Array.isArray(r.duration) && r.duration[2] == null && (r.position ?? 99) > 10;
      const bestDur = pickQualiBest(r.duration);
      if (!isRace && bestDur !== null && bestDur < overallBestLap) overallBestLap = bestDur;

      let intervalText = '';
      if (idx > 0 && !outBadge) {
        const prev = sorted[idx - 1];
        if (isRace) {
          if (typeof r.gap_to_leader === 'number' && typeof prev.gap_to_leader === 'number') {
            const diff = r.gap_to_leader - prev.gap_to_leader;
            if (diff >= 0) intervalText = `+${diff.toFixed(3)}`;
          }
        } else {
          const prevBest = pickQualiBest(prev.duration) ?? lapByDriver.get(Number(prev.driver_number))?.bestLap ?? null;
          const myBest = bestDur ?? lapByDriver.get(Number(r.driver_number))?.bestLap ?? null;
          if (myBest !== null && prevBest !== null && myBest >= prevBest) {
            intervalText = `+${(myBest - prevBest).toFixed(3)}`;
          }
        }
      }

      ordered.push({
        driverNum: Number(r.driver_number),
        posLabel: r.position != null ? String(r.position) : (outBadge || 'NC'),
        isOut: Boolean(outBadge || isQualiKo),
        outBadge,
        lapsCompleted: Number(r.number_of_laps) || lapByDriver.get(Number(r.driver_number))?.lapsCount || 0,
        resultDuration: r.duration,
        resultGap: r.gap_to_leader,
        intervalText,
      });
    }
  } else {
    const latestPos = new Map<number, number>();
    for (const p of bundle.positions ?? []) {
      if (typeof p.driver_number === 'number' && typeof p.position === 'number') {
        latestPos.set(p.driver_number, p.position);
      }
    }
    const latestInt = new Map<number, any>();
    for (const iv of bundle.intervals ?? []) {
      if (typeof iv.driver_number === 'number') latestInt.set(iv.driver_number, iv);
    }
    const nums = [...driverMap.keys()].sort((a, b) => {
      const pa = latestPos.get(a) ?? 999;
      const pb = latestPos.get(b) ?? 999;
      if (pa !== pb) return pa - pb;
      const la = lapByDriver.get(a)?.bestLap ?? Infinity;
      const lb = lapByDriver.get(b)?.bestLap ?? Infinity;
      return la - lb;
    });
    const leaderBest = lapByDriver.get(nums[0])?.bestLap ?? null;
    nums.forEach((num, idx) => {
      const lapRec = lapByDriver.get(num);
      const iv = latestInt.get(num);
      const myBest = lapRec?.bestLap ?? null;
      const prevBest = idx > 0 ? (lapByDriver.get(nums[idx - 1])?.bestLap ?? null) : null;
      ordered.push({
        driverNum: num,
        posLabel: String(latestPos.get(num) ?? idx + 1),
        isOut: false,
        outBadge: '',
        lapsCompleted: lapRec?.lapsCount ?? 0,
        resultDuration: myBest,
        resultGap: iv?.gap_to_leader ?? (!isRace && idx > 0 && myBest && leaderBest ? myBest - leaderBest : null),
        intervalText: iv?.interval != null
          ? formatGapVal(iv.interval)
          : (!isRace && idx > 0 && myBest && prevBest && myBest >= prevBest ? `+${(myBest - prevBest).toFixed(3)}` : ''),
      });
    });
  }

  const maxLaps = ordered.reduce((m, r) => Math.max(m, r.lapsCompleted), 0);

  const rows: TimingRow[] = ordered.map((entry, idx) => {
    const drv = driverMap.get(entry.driverNum) ?? {};
    const first = String(drv.first_name ?? '').trim();
    const last = String(drv.last_name ?? '').trim();
    const full = String(drv.full_name || `${first} ${last}`.trim() || `Car ${entry.driverNum}`);
    const lapRec = lapByDriver.get(entry.driverNum);
    const stints = stintsByDriver.get(entry.driverNum) ?? [];
    const lastStint = stints[stints.length - 1];
    const stintLaps = lastStint
      ? Math.max(0, (Number(lastStint.tyre_age_at_start) || 0) + ((Number(lastStint.lap_end) || entry.lapsCompleted) - (Number(lastStint.lap_start) || 1) + 1))
      : 0;
    const tyre = lastStint
      ? { code: tyreCode(lastStint.compound), age: stintLaps > 0 ? String(stintLaps) : '' }
      : null;

    const bestSec = !isRace
      ? (pickQualiBest(entry.resultDuration) ?? lapRec?.bestLap ?? null)
      : (lapRec?.bestLap ?? null);
    const bestText = formatLapSeconds(bestSec);
    const bestTone: CellTone = bestSec !== null && Math.abs(bestSec - overallBestLap) < 0.0005 ? 'fastest' : '';

    const lastSec = lapRec?.lastLap ?? null;
    const lastTone: CellTone = lastSec !== null && Math.abs(lastSec - overallBestLap) < 0.0005
      ? 'fastest'
      : (lastSec !== null && lapRec?.bestLap !== null && Math.abs(lastSec - lapRec.bestLap) < 0.0005 ? 'pb' : '');
    const lastCell: TimingCell = { text: formatLapSeconds(lastSec), tone: lastTone };

    /* Sector display: latest lap during a live session; driver's fastest lap once finished. */
    const refLap = (isLive ? lapRec?.lastLapObj : lapRec?.bestLapObj) ?? lapRec?.lastLapObj;
    const secCell = (val: unknown, overallMin: number, pbMin: number): TimingCell => {
      if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return { text: '' };
      const tone: CellTone = Math.abs(val - overallMin) < 0.0005
        ? 'fastest'
        : Math.abs(val - pbMin) < 0.0005
          ? 'pb'
          : '';
      return { text: formatSectorSeconds(val), tone };
    };
    const s1Cell = secCell(refLap?.duration_sector_1, overallS1, lapRec?.pbS1 ?? Infinity);
    const s2Cell = secCell(refLap?.duration_sector_2, overallS2, lapRec?.pbS2 ?? Infinity);
    const s3Cell = secCell(refLap?.duration_sector_3, overallS3, lapRec?.pbS3 ?? Infinity);

    let c0: TimingCell;
    let c1: TimingCell;
    let c2: TimingCell;
    let c3: TimingCell;

    if (isRace) {
      const gapTxt = entry.outBadge
        ? entry.outBadge
        : idx === 0
          ? (maxLaps > 0 ? `LAP ${maxLaps}` : 'LEADER')
          : formatGapVal(entry.resultGap);
      c0 = { text: gapTxt };
      c1 = { text: idx === 0 || entry.outBadge ? '' : entry.intervalText };
      c2 = lastCell;
      c3 = { text: bestText, tone: bestTone };
    } else {
      const leaderBest = ordered[0]
        ? (pickQualiBest(ordered[0].resultDuration) ?? lapByDriver.get(ordered[0].driverNum)?.bestLap ?? null)
        : null;
      const computedGap = bestSec !== null && leaderBest !== null && idx > 0
        ? `+${(bestSec - leaderBest).toFixed(3)}`
        : '';
      const gapTxt = entry.outBadge
        ? entry.outBadge
        : idx === 0
          ? ''
          : (formatGapVal(entry.resultGap) || computedGap);
      c0 = { text: bestText, tone: bestTone };
      c1 = { text: gapTxt };
      c2 = { text: idx === 0 || entry.outBadge ? '' : entry.intervalText };
      c3 = lastCell;
    }

    const pitStops = Math.max(0, stints.length - 1);
    return {
      num: String(entry.driverNum),
      pos: entry.posLabel,
      tla: String(drv.name_acronym || entry.driverNum),
      lastName: last,
      fullName: full,
      driverHref: first && last ? `/drivers/${slugify(`${first} ${last}`)}/` : '/drivers.html',
      teamColor: normalizeHex(drv.team_colour, drv.team_name),
      isOut: entry.isOut,
      cells: [c0, c1, c2, c3, s1Cell, s2Cell, s3Cell],
      tyre,
      tail: isRace ? String(stints.length > 0 ? pitStops : '') : String(entry.lapsCompleted || ''),
    };
  });

  /* Track status from latest race control flag when live; Chequered when finished. */
  let track: TimingSnapshot['track'] = isLive
    ? { label: 'Track clear', cls: 'flag-green' }
    : { label: 'Chequered flag', cls: 'flag-idle' };
  if (isLive && bundle.raceControl.length > 0) {
    const lastFlag = [...bundle.raceControl].reverse().find((m) => m.flag || /SAFETY CAR|RED FLAG/i.test(m.message ?? ''));
    if (lastFlag) {
      const f = `${lastFlag.flag ?? ''} ${lastFlag.message ?? ''}`.toUpperCase();
      if (/RED/.test(f)) track = { label: 'Red flag', cls: 'flag-red' };
      else if (/VIRTUAL SAFETY/.test(f)) track = { label: 'Virtual safety car', cls: 'flag-sc' };
      else if (/SAFETY CAR/.test(f)) track = { label: 'Safety car', cls: 'flag-sc' };
      else if (/YELLOW/.test(f)) track = { label: 'Yellow flag', cls: 'flag-yellow' };
    }
  }

  const clock: TimingSnapshot['clock'] = isRace && maxLaps > 0
    ? { label: 'Lap', value: `${maxLaps}/${maxLaps}` }
    : {
        label: 'Remaining',
        value: isLive && Number.isFinite(endMs) ? formatRemainingMs(Math.max(0, endMs - now)) : '00:00',
      };

  const lastW = bundle.weather[bundle.weather.length - 1];
  const weather = lastW
    ? {
        air: Number(lastW.air_temperature).toFixed(1),
        track: Number(lastW.track_temperature).toFixed(1),
        humidity: String(Math.round(Number(lastW.humidity) || 0)),
        wind: Number(lastW.wind_speed || 0).toFixed(1),
        rain: Number(lastW.rainfall) > 0,
      }
    : null;

  const raceControl: RaceControlItem[] = bundle.raceControl.slice(-40).reverse().map((m) => ({
    time: fmtTime(m.date),
    lap: m.lap_number ? `Lap ${m.lap_number}` : '',
    dotCls: rcDotClass(m.flag, m.category, m.message),
    message: String(m.message ?? ''),
  }));

  const radio: RadioClipItem[] = bundle.radio.slice(-12).reverse().map((clip) => {
    const drv = driverMap.get(Number(clip.driver_number)) ?? {};
    const first = String(drv.first_name ?? '').trim();
    const last = String(drv.last_name ?? '').trim();
    return {
      num: String(clip.driver_number ?? ''),
      tla: String(drv.name_acronym || clip.driver_number || ''),
      lastName: last,
      fullName: String(drv.full_name || `${first} ${last}`.trim() || `Car ${clip.driver_number}`),
      teamColor: normalizeHex(drv.team_colour, drv.team_name),
      headshotUrl: String(drv.headshot_url ?? ''),
      time: fmtTime(clip.date),
      url: String(clip.recording_url ?? ''),
    };
  }).filter((clip) => Boolean(clip.url));

  const subtitleParts = [
    ...new Set([session.circuit_short_name, session.location].filter(Boolean).map(String)),
  ];

  return {
    source: 'openf1',
    sessionKey: session.session_key,
    meetingKey: session.meeting_key,
    isLive,
    isRace,
    statusText,
    meetingName,
    sessionName: session.session_name,
    subtitleParts,
    startMs: Number.isFinite(startMs) ? startMs : null,
    track,
    clock,
    weather,
    rows,
    raceControlTotal: bundle.raceControl.length,
    raceControl,
    radio,
  };
}

/* ═══════════════ OFFICIAL F1 SIGNALR CORE CLIENT ═══════════════ */

export class F1SignalRClient extends EventTarget {
  state: Record<string, any> = {};
  status: 'idle' | 'connecting' | 'open' | 'closed' | 'error' = 'idle';
  private ws: WebSocket | null = null;
  private retry = 0;
  private invocation = 0;
  private handshaken = false;
  private lastMessage = 0;
  private wanted = false;
  private paused = false;
  private pinger: number | undefined;
  private reconnectTimer: number | undefined;
  private pauseTimer: number | undefined;

  private onVisibility = () => {
    if (!this.wanted) return;
    if (document.hidden) {
      this.pauseTimer = window.setTimeout(() => this.close(true), 60_000);
    } else {
      clearTimeout(this.pauseTimer);
      this.paused = false;
      if (!this.ws) this.open();
    }
  };

  start(): this {
    this.wanted = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (!this.ws) this.open();
    return this;
  }

  open(): void {
    if (this.ws || typeof WebSocket === 'undefined') return;
    this.paused = false;
    this.setStatus('connecting');
    let socket: WebSocket;
    try {
      socket = new WebSocket(F1_SIGNALR_URL);
    } catch {
      this.setStatus('error');
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;
    this.handshaken = false;
    this.lastMessage = Date.now();
    socket.onopen = () => {
      if (socket !== this.ws) return;
      socket.send(JSON.stringify({ protocol: 'json', version: 1 }) + RECORD_SEP);
    };
    socket.onmessage = (ev) => {
      if (socket === this.ws) this.onData(String(ev.data ?? ''));
    };
    socket.onerror = () => {
      if (socket === this.ws) this.setStatus('error');
    };
    socket.onclose = () => {
      if (socket !== this.ws) return;
      clearInterval(this.pinger);
      this.ws = null;
      if (this.status !== 'error') this.setStatus('closed');
      if (this.wanted && !this.paused) this.scheduleReconnect();
    };
  }

  close(pauseOnly = false): void {
    this.paused = pauseOnly;
    clearInterval(this.pinger);
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    if (!pauseOnly) this.wanted = false;
  }

  private scheduleReconnect(): void {
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(30_000, 1000 * 2 ** this.retry++) + Math.random() * 500;
    this.reconnectTimer = window.setTimeout(() => {
      this.paused = false;
      if (this.wanted && !document.hidden) this.open();
    }, delay);
  }

  private send(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload) + RECORD_SEP);
    }
  }

  private setStatus(next: typeof this.status): void {
    if (this.status === next) return;
    this.status = next;
    this.dispatchEvent(new CustomEvent('status', { detail: next }));
  }

  private onData(raw: string): void {
    this.lastMessage = Date.now();
    for (const frame of raw.split(RECORD_SEP)) {
      if (!frame) continue;
      let msg: any;
      try { msg = JSON.parse(frame); } catch { continue; }
      if (!this.handshaken) {
        this.handshaken = true;
        if (msg.error) { this.setStatus('error'); continue; }
        this.retry = 0;
        this.setStatus('open');
        this.send({
          type: 1,
          invocationId: String(++this.invocation),
          target: 'Subscribe',
          arguments: [[...F1_TOPICS]],
        });
        clearInterval(this.pinger);
        this.pinger = window.setInterval(() => {
          if (Date.now() - this.lastMessage > 45_000) {
            this.ws?.close();
            return;
          }
          this.send({ type: 6 });
        }, 15_000);
        continue;
      }
      if (msg.type === 3 && msg.result && typeof msg.result === 'object') {
        for (const [topic, val] of Object.entries(msg.result)) {
          this.state[topic] = mergeF1Delta(undefined, val);
        }
        this.dispatchEvent(new CustomEvent('update'));
      } else if (msg.type === 1 && Array.isArray(msg.arguments)) {
        const [topic, patch] = msg.arguments;
        if (typeof topic === 'string' && patch && typeof patch === 'object') {
          this.state[topic] = mergeF1Delta(this.state[topic], patch);
          this.dispatchEvent(new CustomEvent('update'));
        }
      } else if (msg.type === 7) {
        this.ws?.close();
      }
    }
  }
}
