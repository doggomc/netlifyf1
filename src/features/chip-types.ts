/* The chip shape the lazy override module edits. Kept apart so chips.ts does not pull in app.ts. */
export interface StreamLink { provider?: string; label?: string; quality?: number; url?: string; taid?: number; mark?: string; addressing?: string; ppv?: boolean; }
export interface StreamSource {
  id: string; label: string; links: StreamLink[]; embdlol?: string; weelo?: string;
  special?: 'onboard' | 'data' | 'feed'; lang?: 'en' | 'other'; gated?: boolean;
  base?: { label: string; links: StreamLink[] };
  hidden?: boolean;
}
