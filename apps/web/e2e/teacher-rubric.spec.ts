import { test, expect } from '@playwright/test';

test.describe('Teacher Rubric Review', () => {
  // We rely on the seed data or creating a submission via API to test this cleanly.
  // Instead of full API generation, let's login as admin, create a question with custom rubric,
  // add it to an assessment, assign it, submit it, and then check review page.

  test('should display dynamically saved rubric criteria and totals for WRITING', async ({ request, page }) => {
    // We will do API setup to bypass UI creation for speed
    // 1. Admin login via API
    const loginRes = await request.post('http://localhost:4000/api/identity/login', {
      data: { email: 'admin@acorn.edu', password: 'admin123' },
    });
    expect(loginRes.status()).toBe(200);
    const adminCookie = loginRes.headers()['set-cookie'] || '';
    const token = decodeURIComponent(adminCookie.match(/acorn_token=([^;]+)/)?.[1] || '');

    // 2. Get skills
    const writingSkill = { id: '66666666-6666-6666-6666-666666666608' };

    // 3. Create question
    const qRes = await request.post('http://localhost:4000/api/assessments/questions', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        type: 'WRITING',
        prompt: 'Custom Rubric Playwright Test',
        difficulty: 'MEDIUM',
        level: 'B2',
        skills: [{ skillId: writingSkill.id, role: 'PRIMARY' }],
        rubric: [
          { criteria: 'Custom Creativity', maxScore: 7 },
          { criteria: 'Custom Formatting', maxScore: 3 },
        ],
      }
    });
    expect(qRes.status()).toBe(201);
    const qId = (await qRes.json()).id;

    // 4. Create Assessment
    const aRes = await request.post('http://localhost:4000/api/assessments', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: 'Custom Rubric Assessment',
        level: 'B2',
        questionIds: [qId],
      }
    });
    expect(aRes.status()).toBe(201);
    const aId = (await aRes.json()).id;

    // 5. Publish Assessment
    const pubRes = await request.put(`http://localhost:4000/api/assessments/${aId}/publish`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(pubRes.status()).toBe(200);

    // 6. Get class and assign
    const classesRes = await request.get('http://localhost:4000/api/classes', {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(classesRes.status()).toBe(200);
    const classId = (await classesRes.json())[0].id;

    const assignRes = await request.post(`http://localhost:4000/api/assessments/${aId}/assign`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { classId }
    });
    expect(assignRes.status()).toBe(201);

    // 7. Login as student to submit
    const studentLogin = await request.post('http://localhost:4000/api/identity/login', {
      data: { email: 'emma.nguyen@student.acorn.edu', password: 'password123' },
    });
    expect(studentLogin.status()).toBe(200);
    const studentCookie = studentLogin.headers()['set-cookie'] || '';
    const studentToken = decodeURIComponent(studentCookie.match(/acorn_token=([^;]+)/)?.[1] || '');

    // Get the submission ID that was automatically created when assigned
    const subsRes = await request.get(`http://localhost:4000/api/submissions`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    expect(subsRes.status()).toBe(200);
    const submissions = await subsRes.json();
    const sub = submissions.find((s: any) => s.assessmentId === aId);
    const subId = sub.id;

    // Submit
    const submitRes = await request.post(`http://localhost:4000/api/submissions/${subId}/submit`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: {
        answers: [{ questionId: qId, responsePayload: 'Here is my test response' }]
      }
    });
    expect(submitRes.status()).toBe(200);

    // 8. Now login to UI as teacher
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'taylor@acorn.edu');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/');

    // Go to submissions
    await page.goto(`/submissions/${subId}/review`);

    // Wait for the custom rubric criteria to appear
    await expect(page.getByText('Custom Creativity')).toBeVisible();
    await expect(page.getByText('Custom Formatting')).toBeVisible();

    // Check max totals - the max values are 7 and 3, so we should see / 7 and / 3
    await expect(page.getByText('/ 7')).toBeVisible();
    await expect(page.getByText('/ 3')).toBeVisible();

    // The calculated raw score should say something / 10
    await expect(page.getByText('/ 10').first()).toBeVisible();
  });

  test('should display dynamically saved rubric criteria and totals for SPEAKING', async ({ request, page }) => {
    // 1. Admin login via API
    const loginRes = await request.post('http://localhost:4000/api/identity/login', {
      data: { email: 'admin@acorn.edu', password: 'admin123' },
    });
    expect(loginRes.status()).toBe(200);
    const adminCookie = loginRes.headers()['set-cookie'] || '';
    const token = decodeURIComponent(adminCookie.match(/acorn_token=([^;]+)/)?.[1] || '');

    // 2. Get skills
    const speakingSkill = { id: '66666666-6666-6666-6666-666666666607' }; // Speaking skill

    // 3. Create question
    const qRes = await request.post('http://localhost:4000/api/assessments/questions', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        type: 'SPEAKING',
        prompt: 'Custom Rubric Playwright Test for Speaking',
        difficulty: 'MEDIUM',
        level: 'B2',
        skills: [{ skillId: speakingSkill.id, role: 'PRIMARY' }],
        rubric: [
          { criteria: 'Speaking Fluency', maxScore: 6 },
          { criteria: 'Speaking Pronunciation', maxScore: 8 },
        ],
      }
    });
    expect(qRes.status()).toBe(201);
    const qId = (await qRes.json()).id;

    // 4. Create Assessment
    const aRes = await request.post('http://localhost:4000/api/assessments', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: 'Custom Speaking Rubric Assessment',
        level: 'B2',
        questionIds: [qId],
      }
    });
    expect(aRes.status()).toBe(201);
    const aId = (await aRes.json()).id;

    // 5. Publish Assessment
    const pubRes = await request.put(`http://localhost:4000/api/assessments/${aId}/publish`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(pubRes.status()).toBe(200);

    // 6. Get class and assign
    const classesRes = await request.get('http://localhost:4000/api/classes', {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(classesRes.status()).toBe(200);
    const classId = (await classesRes.json())[0].id;

    const assignRes = await request.post(`http://localhost:4000/api/assessments/${aId}/assign`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { classId }
    });
    expect(assignRes.status()).toBe(201);

    // 7. Login as student to submit
    const studentLogin = await request.post('http://localhost:4000/api/identity/login', {
      data: { email: 'emma.nguyen@student.acorn.edu', password: 'password123' },
    });
    expect(studentLogin.status()).toBe(200);
    const studentCookie = studentLogin.headers()['set-cookie'] || '';
    const studentToken = decodeURIComponent(studentCookie.match(/acorn_token=([^;]+)/)?.[1] || '');

    // Get the submission ID that was automatically created when assigned
    const subsRes = await request.get(`http://localhost:4000/api/submissions`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    expect(subsRes.status()).toBe(200);
    const submissions = await subsRes.json();
    const sub = submissions.find((s: any) => s.assessmentId === aId);
    const subId = sub.id;

    // Submit
    const submitRes = await request.post(`http://localhost:4000/api/submissions/${subId}/submit`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: {
        answers: [{ questionId: qId, responsePayload: 'Here is my test response audio url' }]
      }
    });
    expect(submitRes.status()).toBe(200);

    // 8. Now login to UI as teacher
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'taylor@acorn.edu');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/');

    // Go to submissions
    await page.goto(`/submissions/${subId}/review`);

    // Wait for the custom rubric criteria to appear
    await expect(page.getByText('Speaking Fluency')).toBeVisible();
    await expect(page.getByText('Speaking Pronunciation')).toBeVisible();

    // Check max totals - the max values are 6 and 8, so we should see / 6 and / 8
    await expect(page.getByText('/ 6')).toBeVisible();
    await expect(page.getByText('/ 8')).toBeVisible();

    // The calculated raw score should say something / 14
    await expect(page.getByText('/ 14').first()).toBeVisible();
  });
}
);