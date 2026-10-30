/** Public endpoints only. Never put Render admin credentials in VITE_* variables. */
export const BACKEND_API = import.meta.env.DEV ? '/control-api' : 'https://f1admin.onrender.com';
export const SITE_CONFIG_CACHE_KEY = 'freef1_site_config_v2';
export const SITE_SEASON = 2026;
export const OPENF1_API = 'https://api.openf1.org/v1';
export const JOLPI = 'https://api.jolpi.ca/ergast/f1';
