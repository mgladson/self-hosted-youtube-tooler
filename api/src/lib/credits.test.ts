import { describe, it, expect } from 'vitest';
import { downloadCost, LOOKUP_COST, WELCOME_CREDITS } from './credits.js';

describe('downloadCost', () => {
  it('charges 2 for audio and standard definition', () => {
    for (const q of ['audio', '360', '480', '720']) {
      expect(downloadCost(q)).toBe(2);
    }
  });

  it('charges 4 for 1080p', () => {
    expect(downloadCost('1080')).toBe(4);
  });

  it('charges 8 for 1440p and 2160p (4K)', () => {
    expect(downloadCost('1440')).toBe(8);
    expect(downloadCost('2160')).toBe(8);
  });

  it('falls back to the cheapest download tier for unknown qualities', () => {
    expect(downloadCost('weird')).toBe(2);
  });

  it('never costs less than a lookup', () => {
    for (const q of ['audio', '360', '480', '720', '1080', '1440', '2160']) {
      expect(downloadCost(q)).toBeGreaterThanOrEqual(LOOKUP_COST);
    }
  });
});

describe('credit constants', () => {
  it('grants a positive welcome balance', () => {
    expect(WELCOME_CREDITS).toBeGreaterThan(0);
  });

  it('prices a lookup at one credit', () => {
    expect(LOOKUP_COST).toBe(1);
  });
});
