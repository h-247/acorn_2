import { db, pool } from './db.js';
import * as schema from './schema.js';
import { hashPassword } from '../auth/crypto.js';
import { notInArray } from 'drizzle-orm';
import {
  UserRole,
  CEFRLevel,
  SkillArea,
  Difficulty,
  MaterialType,
  MaterialStatus,
  AssessmentStatus,
  QuestionType,
  SubmissionStatus,
  EvidenceType,
  EvaluatorType,
  ConfidenceLevel,
  RecommendationAction,
  TeacherDecisionStatus,
} from '@acorn/contracts';

export const SEED_IDS = {
  adminUser: '00000000-0000-0000-0000-000000000001',
  teacherTaylor: '11111111-1111-1111-1111-111111111111',

  // 10 Students
  studentEmma: '22222222-2222-2222-2222-222222222222',
  studentLiam: '33333333-3333-3333-3333-333333333333',
  studentSofia: '22222222-2222-2222-2222-222222222203',
  studentLucas: '22222222-2222-2222-2222-222222222204',
  studentMia: '22222222-2222-2222-2222-222222222205',
  studentNoah: '22222222-2222-2222-2222-222222222206',
  studentAva: '22222222-2222-2222-2222-222222222207',
  studentEthan: '22222222-2222-2222-2222-222222222208',
  studentOlivia: '22222222-2222-2222-2222-222222222209',
  studentWilliam: '22222222-2222-2222-2222-222222222210',

  // Exactly 1 Course and 1 Class
  courseIelts: '44444444-4444-4444-4444-444444444444',
  classIeltsA: '55555555-5555-5555-5555-555555555555',

  // 4 Top-level Parent Skills
  skillReading: '66666666-6666-6666-6666-666666666601',
  skillListening: '66666666-6666-6666-6666-666666666606',
  skillSpeaking: '66666666-6666-6666-6666-666666666607',
  skillWriting: '66666666-6666-6666-6666-666666666608',

  // 8 Direct Child Subskills (2 per parent skill)
  skillReadingMainIdea: '66666666-6666-6666-6666-666666666602',
  skillReadingDetail: '66666666-6666-6666-6666-666666666603',
  skillListeningDetail: '66666666-6666-6666-6666-666666666611',
  skillListeningMainIdea: '66666666-6666-6666-6666-666666666612',
  skillSpeakingFluency: '66666666-6666-6666-6666-666666666613',
  skillSpeakingPronunciation: '66666666-6666-6666-6666-666666666614',
  skillWritingTaskResponse: '66666666-6666-6666-6666-666666666615',
  skillWritingCoherence: '66666666-6666-6666-6666-666666666616',

  // Backward-compatibility aliases for existing test suites
  skillReadingInference: '66666666-6666-6666-6666-666666666603',
  skillReadingVocabContext: '66666666-6666-6666-6666-666666666602',
  skillGrammar: '66666666-6666-6666-6666-666666666616',
  skillVocabulary: '66666666-6666-6666-6666-666666666602',

  // Materials
  matUrbanFarming: '77777777-7777-7777-7777-777777777701',
  matSpeakingCards: '77777777-7777-7777-7777-777777777702',
  matSustainableCities: '77777777-7777-7777-7777-777777777707',
  matVocabClimate: '77777777-7777-7777-7777-777777777703',
  matListeningCampus: '77777777-7777-7777-7777-777777777705',
  matWritingWorkshop: '77777777-7777-7777-7777-777777777710',

  // 10 Concise Questions for Integrated Assessment
  // Reading (3 MCQs)
  qInferenceCityLife: '88888888-8888-8888-8888-888888888801',
  qMainIdeaUrbanFarming: '88888888-8888-8888-8888-888888888802',
  qDetailUrbanFarming: '88888888-8888-8888-8888-888888888804',
  // Listening (3 MCQs)
  qListeningLibraryHours: '88888888-8888-8888-8888-888888888807',
  qListeningBorrowLimit: '88888888-8888-8888-8888-888888888808',
  qListeningIDCard: '88888888-8888-8888-8888-888888888809',
  // Speaking (2 Rubric Questions)
  qSpeakingEnvironmentalHabit: '88888888-8888-8888-8888-888888888806',
  qSpeakingCampusFacility: '88888888-8888-8888-8888-888888888810',
  // Writing (2 Rubric Questions)
  qWritingOpinionEssay: '88888888-8888-8888-8888-888888888805',
  qWritingProblemSolution: '88888888-8888-8888-8888-888888888811',

  // Integrated Assessment & Assignment
  assessmentIntegrated: '99999999-9999-9999-9999-999999999901',
  assessmentReading03: '99999999-9999-9999-9999-999999999901',
  assessmentWriting01: '99999999-9999-9999-9999-999999999902',
  assessmentSpeaking01: '99999999-9999-9999-9999-999999999903',
  assessmentListening01: '99999999-9999-9999-9999-999999999904',
  assignmentIntegrated: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  assignmentReading03: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  assignmentWriting01: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  assignmentSpeaking01: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  assignmentListening01: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',

  // Submissions
  submissionEmmaIntegrated: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  submissionEmmaReading: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  submissionLiamIntegrated: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  submissionLiamReading: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  submissionSofiaIntegrated: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
  submissionSofiaReading: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
  submissionEmmaWriting: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04',
  submissionLiamWriting: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05',
  submissionSofiaSpeaking: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb06',
  submissionNoahListening: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb07',
  submissionLucasListening: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb08',

  // Recommendations
  recEmmaReadingInference: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  recEmmaSpeakingPractice: 'cccccccc-cccc-cccc-cccc-cccccccccc02',
  recNoahListeningDetail: 'cccccccc-cccc-cccc-cccc-cccccccccc03',
  recEmmaWriting: 'cccccccc-cccc-cccc-cccc-cccccccccc04',
};

export const seed = seedDatabase;

