import { ConfidenceLevel } from '@acorn/contracts';
import * as schema from '../../infrastructure/persistence/schema.js';
import { eq, and, desc } from 'drizzle-orm';

export interface ComputedSkillState {
  score: number | null;
  scorePercentage: number | null;
  confidence: ConfidenceLevel;
  evidenceCount: number;
  firstEvidenceAt: string | null;
  lastEvidenceAt: string | null;
}

export function computeSkillState(evidenceList: any[], recentN: number = 20): ComputedSkillState {
  // G08: Only consider non-superseded evidence in skill state computation
  const effectiveEvidence = evidenceList.filter((e) => !e.isSuperseded);

  if (!effectiveEvidence || effectiveEvidence.length === 0) {
    return {
      score: null,
      scorePercentage: null,
      confidence: ConfidenceLevel.NO_DATA,
      evidenceCount: 0,
      firstEvidenceAt: null,
      lastEvidenceAt: null,
    };
  }

  // Sort newest first, take recent N
  const sorted = [...effectiveEvidence].sort(
    (a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime()
  );
  const recent = sorted.slice(0, recentN);

  const totalWeightedScore = recent.reduce(
    (sum, item) => sum + item.normalizedScore * (item.weight ?? 1.0),
    0
  );
  const totalWeight = recent.reduce((sum, item) => sum + (item.weight ?? 1.0), 0);

  const score = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  const count = effectiveEvidence.length;

  let confidence: ConfidenceLevel = ConfidenceLevel.NO_DATA;
  if (count === 0) confidence = ConfidenceLevel.NO_DATA;
  else if (count <= 2) confidence = ConfidenceLevel.LOW;
  else if (count <= 5) confidence = ConfidenceLevel.MEDIUM;
  else confidence = ConfidenceLevel.HIGH;

  return {
    score: Math.round(score * 100) / 100,
    scorePercentage: Math.round(score * 100),
    confidence,
    evidenceCount: count,
    firstEvidenceAt: new Date(sorted[sorted.length - 1].observedAt).toISOString(),
    lastEvidenceAt: new Date(sorted[0].observedAt).toISOString(),
  };
}

export async function recomputeLearnerSkillState(
  txOrDb: any,
  learnerId: string,
  skillId: string,
  recentN: number = 20
) {
  const evidenceList = await txOrDb
    .select()
    .from(schema.learningEvidence)
    .where(
      and(
        eq(schema.learningEvidence.learnerId, learnerId),
        eq(schema.learningEvidence.skillId, skillId)
      )
    )
    .orderBy(desc(schema.learningEvidence.observedAt));


  const state = computeSkillState(evidenceList, recentN);
  const now = new Date();

  await txOrDb
    .insert(schema.learnerSkillStates)
    .values({
      learnerId,
      skillId,
      score: state.score,
      confidence: state.confidence,
      evidenceCount: state.evidenceCount,
      firstEvidenceAt: state.firstEvidenceAt ? new Date(state.firstEvidenceAt) : null,
      lastEvidenceAt: state.lastEvidenceAt ? new Date(state.lastEvidenceAt) : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.learnerSkillStates.learnerId, schema.learnerSkillStates.skillId],
      set: {
        score: state.score,
        confidence: state.confidence,
        evidenceCount: state.evidenceCount,
        firstEvidenceAt: state.firstEvidenceAt ? new Date(state.firstEvidenceAt) : null,
        lastEvidenceAt: state.lastEvidenceAt ? new Date(state.lastEvidenceAt) : null,
        updatedAt: now,
      },
    });

  // Any evidence change can change which skill is weakest, so every current
  // recommendation for the learner must be regenerated from the new state.
  await txOrDb
    .update(schema.recommendations)
    .set({ isStale: true })
    .where(
      and(
        eq(schema.recommendations.learnerId, learnerId),
        eq(schema.recommendations.isStale, false)
      )
    );

  return state;
}
