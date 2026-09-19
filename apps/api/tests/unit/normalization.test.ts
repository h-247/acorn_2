import { describe, it, expect } from 'vitest';

describe('Evidence Normalization', () => {
  it('normalizes scores into [0, 1] range', () => {
    const normalize = (raw: number, max: number) => Math.min(1.0, Math.max(0, raw / max));

    expect(normalize(0, 100)).toBe(0.0);
    expect(normalize(50, 100)).toBe(0.5);
    expect(normalize(100, 100)).toBe(1.0);
    expect(normalize(18, 25)).toBe(0.72);
    // Boundary guards
    expect(normalize(-10, 100)).toBe(0.0);
    expect(normalize(120, 100)).toBe(1.0);
  });
});
