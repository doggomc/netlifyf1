/* One slug rule for the whole site: /drivers/<slug>/ on a card, the standings
   table and a profile URL must all agree, so it lives in exactly one place. */
export const slugify = (value: string) => value.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
