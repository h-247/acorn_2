import { getInitialSeedData } from './seed-data.js';

export interface DatabaseStore {
  users: any[];
  courses: any[];
  classes: any[];
  classEnrollments: any[];
  skills: any[];
  materials: any[];
  materialVersions: any[];
  materialProvenance: any[];
  questions: any[];
  questionSkills: any[];
  assessments: any[];
  assessmentItems: any[];
  assignments: any[];
  submissions: any[];
  submissionResponses: any[];
  learningEvidence: any[];
  learnerSkillStates: any[];
  recommendations: any[];
  recommendationCandidates: any[];
  teacherDecisions: any[];
  aiGenerations: any[];
  auditEvents: any[];
}

class InMemoryDatabase {
  private store: DatabaseStore;

  constructor() {
    this.store = {
      ...getInitialSeedData(),
      materialProvenance: [],
    };
  }

  getStore() {
    return this.store;
  }

  reset() {
    this.store = {
      ...getInitialSeedData(),
      materialProvenance: [],
    };
  }
}

// Global database instance
export const db = new InMemoryDatabase();
