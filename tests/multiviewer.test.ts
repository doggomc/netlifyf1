import { describe, expect, it } from 'vitest';
import { MAX_TILES, describeFeed, focusLayout, layout, tileUrl } from '../src/features/multiviewer';

describe('multiviewer geometry & feed classification', () => {
  it('builds muted and unmuted weellz.live tile URLs cleanly', () => {
    expect(tileUrl('abc123', false)).toBe('https://weellz.live/beta?stream=abc123&autoplay=1&mute=0');
    expect(tileUrl('abc123', true)).toBe('https://weellz.live/beta?stream=abc123&autoplay=1&mute=1');
    expect(tileUrl('abc123', true, 'https://weellz.live/beta?stream=xyz')).toBe(
      'https://weellz.live/beta?stream=xyz&autoplay=1&mute=1',
    );
  });

  it('lays out 1..9 tiles as 16:9 boxes within bounds and 9 tiles as 3x3', () => {
    for (let n = 1; n <= MAX_TILES; n++) {
      const boxes = layout(n, 1424, 836);
      expect(boxes).toHaveLength(n);
      for (const b of boxes) {
        expect(b.w / b.h).toBeCloseTo(16 / 9, 2);
        expect(b.x).toBeGreaterThanOrEqual(-0.5);
        expect(b.y).toBeGreaterThanOrEqual(-0.5);
        expect(b.x + b.w).toBeLessThanOrEqual(1424.5);
        expect(b.y + b.h).toBeLessThanOrEqual(836.5);
      }
    }

    const nine = layout(9, 1424, 836);
    expect(new Set(nine.map((b) => Math.round(b.x))).size).toBe(3);
    expect(new Set(nine.map((b) => Math.round(b.y))).size).toBe(3);
  });

  it('lays out Focus mode with one big hero player and smaller companion tiles', () => {
    const desk = focusLayout(3, 1424, 836);
    expect(desk).toHaveLength(3);
    expect(desk[0].w).toBeGreaterThan(desk[1].w * 2);
    expect(desk[1].x).toBeGreaterThan(desk[0].x + desk[0].w);
    expect(desk[1].w).toBeCloseTo(desk[2].w, 2);
    for (const b of desk) expect(b.w / b.h).toBeCloseTo(16 / 9, 2);

    const deskMany = focusLayout(7, 1424, 836);
    expect(deskMany).toHaveLength(7);
    expect(new Set(deskMany.slice(1).map((b) => Math.round(b.x))).size).toBe(2);

    const mobile = focusLayout(3, 378, 780);
    expect(mobile).toHaveLength(3);
    expect(mobile[0].y).toBe(0);
    expect(mobile[1].y).toBeGreaterThan(mobile[0].h);
    expect(mobile[0].w).toBeGreaterThan(mobile[1].w);
  });

  it('classifies broadcast, driver onboard, and pit wall feeds with clean titles and driver portrait keys', () => {
    expect(describeFeed({ id: 'weelo-skyweelo', label: 'Sky Sports (weelo)', special: 'feed' })).toMatchObject({
      title: 'Sky Sports F1',
      category: 'broadcast',
      badgeKind: 'sky',
    });
    expect(describeFeed({ id: 'weelo-intl', label: 'International Feed', special: 'feed' })).toMatchObject({
      title: 'International Feed',
      subtitle: 'Multi-audio',
      category: 'broadcast',
      badgeKind: 'f1',
    });
    expect(describeFeed({ id: 'weelo-max', label: 'Max Verstappen', special: 'onboard' })).toMatchObject({
      title: 'Max Verstappen',
      subtitle: 'Onboard',
      category: 'onboard',
      driverKey: 'verstappen',
      badgeKind: 'driver',
    });
    expect(describeFeed({ id: 'weelo-drivers', label: 'Drivers Track', special: 'onboard' })).toMatchObject({
      title: 'Driver Tracker',
      category: 'data',
      badgeKind: 'tracker',
    });
    expect(describeFeed({ id: 'weelo-data', label: 'Data Channel', special: 'data' })).toMatchObject({
      title: 'Data Channel',
      category: 'data',
      badgeKind: 'data',
    });
  });
});