export async function seedDatabase() {
  const { rows: [{ database }] } = await pool.query<{ database: string }>('SELECT current_database() AS database');
  if (process.env.NODE_ENV === 'test' && database !== 'acorn_test') {
    throw new Error(`Refusing to seed demo database '${database}' in test mode! Tests must target 'acorn_test'.`);
  }

  console.log('Starting minimal IELTS database seed...');
  const defaultPasswordHash = hashPassword('password123');
  const adminPasswordHash = hashPassword('admin123');

  // 1. Users: Exactly 1 Admin, 1 Teacher, 10 Students = 12 users
  console.log('Seeding users (1 Admin, 1 Teacher, 10 Students)...');
  const usersData = [
    {
      id: SEED_IDS.adminUser,
      email: 'admin@acorn.edu',
      passwordHash: adminPasswordHash,
      name: 'System Admin',
      role: UserRole.ADMIN,
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    },
    {
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      passwordHash: defaultPasswordHash,
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    },
    {
      id: SEED_IDS.studentEmma,
      email: 'emma.nguyen@student.acorn.edu',
      passwordHash: defaultPasswordHash,
      name: 'Emma Nguyen',
      role: UserRole.STUDENT,
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    },
    {
      id: SEED_IDS.studentLiam,
      email: 'liam.chen@student.acorn.edu',
      passwordHash: defaultPasswordHash,
      name: 'Liam Chen',
      role: UserRole.STUDENT,
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    },
    {
      id: SEED_IDS.studentSofia,
      email: 'sofia.rodriguez@student.acorn.edu',
      passwordHash: defaultPasswordHash,
      name: 'Sofia Rodriguez',
      role: UserRole.STUDENT,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
    {
      id: SEED_IDS.studentLucas,
      email: 'lucas.kim@student.acorn.edu',
      passwordHash: defaultPasswordHash,
      name: 'Lucas Kim',
      role: UserRole.STUDENT,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
    {
      id: SEED_IDS.studentMia,
      email: 'mia.patel@student.acorn.edu',
      passwordHash: defaultPasswordHash,
      name: 'Mia Patel',
      role: UserRole.STUDENT,
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    },
    {
      id: SEED_IDS.studentNoah,
      email: 'noah.dubois@student.acorn.edu',
      passwordHash: defaultPasswordHash,
      name: 'Noah Dubois',
      role: UserRole.STUDENT,
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    },
    {
      id: SEED_IDS.studentAva,
      email: 'ava.tanaka@student.acorn.edu',
      passwordHash: defaultPasswordHash,
      name: 'Ava Tanaka',
      role: UserRole.STUDENT,
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    },
    {
      id: SEED_IDS.studentEthan,
      email: 'ethan.almansoor@student.acorn.edu',
      passwordHash: defaultPasswordHash,
      name: 'Ethan Al-Mansoor',
      role: UserRole.STUDENT,
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    },
    {
      id: SEED_IDS.studentOlivia,
      email: 'olivia.santos@student.acorn.edu',
      passwordHash: defaultPasswordHash,
      name: 'Olivia Santos',
      role: UserRole.STUDENT,
      avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
    },
    {
      id: SEED_IDS.studentWilliam,
      email: 'william.zhang@student.acorn.edu',
      passwordHash: defaultPasswordHash,
      name: 'William Zhang',
      role: UserRole.STUDENT,
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    },
  ];

  for (const u of usersData) {
    await db
      .insert(schema.users)
      .values(u)
      .onConflictDoUpdate({
        target: schema.users.id,
        set: { name: u.name, role: u.role, passwordHash: u.passwordHash, tokenVersion: 1, isActive: true },
      });
  }

  // 2. Skills Taxonomy (hierarchical: exactly 4 parents, exactly 2 active child subskills each)
  console.log('Seeding skills taxonomy (4 parents, 2 child subskills each)...');
  const skillsData = [
    // Exactly 4 Top-level Parent Skills
    { id: SEED_IDS.skillReading, code: 'READING', name: 'Reading Comprehension', area: SkillArea.READING, parentId: null, level: CEFRLevel.B1, description: 'Core reading comprehension skills' },
    { id: SEED_IDS.skillListening, code: 'LISTENING', name: 'Listening Comprehension', area: SkillArea.LISTENING, parentId: null, level: CEFRLevel.B1, description: 'Listening for main ideas and details' },
    { id: SEED_IDS.skillSpeaking, code: 'SPEAKING', name: 'Speaking & Fluency', area: SkillArea.SPEAKING, parentId: null, level: CEFRLevel.B1, description: 'Oral fluency and lexical resource' },
    { id: SEED_IDS.skillWriting, code: 'WRITING', name: 'Academic Writing', area: SkillArea.WRITING, parentId: null, level: CEFRLevel.B1, description: 'Essay coherence and task response' },

    // Reading Child Subskills (exactly 2)
    { id: SEED_IDS.skillReadingMainIdea, code: 'READ_MAIN_IDEA', name: 'Main Idea & Gist', area: SkillArea.READING, parentId: SEED_IDS.skillReading, level: CEFRLevel.B1, description: 'Identify primary thesis and paragraph gist' },
    { id: SEED_IDS.skillReadingDetail, code: 'READ_DETAIL', name: 'Supporting Details', area: SkillArea.READING, parentId: SEED_IDS.skillReading, level: CEFRLevel.B1, description: 'Locate explicit factual details' },

    // Listening Child Subskills (exactly 2)
    { id: SEED_IDS.skillListeningDetail, code: 'LISTEN_DETAIL', name: 'Listening for Details', area: SkillArea.LISTENING, parentId: SEED_IDS.skillListening, level: CEFRLevel.B1, description: 'Locate explicit factual details in spoken dialogues' },
    { id: SEED_IDS.skillListeningMainIdea, code: 'LISTEN_MAIN_IDEA', name: 'Listening for Main Idea & Gist', area: SkillArea.LISTENING, parentId: SEED_IDS.skillListening, level: CEFRLevel.B1, description: 'Understand overall meaning and speaker purpose' },

    // Speaking Child Subskills (exactly 2)
    { id: SEED_IDS.skillSpeakingFluency, code: 'SPEAK_FLUENCY', name: 'Fluency & Coherence', area: SkillArea.SPEAKING, parentId: SEED_IDS.skillSpeaking, level: CEFRLevel.B1, description: 'Speak continuously with logical progression and linking' },
    { id: SEED_IDS.skillSpeakingPronunciation, code: 'SPEAK_PRONUNCIATION', name: 'Pronunciation & Intonation', area: SkillArea.SPEAKING, parentId: SEED_IDS.skillSpeaking, level: CEFRLevel.B1, description: 'Produce clear speech sounds, stress patterns, and intonation' },

    // Writing Child Subskills (exactly 2)
    { id: SEED_IDS.skillWritingTaskResponse, code: 'WRITE_TASK_RESPONSE', name: 'Task Response & Ideas', area: SkillArea.WRITING, parentId: SEED_IDS.skillWriting, level: CEFRLevel.B1, description: 'Address all parts of the prompt with supported relevant ideas' },
    { id: SEED_IDS.skillWritingCoherence, code: 'WRITE_COHERENCE', name: 'Coherence & Cohesion', area: SkillArea.WRITING, parentId: SEED_IDS.skillWriting, level: CEFRLevel.B1, description: 'Organize paragraphs with cohesive linking and clear progression' },
  ];

  for (const s of skillsData) {
    await db
      .insert(schema.skills)
      .values(s)
      .onConflictDoUpdate({
        target: schema.skills.id,
        set: { name: s.name, code: s.code, parentId: s.parentId, area: s.area, status: 'ACTIVE' },
      });
  }

  // Ensure any other pre-existing skills are marked ARCHIVED so exactly the 12 taxonomy skills remain ACTIVE
  const activeSkillIds = skillsData.map((s) => s.id);
  await db
    .update(schema.skills)
    .set({ status: 'ARCHIVED' })
    .where(notInArray(schema.skills.id, activeSkillIds));

  // 3. Exactly 1 Course: IELTS 5.0 Preparation
  console.log('Seeding exactly 1 IELTS course...');
  await db
    .insert(schema.courses)
    .values({
      id: SEED_IDS.courseIelts,
      code: 'IELTS_5_0',
      name: 'IELTS 5.0 Preparation',
      description: 'Comprehensive B1-level preparation course for IELTS Academic candidates.',
      level: CEFRLevel.B1,
    })
    .onConflictDoUpdate({
      target: schema.courses.id,
      set: { name: 'IELTS 5.0 Preparation', code: 'IELTS_5_0', level: CEFRLevel.B1 },
    });

  // 4. Exactly 1 Class: IELTS 5.5-6.5 (Sat-Sun, 12:00-15:00)
  console.log('Seeding class IELTS 5.5-6.5 (Sat-Sun, 12:00-15:00)...');
  await db
    .insert(schema.classes)
    .values({
      id: SEED_IDS.classIeltsA,
      courseId: SEED_IDS.courseIelts,
      name: 'IELTS 5.5-6.5 (Sat-Sun, 12:00-15:00)',
      level: CEFRLevel.B1,
      teacherId: SEED_IDS.teacherTaylor,
      nextActivity: '10-Minute Integrated Assessment',
    })
    .onConflictDoUpdate({
      target: schema.classes.id,
      set: {
        name: 'IELTS 5.5-6.5 (Sat-Sun, 12:00-15:00)',
        level: CEFRLevel.B1,
        nextActivity: '10-Minute Integrated Assessment',
        teacherId: SEED_IDS.teacherTaylor,
      },
    });

  // 5. Enrollments: All 10 students enrolled in classIeltsA
  console.log('Seeding enrollments for all 10 students...');
  const studentIds = [
    SEED_IDS.studentEmma,
    SEED_IDS.studentLiam,
    SEED_IDS.studentSofia,
    SEED_IDS.studentLucas,
    SEED_IDS.studentMia,
    SEED_IDS.studentNoah,
    SEED_IDS.studentAva,
    SEED_IDS.studentEthan,
    SEED_IDS.studentOlivia,
    SEED_IDS.studentWilliam,
  ];

  for (let i = 0; i < studentIds.length; i++) {
    await db
      .insert(schema.classEnrollments)
      .values({
        id: `eeeeeeee-eeee-eeee-eeee-eeeeeeeeee${(i + 1).toString(16).padStart(2, '0')}`,
        classId: SEED_IDS.classIeltsA,
        learnerId: studentIds[i],
      })
      .onConflictDoNothing();
  }

  // 6. Materials & Versions
  console.log('Seeding recommendation-ready materials...');
  const materialsData = [
    {
      id: SEED_IDS.matUrbanFarming,
      title: 'Urban Farming and Vertical Agriculture',
      type: MaterialType.ARTICLE,
      primarySkillId: SEED_IDS.skillReadingMainIdea,
      level: CEFRLevel.B1,
      difficulty: Difficulty.MEDIUM,
      topic: 'Urban Innovation & Environment',
      courseId: SEED_IDS.courseIelts,
      tags: ['reading', 'ielts', 'b1', 'environment'],
      estimatedMinutes: 12,
      source: 'Teacher Library • IELTS Academic',
      status: MaterialStatus.APPROVED,
      currentVersionNumber: 1,
      usageCount: 4,
      content: `Urban agriculture is reshaping how city dwellers think about food security and sustainability. Vertical farming uses stacked layers in controlled indoor environments to produce leafy greens with up to 95 percent less water than conventional outdoor methods. While setup capital costs are initially steep, proponents argue that minimal transportation emissions and year-round harvesting make vertical farms resilient against climate extremes. In dense metropolitan zones like Singapore and Tokyo, commercial indoor farms already supply local grocery chains with crisp lettuce, basil, and microgreens every single day of the year.`,
      summary: 'Passage examining benefits and trade-offs of modern vertical agriculture.',
    },
    {
      id: SEED_IDS.matSpeakingCards,
      title: 'IELTS Speaking Part 2: Habit and Environment',
      type: MaterialType.ACTIVITY,
      primarySkillId: SEED_IDS.skillSpeakingFluency,
      level: CEFRLevel.B1,
      difficulty: Difficulty.MEDIUM,
      topic: 'Daily Habits & Environment',
      courseId: SEED_IDS.courseIelts,
      tags: ['speaking', 'ielts', 'b1', 'cue-card'],
      estimatedMinutes: 15,
      source: 'Teacher Library • Cambridge English',
      status: MaterialStatus.APPROVED,
      currentVersionNumber: 1,
      usageCount: 2,
      content: `Describe an environmental law or habit you would like to see introduced in your hometown.\nYou should say:\n- What this law or habit is\n- How it would be carried out\n- What problems it would address\nand explain whether you think people would support it.`,
      summary: 'Prompt cue card for speaking fluency and environmental vocabulary.',
    },
    {
      id: SEED_IDS.matSustainableCities,
      title: 'Sustainable Cities: B1 Adapted Version',
      type: MaterialType.ARTICLE,
      primarySkillId: SEED_IDS.skillReadingMainIdea,
      level: CEFRLevel.B1,
      difficulty: Difficulty.MEDIUM,
      topic: 'Urban Innovation & Environment',
      courseId: SEED_IDS.courseIelts,
      tags: ['reading', 'adaptation', 'b1', 'urban'],
      estimatedMinutes: 10,
      source: 'Adapted from Urban Farming',
      status: MaterialStatus.APPROVED,
      currentVersionNumber: 1,
      usageCount: 1,
      content: `Cities around the globe are searching for innovative ways to grow healthy food in small spaces. Vertical farming allows plants to grow in indoor towers under LED lights. These systems use 90% less water and no soil. Because food is grown inside the city, trucks do not need to transport vegetables hundreds of kilometers from rural farms. As a result, pollution is reduced and food stays fresh longer. Many cities hope this method will help feed growing urban populations in the near future.`,
      summary: 'Simplified reading passage focused on inference for B1 readers.',
    },
    {
      id: SEED_IDS.matVocabClimate,
      title: 'Academic Vocabulary: Climate and Urban Ecology',
      type: MaterialType.ARTICLE,
      primarySkillId: SEED_IDS.skillReadingDetail,
      level: CEFRLevel.B1,
      difficulty: Difficulty.MEDIUM,
      topic: 'Climate & Ecology',
      courseId: SEED_IDS.courseIelts,
      tags: ['vocabulary', 'ielts', 'b1', 'ecology'],
      estimatedMinutes: 15,
      source: 'Teacher Library • Lexical Resource',
      status: MaterialStatus.APPROVED,
      currentVersionNumber: 1,
      usageCount: 2,
      content: `Essential collocation list and lexical exercises for IELTS Academic Band 5.0 to 6.0 focusing on environmental sustainability and ecological stewardship.`,
      summary: 'Targeted lexical resource for environmental and urban topics.',
    },
    {
      id: SEED_IDS.matListeningCampus,
      title: 'Campus Life & Library Orientation',
      type: MaterialType.ACTIVITY,
      primarySkillId: SEED_IDS.skillListeningDetail,
      level: CEFRLevel.B1,
      difficulty: Difficulty.EASY,
      topic: 'Campus Life',
      courseId: SEED_IDS.courseIelts,
      tags: ['listening', 'ielts', 'b1', 'orientation'],
      estimatedMinutes: 15,
      source: 'Teacher Library • IELTS Listening',
      status: MaterialStatus.APPROVED,
      currentVersionNumber: 1,
      usageCount: 1,
      content: `Conversation between an international student and university librarian regarding resource registration, catalog searches, and study room reservations.`,
      summary: 'IELTS Section 1 listening dialogue and comprehension check.',
    },
    {
      id: SEED_IDS.matWritingWorkshop,
      title: 'Writing Workshop: Sustainable Food Systems',
      type: MaterialType.ACTIVITY,
      primarySkillId: SEED_IDS.skillWritingTaskResponse,
      level: CEFRLevel.B1,
      difficulty: Difficulty.MEDIUM,
      topic: 'Sustainability & Food',
      courseId: SEED_IDS.courseIelts,
      tags: ['writing', 'ielts', 'b1', 'opinion-essay'],
      estimatedMinutes: 25,
      source: 'Teacher Library • Academic Writing',
      status: MaterialStatus.APPROVED,
      currentVersionNumber: 1,
      usageCount: 2,
      content: 'Plan an opinion essay with a clear position, two developed body paragraphs, and a concise conclusion. Use evidence from the urban farming reading where relevant.',
      summary: 'Guided preparation activity for a B1 opinion essay.',
    },
  ];

  for (const m of materialsData) {
    const { content, summary, ...matRow } = m;
    await db
      .insert(schema.materials)
      .values(matRow)
      .onConflictDoUpdate({
        target: schema.materials.id,
        set: {
          title: matRow.title,
          status: matRow.status,
          primarySkillId: matRow.primarySkillId,
          usageCount: matRow.usageCount,
          topic: matRow.topic,
          difficulty: matRow.difficulty,
          courseId: matRow.courseId,
          tags: matRow.tags,
        },
      });

    await db
      .insert(schema.materialVersions)
      .values({
        id: `ffffffff-ffff-ffff-ffff-${m.id.substring(m.id.length - 12)}`,
        materialId: m.id,
        versionNumber: 1,
        content: m.content,
        summary: m.summary,
        changelog: 'Initial version',
        createdBy: SEED_IDS.teacherTaylor,
      })
      .onConflictDoNothing();
  }

  // Provenance link for adapted material
  await db
    .insert(schema.materialProvenance)
    .values({
      id: 'ffffffff-0000-0000-0000-000000000001',
      materialId: SEED_IDS.matSustainableCities,
      sourceMaterialId: SEED_IDS.matUrbanFarming,
      adaptationType: 'TEACHER_ADAPTATION',
      notes: 'Simplified sentence complexity and focused vocabulary for targeted B1 inference practice.',
    })
    .onConflictDoNothing();

  // Release all materials to classIeltsA
  console.log('Seeding class materials...');
  await db
    .insert(schema.classMaterials)
    .values([
      {
        id: 'cccccccc-0000-0000-0000-000000000001',
        classId: SEED_IDS.classIeltsA,
        materialId: SEED_IDS.matUrbanFarming,
        releasedBy: SEED_IDS.teacherTaylor,
      },
      {
        id: 'cccccccc-0000-0000-0000-000000000002',
        classId: SEED_IDS.classIeltsA,
        materialId: SEED_IDS.matSustainableCities,
        releasedBy: SEED_IDS.teacherTaylor,
      },
      {
        id: 'cccccccc-0000-0000-0000-000000000003',
        classId: SEED_IDS.classIeltsA,
        materialId: SEED_IDS.matSpeakingCards,
        releasedBy: SEED_IDS.teacherTaylor,
      },
      {
        id: 'cccccccc-0000-0000-0000-000000000004',
        classId: SEED_IDS.classIeltsA,
        materialId: SEED_IDS.matListeningCampus,
        releasedBy: SEED_IDS.teacherTaylor,
      },
      {
        id: 'cccccccc-0000-0000-0000-000000000005',
        classId: SEED_IDS.classIeltsA,
        materialId: SEED_IDS.matWritingWorkshop,
        releasedBy: SEED_IDS.teacherTaylor,
      },
      {
        id: 'cccccccc-0000-0000-0000-000000000006',
        classId: SEED_IDS.classIeltsA,
        materialId: SEED_IDS.matVocabClimate,
        releasedBy: SEED_IDS.teacherTaylor,
      },
    ])
    .onConflictDoNothing();

  // Deterministic listening audio fixture row compatible with pnpm demo:prepare-listening
  await db
    .insert(schema.materialFiles)
    .values({
      id: 'abababab-abab-abab-abab-ababababab01',
      materialId: SEED_IDS.matListeningCampus,
      fileName: 'campus-library-orientation.mp3',
      fileKey: 'demo-rehearsal/listening/campus-library-orientation.mp3',
      fileSize: 0,
      mimeType: 'audio/mpeg',
      uploadedBy: SEED_IDS.teacherTaylor,
      uploadedAt: new Date('2025-01-07T08:00:00.000Z'),
    })
    .onConflictDoUpdate({
      target: schema.materialFiles.id,
      set: {
        fileName: 'campus-library-orientation.mp3',
        fileKey: 'demo-rehearsal/listening/campus-library-orientation.mp3',
        mimeType: 'audio/mpeg',
        fileSize: 0,
      },
    });

  // 7. Questions (Exactly 10 questions: 3 Reading, 3 Listening, 2 Speaking, 2 Writing)
  console.log('Seeding 10 questions for integrated assessment...');
  const questionsData = [
    // 1. Reading (3 MCQs tagged to chosen child skillReadingMainIdea)
    {
      id: SEED_IDS.qInferenceCityLife,
      type: QuestionType.MCQ,
      prompt: 'What primary factor allows modern indoor vertical farms to harvest crops year-round?',
      passage: 'Vertical farming uses stacked layers in controlled indoor environments to produce leafy greens with up to 95 percent less water than conventional outdoor methods.',
      options: [
        'A. Climate-controlled indoor environments that operate independently of seasonal weather',
        'B. Exclusive reliance on high rainfall during the summer months',
        'C. Direct soil fertilization transported from rural farmlands',
        'D. Lower upfront capital and operational setup investments',
      ],
      correctAnswer: 'A. Climate-controlled indoor environments that operate independently of seasonal weather',
      difficulty: Difficulty.MEDIUM,
      level: CEFRLevel.B1,
      sourceMaterialId: SEED_IDS.matUrbanFarming,
      usageCount: 3,
      skills: [
        { skillId: SEED_IDS.skillReadingMainIdea, role: 'PRIMARY', weight: 1.0 },
      ],
    },
    {
      id: SEED_IDS.qMainIdeaUrbanFarming,
      type: QuestionType.MCQ,
      prompt: 'Which statement best summarizes the main idea of the passage?',
      passage: null,
      options: [
        'A. Singapore produces all its own food using traditional techniques.',
        'B. Urban vertical farming offers sustainable advantages despite high initial setup costs.',
        'C. LED lighting has made conventional outdoor agriculture completely obsolete.',
        'D. Transportation emissions cannot be reduced through local farming.',
      ],
      correctAnswer: 'B. Urban vertical farming offers sustainable advantages despite high initial setup costs.',
      difficulty: Difficulty.EASY,
      level: CEFRLevel.B1,
      sourceMaterialId: SEED_IDS.matUrbanFarming,
      usageCount: 3,
      skills: [
        { skillId: SEED_IDS.skillReadingMainIdea, role: 'PRIMARY', weight: 1.0 },
      ],
    },
    {
      id: SEED_IDS.qDetailUrbanFarming,
      type: QuestionType.MCQ,
      prompt: 'According to the text, how much water can vertical farming save compared to conventional outdoor farming?',
      passage: null,
      options: ['A. Up to 50 percent', 'B. Up to 75 percent', 'C. Up to 95 percent', 'D. Nearly 100 percent'],
      correctAnswer: 'C. Up to 95 percent',
      difficulty: Difficulty.EASY,
      level: CEFRLevel.B1,
      sourceMaterialId: SEED_IDS.matUrbanFarming,
      usageCount: 2,
      skills: [
        { skillId: SEED_IDS.skillReadingMainIdea, role: 'PRIMARY', weight: 1.0 },
      ],
    },

    // 2. Listening (3 MCQs tagged to chosen child skillListeningDetail & linked to matListeningCampus)
    {
      id: SEED_IDS.qListeningLibraryHours,
      type: QuestionType.LISTENING,
      prompt: 'According to the campus library orientation recording, when can students reserve a group study room?',
      passage: null,
      options: ['A. Only before 10 a.m.', 'B. From 8 a.m. to 8 p.m.', 'C. Only at weekends', 'D. After midnight'],
      correctAnswer: 'B. From 8 a.m. to 8 p.m.',
      rubric: null,
      difficulty: Difficulty.EASY,
      level: CEFRLevel.B1,
      sourceMaterialId: SEED_IDS.matListeningCampus,
      usageCount: 2,
      skills: [{ skillId: SEED_IDS.skillListeningDetail, role: 'PRIMARY', weight: 1.0 }],
    },
    {
      id: SEED_IDS.qListeningBorrowLimit,
      type: QuestionType.LISTENING,
      prompt: 'According to the librarian, how many books can an undergraduate student borrow simultaneously?',
      passage: null,
      options: ['A. Up to 5 books', 'B. Up to 10 books', 'C. Up to 15 books', 'D. Unlimited books'],
      correctAnswer: 'B. Up to 10 books',
      rubric: null,
      difficulty: Difficulty.MEDIUM,
      level: CEFRLevel.B1,
      sourceMaterialId: SEED_IDS.matListeningCampus,
      usageCount: 1,
      skills: [{ skillId: SEED_IDS.skillListeningDetail, role: 'PRIMARY', weight: 1.0 }],
    },
    {
      id: SEED_IDS.qListeningIDCard,
      type: QuestionType.LISTENING,
      prompt: 'What form of identification must the student present to collect their library card?',
      passage: null,
      options: ['A. Student identification card', 'B. Passport only', 'C. Course fee payment receipt', 'D. Recommendation letter'],
      correctAnswer: 'A. Student identification card',
      rubric: null,
      difficulty: Difficulty.EASY,
      level: CEFRLevel.B1,
      sourceMaterialId: SEED_IDS.matListeningCampus,
      usageCount: 1,
      skills: [{ skillId: SEED_IDS.skillListeningDetail, role: 'PRIMARY', weight: 1.0 }],
    },

    // 3. Speaking (2 Rubric questions tagged to chosen child skillSpeakingFluency)
    {
      id: SEED_IDS.qSpeakingEnvironmentalHabit,
      type: QuestionType.SPEAKING,
      prompt: 'Describe an environmental habit you would like people in your hometown to adopt. Explain how it would work and why it would help.',
      passage: null,
      options: null,
      correctAnswer: null,
      rubric: [
        { criteria: 'Fluency and Coherence', maxScore: 9, description: 'Sustains a clear, connected response.' },
        { criteria: 'Lexical Resource', maxScore: 9, description: 'Uses relevant environmental vocabulary.' },
        { criteria: 'Grammar and Pronunciation', maxScore: 9, description: 'Uses understandable, accurate spoken English.' },
      ],
      difficulty: Difficulty.MEDIUM,
      level: CEFRLevel.B1,
      sourceMaterialId: SEED_IDS.matSpeakingCards,
      usageCount: 1,
      skills: [{ skillId: SEED_IDS.skillSpeakingFluency, role: 'PRIMARY', weight: 1.0 }],
    },
    {
      id: SEED_IDS.qSpeakingCampusFacility,
      type: QuestionType.SPEAKING,
      prompt: 'Talk about a facility on your campus or in your city that promotes sustainable living. Explain why it is important.',
      passage: null,
      options: null,
      correctAnswer: null,
      rubric: [
        { criteria: 'Fluency and Coherence', maxScore: 9, description: 'Speaks fluently with clear progression and cohesive discourse.' },
        { criteria: 'Lexical Resource', maxScore: 9, description: 'Applies precise topic vocabulary.' },
        { criteria: 'Grammar and Pronunciation', maxScore: 9, description: 'Maintains grammatical control and clear pronunciation.' },
      ],
      difficulty: Difficulty.MEDIUM,
      level: CEFRLevel.B1,
      sourceMaterialId: SEED_IDS.matSpeakingCards,
      usageCount: 1,
      skills: [{ skillId: SEED_IDS.skillSpeakingFluency, role: 'PRIMARY', weight: 1.0 }],
    },

    // 4. Writing (2 Rubric questions tagged to chosen child skillWritingTaskResponse)
    {
      id: SEED_IDS.qWritingOpinionEssay,
      type: QuestionType.WRITING,
      prompt: 'Some people believe that governments should spend money on modern vertical farms, while others think traditional agriculture should receive more support. Discuss both views and give your opinion.',
      passage: null,
      options: null,
      correctAnswer: null,
      rubric: [
        { criteria: 'Task Achievement', maxScore: 9, description: 'Addresses all parts of the prompt with clear position' },
        { criteria: 'Coherence and Cohesion', maxScore: 9, description: 'Logically organizes ideas with cohesive devices' },
        { criteria: 'Lexical Resource', maxScore: 9, description: 'Uses wide range of environmental vocabulary accurately' },
        { criteria: 'Grammatical Range', maxScore: 9, description: 'Uses variety of complex sentence structures' },
      ],
      difficulty: Difficulty.HARD,
      level: CEFRLevel.B1,
      sourceMaterialId: SEED_IDS.matWritingWorkshop,
      usageCount: 1,
      skills: [
        { skillId: SEED_IDS.skillWritingTaskResponse, role: 'PRIMARY', weight: 1.0 },
      ],
    },
    {
      id: SEED_IDS.qWritingProblemSolution,
      type: QuestionType.WRITING,
      prompt: 'Cities face increasing challenges with food waste and energy consumption. Suggest practical measures that city authorities can implement to solve these issues.',
      passage: null,
      options: null,
      correctAnswer: null,
      rubric: [
        { criteria: 'Task Achievement', maxScore: 9, description: 'Presents relevant, well-developed solutions to the problems' },
        { criteria: 'Coherence and Cohesion', maxScore: 9, description: 'Sequences arguments logically with clear transitions' },
        { criteria: 'Lexical Resource', maxScore: 9, description: 'Demonstrates lexical accuracy and appropriate collocation' },
        { criteria: 'Grammatical Range', maxScore: 9, description: 'Employs complex syntactic structures accurately' },
      ],
      difficulty: Difficulty.HARD,
      level: CEFRLevel.B1,
      sourceMaterialId: SEED_IDS.matWritingWorkshop,
      usageCount: 1,
      skills: [
        { skillId: SEED_IDS.skillWritingTaskResponse, role: 'PRIMARY', weight: 1.0 },
      ],
    },
  ];

  for (const q of questionsData) {
    const { skills, ...qRow } = q;
    await db
      .insert(schema.questions)
      .values(qRow)
      .onConflictDoUpdate({
        target: schema.questions.id,
        set: {
          prompt: qRow.prompt,
          type: qRow.type,
          options: qRow.options,
          correctAnswer: qRow.correctAnswer,
          rubric: qRow.rubric,
          difficulty: qRow.difficulty,
          level: qRow.level,
          sourceMaterialId: qRow.sourceMaterialId,
        },
      });

    for (const sk of skills) {
      await db
        .insert(schema.questionSkills)
        .values({
          questionId: q.id,
          skillId: sk.skillId,
          role: sk.role,
          weight: sk.weight,
        })
        .onConflictDoUpdate({
          target: [schema.questionSkills.questionId, schema.questionSkills.skillId],
          set: { role: sk.role, weight: sk.weight },
        });
    }
  }

  // 8. Assessments & Assessment Items (10-minute four-skill integrated assessment)
  console.log('Seeding 10-minute integrated assessment...');
  await db
    .insert(schema.assessments)
    .values({
      id: SEED_IDS.assessmentIntegrated,
      title: 'IELTS 5.5-6.5 Integrated Skills Assessment',
      description: '10-minute four-skill integrated assessment evaluating Reading, Listening, Speaking, and Writing.',
      instructions: 'Complete all 10 concise questions across the four skills within the 10-minute time limit.',
      level: CEFRLevel.B1,
      status: AssessmentStatus.PUBLISHED,
      timeLimitMinutes: 10,
      createdBy: SEED_IDS.teacherTaylor,
    })
    .onConflictDoUpdate({
      target: schema.assessments.id,
      set: {
        title: 'IELTS 5.5-6.5 Integrated Skills Assessment',
        description: '10-minute four-skill integrated assessment evaluating Reading, Listening, Speaking, and Writing.',
        instructions: 'Complete all 10 concise questions across the four skills within the 10-minute time limit.',
        level: CEFRLevel.B1,
        status: AssessmentStatus.PUBLISHED,
        timeLimitMinutes: 10,
      },
    });

  const assessItems = [
    // 3 Reading MCQs
    { assessmentId: SEED_IDS.assessmentIntegrated, questionId: SEED_IDS.qMainIdeaUrbanFarming, sequenceOrder: 1, points: 1.0 },
    { assessmentId: SEED_IDS.assessmentIntegrated, questionId: SEED_IDS.qDetailUrbanFarming, sequenceOrder: 2, points: 1.0 },
    { assessmentId: SEED_IDS.assessmentIntegrated, questionId: SEED_IDS.qInferenceCityLife, sequenceOrder: 3, points: 1.0 },
    // 3 Listening MCQs
    { assessmentId: SEED_IDS.assessmentIntegrated, questionId: SEED_IDS.qListeningLibraryHours, sequenceOrder: 4, points: 1.0 },
    { assessmentId: SEED_IDS.assessmentIntegrated, questionId: SEED_IDS.qListeningBorrowLimit, sequenceOrder: 5, points: 1.0 },
    { assessmentId: SEED_IDS.assessmentIntegrated, questionId: SEED_IDS.qListeningIDCard, sequenceOrder: 6, points: 1.0 },
    // 2 Speaking rubric questions
    { assessmentId: SEED_IDS.assessmentIntegrated, questionId: SEED_IDS.qSpeakingEnvironmentalHabit, sequenceOrder: 7, points: 27.0 },
    { assessmentId: SEED_IDS.assessmentIntegrated, questionId: SEED_IDS.qSpeakingCampusFacility, sequenceOrder: 8, points: 27.0 },
    // 2 Writing rubric questions
    { assessmentId: SEED_IDS.assessmentIntegrated, questionId: SEED_IDS.qWritingOpinionEssay, sequenceOrder: 9, points: 36.0 },
    { assessmentId: SEED_IDS.assessmentIntegrated, questionId: SEED_IDS.qWritingProblemSolution, sequenceOrder: 10, points: 36.0 },
  ];

  for (const item of assessItems) {
    await db
      .insert(schema.assessmentItems)
      .values(item)
      .onConflictDoUpdate({
        target: [schema.assessmentItems.assessmentId, schema.assessmentItems.questionId],
        set: { sequenceOrder: item.sequenceOrder, points: item.points },
      });
  }

  // 9. Assignment & Submissions
  console.log('Seeding assignment and rehearsal submissions...');
  await db
    .insert(schema.assignments)
    .values({
      id: SEED_IDS.assignmentIntegrated,
      assessmentId: SEED_IDS.assessmentIntegrated,
      classId: SEED_IDS.classIeltsA,
      learnerId: null,
      status: 'OPEN',
    })
    .onConflictDoUpdate({
      target: schema.assignments.id,
      set: {
        assessmentId: SEED_IDS.assessmentIntegrated,
        classId: SEED_IDS.classIeltsA,
        status: 'OPEN',
      },
    });

  // Submission 1: Emma (EVALUATED)
  await db
    .insert(schema.submissions)
    .values({
      id: SEED_IDS.submissionEmmaIntegrated,
      assignmentId: SEED_IDS.assignmentIntegrated,
      assessmentId: SEED_IDS.assessmentIntegrated,
      learnerId: SEED_IDS.studentEmma,
      status: SubmissionStatus.EVALUATED,
      evaluatorId: SEED_IDS.teacherTaylor,
      evaluatorType: EvaluatorType.TEACHER,
      overallScore: 78,
      maxPossibleScore: 100,
      teacherFeedback: 'Solid performance across all four skills. Great reading accuracy and fluent oral responses.',
      actualStartedAt: new Date('2025-01-06T08:00:00.000Z'),
      submittedAt: new Date('2025-01-06T08:10:00.000Z'),
      evaluatedAt: new Date('2025-01-06T11:00:00.000Z'),
    })
    .onConflictDoUpdate({
      target: schema.submissions.id,
      set: {
        status: SubmissionStatus.EVALUATED,
        evaluatorId: SEED_IDS.teacherTaylor,
        evaluatorType: EvaluatorType.TEACHER,
        overallScore: 78,
        teacherFeedback: 'Solid performance across all four skills. Great reading accuracy and fluent oral responses.',
        evaluatedAt: new Date('2025-01-06T11:00:00.000Z'),
      },
    });

  const emmaResponses = [
    {
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      questionId: SEED_IDS.qMainIdeaUrbanFarming,
      responsePayload: 'B. Urban vertical farming offers sustainable advantages despite high initial setup costs.',
      isCorrect: true,
      rawScore: 1,
      normalizedScore: 1.0,
      rubricScores: null,
      teacherFeedback: null,
    },
    {
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      questionId: SEED_IDS.qDetailUrbanFarming,
      responsePayload: 'C. Up to 95 percent',
      isCorrect: true,
      rawScore: 1,
      normalizedScore: 1.0,
      rubricScores: null,
      teacherFeedback: null,
    },
    {
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      questionId: SEED_IDS.qInferenceCityLife,
      responsePayload: 'A. Climate-controlled indoor environments that operate independently of seasonal weather',
      isCorrect: true,
      rawScore: 1,
      normalizedScore: 1.0,
      rubricScores: null,
      teacherFeedback: null,
    },
    {
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      questionId: SEED_IDS.qListeningLibraryHours,
      responsePayload: 'B. From 8 a.m. to 8 p.m.',
      isCorrect: true,
      rawScore: 1,
      normalizedScore: 1.0,
      rubricScores: null,
      teacherFeedback: null,
    },
    {
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      questionId: SEED_IDS.qListeningBorrowLimit,
      responsePayload: 'B. Up to 10 books',
      isCorrect: true,
      rawScore: 1,
      normalizedScore: 1.0,
      rubricScores: null,
      teacherFeedback: null,
    },
    {
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      questionId: SEED_IDS.qListeningIDCard,
      responsePayload: 'A. Student identification card',
      isCorrect: true,
      rawScore: 1,
      normalizedScore: 1.0,
      rubricScores: null,
      teacherFeedback: null,
    },
    {
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      questionId: SEED_IDS.qSpeakingEnvironmentalHabit,
      responsePayload: { type: 'TEXT_TRANSCRIPT', transcript: 'I would like people in my hometown to carry reusable water bottles and utilize refill stations.' },
      isCorrect: true,
      rawScore: 20,
      normalizedScore: 20 / 27,
      teacherFeedback: 'Organized response with natural flow and relevant vocabulary.',
      rubricScores: [
        { criteria: 'Fluency and Coherence', score: 7, maxScore: 9 },
        { criteria: 'Lexical Resource', score: 7, maxScore: 9 },
        { criteria: 'Grammar and Pronunciation', score: 6, maxScore: 9 },
      ],
    },
    {
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      questionId: SEED_IDS.qSpeakingCampusFacility,
      responsePayload: { type: 'TEXT_TRANSCRIPT', transcript: 'Our campus recycling hub makes it easy for students to sort organic waste and compost on site.' },
      isCorrect: true,
      rawScore: 21,
      normalizedScore: 21 / 27,
      teacherFeedback: 'Clear articulation with good descriptive vocabulary.',
      rubricScores: [
        { criteria: 'Fluency and Coherence', score: 7, maxScore: 9 },
        { criteria: 'Lexical Resource', score: 7, maxScore: 9 },
        { criteria: 'Grammar and Pronunciation', score: 7, maxScore: 9 },
      ],
    },
    {
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      questionId: SEED_IDS.qWritingOpinionEssay,
      responsePayload: 'Modern vertical agriculture addresses food security and cuts emissions, yet traditional agriculture sustains rural livelihoods. Both approaches should receive targeted government funding.',
      isCorrect: true,
      rawScore: 28,
      normalizedScore: 28 / 36,
      teacherFeedback: 'Well structured essay with appropriate paragraphing and clear stance.',
      rubricScores: [
        { criteria: 'Task Achievement', score: 7, maxScore: 9 },
        { criteria: 'Coherence and Cohesion', score: 7, maxScore: 9 },
        { criteria: 'Lexical Resource', score: 7, maxScore: 9 },
        { criteria: 'Grammatical Range', score: 7, maxScore: 9 },
      ],
    },
    {
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      questionId: SEED_IDS.qWritingProblemSolution,
      responsePayload: 'Municipal governments should invest in community composting programs and enforce energy audits for commercial buildings to mitigate food waste and power loss.',
      isCorrect: true,
      rawScore: 28,
      normalizedScore: 28 / 36,
      teacherFeedback: 'Practical solutions presented with relevant supporting arguments.',
      rubricScores: [
        { criteria: 'Task Achievement', score: 7, maxScore: 9 },
        { criteria: 'Coherence and Cohesion', score: 7, maxScore: 9 },
        { criteria: 'Lexical Resource', score: 7, maxScore: 9 },
        { criteria: 'Grammatical Range', score: 7, maxScore: 9 },
      ],
    },
  ];

  for (const resp of emmaResponses) {
    await db
      .insert(schema.submissionResponses)
      .values(resp)
      .onConflictDoUpdate({
        target: [schema.submissionResponses.submissionId, schema.submissionResponses.questionId],
        set: {
          responsePayload: resp.responsePayload,
          isCorrect: resp.isCorrect,
          rawScore: resp.rawScore,
          normalizedScore: resp.normalizedScore,
          teacherFeedback: resp.teacherFeedback,
          rubricScores: resp.rubricScores,
        },
      });
  }

  // Submission 2: Liam (SUBMITTED - awaiting evaluation)
  await db
    .insert(schema.submissions)
    .values({
      id: SEED_IDS.submissionLiamIntegrated,
      assignmentId: SEED_IDS.assignmentIntegrated,
      assessmentId: SEED_IDS.assessmentIntegrated,
      learnerId: SEED_IDS.studentLiam,
      status: SubmissionStatus.SUBMITTED,
      evaluatorId: null,
      evaluatorType: EvaluatorType.TEACHER,
      overallScore: null,
      maxPossibleScore: 100,
      actualStartedAt: new Date(Date.now() - 3600000 * 3),
      submittedAt: new Date(Date.now() - 3600000 * 2),
      evaluatedAt: null,
    })
    .onConflictDoUpdate({
      target: schema.submissions.id,
      set: { status: SubmissionStatus.SUBMITTED },
    });

  const liamResponses = [
    {
      submissionId: SEED_IDS.submissionLiamIntegrated,
      questionId: SEED_IDS.qMainIdeaUrbanFarming,
      responsePayload: 'B. Urban vertical farming offers sustainable advantages despite high initial setup costs.',
      isCorrect: null,
      rawScore: null,
      normalizedScore: null,
    },
    {
      submissionId: SEED_IDS.submissionLiamIntegrated,
      questionId: SEED_IDS.qDetailUrbanFarming,
      responsePayload: 'C. Up to 95 percent',
      isCorrect: null,
      rawScore: null,
      normalizedScore: null,
    },
  ];

  for (const resp of liamResponses) {
    await db
      .insert(schema.submissionResponses)
      .values(resp)
      .onConflictDoUpdate({
        target: [schema.submissionResponses.submissionId, schema.submissionResponses.questionId],
        set: { responsePayload: resp.responsePayload },
      });
  }

  // Submission 3: Sofia (STARTED - in draft)
  await db
    .insert(schema.submissions)
    .values({
      id: SEED_IDS.submissionSofiaIntegrated,
      assignmentId: SEED_IDS.assignmentIntegrated,
      assessmentId: SEED_IDS.assessmentIntegrated,
      learnerId: SEED_IDS.studentSofia,
      status: SubmissionStatus.STARTED,
      evaluatorId: null,
      evaluatorType: EvaluatorType.AUTO,
      overallScore: null,
      maxPossibleScore: 100,
      actualStartedAt: new Date(Date.now() - 3600000 * 1),
      startedAt: new Date(Date.now() - 3600000 * 1),
      submittedAt: null,
      evaluatedAt: null,
    })
    .onConflictDoUpdate({
      target: schema.submissions.id,
      set: { status: SubmissionStatus.STARTED },
    });

  // 10. Learning Evidence (for Emma's evaluated submission across all 4 selected child subskills)
  console.log('Seeding learning evidence...');
  const evidenceRows = [
    {
      id: '11111111-2222-3333-4444-555555555501',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillReadingMainIdea,
      questionId: SEED_IDS.qMainIdeaUrbanFarming,
      assessmentId: SEED_IDS.assessmentIntegrated,
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      evidenceType: EvidenceType.QUESTION_RESULT,
      evaluatorType: EvaluatorType.AUTO,
      observedValue: 'Correct',
      normalizedScore: 1.0,
      difficulty: Difficulty.EASY,
      weight: 1.0,
      observedAt: new Date('2025-01-06T11:00:00.000Z'),
      sourceMaterialId: SEED_IDS.matUrbanFarming,
      isSuperseded: false,
    },
    {
      id: '11111111-2222-3333-4444-555555555502',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillReadingDetail,
      questionId: SEED_IDS.qDetailUrbanFarming,
      assessmentId: SEED_IDS.assessmentIntegrated,
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      evidenceType: EvidenceType.QUESTION_RESULT,
      evaluatorType: EvaluatorType.AUTO,
      observedValue: 'Correct',
      normalizedScore: 1.0,
      difficulty: Difficulty.EASY,
      weight: 1.0,
      observedAt: new Date('2025-01-06T11:01:00.000Z'),
      sourceMaterialId: SEED_IDS.matUrbanFarming,
      isSuperseded: false,
    },
    {
      id: '11111111-2222-3333-4444-555555555503',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillListeningDetail,
      questionId: SEED_IDS.qListeningLibraryHours,
      assessmentId: SEED_IDS.assessmentIntegrated,
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      evidenceType: EvidenceType.QUESTION_RESULT,
      evaluatorType: EvaluatorType.AUTO,
      observedValue: 'Correct',
      normalizedScore: 1.0,
      difficulty: Difficulty.EASY,
      weight: 1.0,
      observedAt: new Date('2025-01-06T11:02:00.000Z'),
      sourceMaterialId: SEED_IDS.matListeningCampus,
      isSuperseded: false,
    },
    {
      id: '11111111-2222-3333-4444-555555555504',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillWritingTaskResponse,
      questionId: SEED_IDS.qWritingOpinionEssay,
      assessmentId: SEED_IDS.assessmentIntegrated,
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      evidenceType: EvidenceType.QUESTION_RESULT,
      evaluatorType: EvaluatorType.TEACHER,
      observedValue: 'Teacher rubric: 28/36',
      normalizedScore: 28 / 36,
      difficulty: Difficulty.HARD,
      weight: 1.0,
      observedAt: new Date('2025-01-06T11:03:00.000Z'),
      sourceMaterialId: SEED_IDS.matWritingWorkshop,
      isSuperseded: false,
    },
    {
      id: '11111111-2222-3333-4444-555555555505',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillSpeakingFluency,
      questionId: SEED_IDS.qSpeakingEnvironmentalHabit,
      assessmentId: SEED_IDS.assessmentIntegrated,
      submissionId: SEED_IDS.submissionEmmaIntegrated,
      evidenceType: EvidenceType.QUESTION_RESULT,
      evaluatorType: EvaluatorType.TEACHER,
      observedValue: 'Teacher rubric: 20/27',
      normalizedScore: 20 / 27,
      difficulty: Difficulty.MEDIUM,
      weight: 1.0,
      observedAt: new Date('2025-01-06T11:04:00.000Z'),
      sourceMaterialId: SEED_IDS.matSpeakingCards,
      isSuperseded: false,
    },
  ];

  for (const ev of evidenceRows) {
    await db
      .insert(schema.learningEvidence)
      .values(ev)
      .onConflictDoUpdate({
        target: schema.learningEvidence.id,
        set: {
          learnerId: ev.learnerId,
          skillId: ev.skillId,
          questionId: ev.questionId,
          assessmentId: ev.assessmentId,
          submissionId: ev.submissionId,
          evidenceType: ev.evidenceType,
          evaluatorType: ev.evaluatorType,
          observedValue: ev.observedValue,
          normalizedScore: ev.normalizedScore,
          difficulty: ev.difficulty,
          weight: ev.weight,
          observedAt: ev.observedAt,
          sourceMaterialId: ev.sourceMaterialId,
          isSuperseded: false,
        },
      });
  }

  // 11. Learner Skill States
  console.log('Seeding learner skill states...');
  const skillStates = [
    {
      id: '22222222-3333-4444-5555-666666666701',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillReadingMainIdea,
      score: 1.0,
      confidence: ConfidenceLevel.LOW,
      evidenceCount: 1,
    },
    {
      id: '22222222-3333-4444-5555-666666666702',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillReadingDetail,
      score: 1.0,
      confidence: ConfidenceLevel.LOW,
      evidenceCount: 1,
    },
    {
      id: '22222222-3333-4444-5555-666666666703',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillListeningDetail,
      score: 1.0,
      confidence: ConfidenceLevel.LOW,
      evidenceCount: 1,
    },
    {
      id: '22222222-3333-4444-5555-666666666704',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillWritingTaskResponse,
      score: 28 / 36,
      confidence: ConfidenceLevel.LOW,
      evidenceCount: 1,
    },
    {
      id: '22222222-3333-4444-5555-666666666705',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillSpeakingFluency,
      score: 20 / 27,
      confidence: ConfidenceLevel.LOW,
      evidenceCount: 1,
    },
    {
      id: '22222222-3333-4444-5555-666666666706',
      learnerId: SEED_IDS.studentNoah,
      skillId: SEED_IDS.skillListeningDetail,
      score: 0,
      confidence: ConfidenceLevel.LOW,
      evidenceCount: 1,
    },
  ];

  for (const st of skillStates) {
    await db
      .insert(schema.learnerSkillStates)
      .values(st)
      .onConflictDoUpdate({
        target: [schema.learnerSkillStates.learnerId, schema.learnerSkillStates.skillId],
        set: { score: st.score, confidence: st.confidence, evidenceCount: st.evidenceCount },
      });
  }

  // 12. Recommendations & Candidates & Teacher Decisions
  console.log('Seeding recommendations and decisions...');
  // Recommendation 1: Pending (Emma - Reading Main Idea)
  await db
    .insert(schema.recommendations)
    .values({
      id: SEED_IDS.recEmmaReadingInference,
      learnerId: SEED_IDS.studentEmma,
      targetSkillId: SEED_IDS.skillReadingMainIdea,
      targetLevel: CEFRLevel.B1,
      priority: 'HIGH',
      recommendedActionText: 'Targeted Practice: Main Idea & Gist (B1)',
      rationale: [
        'Recent assessment indicates solid foundation in reading details.',
        'High accuracy on factual recall supports advancing to synthesized main idea questions.',
        'Structured practice on central argument identification reinforces academic reading readiness.',
      ],
      evidenceBasisCount: 2,
      learnerCurrentScore: 1.0,
      learnerConfidence: ConfidenceLevel.LOW,
      decisionStatus: TeacherDecisionStatus.PENDING,
    })
    .onConflictDoUpdate({
      target: schema.recommendations.id,
      set: {
        targetSkillId: SEED_IDS.skillReadingMainIdea,
        decisionStatus: TeacherDecisionStatus.PENDING,
      },
    });

  const candidatesData = [
    {
      recommendationId: SEED_IDS.recEmmaReadingInference,
      materialId: SEED_IDS.matUrbanFarming,
      action: RecommendationAction.REUSE,
      matchReason: 'Direct reading comprehension match from library with main idea focus.',
    },
    {
      recommendationId: SEED_IDS.recEmmaReadingInference,
      materialId: SEED_IDS.matSustainableCities,
      action: RecommendationAction.ADAPT,
      matchReason: 'Adapted variant with simpler sentence structures for focused reading practice.',
    },
  ];

  for (const cand of candidatesData) {
    await db
      .insert(schema.recommendationCandidates)
      .values(cand)
      .onConflictDoNothing();
  }

  // Recommendation 2: Accepted by Teacher Taylor for Speaking Fluency
  await db
    .insert(schema.recommendations)
    .values({
      id: SEED_IDS.recEmmaSpeakingPractice,
      learnerId: SEED_IDS.studentEmma,
      targetSkillId: SEED_IDS.skillSpeakingFluency,
      targetLevel: CEFRLevel.B1,
      priority: 'MEDIUM',
      recommendedActionText: 'Speaking Fluency Practice: Habit and Environment',
      rationale: [
        'Student demonstrates strong reading vocabulary that can be activated in oral responses.',
        'Oral practice with structured cue card prompts reinforces fluency and discourse linking.',
      ],
      evidenceBasisCount: 1,
      learnerCurrentScore: 20 / 27,
      learnerConfidence: ConfidenceLevel.MEDIUM,
      decisionStatus: TeacherDecisionStatus.ACCEPT,
    })
    .onConflictDoUpdate({
      target: schema.recommendations.id,
      set: {
        targetSkillId: SEED_IDS.skillSpeakingFluency,
        decisionStatus: TeacherDecisionStatus.ACCEPT,
      },
    });

  await db
    .insert(schema.recommendationCandidates)
    .values({
      recommendationId: SEED_IDS.recEmmaSpeakingPractice,
      materialId: SEED_IDS.matSpeakingCards,
      action: RecommendationAction.REUSE,
      matchReason: 'Standard cue card speaking prompt covering environmental themes.',
    })
    .onConflictDoNothing();

  await db
    .insert(schema.teacherDecisions)
    .values({
      id: 'dddddddd-dddd-dddd-dddd-dddddddddd01',
      recommendationId: SEED_IDS.recEmmaSpeakingPractice,
      decision: TeacherDecisionStatus.ACCEPT,
      teacherNotes: 'Approved speaking activity for next Tuesday class session.',
      selectedMaterialId: SEED_IDS.matSpeakingCards,
      decidedAt: new Date(Date.now() - 3600000 * 12),
      teacherId: SEED_IDS.teacherTaylor,
    })
    .onConflictDoNothing();

  // Recommendation 3: Noah (Listening Detail)
  await db
    .insert(schema.recommendations)
    .values({
      id: SEED_IDS.recNoahListeningDetail,
      learnerId: SEED_IDS.studentNoah,
      targetSkillId: SEED_IDS.skillListeningDetail,
      targetLevel: CEFRLevel.B1,
      priority: 'HIGH',
      recommendedActionText: 'Listening Detail Practice: Campus Library Orientation',
      rationale: [
        'The latest listening response missed an explicit opening-hours detail.',
        'A short replay and a second detail-focused question are appropriate before moving on.',
      ],
      evidenceBasisCount: 1,
      learnerCurrentScore: 0,
      learnerConfidence: ConfidenceLevel.LOW,
      decisionStatus: TeacherDecisionStatus.PENDING,
      isStale: false,
    })
    .onConflictDoUpdate({
      target: schema.recommendations.id,
      set: {
        targetSkillId: SEED_IDS.skillListeningDetail,
        decisionStatus: TeacherDecisionStatus.PENDING,
        isStale: false,
        evidenceBasisCount: 1,
        learnerCurrentScore: 0,
      },
    });

  await db
    .insert(schema.recommendationCandidates)
    .values({
      recommendationId: SEED_IDS.recNoahListeningDetail,
      materialId: SEED_IDS.matListeningCampus,
      action: RecommendationAction.REUSE,
      matchReason: 'The released listening material directly targets the missed library-hours detail.',
    })
    .onConflictDoNothing();

  // 13. Audit events
  console.log('Seeding initial audit events...');
  const auditReferenceTime = new Date('2025-01-08T09:00:00.000Z').getTime();
  const auditEventsData = [
    {
      actorId: SEED_IDS.adminUser,
      actorRole: UserRole.ADMIN,
      action: 'SYSTEM_INITIALIZED',
      entityType: 'SYSTEM',
      entityId: null,
      metadata: { environment: 'local-development', version: '1.0.0' },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 * 7),
    },
    {
      actorId: SEED_IDS.adminUser,
      actorRole: UserRole.ADMIN,
      action: 'COURSE_CREATED',
      entityType: 'COURSE',
      entityId: SEED_IDS.courseIelts,
      metadata: { code: 'IELTS_5_0', name: 'IELTS 5.0 Preparation' },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 * 6),
    },
    {
      actorId: SEED_IDS.adminUser,
      actorRole: UserRole.ADMIN,
      action: 'CLASS_CREATED',
      entityType: 'CLASS',
      entityId: SEED_IDS.classIeltsA,
      metadata: { name: 'IELTS 5.5-6.5 (Sat-Sun, 12:00-15:00)', teacherId: SEED_IDS.teacherTaylor },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 * 6 + 1000),
    },
    {
      actorId: SEED_IDS.adminUser,
      actorRole: UserRole.ADMIN,
      action: 'LEARNERS_ENROLLED',
      entityType: 'CLASS',
      entityId: SEED_IDS.classIeltsA,
      metadata: { enrolledCount: 10 },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 * 5),
    },
    {
      actorId: SEED_IDS.teacherTaylor,
      actorRole: UserRole.TEACHER,
      action: 'MATERIAL_CREATED',
      entityType: 'MATERIAL',
      entityId: SEED_IDS.matUrbanFarming,
      metadata: { title: 'Urban Farming and Vertical Agriculture', level: 'B1' },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 * 5 + 2000),
    },
    {
      actorId: SEED_IDS.teacherTaylor,
      actorRole: UserRole.TEACHER,
      action: 'MATERIAL_RELEASED',
      entityType: 'CLASS_MATERIAL',
      entityId: SEED_IDS.matUrbanFarming,
      metadata: { classId: SEED_IDS.classIeltsA },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 * 4),
    },
    {
      actorId: SEED_IDS.teacherTaylor,
      actorRole: UserRole.TEACHER,
      action: 'ASSESSMENT_CREATED',
      entityType: 'ASSESSMENT',
      entityId: SEED_IDS.assessmentIntegrated,
      metadata: { title: 'IELTS 5.5-6.5 Integrated Skills Assessment' },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 * 4 + 1000),
    },
    {
      actorId: SEED_IDS.teacherTaylor,
      actorRole: UserRole.TEACHER,
      action: 'ASSESSMENT_ASSIGNED',
      entityType: 'ASSIGNMENT',
      entityId: SEED_IDS.assignmentIntegrated,
      metadata: { classId: SEED_IDS.classIeltsA },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 * 3),
    },
    {
      actorId: SEED_IDS.studentEmma,
      actorRole: UserRole.STUDENT,
      action: 'SUBMISSION_STARTED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionEmmaIntegrated,
      metadata: { assessmentId: SEED_IDS.assessmentIntegrated },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 * 2),
    },
    {
      actorId: SEED_IDS.studentEmma,
      actorRole: UserRole.STUDENT,
      action: 'SUBMISSION_COMPLETED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionEmmaIntegrated,
      metadata: { timeSpentMinutes: 10 },
      timestamp: new Date(auditReferenceTime - 3600000 * 24),
    },
    {
      actorId: null,
      actorRole: 'SYSTEM',
      action: 'SUBMISSION_EVALUATED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionEmmaIntegrated,
      metadata: { score: 78, evaluatorType: 'TEACHER' },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 + 500),
    },
    {
      actorId: null,
      actorRole: 'SYSTEM',
      action: 'RECOMMENDATION_GENERATED',
      entityType: 'RECOMMENDATION',
      entityId: SEED_IDS.recEmmaReadingInference,
      metadata: { learnerId: SEED_IDS.studentEmma, skillId: SEED_IDS.skillReadingMainIdea },
      timestamp: new Date(auditReferenceTime - 3600000 * 23),
    },
    {
      actorId: SEED_IDS.studentLiam,
      actorRole: UserRole.STUDENT,
      action: 'SUBMISSION_STARTED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionLiamIntegrated,
      metadata: { assessmentId: SEED_IDS.assessmentIntegrated },
      timestamp: new Date(auditReferenceTime - 3600000 * 3),
    },
    {
      actorId: SEED_IDS.studentLiam,
      actorRole: UserRole.STUDENT,
      action: 'SUBMISSION_COMPLETED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionLiamIntegrated,
      metadata: { timeSpentMinutes: 9 },
      timestamp: new Date(auditReferenceTime - 3600000 * 2),
    },
    {
      actorId: SEED_IDS.studentSofia,
      actorRole: UserRole.STUDENT,
      action: 'SUBMISSION_STARTED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionSofiaIntegrated,
      metadata: { assessmentId: SEED_IDS.assessmentIntegrated },
      timestamp: new Date(auditReferenceTime - 3600000 * 1),
    },
    {
      actorId: SEED_IDS.teacherTaylor,
      actorRole: UserRole.TEACHER,
      action: 'TEACHER_DECISION_RECORDED',
      entityType: 'RECOMMENDATION',
      entityId: SEED_IDS.recEmmaSpeakingPractice,
      metadata: { decision: 'ACCEPTED', selectedMaterialId: SEED_IDS.matSpeakingCards },
      timestamp: new Date(auditReferenceTime - 3600000 * 12),
    },
    {
      actorId: SEED_IDS.adminUser,
      actorRole: UserRole.ADMIN,
      action: 'TAXONOMY_UPDATED',
      entityType: 'SKILL',
      entityId: SEED_IDS.skillReadingMainIdea,
      metadata: { change: 'verified description alignment' },
      timestamp: new Date(auditReferenceTime - 3600000 * 10),
    },
    {
      actorId: SEED_IDS.teacherTaylor,
      actorRole: UserRole.TEACHER,
      action: 'CLASS_UPDATED',
      entityType: 'CLASS',
      entityId: SEED_IDS.classIeltsA,
      metadata: { nextActivity: '10-Minute Integrated Assessment' },
      timestamp: new Date(auditReferenceTime - 3600000 * 5),
    },
  ];

  for (const [index, a] of auditEventsData.entries()) {
    await db
      .insert(schema.auditEvents)
      .values({
        id: `dddddddd-dddd-dddd-dddd-${String(index + 1).padStart(12, '0')}`,
        ...a,
      })
      .onConflictDoNothing();
  }

  console.log('Minimal IELTS seed completed successfully!');
}

// Run if called directly
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Database seed error:', err);
      await pool.end();
      process.exit(1);
    });
}
