import { describe, it, expect } from 'vitest';
import { computeSkillState } from '../../src/modules/learner-state/learner-state.plugin.js';
import { ConfidenceLevel } from '@acorn/contracts';

describe('Learner State Computation (Recent-N Weighted Average)', () => {
  it('returns NO_DATA confidence and null score when evidence list is empty', () => {
    const state = computeSkillState([]);
    expect(state.confidence).toBe(ConfidenceLevel.NO_DATA);
    expect(state.score).toBeNull();
    expect(state.scorePercentage).toBeNull();
    expect(state.evidenceCount).toBe(0);
  });

  it('correctly maps confidence boundaries: 1-2 LOW, 3-5 MEDIUM, 6+ HIGH', () => {
    const makeEvidence = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        normalizedScore: 0.8,
        weight: 1.0,
        observedAt: new Date(2025, 0, i + 1).toISOString(),
      }));

    expect(computeSkillState(makeEvidence(1)).confidence).toBe(ConfidenceLevel.LOW);
    expect(computeSkillState(makeEvidence(2)).confidence).toBe(ConfidenceLevel.LOW);
    expect(computeSkillState(makeEvidence(3)).confidence).toBe(ConfidenceLevel.MEDIUM);
    expect(computeSkillState(makeEvidence(5)).confidence).toBe(ConfidenceLevel.MEDIUM);
    expect(computeSkillState(makeEvidence(6)).confidence).toBe(ConfidenceLevel.HIGH);
    expect(computeSkillState(makeEvidence(20)).confidence).toBe(ConfidenceLevel.HIGH);
  });

  it('computes weighted average over recent N items with varying weights', () => {
    // 3 items: (1.0 * 1.5) + (0.5 * 1.0) + (0.0 * 0.5) = 1.5 + 0.5 + 0 = 2.0
    // total weight = 1.5 + 1.0 + 0.5 = 3.0
    // expected = 2.0 / 3.0 = 0.67 (67%)
    const evidence = [
      { normalizedScore: 1.0, weight: 1.5, observedAt: '2025-04-03T10:00:00.000Z' },
      { normalizedScore: 0.5, weight: 1.0, observedAt: '2025-04-02T10:00:00.000Z' },
      { normalizedScore: 0.0, weight: 0.5, observedAt: '2025-04-01T10:00:00.000Z' },
    ];

    const state = computeSkillState(evidence, 20);
    expect(state.score).toBe(0.67);
    expect(state.scorePercentage).toBe(67);
    expect(state.confidence).toBe(ConfidenceLevel.MEDIUM);
    expect(state.evidenceCount).toBe(3);
  });

  it('restricts computation to recent-N items when total evidence exceeds N', () => {
    // 25 items, recent 20 are score 1.0, older 5 are score 0.0
    const evidence = [];
    for (let i = 0; i < 20; i++) {
      evidence.push({
        normalizedScore: 1.0,
        weight: 1.0,
        observedAt: new Date(2025, 3, 25 - i).toISOString(),
      });
    }
    for (let i = 0; i < 5; i++) {
      evidence.push({
        normalizedScore: 0.0,
        weight: 1.0,
        observedAt: new Date(2025, 0, 5 - i).toISOString(),
      });
    }

    const state = computeSkillState(evidence, 20);
    expect(state.score).toBe(1.0);
    expect(state.scorePercentage).toBe(100);
    expect(state.evidenceCount).toBe(25);
  });
});
