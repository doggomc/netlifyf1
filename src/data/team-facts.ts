/* Constructor profile facts: official 2026 FIA entry names, bases, power units,
   first championship seasons and constructors' titles. Kept in its own module
   so the /teams grid page stays inside the thin-shell JS budget. */

export type TeamProfileFacts = {
  slug: string;
  id: string;
  constructorId: string;
  name: string;
  entryName: string;
  color: string;
  logo: string;
  base: string;
  powerUnit: string;
  firstSeason: string;
  titles: number;
};

export const TEAM_PROFILES: TeamProfileFacts[] = [
  {
    slug: 'mercedes',
    id: 'mercedes',
    constructorId: 'mercedes',
    name: 'Mercedes',
    entryName: 'Mercedes-AMG Petronas F1 Team',
    color: '#00D2BE',
    logo: 'mercedes',
    base: 'Brackley, United Kingdom',
    powerUnit: 'Mercedes',
    firstSeason: '1970',
    titles: 8,
  },
  {
    slug: 'ferrari',
    id: 'ferrari',
    constructorId: 'ferrari',
    name: 'Ferrari',
    entryName: 'Scuderia Ferrari HP',
    color: '#DC0000',
    logo: 'ferrari',
    base: 'Maranello, Italy',
    powerUnit: 'Ferrari',
    firstSeason: '1950',
    titles: 16,
  },
  {
    slug: 'red-bull-racing',
    id: 'redbull',
    constructorId: 'red_bull',
    name: 'Red Bull Racing',
    entryName: 'Oracle Red Bull Racing',
    color: '#1E41FF',
    logo: 'redbullracing',
    base: 'Milton Keynes, United Kingdom',
    powerUnit: 'Red Bull Ford',
    firstSeason: '1997',
    titles: 6,
  },
  {
    slug: 'mclaren',
    id: 'mclaren',
    constructorId: 'mclaren',
    name: 'McLaren',
    entryName: 'McLaren Mastercard F1 Team',
    color: '#FF8000',
    logo: 'mclaren',
    base: 'Woking, United Kingdom',
    powerUnit: 'Mercedes',
    firstSeason: '1966',
    titles: 10,
  },
  {
    slug: 'racing-bulls',
    id: 'racingbulls',
    constructorId: 'rb',
    name: 'Racing Bulls',
    entryName: 'Visa Cash App Racing Bulls F1 Team',
    color: '#6692FF',
    logo: 'racingbulls',
    base: 'Faenza, Italy',
    powerUnit: 'Red Bull Ford',
    firstSeason: '1985',
    titles: 0,
  },
  {
    slug: 'alpine',
    id: 'alpine',
    constructorId: 'alpine',
    name: 'Alpine',
    entryName: 'BWT Alpine F1 Team',
    color: '#FF0080',
    logo: 'alpine',
    base: 'Enstone, United Kingdom',
    powerUnit: 'Mercedes',
    firstSeason: '1981',
    titles: 0,
  },
  {
    slug: 'haas',
    id: 'haas',
    constructorId: 'haas',
    name: 'Haas',
    entryName: 'TGR Haas F1 Team',
    color: '#B6BABD',
    logo: 'haasf1team',
    base: 'Kannapolis, United States',
    powerUnit: 'Ferrari',
    firstSeason: '2016',
    titles: 0,
  },
  {
    slug: 'audi',
    id: 'audi',
    constructorId: 'audi',
    name: 'Audi',
    entryName: 'Audi Revolut F1 Team',
    color: '#E62213',
    logo: 'audi',
    base: 'Hinwil, Switzerland',
    powerUnit: 'Audi',
    firstSeason: '1993',
    titles: 0,
  },
  {
    slug: 'williams',
    id: 'williams',
    constructorId: 'williams',
    name: 'Williams',
    entryName: 'Atlassian Williams F1 Team',
    color: '#005AFF',
    logo: 'williams',
    base: 'Grove, United Kingdom',
    powerUnit: 'Mercedes',
    firstSeason: '1977',
    titles: 9,
  },
  {
    slug: 'aston-martin',
    id: 'astonmartin',
    constructorId: 'aston_martin',
    name: 'Aston Martin',
    entryName: 'Aston Martin Aramco F1 Team',
    color: '#006F62',
    logo: 'astonmartin',
    base: 'Silverstone, United Kingdom',
    powerUnit: 'Honda',
    firstSeason: '1991',
    titles: 0,
  },
  {
    slug: 'cadillac',
    id: 'cadillac',
    constructorId: 'cadillac',
    name: 'Cadillac',
    entryName: 'Cadillac Formula 1 Team',
    color: '#B4A07A',
    logo: 'cadillac',
    base: 'Fishers, United States',
    powerUnit: 'Ferrari',
    firstSeason: '2026',
    titles: 0,
  },
];

export function findTeamBySlug(slug: string): TeamProfileFacts | null {
  return TEAM_PROFILES.find((team) => team.slug === slug) ?? null;
}

export function findTeamByConstructorId(constructorId: string, apiName = ''): TeamProfileFacts | null {
  const byId = TEAM_PROFILES.find((team) => team.constructorId === constructorId);
  if (byId) return byId;
  const lower = apiName.toLowerCase();
  return TEAM_PROFILES.find((team) => team.name.toLowerCase() === lower || lower.startsWith(team.name.toLowerCase())) ?? null;
}
