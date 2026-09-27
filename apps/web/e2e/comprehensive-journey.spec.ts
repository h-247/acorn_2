import { test, expect, type Locator } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

async function expectAudioToDecodeAndPlay(audio: Locator) {
  await audio.evaluate(async (element: HTMLAudioElement) => {
    element.muted = true;
    element.load();

    await new Promise<void>((resolve, reject) => {
      if (element.readyState >= HTMLMediaElement.HAVE_METADATA && Number.isFinite(element.duration) && element.duration > 0) {
        resolve();
        return;
      }

      const timeout = window.setTimeout(() => reject(new Error('Timed out waiting for audio metadata')), 15_000);
      element.addEventListener('loadedmetadata', () => {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
      element.addEventListener('error', () => {
        window.clearTimeout(timeout);
        reject(new Error(element.error?.message || 'Audio failed to decode'));
      }, { once: true });
    });

    if (!Number.isFinite(element.duration) || element.duration <= 0) {
      throw new Error(`Invalid decoded audio duration: ${element.duration}`);
    }
    await element.play();
  });

  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime), {
    timeout: 10_000,
    message: 'audio playback time should advance',
  }).toBeGreaterThan(0);

  await audio.evaluate((element: HTMLAudioElement) => element.pause());
}

test.describe('Comprehensive Multi-Skill Journey (Reading, Writing, Speaking, Listening)', () => {
  test('Admin → Teacher → Student → Teacher journey across 4 skills', async ({ request, page }) => {
    test.setTimeout(120_000);

    // ─── 1. ADMIN API SETUP ───────────────────────────────────────────────────
    const loginRes = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/identity/login`, {
      data: { email: 'admin@acorn.edu', password: 'admin123' },
    });
    expect(loginRes.status()).toBe(200);
    const adminToken = decodeURIComponent(
      (loginRes.headers()['set-cookie'] || '').match(/acorn_token=([^;]+)/)?.[1] || ''
    );
    const adminH = { Authorization: `Bearer ${adminToken}` };

    const skillsRes = await request.get(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/taxonomy/skills`, { headers: adminH });
    expect(skillsRes.status()).toBe(200);
    const skills = await skillsRes.json();
    const readingSkill  = skills.find((s: any) => s.area === 'READING')  ?? skills[0];
    const writingSkill  = skills.find((s: any) => s.area === 'WRITING')  ?? skills[1];
    const speakingSkill = skills.find((s: any) => s.area === 'SPEAKING') ?? skills[2];
    const listeningSkill= skills.find((s: any) => s.area === 'LISTENING')?? skills[3];

    // Create a material for LISTENING with audio
    const mListenRes = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/materials`, {
      headers: adminH,
      data: { title: 'Listening Material', type: 'ARTICLE', primarySkillId: listeningSkill.id, level: 'B1', content: 'Listen to this.', estimatedMinutes: 10, source: 'Internal' },
    });
    const listenMatId = (await mListenRes.json()).id;

    // Use valid audio fixture
    const fixtureAudioPath = path.join(__dirname, 'fixtures', 'test-audio.mp3');
    if (!fs.existsSync(fixtureAudioPath)) {
      throw new Error(`Audio fixture missing: ${fixtureAudioPath}.`);
    }

    const audioBuffer = fs.readFileSync(fixtureAudioPath);
    const multipartFile = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/materials/${listenMatId}/files`, {
      headers: adminH,
      multipart: {
        file: {
          name: 'listening.mp3',
          mimeType: 'audio/mpeg',
          buffer: audioBuffer,
        }
      }
    });
    expect(multipartFile.status()).toBe(201);

    // Create candidate material for recommendation
    const recMatRes = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/materials`, {
      headers: adminH,
      data: { title: 'Extra Practice Material', type: 'ARTICLE', primarySkillId: readingSkill.id, level: 'B1', content: 'Practice makes perfect.', estimatedMinutes: 15, source: 'Internal' },
    });
    const recMatId = (await recMatRes.json()).id;

    // Approve recMat so it can be assigned (assign-next-activity requires APPROVED status)
    await request.put(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/materials/${recMatId}`, {
      headers: adminH,
      data: { status: 'APPROVED' },
    });

    // Approve listenMatId so it can be released
    await request.put(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/materials/${listenMatId}`, {
      headers: adminH,
      data: { status: 'APPROVED' },
    });

    // Release both to class
    const clRes = await request.get(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/classes`, { headers: adminH });
    expect(clRes.status()).toBe(200);
    const classId = (await clRes.json())[0].id as string;

    const releaseRes = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/materials/${listenMatId}/release`, { headers: adminH, data: { classId } });
    expect(releaseRes.status()).toBe(201);
    // recMatId is NOT released to the class. It will be assigned individually later.

    const createQ = async (data: any) => {
      const r = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/assessments/questions`, { headers: adminH, data });
      expect(r.status()).toBe(201);
      return (await r.json()).id as string;
    };

    const qReadId    = await createQ({ type: 'MCQ',      prompt: 'What is the main idea?',  difficulty: 'MEDIUM', level: 'B1', skills: [{ skillId: readingSkill.id,   role: 'PRIMARY' }], options: ['A', 'B'], correctAnswer: 'A' });
    const qWriteId   = await createQ({ type: 'WRITING',  prompt: 'Write a short essay.',     difficulty: 'MEDIUM', level: 'B1', skills: [{ skillId: writingSkill.id,   role: 'PRIMARY' }], rubric: [{ criteria: 'Content', maxScore: 10 }] });
    const qSpeakId   = await createQ({ type: 'SPEAKING', prompt: 'Describe the picture.',    difficulty: 'MEDIUM', level: 'B1', skills: [{ skillId: speakingSkill.id,  role: 'PRIMARY' }], rubric: [{ criteria: 'Fluency', maxScore: 10 }] });
    const qListenId  = await createQ({ type: 'LISTENING',prompt: 'Did you hear a question?', difficulty: 'MEDIUM', level: 'B1', skills: [{ skillId: listeningSkill.id, role: 'PRIMARY' }], options: ['Yes', 'No'], correctAnswer: 'Yes', sourceMaterialId: listenMatId });
    const qListenBadId = await createQ({ type: 'LISTENING',prompt: 'Missing audio question?', difficulty: 'MEDIUM', level: 'B1', skills: [{ skillId: listeningSkill.id, role: 'PRIMARY' }], options: ['Yes', 'No'], correctAnswer: 'Yes', sourceMaterialId: recMatId });

    // Negative test for publish validation (missing audio)
    const badARes = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/assessments`, {
      headers: adminH,
      data: { title: 'Bad Assessment', level: 'B1', questionIds: [qListenBadId] },
    });
    const badAId = (await badARes.json()).id;
    const badReadyRes = await request.put(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/assessments/${badAId}/ready`, { headers: adminH });
    expect(badReadyRes.status()).toBe(400);

    const aRes = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/assessments`, {
      headers: adminH,
      data: { title: '4-Skill E2E Assessment', level: 'B1', questionIds: [qReadId, qWriteId, qSpeakId, qListenId] },
    });
    expect(aRes.status()).toBe(201);
    const aId = (await aRes.json()).id as string;

    const readyRes = await request.put(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/assessments/${aId}/ready`, { headers: adminH });
    expect(readyRes.status()).toBe(200);
    const pubRes = await request.put(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/assessments/${aId}/publish`, { headers: adminH });
    expect(pubRes.status()).toBe(200);

    const assignRes = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/assessments/${aId}/assign`, {
      headers: adminH, data: { classId },
    });
    expect(assignRes.status()).toBe(201);

    // Get Emma's ID
    const studentLoginRes = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/identity/login`, {
      data: { email: 'emma.nguyen@student.acorn.edu', password: 'password123' },
    });
    const studentInfo = await studentLoginRes.json();
    const emmaId = studentInfo.user?.id ?? studentInfo.id;
    const studentToken = decodeURIComponent(
      (studentLoginRes.headers()['set-cookie'] || '').match(/acorn_token=([^;]+)/)?.[1] || ''
    );
    const studentH = { Authorization: `Bearer ${studentToken}` };

    // Get the submission ID created for Emma
    const subsRes = await request.get(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/submissions`, { headers: studentH });
    const subs = await subsRes.json();
    const sub = subs.find((s: any) => s.assessmentId === aId);
    const subId = sub.id;

    // ─── 2. STUDENT — browser journey ────────────────────────────────────────
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'emma.nguyen@student.acorn.edu');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://127.0.0.1:3000/student');

    // Verify candidate material is NOT visible before assignment
    await page.goto('/student/materials');
    await expect(page.getByText('Extra Practice Material')).not.toBeVisible();

    // Go to Assessment Player
    await page.goto(`/student/assessments/${subId}`);

    // Start attempt
    await page.click('text=Start Attempt');

    // Question 1: Reading MCQ
    await expect(page.getByText('What is the main idea?')).toBeVisible();
    const readingAnswer = page.getByTestId('answer-option-0');
    await readingAnswer.click();
    await expect(readingAnswer).toHaveAttribute('aria-disabled', 'false');
    await page.waitForSelector('text=Answers autosaved');
    await page.getByRole('button', { name: 'Next ›' }).click();

    // Question 2: Writing
    await expect(page.getByText('Write a short essay.')).toBeVisible();
    await page.fill('textarea[placeholder="Compose your structured multi-paragraph essay or response here..."]', 'This is my essay response.');
    await page.waitForSelector('text=Answers autosaved');

    // Test autosave resume (reload page and see if text is still there)
    await page.reload();
    await expect(page.getByText('What is the main idea?')).toBeVisible(); // First question loads
    await page.getByRole('button', { name: 'Next ›' }).click(); // Go to second question

    await expect(page.getByText('Write a short essay.')).toBeVisible();
    await expect(page.locator('textarea[placeholder="Compose your structured multi-paragraph essay or response here..."]')).toHaveValue('This is my essay response.');
    await page.getByRole('button', { name: 'Next ›' }).click();

    // Question 3: Speaking
    await expect(page.getByText('Describe the picture.')).toBeVisible();
    // Upload valid audio fixture instead of recording
    await page.setInputFiles('input[type="file"][accept="audio/*"]', fixtureAudioPath);
    await page.waitForSelector('text=Audio file uploaded and saved');
    await page.getByRole('button', { name: 'Next ›' }).click();

    // Question 4: Listening (valid audio)
    const listeningQuestion = page.locator('div').filter({ hasText: 'Did you hear a question?' }).last();
    await expect(listeningQuestion).toBeVisible();

    // Wait for the authorized Listening audio and prove that Chromium decodes and plays it.
    const listeningAudio = page.locator('div').filter({ hasText: 'Listening Audio Track' }).first().locator('audio');
    await expect(listeningAudio).toBeAttached({ timeout: 15000 });
    const audioSrc = await listeningAudio.locator('source').getAttribute('src');
    expect(audioSrc).toContain('X-Amz-'); // Should be a signed URL

    await expectAudioToDecodeAndPlay(listeningAudio);

    const listeningAnswer = listeningQuestion.getByTestId('answer-option-0');
    await listeningAnswer.click();
    await expect(listeningAnswer).toHaveAttribute('aria-disabled', 'false');
    await page.waitForSelector('text=Answers autosaved');

    // Submit
    await page.getByRole('button', { name: 'Submit assessment' }).click();
    await expect(page.getByText('Ready to submit your assessment?')).toBeVisible();
    await page.getByRole('button', { name: 'Yes, Submit Now' }).click();

    // Should be redirected to /student
    await expect(page).toHaveURL('http://127.0.0.1:3000/student');

    // Verify owner student can access the audio playback URL via API
    const ownerAudioRes = await request.get(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/submissions/${subId}/audio/${qSpeakId}`, { headers: studentH });
    expect(ownerAudioRes.status()).toBe(200);

    // Verify another student cannot access it
    const otherStudentLoginRes = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/identity/login`, {
      data: { email: 'lucas.kim@student.acorn.edu', password: 'password123' },
    });
    const otherStudentToken = decodeURIComponent((otherStudentLoginRes.headers()['set-cookie'] || '').match(/acorn_token=([^;]+)/)?.[1] || '');
    const otherStudentH = { Authorization: `Bearer ${otherStudentToken}` };
    const otherAudioRes = await request.get(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/submissions/${subId}/audio/${qSpeakId}`, { headers: otherStudentH });
    expect(otherAudioRes.status()).toBe(403);

    // Verify a teacher who does not own the class cannot access the recording.
    const unrelatedTeacherEmail = 'unrelated.teacher@acorn.edu';
    const createTeacherRes = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/identity/users`, {
      headers: adminH,
      data: { email: unrelatedTeacherEmail, name: 'Unrelated Teacher', password: 'password123', role: 'TEACHER' },
    });
    expect(createTeacherRes.status()).toBe(201);
    const unrelatedLoginRes = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/identity/login`, {
      data: { email: unrelatedTeacherEmail, password: 'password123' },
    });
    expect(unrelatedLoginRes.status()).toBe(200);
    const unrelatedTeacherToken = decodeURIComponent((unrelatedLoginRes.headers()['set-cookie'] || '').match(/acorn_token=([^;]+)/)?.[1] || '');
    const unrelatedTeacherAudioRes = await request.get(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/submissions/${subId}/audio/${qSpeakId}`, {
      headers: { Authorization: `Bearer ${unrelatedTeacherToken}` },
    });
    expect(unrelatedTeacherAudioRes.status()).toBe(403);

    // ─── 3. TEACHER — evaluate via UI ──────────────────────────────────────
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'taylor@acorn.edu');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Verify authorized teacher can access it via API
    const teacherTokenCookie = await page.context().cookies();
    const teacherToken = teacherTokenCookie.find((c) => c.name === 'acorn_token')?.value;
    const teacherAudioRes = await request.get(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/submissions/${subId}/audio/${qSpeakId}`, { headers: { Authorization: `Bearer ${teacherToken}` } });
    expect(teacherAudioRes.status()).toBe(200);

    await page.goto(`/submissions/${subId}/review`);
    await expect(page.getByRole('heading', { name: 'Submission Review & Grading', level: 1 })).toBeVisible();

    // Teacher can decode and play the student's persisted recording.
    const teacherSpeakAudio = page.locator('audio').first();
    await expect(teacherSpeakAudio).toBeAttached({ timeout: 15000 });
    await expect(teacherSpeakAudio).toHaveAttribute('src', /http/);
    await expectAudioToDecodeAndPlay(teacherSpeakAudio);

    // Writing Rubric grading (Slider input for Content)
    // Find the slider for 'Content' and set it to 8
    const writeSection = page.locator('div').filter({ hasText: 'Write a short essay.' });
    await writeSection.locator('input[type="range"]').nth(0).fill('8');

    // Speaking Rubric grading (Slider input for Fluency)
    const speakSection = page.locator('div').filter({ hasText: 'Describe the picture.' });
    await speakSection.locator('input[type="range"]').nth(0).fill('7');

    await page.getByRole('button', { name: 'Finalize evaluation ›' }).click();
    await expect(page.getByText(/^Evaluated$/i).first()).toBeVisible({ timeout: 15000 });

    // ─── 4. ASSERT EVIDENCE ────────────────────────────────────────────────
    const evRes = await request.get(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/evidence?learnerId=${emmaId}`, { headers: adminH });
    expect(evRes.status()).toBe(200);
    const allEvidence = await evRes.json();
    const subEvidence = allEvidence.filter((e: any) => e.submissionId === subId);

    // Should have 1 evidence per valid answered question (at least 4)
    // Check no duplicate effective evidence (unique by questionId for this submission)
    const uniqueQuestions = new Set(subEvidence.map((e: any) => e.questionId));
    expect(uniqueQuestions.size).toBe(subEvidence.length);

    // Reading evidence
    const readEv = subEvidence.find((e: any) => e.questionId === qReadId);
    expect(readEv).toBeDefined();
    expect(readEv.skillId).toBe(readingSkill.id);
    expect(readEv.assessmentId).toBe(aId);
    expect(readEv.evaluatorType).toBe('TEACHER'); // Teacher finalized

    // Writing evidence
    const writeEv = subEvidence.find((e: any) => e.questionId === qWriteId);
    expect(writeEv).toBeDefined();
    expect(writeEv.skillId).toBe(writingSkill.id);
    expect(writeEv.assessmentId).toBe(aId);
    expect(writeEv.evaluatorType).toBe('TEACHER');
    expect(typeof writeEv.normalizedScore).toBe('number');

    // Speaking evidence
    const speakEv = subEvidence.find((e: any) => e.questionId === qSpeakId);
    expect(speakEv).toBeDefined();
    expect(speakEv.skillId).toBe(speakingSkill.id);
    expect(speakEv.assessmentId).toBe(aId);
    expect(speakEv.evaluatorType).toBe('TEACHER');

    // Listening evidence
    const listenEv = subEvidence.find((e: any) => e.questionId === qListenId);
    expect(listenEv).toBeDefined();
    expect(listenEv.skillId).toBe(listeningSkill.id);
    expect(listenEv.assessmentId).toBe(aId);
    expect(listenEv.evaluatorType).toBe('TEACHER'); // Teacher finalized
    expect(listenEv.sourceMaterialId).toBe(listenMatId);

    // ─── 5. RECOMMENDATION: teacher decision via API + assign activity via UI ──
    // Get the recommendation for Emma using admin token (admin can access any learner)
    const recRes = await request.get(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/recommendations/learner/${emmaId}`, {
      headers: adminH,
    });
    expect(recRes.status()).toBe(200);
    const recData = await recRes.json();
    expect(recData).toBeTruthy();
    const recId = recData.id;

    // Record teacher decision via API (proves teacher decision pathway works)
    const decisionRes = await request.post(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/recommendations/${recId}/decision`, {
      headers: adminH,
      data: { recommendationId: recId, decision: 'ACCEPT', teacherNotes: 'Approved by e2e test' },
    });
    expect(decisionRes.status()).toBe(200);
    const decision = await decisionRes.json();

    // Now test the "Assign Next Activity" modal in the browser
    await page.goto(`/learners/${emmaId}/recommendation`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Recommendation Workspace')).toBeVisible();

    await page.getByRole('button', { name: 'Assign Next Activity ›' }).click();
    await expect(page.getByRole('heading', { name: 'Schedule Separate Next Activity' })).toBeVisible();

    // Select the "Extra Practice Material" from the material dropdown (2nd select = material)
    await page.locator('select').nth(1).selectOption(recMatId);

    const assignmentResponsePromise = page.waitForResponse((response) =>
      response.url().includes(`/api/recommendations/${recId}/assign-next-activity`) && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Confirm Activity' }).click();
    const assignmentResponse = await assignmentResponsePromise;
    expect(assignmentResponse.status()).toBe(200);
    const assignmentResult = await assignmentResponse.json();
    expect(assignmentResult.decisionId).toBe(decision.id);
    await expect(page.getByText(/Next activity assigned/i).first()).toBeVisible({ timeout: 10000 });

    const auditRes = await request.get(`${process.env.API_BASE_URL || 'http://localhost:4100'}/api/audit/events?action=NEXT_ACTIVITY_ASSIGNED&entityType=RECOMMENDATION&entityId=${recId}`, { headers: adminH });
    expect(auditRes.status()).toBe(200);
    const auditData = await auditRes.json();
    expect(auditData.total).toBe(1);
    expect(auditData.items).toHaveLength(1);
    expect(auditData.items[0].metadata.materialId).toBe(recMatId);

    // ─── 5. STUDENT — visibility of assigned activity ───────────────────────
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'emma.nguyen@student.acorn.edu');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Student should see the newly assigned Extra Practice Material
    await page.goto('/student/materials');
    await expect(page.getByText('Extra Practice Material')).toBeVisible();

    // Verify another student does NOT receive the individually assigned activity
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'lucas.kim@student.acorn.edu');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.goto('/student/materials');
    await expect(page.getByText('Extra Practice Material')).not.toBeVisible();
  });
});
