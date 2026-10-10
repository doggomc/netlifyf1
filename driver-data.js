/* Canonical 2026 driver/team identities used when Jolpica has not published
   standings yet, or when a profile is missing optional fields. Live standings
   still win: this file is a roster fallback, never a source of championship
   positions or points. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FreeF1DriverData = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const ROSTER = Object.freeze([
    { id: 'russell', givenName: 'George', familyName: 'Russell', code: 'RUS', teamId: 'mercedes', teamName: 'Mercedes' },
    { id: 'antonelli', givenName: 'Andrea Kimi', familyName: 'Antonelli', code: 'ANT', teamId: 'mercedes', teamName: 'Mercedes' },
    { id: 'leclerc', givenName: 'Charles', familyName: 'Leclerc', code: 'LEC', teamId: 'ferrari', teamName: 'Ferrari' },
    { id: 'hamilton', givenName: 'Lewis', familyName: 'Hamilton', code: 'HAM', teamId: 'ferrari', teamName: 'Ferrari' },
    { id: 'norris', givenName: 'Lando', familyName: 'Norris', code: 'NOR', teamId: 'mclaren', teamName: 'McLaren' },
    { id: 'piastri', givenName: 'Oscar', familyName: 'Piastri', code: 'PIA', teamId: 'mclaren', teamName: 'McLaren' },
    { id: 'max_verstappen', givenName: 'Max', familyName: 'Verstappen', code: 'VER', teamId: 'redbull', teamName: 'Red Bull' },
    { id: 'hadjar', givenName: 'Isack', familyName: 'Hadjar', code: 'HAD', teamId: 'redbull', teamName: 'Red Bull' },
    { id: 'lawson', givenName: 'Liam', familyName: 'Lawson', code: 'LAW', teamId: 'racingbulls', teamName: 'Racing Bulls' },
    { id: 'arvid_lindblad', givenName: 'Arvid', familyName: 'Lindblad', code: 'LIN', teamId: 'racingbulls', teamName: 'Racing Bulls' },
    { id: 'gasly', givenName: 'Pierre', familyName: 'Gasly', code: 'GAS', teamId: 'alpine', teamName: 'Alpine' },
    { id: 'colapinto', givenName: 'Franco', familyName: 'Colapinto', code: 'COL', teamId: 'alpine', teamName: 'Alpine' },
    { id: 'ocon', givenName: 'Esteban', familyName: 'Ocon', code: 'OCO', teamId: 'haas', teamName: 'Haas' },
    { id: 'bearman', givenName: 'Oliver', familyName: 'Bearman', code: 'BEA', teamId: 'haas', teamName: 'Haas' },
    { id: 'hulkenberg', givenName: 'Nico', familyName: 'Hülkenberg', code: 'HUL', teamId: 'audi', teamName: 'Audi' },
    { id: 'bortoleto', givenName: 'Gabriel', familyName: 'Bortoleto', code: 'BOR', teamId: 'audi', teamName: 'Audi' },
    { id: 'sainz', givenName: 'Carlos', familyName: 'Sainz', code: 'SAI', teamId: 'williams', teamName: 'Williams' },
    { id: 'albon', givenName: 'Alexander', familyName: 'Albon', code: 'ALB', teamId: 'williams', teamName: 'Williams' },
    { id: 'alonso', givenName: 'Fernando', familyName: 'Alonso', code: 'ALO', teamId: 'astonmartin', teamName: 'Aston Martin' },
    { id: 'stroll', givenName: 'Lance', familyName: 'Stroll', code: 'STR', teamId: 'astonmartin', teamName: 'Aston Martin' },
    { id: 'perez', givenName: 'Sergio', familyName: 'Pérez', code: 'PER', teamId: 'cadillac', teamName: 'Cadillac' },
    { id: 'bottas', givenName: 'Valtteri', familyName: 'Bottas', code: 'BOT', teamId: 'cadillac', teamName: 'Cadillac' }
  ].map((driver) => Object.freeze(driver)));

  const DRIVER_ALIASES = Object.freeze({
    verstappen: 'max_verstappen',
    maxverstappen: 'max_verstappen',
    arvidlindblad: 'arvid_lindblad',
    kimi_antonelli: 'antonelli',
    andrea_kimi_antonelli: 'antonelli',
    charles_leclerc: 'leclerc',
    lewis_hamilton: 'hamilton',
    lando_norris: 'norris',
    oscar_piastri: 'piastri',
    isack_hadjar: 'hadjar',
    liam_lawson: 'lawson',
    pierre_gasly: 'gasly',
    franco_colapinto: 'colapinto',
    esteban_ocon: 'ocon',
    oliver_bearman: 'bearman',
    nico_hulkenberg: 'hulkenberg',
    hulkemberg: 'hulkenberg',
    gabriel_bortoleto: 'bortoleto',
    carlos_sainz: 'sainz',
    alexander_albon: 'albon',
    fernando_alonso: 'alonso',
    lance_stroll: 'stroll',
    sergio_perez: 'perez',
    valtteri_bottas: 'bottas'
  });

  const TEAM_ALIASES = Object.freeze({
    mercedes: 'mercedes',
    ferrari: 'ferrari',
    mclaren: 'mclaren',
    williams: 'williams',
    'red bull': 'redbull',
    redbull: 'redbull',
    'red bull racing': 'redbull',
    'aston martin': 'astonmartin',
    astonmartin: 'astonmartin',
    'alpine f1 team': 'alpine',
    alpine: 'alpine',
    'haas f1 team': 'haas',
    haas: 'haas',
    audi: 'audi',
    sauber: 'audi',
    'cadillac f1 team': 'cadillac',
    cadillac: 'cadillac',
    rb: 'racingbulls',
    'rb f1 team': 'racingbulls',
    'racing bulls': 'racingbulls',
    'racing bulls f1 team': 'racingbulls'
  });
  const TEAM_ALIAS_MATCHES = Object.entries(TEAM_ALIASES)
    .filter(([name]) => name.length >= 4)
    .sort(([a], [b]) => b.length - a.length);

  const byId = new Map(ROSTER.map((driver) => [driver.id, driver]));

  function cleanId(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  function canonicalDriverId(value) {
    const id = cleanId(value);
    return DRIVER_ALIASES[id] || id;
  }

  function findDriver(value) {
    return byId.get(canonicalDriverId(value)) || null;
  }

  function teamToken(value) {
    return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  }

  function teamIdFor(value) {
    const token = teamToken(value);
    if (TEAM_ALIASES[token]) return TEAM_ALIASES[token];
    const compact = token.replace(/\s/g, '');
    if (TEAM_ALIASES[compact]) return TEAM_ALIASES[compact];
    for (const [alias, id] of TEAM_ALIAS_MATCHES) {
      if (token.includes(alias)) return id;
    }
    for (const driver of ROSTER) {
      if (token === driver.teamId || token === teamToken(driver.teamName)) return driver.teamId;
    }
    return '';
  }

  function normalizeName(value) {
    return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  }

  function findDriverByName(value) {
    const name = normalizeName(value);
    if (!name) return null;
    const alias = Object.entries(DRIVER_ALIASES).find(([key]) => normalizeName(key) === name)?.[1];
    if (alias && byId.has(canonicalDriverId(alias))) return byId.get(canonicalDriverId(alias));
    const words = String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    const surname = words.at(-1) || '';
    const first = words[0] || '';
    return ROSTER.find((driver) => {
      const full = normalizeName(`${driver.givenName} ${driver.familyName}`);
      const family = normalizeName(driver.familyName);
      const given = normalizeName(driver.givenName);
      const givenWords = driver.givenName.split(/\s+/).map(normalizeName);
      const exact = name === full || name === normalizeName(driver.code) || name === family;
      const initialAndSurname = surname === family && first.length === 1 && givenWords.some((part) => part.startsWith(first));
      const abbreviatedName = surname === family && words.length >= 2 && first.length > 1 && given.startsWith(first);
      return exact || initialAndSurname || abbreviatedName;
    }) || null;
  }

  function photoKey(value) {
    const id = canonicalDriverId(value);
    if (id === 'max_verstappen') return 'verstappen';
    if (id === 'arvid_lindblad') return 'lindblad';
    return id;
  }

  function nonEmptyFields(base, values) {
    const out = { ...base };
    for (const [key, value] of Object.entries(values || {})) {
      if (value !== undefined && value !== null && value !== '') out[key] = value;
    }
    return out;
  }

  function enrichStandings(list) {
    const rows = Array.isArray(list) ? list : [];
    const actualById = new Map();
    const unknownRows = [];

    for (const row of rows) {
      const id = canonicalDriverId(row?.Driver?.driverId);
      if (!id) continue;
      if (byId.has(id)) {
        if (!actualById.has(id)) actualById.set(id, row);
      } else {
        unknownRows.push(row);
      }
    }

    const merged = ROSTER.map((rosterDriver, rosterIndex) => {
      const actual = actualById.get(rosterDriver.id);
      const driver = nonEmptyFields({
        driverId: rosterDriver.id,
        givenName: rosterDriver.givenName,
        familyName: rosterDriver.familyName,
        code: rosterDriver.code
      }, actual?.Driver);
      driver.driverId = rosterDriver.id;
      const defaultConstructor = { constructorId: rosterDriver.teamId, name: rosterDriver.teamName };
      const remoteConstructor = actual?.Constructors?.find((item) => item && (item.name || item.constructorId));
      const constructor = remoteConstructor
        ? nonEmptyFields(defaultConstructor, remoteConstructor)
        : defaultConstructor;
      return {
        ...(actual || {}),
        Driver: driver,
        Constructors: [constructor],
        position: actual?.position ?? '',
        points: actual?.points ?? '0',
        wins: actual?.wins ?? '0',
        _hasStandings: Boolean(actual),
        _rosterIndex: rosterIndex
      };
    });

    for (const row of unknownRows) {
      const id = canonicalDriverId(row?.Driver?.driverId);
      const driver = nonEmptyFields({ driverId: id }, row.Driver);
      driver.driverId = id;
      merged.push({ ...row, Driver: driver, Constructors: row.Constructors || [], _hasStandings: true, _rosterIndex: ROSTER.length });
    }

    const positionOf = (row) => {
      const position = Number.parseInt(row.position, 10);
      return Number.isFinite(position) && position > 0 ? position : Number.POSITIVE_INFINITY;
    };
    merged.sort((a, b) => positionOf(a) - positionOf(b) || a._rosterIndex - b._rosterIndex);
    return merged;
  }

  return Object.freeze({
    ROSTER,
    DRIVER_ALIASES,
    TEAM_ALIASES,
    canonicalDriverId,
    findDriver,
    findDriverByName,
    teamIdFor,
    photoKey,
    enrichStandings
  });
});
