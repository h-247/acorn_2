import { test, expect } from '@playwright/test';

test.describe('Material Lifecycle E2E', () => {
  test('should enforce end-to-end lifecycle and student access controls', async ({ request, page, browser }) => {
    // 1. Admin login
    const loginRes = await request.post('http://localhost:4000/api/identity/login', {
      data: { email: 'admin@acorn.edu', password: 'admin123' },
    });
    expect(loginRes.status()).toBe(200);
    const adminCookie = loginRes.headers()['set-cookie'] || '';
    const adminToken = decodeURIComponent(adminCookie.match(/acorn_token=([^;]+)/)?.[1] || '');

    // Get Liam (in released class)
    const liamId = '33333333-3333-3333-3333-333333333333';

    // Create an outsider student (not in any class)
    const createOutsiderRes = await request.post('http://localhost:4000/api/identity/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        email: 'outsider@student.acorn.edu',
        password: 'password123',
        name: 'Outsider Student',
        role: 'STUDENT'
      }
    });
    expect(createOutsiderRes.status()).toBe(201);

    // Login as outsider
    const outsiderLoginRes = await request.post('http://localhost:4000/api/identity/login', {
      data: { email: 'outsider@student.acorn.edu', password: 'password123' },
    });
    expect(outsiderLoginRes.status()).toBe(200);
    const outsiderCookie = outsiderLoginRes.headers()['set-cookie'] || '';
    const outsiderToken = decodeURIComponent(outsiderCookie.match(/acorn_token=([^;]+)/)?.[1] || '');

    // Login as Liam via API to check downloads
    const liamLoginRes = await request.post('http://localhost:4000/api/identity/login', {
      data: { email: 'liam.chen@student.acorn.edu', password: 'password123' },
    });
    expect(liamLoginRes.status()).toBe(200);
    const liamCookie = liamLoginRes.headers()['set-cookie'] || '';
    const liamToken = decodeURIComponent(liamCookie.match(/acorn_token=([^;]+)/)?.[1] || '');

    const classId = '55555555-5555-5555-5555-555555555555'; // SEED_IDS.classIeltsA

    const newSkillRes = await request.post('http://localhost:4000/api/taxonomy/skills', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        code: 'AAA_TEST_SKILL',
        name: 'A Test Skill',
        area: 'READING',
        level: 'B1'
      }
    });
    expect(newSkillRes.status()).toBe(201);
    const grammarSkill = await newSkillRes.json();

    const checkSkillsRes = await request.get('http://localhost:4000/api/taxonomy/skills', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const skillsCheck = await checkSkillsRes.json();
    console.log('FIRST SKILL BY DEFAULT:', skillsCheck[0]?.code);

    // 2. Admin creates material as DRAFT
    const createRes = await request.post('http://localhost:4000/api/materials', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: 'Playwright E2E Lifecycle Material',
        type: 'ARTICLE',
        level: 'B2',
        primarySkillId: grammarSkill.id,
        content: 'This is test material content for Playwright'
      }
    });
    expect(createRes.status()).toBe(201);
    const material = await createRes.json();
    const mId = material.id;
    expect(material.status).toBe('DRAFT');

    // Upload a file to it right away so we can test download paths
    const uploadRes = await request.post(`http://localhost:4000/api/materials/${mId}/files`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('Fake PDF content')
        }
      }
    });
    expect(uploadRes.status()).toBe(201);
    const fileData = await uploadRes.json();
    const fileId = fileData.id;

    // Student browser setup for UI checks
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await studentPage.goto('/sign-in');
    await studentPage.fill('input[type="email"]', 'liam.chen@student.acorn.edu');
    await studentPage.fill('input[type="password"]', 'password123');
    await studentPage.click('button[type="submit"]');
    await studentPage.waitForURL('/student');

        // Get students from class to avoid recommendation caching
    const classDataRes = await request.get(`http://localhost:4000/api/classes/${classId}/enrollments`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const classData = await classDataRes.json();
    const students = Array.isArray(classData) ? classData : classData.items;

    // Liam is at some index, let's just pick 4 others.
    const otherStudents = students.filter((s: any) => s.learnerId !== liamId).map((s: any) => s.learnerId);

    // Helper for negative assertions
    const assertUnavailable = async (stateName: string, studentId: string) => {
      // API: Direct fetch should fail for student
      const fetchRes = await request.get(`http://localhost:4000/api/materials/${mId}`, {
        headers: { Authorization: `Bearer ${liamToken}` }
      });
      expect([403, 404], `State ${stateName}: Direct fetch should be 403 or 404`).toContain(fetchRes.status());

      // API: Download should fail for student
      const dlRes = await request.get(`http://localhost:4000/api/materials/${mId}/files/${fileId}/download`, {
        headers: { Authorization: `Bearer ${liamToken}` }
      });
      expect([403, 404], `State ${stateName}: Download should be 403 or 404`).toContain(dlRes.status());

      // API: Should not be in candidates
      const candidateRes = await request.get(`http://localhost:4000/api/recommendations/learner/${studentId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(candidateRes.status()).toBe(200);
      const rec = await candidateRes.json();
      const candidateMaterials = rec.candidates.map((c: any) => c.materialId);
      expect(candidateMaterials).not.toContain(mId);

      // UI: Should not appear in student list
      await studentPage.goto('/student/materials');
      await expect(studentPage.getByText('Playwright E2E Lifecycle Material')).not.toBeVisible();
    };

    // State 1: DRAFT
    await assertUnavailable('DRAFT', otherStudents[0]);

    // State 2: UNDER_REVIEW
    const underReviewRes = await request.put(`http://localhost:4000/api/materials/${mId}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'UNDER_REVIEW' }
    });
    expect(underReviewRes.status()).toBe(200);
    await assertUnavailable('UNDER_REVIEW', otherStudents[1]);

    // State 3: APPROVED (but not released)
    const approveRes = await request.put(`http://localhost:4000/api/materials/${mId}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'APPROVED' }
    });
    expect(approveRes.status()).toBe(200);
    await assertUnavailable('APPROVED_UNRELEASED', otherStudents[2]);

    // State 4: ARCHIVED (move from APPROVED to ARCHIVED)
    const archiveRes = await request.put(`http://localhost:4000/api/materials/${mId}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'ARCHIVED' }
    });
    expect(archiveRes.status()).toBe(200);
    await assertUnavailable('ARCHIVED', otherStudents[3]);

    // Move back to APPROVED for positive flow
    const reApproveRes = await request.put(`http://localhost:4000/api/materials/${mId}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'APPROVED' }
    });
    expect(reApproveRes.status()).toBe(200);

    // 5. Release to class
    const releaseRes = await request.post(`http://localhost:4000/api/materials/${mId}/release`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { classId }
    });
    expect(releaseRes.status()).toBe(201);

    // 6. Verify positive flow for Liam (enrolled)
    // API: Direct fetch should succeed
    const fetchRes = await request.get(`http://localhost:4000/api/materials/${mId}`, {
      headers: { Authorization: `Bearer ${liamToken}` }
    });
    expect(fetchRes.status()).toBe(200);

    // API: Download should succeed and return signed URL
    const liamDlRes = await request.get(`http://localhost:4000/api/materials/${mId}/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${liamToken}` }
    });
    expect(liamDlRes.status()).toBe(200);
    const liamDlData = await liamDlRes.json();
    expect(liamDlData.url).toContain('http');

    expect(liamDlData.fileName).toBe('test.pdf');
    expect(liamDlData.mimeType).toBe('application/pdf');
    // API: Should be in candidates
    const candidateRes2 = await request.get(`http://localhost:4000/api/recommendations/learner/${liamId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(candidateRes2.status()).toBe(200);
    const rec2 = await candidateRes2.json();
    console.log('REC2:', JSON.stringify(rec2, null, 2));
    const candidateMaterials2 = rec2.candidates.map((c: any) => c.materialId);
    expect(candidateMaterials2).toContain(mId);

    // UI: Should see and read the material
    await studentPage.goto('/student/materials');
    await expect(studentPage.getByText('Playwright E2E Lifecycle Material')).toBeVisible();
    await studentPage.getByRole('button', { name: 'Read & Study' }).first().click();
    await expect(studentPage.getByText('This is test material content for Playwright')).toBeVisible();

    // 7. Verify outsider student cannot download
    const outsiderDlRes = await request.get(`http://localhost:4000/api/materials/${mId}/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${outsiderToken}` }
    });
    expect(outsiderDlRes.status()).toBe(403);

    await studentContext.close();
  });
});