import { describe, expect, it } from 'vitest';
import {
  WEELO_REFRESH_MS,
  WEELLZ_PLAYER_BASE,
  parseWeellzFeeds,
  refreshWeeloCatalogues,
  type CatalogueDeps,
} from '../src/features/catalogues';

describe('weellz.live feed resolution & 3-minute refresh', () => {
  it('sets the Weelo refresh interval to 3 minutes (180,000 ms)', () => {
    expect(WEELO_REFRESH_MS).toBe(3 * 60_000);
  });

  it('extracts rotating session channel links, backups, shows, and onboards from weellz.live feeds', () => {
    const nowSec = 1762510000; // Sat before FP3
    const playersJson = {
      events: [
        {
          id: 'f1-2026-r20-practice-3',
          name: 'F1 Practice 3',
          series: 'Formula 1',
          series_key: 'f1',
          weekend: 'São Paulo Grand Prix',
          live: false,
          start: nowSec + 3600,
          channels: [
            { name: 'International Feed', stream: 'intl_sat_id', lang: 'Multi-audio', pending: false },
            { name: 'F1 TV', stream: 'f1tv_world_id', lang: 'English', pending: false },
            { name: 'Sky Sports', stream: 'sky_sat_cd_id', lang: 'English', pending: false },
            { name: 'Driver Tracker', stream: 'tracker_id', lang: 'Data', pending: false },
            { name: 'Data Channel', stream: 'data_id', lang: 'Data', pending: false },
            { name: 'Kimi Antonelli', stream: 'kimi_id', lang: 'Onboard', pending: false },
            { name: 'Max Verstappen', stream: 'max_id', lang: 'Onboard', pending: false },
            { name: 'Charles Leclerc', stream: 'charles_id', lang: 'Onboard', pending: false },
          ],
        },
        {
          id: 'f1-2026-r20-race',
          name: 'F1 Race',
          series: 'Formula 1',
          series_key: 'f1',
          weekend: 'São Paulo Grand Prix',
          live: false,
          start: nowSec + 90_000,
          channels: [
            { name: 'Sky Sports', stream: 'sky_sun_bd_id', lang: 'English', pending: false },
          ],
        },
        {
          id: 'show-pre-qualifying-show-21-51',
          name: 'Pre-Qualifying Show',
          series: 'Motorsport Shows',
          series_key: 'show',
          weekend: 'São Paulo Grand Prix',
          live: false,
          start: nowSec + 7200,
          channels: [
            { name: 'F1 TV', stream: 'f1tv_shows_id', lang: 'English', pending: false },
            { name: 'Sky Sports', stream: 'sky_sat_cd_id', lang: 'English', pending: false },
          ],
        },
      ],
    };

    const statusJson = {
      now: nowSec,
      events: [
        { id: 'f1-2026-r20-practice-3', live: false, done: false },
        { id: 'show-pre-qualifying-show-21-51', live: false, done: false },
      ],
    };

    const feedJson = {
      events: [
        {
          id: 'f1-2026-r20',
          series: 'f1',
          sessions: [{ slug: 'practice-3', startsAt: new Date((nowSec + 3600) * 1000).toISOString() }],
          streams: [
            { label: 'International Feed', language: 'Multi-audio', url: `${WEELLZ_PLAYER_BASE}intl_sat_id&r=1` },
            { label: 'International Feed - Backup', language: 'English', url: 'https://weellz.live/at?id=backup_intl_token' },
          ],
        },
      ],
    };

    const parsed = parseWeellzFeeds(playersJson, statusJson, feedJson, nowSec * 1000);

    expect(parsed.slots.skyweelo?.stream).toBe('sky_sat_cd_id');
    expect(parsed.slots.skyweelo?.urls).toEqual([`${WEELLZ_PLAYER_BASE}sky_sat_cd_id`]);
    expect(parsed.slots.intl?.urls).toEqual([
      `${WEELLZ_PLAYER_BASE}intl_sat_id`,
      'https://weellz.live/at?id=backup_intl_token',
    ]);
    expect(parsed.slots.f1tvworld?.stream).toBe('f1tv_world_id');
    expect(parsed.slots.shows?.stream).toBe('f1tv_shows_id');
    expect(parsed.slots.drivers?.stream).toBe('tracker_id');
    expect(parsed.slots.data?.stream).toBe('data_id');
    expect(parsed.onboards.map((o) => o.label)).toEqual([
      'Kimi Antonelli',
      'Max Verstappen',
      'Charles Leclerc',
    ]);
  });

  it('promotes a live F1 show Sky Sports feed when the show is on air before track action', () => {
    const nowSec = 1762520000;
    const playersJson = {
      events: [
        {
          id: 'f1-2026-r20-qualifying',
          name: 'F1 Qualifying',
          series: 'Formula 1',
          series_key: 'f1',
          weekend: 'São Paulo Grand Prix',
          live: false,
          start: nowSec + 5400,
          channels: [{ name: 'Sky Sports', stream: 'sky_quali_id', lang: 'English', pending: false }],
        },
        {
          id: 'show-pre-qualifying',
          name: 'Pre-Qualifying Show',
          series: 'Motorsport Shows',
          series_key: 'show',
          weekend: 'São Paulo Grand Prix',
          live: false,
          start: nowSec - 300,
          channels: [
            { name: 'Sky Sports', stream: 'sky_show_live_id', lang: 'English', pending: false },
            { name: 'F1 TV', stream: 'f1tv_shows_live_id', lang: 'English', pending: false },
          ],
        },
      ],
    };
    const statusJson = {
      events: [
        { id: 'f1-2026-r20-qualifying', live: false, done: false },
        { id: 'show-pre-qualifying', live: true, done: false },
      ],
    };

    const parsed = parseWeellzFeeds(playersJson, statusJson, null, nowSec * 1000);
    expect(parsed.anyLive).toBe(true);
    expect(parsed.slots.skyweelo?.stream).toBe('sky_show_live_id');
    expect(parsed.slots.skyweelo?.urls).toEqual([
      `${WEELLZ_PLAYER_BASE}sky_show_live_id`,
      `${WEELLZ_PLAYER_BASE}sky_quali_id`,
    ]);
  });

  it('refreshes weellz.live links immediately on every 3-minute refresh call without TTL staleness', async () => {
    let skyToken = 'sky_tick_1';
    const deps: CatalogueDeps = {
      backend: 'https://f1admin.example',
      fetchWithTimeout: async (url: string) => {
        if (url.includes('/players/events.json')) {
          return new Response(
            JSON.stringify({
              events: [
                {
                  id: 'f1-r20-fp3',
                  name: 'F1 Practice 3',
                  series_key: 'f1',
                  weekend: 'São Paulo Grand Prix',
                  live: true,
                  start: Math.floor(Date.now() / 1000),
                  channels: [{ name: 'Sky Sports', stream: skyToken, lang: 'English', pending: false }],
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.includes('/api/status.json')) {
          return new Response(JSON.stringify({ events: [{ id: 'f1-r20-fp3', live: true, done: false }] }), { status: 200 });
        }
        if (url.includes('/api/stream/weelo')) {
          return new Response(JSON.stringify({ state: { [skyToken]: 'online' } }), { status: 200 });
        }
        return new Response(JSON.stringify({ events: [] }), { status: 200 });
      },
    };

    const first = await refreshWeeloCatalogues(deps);
    expect(first.weellz?.slots.skyweelo?.stream).toBe('sky_tick_1');
    expect(first.weelo.sky_tick_1).toBe('online');

    skyToken = 'sky_tick_2';
    const second = await refreshWeeloCatalogues(deps);
    expect(second.weellz?.slots.skyweelo?.stream).toBe('sky_tick_2');
    expect(second.weelo.sky_tick_2).toBe('online');
  });
});
