import { db, pool } from './db.js';
import * as schema from './schema.js';
import { hashPassword } from '../auth/crypto.js';
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

  // Skills
  skillReading: '66666666-6666-6666-6666-666666666601',
  skillReadingMainIdea: '66666666-6666-6666-6666-666666666602',
  skillReadingDetail: '66666666-6666-6666-6666-666666666603',
  skillReadingInference: '66666666-6666-6666-6666-666666666604',
  skillReadingVocabContext: '66666666-6666-6666-6666-666666666605',
  skillListening: '66666666-6666-6666-6666-666666666606',
  skillSpeaking: '66666666-6666-6666-6666-666666666607',
  skillWriting: '66666666-6666-6666-6666-666666666608',
  skillGrammar: '66666666-6666-6666-6666-666666666609',
  skillVocabulary: '66666666-6666-6666-6666-666666666610',

  // Materials
  matUrbanFarming: '77777777-7777-7777-7777-777777777701',
  matSpeakingCards: '77777777-7777-7777-7777-777777777702',
  matSustainableCities: '77777777-7777-7777-7777-777777777707',
  matVocabClimate: '77777777-7777-7777-7777-777777777703',
  matListeningCampus: '77777777-7777-7777-7777-777777777705',
  matWritingWorkshop: '77777777-7777-7777-7777-777777777710',

  // Questions
  qInferenceCityLife: '88888888-8888-8888-8888-888888888801',
  qMainIdeaUrbanFarming: '88888888-8888-8888-8888-888888888802',
  qDetailUrbanFarming: '88888888-8888-8888-8888-888888888804',
  qWritingOpinionEssay: '88888888-8888-8888-8888-888888888805',
  qSpeakingEnvironmentalHabit: '88888888-8888-8888-8888-888888888806',
  qListeningLibraryHours: '88888888-8888-8888-8888-888888888807',

  // Assessment & Assignment
  assessmentReading03: '99999999-9999-9999-9999-999999999901',
  assessmentWriting01: '99999999-9999-9999-9999-999999999902',
  assessmentSpeaking01: '99999999-9999-9999-9999-999999999903',
  assessmentListening01: '99999999-9999-9999-9999-999999999904',
  assignmentReading03: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  assignmentWriting01: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  assignmentSpeaking01: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  assignmentListening01: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  submissionEmmaReading: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  submissionLiamReading: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
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

  // 2. Skills Taxonomy (hierarchical)
  console.log('Seeding skills taxonomy...');
  const skillsData = [
    { id: SEED_IDS.skillReading, code: 'READING', name: 'Reading Comprehension', area: SkillArea.READING, parentId: null, level: CEFRLevel.B1, description: 'Core reading comprehension skills' },
    { id: SEED_IDS.skillListening, code: 'LISTENING', name: 'Listening Comprehension', area: SkillArea.LISTENING, parentId: null, level: CEFRLevel.B1, description: 'Listening for main ideas and details' },
    { id: SEED_IDS.skillSpeaking, code: 'SPEAKING', name: 'Speaking & Fluency', area: SkillArea.SPEAKING, parentId: null, level: CEFRLevel.B1, description: 'Oral fluency and lexical resource' },
    { id: SEED_IDS.skillWriting, code: 'WRITING', name: 'Academic Writing', area: SkillArea.WRITING, parentId: null, level: CEFRLevel.B1, description: 'Essay coherence and task response' },
    { id: SEED_IDS.skillGrammar, code: 'GRAMMAR', name: 'Grammatical Range', area: SkillArea.GRAMMAR, parentId: null, level: CEFRLevel.B1, description: 'Clause structures and accuracy' },
    { id: SEED_IDS.skillVocabulary, code: 'VOCABULARY', name: 'Lexical Resource', area: SkillArea.VOCABULARY, parentId: null, level: CEFRLevel.B1, description: 'Topic-specific vocabulary and collocations' },
    { id: SEED_IDS.skillReadingMainIdea, code: 'READ_MAIN_IDEA', name: 'Main Idea & Gist', area: SkillArea.READING, parentId: SEED_IDS.skillReading, level: CEFRLevel.B1, description: 'Identify primary thesis and paragraph gist' },
    { id: SEED_IDS.skillReadingDetail, code: 'READ_DETAIL', name: 'Supporting Details', area: SkillArea.READING, parentId: SEED_IDS.skillReading, level: CEFRLevel.B1, description: 'Locate explicit factual details' },
    { id: SEED_IDS.skillReadingInference, code: 'READ_INFERENCE', name: 'Making Inferences', area: SkillArea.READING, parentId: SEED_IDS.skillReading, level: CEFRLevel.B1, description: 'Infer unstated meaning from context' },
    { id: SEED_IDS.skillReadingVocabContext, code: 'READ_VOCAB_CONTEXT', name: 'Vocabulary in Context', area: SkillArea.READING, parentId: SEED_IDS.skillReading, level: CEFRLevel.B1, description: 'Deduce word meaning from co-text' },
  ];

  for (const s of skillsData) {
    await db
      .insert(schema.skills)
      .values(s)
      .onConflictDoUpdate({
        target: schema.skills.id,
        // status is reset on purpose: seeding upserts rather than truncating, so
        // anything left out of this clause survives from the previous run.
        set: { name: s.name, code: s.code, parentId: s.parentId, status: 'ACTIVE' },
      });
  }

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

  // 4. Exactly 1 Class: IELTS Foundation A
  console.log('Seeding exactly 1 class...');
  await db
    .insert(schema.classes)
    .values({
      id: SEED_IDS.classIeltsA,
      courseId: SEED_IDS.courseIelts,
      name: 'IELTS 5.0 Foundation A',
      level: CEFRLevel.B1,
      teacherId: SEED_IDS.teacherTaylor,
      nextActivity: 'Reading: Urban Farming',
    })
    .onConflictDoUpdate({
      target: schema.classes.id,
      set: { name: 'IELTS 5.0 Foundation A', nextActivity: 'Reading: Urban Farming', teacherId: SEED_IDS.teacherTaylor },
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
  console.log('Seeding materials...');
  const materialsData = [
    {
      id: SEED_IDS.matUrbanFarming,
      title: 'Urban Farming and Vertical Agriculture',
      type: MaterialType.ARTICLE,
      primarySkillId: SEED_IDS.skillReading,
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
      primarySkillId: SEED_IDS.skillSpeaking,
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
      primarySkillId: SEED_IDS.skillReading,
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
      primarySkillId: SEED_IDS.skillVocabulary,
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
      primarySkillId: SEED_IDS.skillListening,
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
      primarySkillId: SEED_IDS.skillWriting,
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

  // Release materials to classIeltsA
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
    ])
    .onConflictDoNothing();

  // This is intentionally database metadata only. The full browser rehearsal
  // uploads a real MP3 into object storage; seed must not claim a nonexistent
  // object is playable.
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
      set: { fileName: 'campus-library-orientation.mp3', fileKey: 'demo-rehearsal/listening/campus-library-orientation.mp3', mimeType: 'audio/mpeg', fileSize: 0 },
    });

  // 7. Questions
  console.log('Seeding questions...');
  const questionsData = [
    {
      id: SEED_IDS.qInferenceCityLife,
      type: QuestionType.MCQ,
      prompt: 'What can be inferred about conventional outdoor farming compared to vertical farming from paragraph 1?',
      passage: 'Vertical farming uses stacked layers in controlled indoor environments to produce leafy greens with up to 95 percent less water than conventional outdoor methods.',
      options: [
        'A. It requires less initial capital investment than vertical farming.',
        'B. It consumes significantly more water and depends heavily on seasonal weather.',
        'C. It produces vegetables with higher nutritional content.',
        'D. It is no longer practiced in Asian countries.',
      ],
      correctAnswer: 'B. It consumes significantly more water and depends heavily on seasonal weather.',
      difficulty: Difficulty.MEDIUM,
      level: CEFRLevel.B1,
      sourceMaterialId: SEED_IDS.matUrbanFarming,
      usageCount: 3,
      skills: [
        { skillId: SEED_IDS.skillReadingInference, role: 'PRIMARY', weight: 1.0 },
        { skillId: SEED_IDS.skillReading, role: 'SECONDARY', weight: 0.5 },
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
        { skillId: SEED_IDS.skillReadingDetail, role: 'PRIMARY', weight: 1.0 },
      ],
    },
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
      sourceMaterialId: SEED_IDS.matUrbanFarming,
      usageCount: 1,
      skills: [
        { skillId: SEED_IDS.skillWriting, role: 'PRIMARY', weight: 1.0 },
      ],
    },
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
      skills: [{ skillId: SEED_IDS.skillSpeaking, role: 'PRIMARY', weight: 1.0 }],
    },
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
      skills: [{ skillId: SEED_IDS.skillListening, role: 'PRIMARY', weight: 1.0 }],
    },
  ];

  for (const q of questionsData) {
    const { skills, ...qRow } = q;
    await db
      .insert(schema.questions)
      .values(qRow)
      .onConflictDoUpdate({
        target: schema.questions.id,
        set: { prompt: qRow.prompt, correctAnswer: qRow.correctAnswer },
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
        .onConflictDoNothing();
    }
  }

  // 8. Assessments & Assessment Items
  console.log('Seeding assessments...');
  await db
    .insert(schema.assessments)
    .values({
      id: SEED_IDS.assessmentReading03,
      title: 'Reading Assessment 03 — Urban Innovation',
      description: 'Standard B1 reading quiz with MCQ items evaluating main idea, details, and inference.',
      instructions: 'Read the passage carefully and choose the best answer for each question.',
      level: CEFRLevel.B1,
      status: AssessmentStatus.PUBLISHED,
      timeLimitMinutes: 20,
      createdBy: SEED_IDS.teacherTaylor,
    })
    .onConflictDoUpdate({
      target: schema.assessments.id,
      set: { status: AssessmentStatus.PUBLISHED },
    });

  const assessItems = [
    { assessmentId: SEED_IDS.assessmentReading03, questionId: SEED_IDS.qMainIdeaUrbanFarming, sequenceOrder: 1, points: 1.0 },
    { assessmentId: SEED_IDS.assessmentReading03, questionId: SEED_IDS.qDetailUrbanFarming, sequenceOrder: 2, points: 1.0 },
    { assessmentId: SEED_IDS.assessmentReading03, questionId: SEED_IDS.qInferenceCityLife, sequenceOrder: 3, points: 1.0 },
    { assessmentId: SEED_IDS.assessmentWriting01, questionId: SEED_IDS.qWritingOpinionEssay, sequenceOrder: 1, points: 36.0 },
    { assessmentId: SEED_IDS.assessmentSpeaking01, questionId: SEED_IDS.qSpeakingEnvironmentalHabit, sequenceOrder: 1, points: 27.0 },
    { assessmentId: SEED_IDS.assessmentListening01, questionId: SEED_IDS.qListeningLibraryHours, sequenceOrder: 1, points: 1.0 },
  ];

  const fourSkillAssessments = [
    {
      id: SEED_IDS.assessmentWriting01,
      title: 'Writing Assessment 01 — Sustainable Food Systems',
      description: 'B1 opinion essay assessed by a teacher with the published rubric.',
      instructions: 'Write 180–220 words. Discuss both views and state your own position.',
      level: CEFRLevel.B1,
      status: AssessmentStatus.PUBLISHED,
      timeLimitMinutes: 35,
      createdBy: SEED_IDS.teacherTaylor,
    },
    {
      id: SEED_IDS.assessmentSpeaking01,
      title: 'Speaking Assessment 01 — Environmental Habits',
      description: 'B1 individual speaking response assessed by a teacher with the published rubric.',
      instructions: 'Prepare for one minute, then record a two-minute response.',
      level: CEFRLevel.B1,
      status: AssessmentStatus.PUBLISHED,
      timeLimitMinutes: 12,
      createdBy: SEED_IDS.teacherTaylor,
    },
    {
      id: SEED_IDS.assessmentListening01,
      title: 'Listening Assessment 01 — Campus Library Orientation',
      description: 'B1 listening comprehension check linked to an audio source material.',
      instructions: 'Listen to the recording and select the best answer.',
      level: CEFRLevel.B1,
      status: AssessmentStatus.PUBLISHED,
      timeLimitMinutes: 10,
      createdBy: SEED_IDS.teacherTaylor,
    },
  ];

  for (const assessment of fourSkillAssessments) {
    await db
      .insert(schema.assessments)
      .values(assessment)
      .onConflictDoUpdate({
        target: schema.assessments.id,
        set: { title: assessment.title, description: assessment.description, instructions: assessment.instructions, status: AssessmentStatus.PUBLISHED, timeLimitMinutes: assessment.timeLimitMinutes },
      });
  }

  for (const item of assessItems) {
    await db
      .insert(schema.assessmentItems)
      .values(item)
      .onConflictDoNothing();
  }

  // 9. Assignment & Submissions in meaningful states:
  // - Emma: EVALUATED (67%)
  // - Liam: SUBMITTED (pending teacher evaluation)
  // - Sofia: STARTED (in draft)
  console.log('Seeding assignments and submissions...');
  await db
    .insert(schema.assignments)
    .values({
      id: SEED_IDS.assignmentReading03,
      assessmentId: SEED_IDS.assessmentReading03,
      classId: SEED_IDS.classIeltsA,
      learnerId: null,
      status: 'OPEN',
    })
    .onConflictDoNothing();

  for (const assignment of [
    { id: SEED_IDS.assignmentWriting01, assessmentId: SEED_IDS.assessmentWriting01, classId: SEED_IDS.classIeltsA, learnerId: null, status: 'OPEN' },
    { id: SEED_IDS.assignmentSpeaking01, assessmentId: SEED_IDS.assessmentSpeaking01, classId: SEED_IDS.classIeltsA, learnerId: null, status: 'OPEN' },
    { id: SEED_IDS.assignmentListening01, assessmentId: SEED_IDS.assessmentListening01, classId: SEED_IDS.classIeltsA, learnerId: null, status: 'OPEN' },
  ]) {
    await db.insert(schema.assignments).values(assignment).onConflictDoNothing();
  }

  // Submission 1: Emma (EVALUATED)
  await db
    .insert(schema.submissions)
    .values({
      id: SEED_IDS.submissionEmmaReading,
      assignmentId: SEED_IDS.assignmentReading03,
      assessmentId: SEED_IDS.assessmentReading03,
      learnerId: SEED_IDS.studentEmma,
      status: SubmissionStatus.EVALUATED,
      evaluatorId: null,
      evaluatorType: EvaluatorType.AUTO,
      overallScore: 67,
      maxPossibleScore: 100,
      submittedAt: new Date(Date.now() - 3600000 * 24),
      evaluatedAt: new Date(Date.now() - 3600000 * 24),
    })
    .onConflictDoUpdate({
      target: schema.submissions.id,
      set: { status: SubmissionStatus.EVALUATED, overallScore: 67 },
    });

  const emmaResponses = [
    {
      submissionId: SEED_IDS.submissionEmmaReading,
      questionId: SEED_IDS.qMainIdeaUrbanFarming,
      responsePayload: 'B. Urban vertical farming offers sustainable advantages despite high initial setup costs.',
      isCorrect: true,
      rawScore: 1,
      normalizedScore: 1.0,
    },
    {
      submissionId: SEED_IDS.submissionEmmaReading,
      questionId: SEED_IDS.qDetailUrbanFarming,
      responsePayload: 'C. Up to 95 percent',
      isCorrect: true,
      rawScore: 1,
      normalizedScore: 1.0,
    },
    {
      submissionId: SEED_IDS.submissionEmmaReading,
      questionId: SEED_IDS.qInferenceCityLife,
      responsePayload: 'A. It requires less initial capital investment than vertical farming.',
      isCorrect: false,
      rawScore: 0,
      normalizedScore: 0.0,
    },
  ];

  for (const resp of emmaResponses) {
    await db
      .insert(schema.submissionResponses)
      .values(resp)
      .onConflictDoUpdate({
        target: [schema.submissionResponses.submissionId, schema.submissionResponses.questionId],
        set: { isCorrect: resp.isCorrect, normalizedScore: resp.normalizedScore },
      });
  }

  // Submission 2: Liam (SUBMITTED - awaiting evaluation)
  await db
    .insert(schema.submissions)
    .values({
      id: SEED_IDS.submissionLiamReading,
      assignmentId: SEED_IDS.assignmentReading03,
      assessmentId: SEED_IDS.assessmentReading03,
      learnerId: SEED_IDS.studentLiam,
      status: SubmissionStatus.SUBMITTED,
      evaluatorId: null,
      evaluatorType: EvaluatorType.AUTO,
      overallScore: null,
      maxPossibleScore: 100,
      submittedAt: new Date(Date.now() - 3600000 * 2),
      evaluatedAt: null,
    })
    .onConflictDoUpdate({
      target: schema.submissions.id,
      set: { status: SubmissionStatus.SUBMITTED },
    });

  const liamResponses = [
    {
      submissionId: SEED_IDS.submissionLiamReading,
      questionId: SEED_IDS.qMainIdeaUrbanFarming,
      responsePayload: 'B. Urban vertical farming offers sustainable advantages despite high initial setup costs.',
      isCorrect: null,
      rawScore: null,
      normalizedScore: null,
    },
    {
      submissionId: SEED_IDS.submissionLiamReading,
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
      id: SEED_IDS.submissionSofiaReading,
      assignmentId: SEED_IDS.assignmentReading03,
      assessmentId: SEED_IDS.assessmentReading03,
      learnerId: SEED_IDS.studentSofia,
      status: SubmissionStatus.STARTED,
      evaluatorId: null,
      evaluatorType: EvaluatorType.AUTO,
      overallScore: null,
      maxPossibleScore: 100,
      startedAt: new Date(Date.now() - 3600000 * 1),
      submittedAt: null,
      evaluatedAt: null,
    })
    .onConflictDoUpdate({
      target: schema.submissions.id,
      set: { status: SubmissionStatus.STARTED },
    });

  const fourSkillSubmissions = [
    {
      id: SEED_IDS.submissionEmmaWriting,
      assignmentId: SEED_IDS.assignmentWriting01,
      assessmentId: SEED_IDS.assessmentWriting01,
      learnerId: SEED_IDS.studentEmma,
      status: SubmissionStatus.EVALUATED,
      evaluatorId: SEED_IDS.teacherTaylor,
      evaluatorType: EvaluatorType.TEACHER,
      overallScore: 78,
      maxPossibleScore: 100,
      teacherFeedback: 'Clear position and organization. Develop the counterargument with one concrete example.',
      actualStartedAt: new Date('2025-01-06T08:00:00.000Z'),
      submittedAt: new Date('2025-01-06T08:28:00.000Z'),
      evaluatedAt: new Date('2025-01-06T11:00:00.000Z'),
    },
    {
      id: SEED_IDS.submissionLiamWriting,
      assignmentId: SEED_IDS.assignmentWriting01,
      assessmentId: SEED_IDS.assessmentWriting01,
      learnerId: SEED_IDS.studentLiam,
      status: SubmissionStatus.SUBMITTED,
      evaluatorId: null,
      evaluatorType: EvaluatorType.TEACHER,
      overallScore: null,
      maxPossibleScore: 100,
      teacherFeedback: null,
      actualStartedAt: new Date('2025-01-08T08:00:00.000Z'),
      submittedAt: new Date('2025-01-08T08:31:00.000Z'),
      evaluatedAt: null,
    },
    {
      id: SEED_IDS.submissionSofiaSpeaking,
      assignmentId: SEED_IDS.assignmentSpeaking01,
      assessmentId: SEED_IDS.assessmentSpeaking01,
      learnerId: SEED_IDS.studentSofia,
      status: SubmissionStatus.EVALUATED,
      evaluatorId: SEED_IDS.teacherTaylor,
      evaluatorType: EvaluatorType.TEACHER,
      overallScore: 74,
      maxPossibleScore: 100,
      teacherFeedback: 'Good fluency and topic vocabulary. Work on verb endings in longer sentences.',
      actualStartedAt: new Date('2025-01-06T13:00:00.000Z'),
      submittedAt: new Date('2025-01-06T13:09:00.000Z'),
      evaluatedAt: new Date('2025-01-06T15:00:00.000Z'),
    },
    {
      id: SEED_IDS.submissionNoahListening,
      assignmentId: SEED_IDS.assignmentListening01,
      assessmentId: SEED_IDS.assessmentListening01,
      learnerId: SEED_IDS.studentNoah,
      status: SubmissionStatus.EVALUATED,
      evaluatorId: null,
      evaluatorType: EvaluatorType.AUTO,
      overallScore: 0,
      maxPossibleScore: 100,
      teacherFeedback: null,
      actualStartedAt: new Date('2025-01-07T09:00:00.000Z'),
      submittedAt: new Date('2025-01-07T09:06:00.000Z'),
      evaluatedAt: new Date('2025-01-07T09:06:00.000Z'),
    },
    {
      id: SEED_IDS.submissionLucasListening,
      assignmentId: SEED_IDS.assignmentListening01,
      assessmentId: SEED_IDS.assessmentListening01,
      learnerId: SEED_IDS.studentLucas,
      status: SubmissionStatus.STARTED,
      evaluatorId: null,
      evaluatorType: EvaluatorType.AUTO,
      overallScore: null,
      maxPossibleScore: 100,
      teacherFeedback: null,
      actualStartedAt: new Date('2025-01-08T10:00:00.000Z'),
      submittedAt: null,
      evaluatedAt: null,
    },
  ];

  for (const submission of fourSkillSubmissions) {
    await db.insert(schema.submissions).values(submission).onConflictDoUpdate({
      target: schema.submissions.id,
      set: {
        status: submission.status,
        evaluatorId: submission.evaluatorId,
        evaluatorType: submission.evaluatorType,
        overallScore: submission.overallScore,
        teacherFeedback: submission.teacherFeedback,
        actualStartedAt: submission.actualStartedAt,
        submittedAt: submission.submittedAt,
        evaluatedAt: submission.evaluatedAt,
      },
    });
  }

  const fourSkillResponses = [
    {
      submissionId: SEED_IDS.submissionEmmaWriting,
      questionId: SEED_IDS.qWritingOpinionEssay,
      responsePayload: 'Governments should fund modern farms because they save water and reduce transport emissions. Traditional farms should still receive support because they protect rural jobs. In my view, cities need a balanced policy that funds efficient urban farms while helping traditional farmers adopt sustainable methods.',
      isCorrect: true,
      rawScore: 28,
      normalizedScore: 28 / 36,
      teacherFeedback: 'A coherent response with a clear view.',
      rubricScores: [
        { criteria: 'Task Achievement', score: 7, maxScore: 9 },
        { criteria: 'Coherence and Cohesion', score: 7, maxScore: 9 },
        { criteria: 'Lexical Resource', score: 7, maxScore: 9 },
        { criteria: 'Grammatical Range', score: 7, maxScore: 9 },
      ],
    },
    {
      submissionId: SEED_IDS.submissionLiamWriting,
      questionId: SEED_IDS.qWritingOpinionEssay,
      responsePayload: 'Modern vertical farms can be useful in crowded cities, but governments should also help traditional farmers because they provide food and employment for many communities.',
      isCorrect: null,
      rawScore: null,
      normalizedScore: null,
      teacherFeedback: null,
      rubricScores: null,
    },
    {
      submissionId: SEED_IDS.submissionSofiaSpeaking,
      questionId: SEED_IDS.qSpeakingEnvironmentalHabit,
      responsePayload: { type: 'TEXT_TRANSCRIPT', transcript: 'I would like people in my hometown to carry reusable bottles. Schools could provide water stations, and this would reduce plastic waste in public parks.' },
      isCorrect: true,
      rawScore: 20,
      normalizedScore: 20 / 27,
      teacherFeedback: 'Organized response with useful vocabulary.',
      rubricScores: [
        { criteria: 'Fluency and Coherence', score: 7, maxScore: 9 },
        { criteria: 'Lexical Resource', score: 7, maxScore: 9 },
        { criteria: 'Grammar and Pronunciation', score: 6, maxScore: 9 },
      ],
    },
    {
      submissionId: SEED_IDS.submissionNoahListening,
      questionId: SEED_IDS.qListeningLibraryHours,
      responsePayload: 'A. Only before 10 a.m.',
      isCorrect: false,
      rawScore: 0,
      normalizedScore: 0,
      teacherFeedback: 'Review the library-hours detail before the next attempt.',
      rubricScores: null,
    },
    {
      submissionId: SEED_IDS.submissionLucasListening,
      questionId: SEED_IDS.qListeningLibraryHours,
      responsePayload: 'B. From 8 a.m. to 8 p.m.',
      isCorrect: null,
      rawScore: null,
      normalizedScore: null,
      teacherFeedback: null,
      rubricScores: null,
    },
  ];

  for (const response of fourSkillResponses) {
    await db.insert(schema.submissionResponses).values(response).onConflictDoUpdate({
      target: [schema.submissionResponses.submissionId, schema.submissionResponses.questionId],
      set: {
        responsePayload: response.responsePayload,
        isCorrect: response.isCorrect,
        rawScore: response.rawScore,
        normalizedScore: response.normalizedScore,
        teacherFeedback: response.teacherFeedback,
        rubricScores: response.rubricScores,
      },
    });
  }

  // 10. Learning Evidence
  console.log('Seeding learning evidence...');
  const evidenceRows = [
    {
      id: '11111111-2222-3333-4444-555555555501',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillReadingMainIdea,
      questionId: SEED_IDS.qMainIdeaUrbanFarming,
      assessmentId: SEED_IDS.assessmentReading03,
      submissionId: SEED_IDS.submissionEmmaReading,
      evidenceType: EvidenceType.QUESTION_RESULT,
      evaluatorType: EvaluatorType.AUTO,
      observedValue: 'Correct',
      normalizedScore: 1.0,
      difficulty: Difficulty.EASY,
      weight: 1.0,
      observedAt: new Date(Date.now() - 3600000 * 24 * 5),
      sourceMaterialId: SEED_IDS.matUrbanFarming,
    },
    {
      id: '11111111-2222-3333-4444-555555555502',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillReadingDetail,
      questionId: SEED_IDS.qDetailUrbanFarming,
      assessmentId: SEED_IDS.assessmentReading03,
      submissionId: SEED_IDS.submissionEmmaReading,
      evidenceType: EvidenceType.QUESTION_RESULT,
      evaluatorType: EvaluatorType.AUTO,
      observedValue: 'Correct',
      normalizedScore: 1.0,
      difficulty: Difficulty.EASY,
      weight: 1.0,
      observedAt: new Date(Date.now() - 3600000 * 24 * 3),
      sourceMaterialId: SEED_IDS.matUrbanFarming,
    },
    {
      id: '11111111-2222-3333-4444-555555555503',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillReadingInference,
      questionId: SEED_IDS.qInferenceCityLife,
      assessmentId: SEED_IDS.assessmentReading03,
      submissionId: SEED_IDS.submissionEmmaReading,
      evidenceType: EvidenceType.QUESTION_RESULT,
      evaluatorType: EvaluatorType.AUTO,
      observedValue: 'Incorrect',
      normalizedScore: 0.0,
      difficulty: Difficulty.MEDIUM,
      weight: 1.0,
      observedAt: new Date(Date.now() - 3600000 * 24 * 1),
      sourceMaterialId: SEED_IDS.matUrbanFarming,
    },
    {
      id: '11111111-2222-3333-4444-555555555504',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillWriting,
      questionId: SEED_IDS.qWritingOpinionEssay,
      assessmentId: SEED_IDS.assessmentWriting01,
      submissionId: SEED_IDS.submissionEmmaWriting,
      evidenceType: EvidenceType.QUESTION_RESULT,
      evaluatorType: EvaluatorType.TEACHER,
      observedValue: 'Teacher rubric: 28/36',
      normalizedScore: 28 / 36,
      difficulty: Difficulty.HARD,
      weight: 1.0,
      observedAt: new Date('2025-01-06T11:00:00.000Z'),
      sourceMaterialId: SEED_IDS.matWritingWorkshop,
    },
    {
      id: '11111111-2222-3333-4444-555555555505',
      learnerId: SEED_IDS.studentSofia,
      skillId: SEED_IDS.skillSpeaking,
      questionId: SEED_IDS.qSpeakingEnvironmentalHabit,
      assessmentId: SEED_IDS.assessmentSpeaking01,
      submissionId: SEED_IDS.submissionSofiaSpeaking,
      evidenceType: EvidenceType.QUESTION_RESULT,
      evaluatorType: EvaluatorType.TEACHER,
      observedValue: 'Teacher rubric: 20/27',
      normalizedScore: 20 / 27,
      difficulty: Difficulty.MEDIUM,
      weight: 1.0,
      observedAt: new Date('2025-01-06T15:00:00.000Z'),
      sourceMaterialId: SEED_IDS.matSpeakingCards,
    },
    {
      id: '11111111-2222-3333-4444-555555555506',
      learnerId: SEED_IDS.studentNoah,
      skillId: SEED_IDS.skillListening,
      questionId: SEED_IDS.qListeningLibraryHours,
      assessmentId: SEED_IDS.assessmentListening01,
      submissionId: SEED_IDS.submissionNoahListening,
      evidenceType: EvidenceType.QUESTION_RESULT,
      evaluatorType: EvaluatorType.AUTO,
      observedValue: 'Incorrect listening answer',
      normalizedScore: 0,
      difficulty: Difficulty.EASY,
      weight: 1.0,
      observedAt: new Date('2025-01-07T09:06:00.000Z'),
      sourceMaterialId: SEED_IDS.matListeningCampus,
    },
  ];

  for (const ev of evidenceRows) {
    await db
      .insert(schema.learningEvidence)
      .values(ev)
      .onConflictDoNothing();
  }

  // 11. Learner Skill States
  console.log('Seeding learner skill states...');
  const skillStates = [
    {
      id: '22222222-3333-4444-5555-666666666601',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillReadingMainIdea,
      score: 1.0,
      confidence: ConfidenceLevel.LOW,
      evidenceCount: 1,
    },
    {
      id: '22222222-3333-4444-5555-666666666602',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillReadingDetail,
      score: 1.0,
      confidence: ConfidenceLevel.LOW,
      evidenceCount: 1,
    },
    {
      id: '22222222-3333-4444-5555-666666666603',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillReadingInference,
      score: 0.0,
      confidence: ConfidenceLevel.LOW,
      evidenceCount: 1,
    },
    {
      id: '22222222-3333-4444-5555-666666666604',
      learnerId: SEED_IDS.studentEmma,
      skillId: SEED_IDS.skillWriting,
      score: 28 / 36,
      confidence: ConfidenceLevel.LOW,
      evidenceCount: 1,
    },
    {
      id: '22222222-3333-4444-5555-666666666605',
      learnerId: SEED_IDS.studentSofia,
      skillId: SEED_IDS.skillSpeaking,
      score: 20 / 27,
      confidence: ConfidenceLevel.LOW,
      evidenceCount: 1,
    },
    {
      id: '22222222-3333-4444-5555-666666666606',
      learnerId: SEED_IDS.studentNoah,
      skillId: SEED_IDS.skillListening,
      score: 0,
      confidence: ConfidenceLevel.LOW,
      evidenceCount: 1,
    },
  ];

  for (const st of skillStates) {
    await db
      .insert(schema.learnerSkillStates).values(st)
      .onConflictDoUpdate({
        target: [schema.learnerSkillStates.learnerId, schema.learnerSkillStates.skillId],
        set: { score: st.score, confidence: st.confidence, evidenceCount: st.evidenceCount },
      });
  }

  // 12. Recommendations & Candidates & Teacher Decisions
  console.log('Seeding recommendations and decisions...');
  // Recommendation 1: Pending (Emma - Reading Inference)
  await db
    .insert(schema.recommendations)
    .values({
      id: SEED_IDS.recEmmaReadingInference,
      learnerId: SEED_IDS.studentEmma,
      targetSkillId: SEED_IDS.skillReadingInference,
      targetLevel: CEFRLevel.B1,
      priority: 'HIGH',
      recommendedActionText: 'Targeted Practice: Making Inferences (B1)',
      rationale: [
        'Recent assessment indicates inference score of 0% on medium-difficulty items.',
        'High accuracy (100%) on main idea and detail indicates good comprehension foundation.',
        'Structured practice on context-clue inferences will reinforce reading performance.',
      ],
      evidenceBasisCount: 3,
      learnerCurrentScore: 0.0,
      learnerConfidence: ConfidenceLevel.LOW,
      decisionStatus: TeacherDecisionStatus.PENDING,
    })
    .onConflictDoUpdate({
      target: schema.recommendations.id,
      set: { decisionStatus: TeacherDecisionStatus.PENDING },
    });

  const candidatesData = [
    {
      recommendationId: SEED_IDS.recEmmaReadingInference,
      materialId: SEED_IDS.matUrbanFarming,
      action: RecommendationAction.REUSE,
      matchReason: 'Direct reading comprehension match from library with inference focus questions.',
    },
    {
      recommendationId: SEED_IDS.recEmmaReadingInference,
      materialId: SEED_IDS.matSustainableCities,
      action: RecommendationAction.ADAPT,
      matchReason: 'Adapted variant with simpler sentence structures for focused context clues.',
    },
  ];

  for (const cand of candidatesData) {
    await db
      .insert(schema.recommendationCandidates)
      .values(cand)
      .onConflictDoNothing();
  }

  // Recommendation 2: Accepted by Teacher Taylor with a decision
  await db
    .insert(schema.recommendations)
    .values({
      id: SEED_IDS.recEmmaSpeakingPractice,
      learnerId: SEED_IDS.studentEmma,
      targetSkillId: SEED_IDS.skillSpeaking,
      targetLevel: CEFRLevel.B1,
      priority: 'MEDIUM',
      recommendedActionText: 'Speaking Fluency Practice: Habit and Environment',
      rationale: [
        'Student demonstrates strong reading vocabulary that can be activated in oral responses.',
        'Oral practice with structured cue card prompts reinforces vocabulary retention.',
      ],
      evidenceBasisCount: 2,
      learnerCurrentScore: 0.7,
      learnerConfidence: ConfidenceLevel.MEDIUM,
      decisionStatus: TeacherDecisionStatus.ACCEPT,
    })
    .onConflictDoUpdate({
      target: schema.recommendations.id,
      set: { decisionStatus: TeacherDecisionStatus.ACCEPT },
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

  await db
    .insert(schema.recommendations)
    .values({
      id: SEED_IDS.recNoahListeningDetail,
      learnerId: SEED_IDS.studentNoah,
      targetSkillId: SEED_IDS.skillListening,
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
      set: { decisionStatus: TeacherDecisionStatus.PENDING, isStale: false, evidenceBasisCount: 1, learnerCurrentScore: 0 },
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

  // 13. Audit events (18 diverse events across actors, actions, entities, dates)
  // IDs and timestamps are fixed so rerunning the seed is idempotent.
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
      metadata: { name: 'IELTS 5.0 Foundation A', teacherId: SEED_IDS.teacherTaylor },
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
      entityId: SEED_IDS.assessmentReading03,
      metadata: { title: 'Reading Assessment 03 — Urban Innovation' },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 * 4 + 1000),
    },
    {
      actorId: SEED_IDS.teacherTaylor,
      actorRole: UserRole.TEACHER,
      action: 'ASSESSMENT_ASSIGNED',
      entityType: 'ASSIGNMENT',
      entityId: SEED_IDS.assignmentReading03,
      metadata: { classId: SEED_IDS.classIeltsA },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 * 3),
    },
    {
      actorId: SEED_IDS.studentEmma,
      actorRole: UserRole.STUDENT,
      action: 'SUBMISSION_STARTED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionEmmaReading,
      metadata: { assessmentId: SEED_IDS.assessmentReading03 },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 * 2),
    },
    {
      actorId: SEED_IDS.studentEmma,
      actorRole: UserRole.STUDENT,
      action: 'SUBMISSION_COMPLETED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionEmmaReading,
      metadata: { timeSpentMinutes: 14 },
      timestamp: new Date(auditReferenceTime - 3600000 * 24),
    },
    {
      actorId: null,
      actorRole: 'SYSTEM',
      action: 'SUBMISSION_EVALUATED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionEmmaReading,
      metadata: { score: 67, evaluatorType: 'AUTO' },
      timestamp: new Date(auditReferenceTime - 3600000 * 24 + 500),
    },
    {
      actorId: null,
      actorRole: 'SYSTEM',
      action: 'RECOMMENDATION_GENERATED',
      entityType: 'RECOMMENDATION',
      entityId: SEED_IDS.recEmmaReadingInference,
      metadata: { learnerId: SEED_IDS.studentEmma, skillId: SEED_IDS.skillReadingInference },
      timestamp: new Date(auditReferenceTime - 3600000 * 23),
    },
    {
      actorId: SEED_IDS.studentLiam,
      actorRole: UserRole.STUDENT,
      action: 'SUBMISSION_STARTED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionLiamReading,
      metadata: { assessmentId: SEED_IDS.assessmentReading03 },
      timestamp: new Date(auditReferenceTime - 3600000 * 3),
    },
    {
      actorId: SEED_IDS.studentLiam,
      actorRole: UserRole.STUDENT,
      action: 'SUBMISSION_COMPLETED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionLiamReading,
      metadata: { timeSpentMinutes: 18 },
      timestamp: new Date(auditReferenceTime - 3600000 * 2),
    },
    {
      actorId: SEED_IDS.studentSofia,
      actorRole: UserRole.STUDENT,
      action: 'SUBMISSION_STARTED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionSofiaReading,
      metadata: { assessmentId: SEED_IDS.assessmentReading03 },
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
      entityId: SEED_IDS.skillReadingInference,
      metadata: { change: 'verified description alignment' },
      timestamp: new Date(auditReferenceTime - 3600000 * 10),
    },
    {
      actorId: SEED_IDS.teacherTaylor,
      actorRole: UserRole.TEACHER,
      action: 'CLASS_UPDATED',
      entityType: 'CLASS',
      entityId: SEED_IDS.classIeltsA,
      metadata: { nextActivity: 'Reading: Urban Farming' },
      timestamp: new Date(auditReferenceTime - 3600000 * 5),
    },
    {
      actorId: SEED_IDS.teacherTaylor,
      actorRole: UserRole.TEACHER,
      action: 'ASSESSMENT_ASSIGNED',
      entityType: 'ASSIGNMENT',
      entityId: SEED_IDS.assignmentWriting01,
      metadata: { classId: SEED_IDS.classIeltsA, skill: 'WRITING' },
      timestamp: new Date('2025-01-05T09:00:00.000Z'),
    },
    {
      actorId: SEED_IDS.studentEmma,
      actorRole: UserRole.STUDENT,
      action: 'SUBMISSION_EVALUATED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionEmmaWriting,
      metadata: { skill: 'WRITING', score: 78, evaluatorType: 'TEACHER' },
      timestamp: new Date('2025-01-06T11:00:00.000Z'),
    },
    {
      actorId: SEED_IDS.teacherTaylor,
      actorRole: UserRole.TEACHER,
      action: 'SUBMISSION_EVALUATED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionSofiaSpeaking,
      metadata: { skill: 'SPEAKING', score: 74, evaluatorType: 'TEACHER' },
      timestamp: new Date('2025-01-06T15:00:00.000Z'),
    },
    {
      actorId: null,
      actorRole: 'SYSTEM',
      action: 'SUBMISSION_EVALUATED',
      entityType: 'SUBMISSION',
      entityId: SEED_IDS.submissionNoahListening,
      metadata: { skill: 'LISTENING', score: 0, evaluatorType: 'AUTO' },
      timestamp: new Date('2025-01-07T09:06:00.000Z'),
    },
    {
      actorId: null,
      actorRole: 'SYSTEM',
      action: 'RECOMMENDATION_GENERATED',
      entityType: 'RECOMMENDATION',
      entityId: SEED_IDS.recNoahListeningDetail,
      metadata: { learnerId: SEED_IDS.studentNoah, skillId: SEED_IDS.skillListening },
      timestamp: new Date('2025-01-07T09:07:00.000Z'),
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
