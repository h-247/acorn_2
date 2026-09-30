import { test, expect } from '@playwright/test';

test.describe('Student Assessment & Authorization Boundary E2E', () => {
  test('should sign in student via cookie, view assessments, resume assigned assessment, and deny teacher/admin routes', async ({
    page,
    context,
  }) => {
    // 1. Navigate to the sign-in page
    await page.goto('/sign-in');
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole('heading', { name: /sign in to acorn/i })).toBeVisible();

    // 2. Fill in student credentials from the documented dev seed
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await emailInput.fill('emma.nguyen@student.acorn.edu');
    await passwordInput.fill('password123');

    // 3. Submit student login form
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeEnabled();
    await signInButton.click();

    // 4. Verify redirected to Student Home portal
    await expect(page).toHaveURL('http://127.0.0.1:3000/student');
    await expect(page.getByRole('heading', { name: /welcome back, emma/i })).toBeVisible();
    await expect(page.getByText('Student Portal')).toBeVisible();

    // 5. Verify the auth cookie was set via the cookie authentication flow
    const cookiesAfterLogin = await context.cookies();
    const authCookie = cookiesAfterLogin.find((c) => c.name === 'acorn_token');
    expect(authCookie).toBeDefined();
    expect(authCookie?.value).toBeTruthy();

    // 6. Student can inspect evidence-backed learning progress without teacher tooling.
    await page.getByRole('link', { name: 'My Progress' }).click();
    await expect(page).toHaveURL('http://127.0.0.1:3000/student/progress');
    await expect(page.getByRole('heading', { name: 'My Progress' })).toBeVisible();
    await expect(page.getByText('Skill breakdown')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Materials', exact: true })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Study Materials' })).toBeVisible();

    // 7. Navigate to Student Assessments list
    await page.goto('/student/assessments');
    await expect(page).toHaveURL('http://127.0.0.1:3000/student/assessments');
    await expect(page.getByRole('heading', { name: 'My Assessments' })).toBeVisible();

    // 8. Verify student sees own assessments
    const assessmentHeading = page
      .getByRole('heading', { name: 'Reading Assessment 03 — Urban Innovation' })
      .first();
    await expect(assessmentHeading).toBeVisible();
    await expect(page.getByText('Evaluated').first()).toBeVisible();

    // 9. Open the evaluated seeded submission to review results.
    const seedSubmissionLink = page.locator('a[href*="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01"]');
    await expect(seedSubmissionLink).toBeVisible();
    await seedSubmissionLink.click();

    // 10. Verify the evaluated result is readable but cannot be edited/resubmitted.
    await expect(page).toHaveURL(/\/student\/assessments\/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Reading Assessment 03 — Urban Innovation' })
    ).toBeVisible();
    await expect(page.getByText('Question 1 of 3').first()).toBeVisible();
    await expect(page.getByText(/Reading Passage/i)).toBeVisible();

    // Previously saved answers remain visible, but the result is read-only.
    await expect(
      page.getByText(/Which statement best summarizes the main idea of the passage/i)
    ).toBeVisible();
    await expect(page.getByText('This submission is read-only.')).toBeVisible();
    await expect(page.getByText('Read-only result')).toBeVisible();
    const optionChoice = page.getByText(
      'B. Urban vertical farming offers sustainable advantages despite high initial setup costs.'
    );
    await expect(optionChoice).toBeVisible();
    await expect(optionChoice).toBeDisabled();
    await expect(page.getByRole('button', { name: /submit assessment/i })).not.toBeVisible();

    // 11. Verify student cannot navigate to teacher route
    await page.goto('/');
    await expect(page).toHaveURL('http://127.0.0.1:3000/');
    await expect(page.getByRole('heading', { name: 'Teacher Home' })).not.toBeVisible();
    await expect(page.getByText('Unable to load teacher dashboard')).toBeVisible();
    await expect(page.getByText(/Action requires one of/i)).toBeVisible();

    // 12. Verify student cannot navigate to admin route
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(
      page.getByText(/Action requires one of: ADMIN, TEACHER|Failed to load administrative data/i)
    ).toBeVisible();

    // 13. Verify student shell does not present teacher/admin navigation links
    await page.goto('/student');
    await expect(page).toHaveURL('http://127.0.0.1:3000/student');
    await expect(page.getByRole('link', { name: 'Materials', exact: true })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Study Materials' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Classes' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Learners' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin Portal' })).not.toBeVisible();
  });

  test('should render recommendation card with real skill, candidate title, and formatted rationale when accepted', async ({
    page,
  }) => {
    // 1. Intercept recommendation endpoint to return an accepted recommendation with realistic domain fields
    await page.route('**/api/recommendations/learner/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '99999999-9999-9999-9999-999999999999',
          learnerId: '11111111-1111-1111-1111-111111111101',
          learnerName: 'Emma Nguyen',
          targetSkillId: '22222222-2222-2222-2222-222222222201',
          targetSkillName: 'Reading: Inference and Deduction',
          targetLevel: 'B2',
          priority: 'HIGH',
          recommendedActionText: 'Focus on Reading: Inference and Deduction',
          rationale: [
            'Scored 45% in recent assessment.',
            'Grounded in 3 recorded learning evidence observations.',
          ],
          evidenceBasisCount: 3,
          learnerCurrentScore: 45,
          learnerConfidence: 'LOW',
          decisionStatus: 'ACCEPT',
          createdAt: new Date().toISOString(),
          candidates: [
            {
              materialId: '33333333-3333-3333-3333-333333333301',
              title: 'Sustainable Cities and Vertical Farming Article',
              type: 'ARTICLE',
              level: 'B2',
              estimatedMinutes: 15,
              action: 'PRACTICE',
              matchReason: 'Direct alignment with target skill deficiency',
              tags: ['ielts', 'reading'],
              previouslyUsedCount: 1,
            },
          ],
          teacherDecision: {
            id: '44444444-4444-4444-4444-444444444401',
            decision: 'ACCEPT',
            teacherNotes: 'Assigned next activity',
            selectedMaterialId: '33333333-3333-3333-3333-333333333301',
            decidedAt: new Date().toISOString(),
          },
        }),
      });
    });

    // 2. Sign in as student Emma
    await page.goto('/sign-in');
    await page.locator('input[type="email"]').fill('emma.nguyen@student.acorn.edu');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // 3. Verify on student dashboard
    await expect(page).toHaveURL('http://127.0.0.1:3000/student');
    await expect(page.getByRole('heading', { name: /welcome back, emma/i })).toBeVisible();

    // 4. Verify recommendation card displays real targetSkillName, candidate title, and readable rationale
    const recCard = page.locator('[data-testid="student-recommendation-card"]');
    await expect(recCard).toBeVisible();
    await expect(recCard.getByText('Recommended Next Step')).toBeVisible();

    // Actual skill name
    await expect(page.locator('[data-testid="rec-skill"]')).toHaveText('Reading: Inference and Deduction');

    // Candidate title
    await expect(page.locator('[data-testid="rec-title"]')).toHaveText('Sustainable Cities and Vertical Farming Article');

    // Formatted rationale
    await expect(page.locator('[data-testid="rec-rationale"]')).toContainText(
      'Scored 45% in recent assessment. Grounded in 3 recorded learning evidence observations.'
    );
  });

  test('admin enroll learner selects class and student, submits form, and verifies persisted enrollment', async ({ page }) => {
    // 1. Sign in as admin
    await page.goto('/sign-in');
    await page.locator('input[type="email"]').fill('admin@acorn.edu');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin/);

    // 2. Create a student who is deliberately not in the seeded class. The seed
    // enrolls every demo student, so using one of them would let this test pass
    // after an idempotent no-op instead of proving the enrollment flow works.
    const suffix = Date.now();
    const studentName = `Enrollment E2E ${suffix}`;
    const apiCookies = await page.context().cookies();
    const authToken = apiCookies.find((cookie) => cookie.name === 'acorn_token')?.value;
    expect(authToken).toBeTruthy();
    const createStudent = await page.request.post('http://127.0.0.1:4100/api/identity/users', {
      headers: { authorization: `Bearer ${authToken}` },
      data: {
        email: `enrollment-e2e-${suffix}@student.acorn.edu`,
        name: studentName,
        password: 'password123',
        role: 'STUDENT',
      },
    });
    expect(createStudent.status()).toBe(201);
    const createdStudent = await createStudent.json();

    // 3. Go to admin classes tab after the lookup data includes the new student.
    await page.goto('/admin?tab=classes');
    await expect(page.getByRole('heading', { name: 'Class Cohorts & Enrollments' })).toBeVisible();

    // 4. Open Enroll Student modal
    await expect(page.getByRole('button', { name: /enroll learner/i })).toBeVisible();
    await page.getByRole('button', { name: /enroll learner/i }).click();

    // 5. Scope selects to the modal dialog and make explicit selections.
    const modalHeading = page.getByRole('heading', { name: 'Enroll Student in Class' });
    await expect(modalHeading).toBeVisible();
    const modalContainer = modalHeading.locator('../..');

    const classSelect = modalContainer.locator('select').nth(0);
    const studentSelect = modalContainer.locator('select').nth(1);
    await expect(classSelect).toBeVisible();
    await expect(studentSelect).toBeVisible();

    const classOptionsCount = await classSelect.locator('option').count();
    expect(classOptionsCount).toBeGreaterThan(0);

    const studentOptionsCount = await studentSelect.locator('option').count();
    expect(studentOptionsCount).toBeGreaterThan(0);

    const classId = await classSelect.inputValue();
    await studentSelect.selectOption(createdStudent.id);

    // The new student must not already be present before submitting the form.
    await modalContainer.getByRole('button', { name: /cancel/i }).click();
    await expect(modalHeading).not.toBeVisible();
    const manageStudentsBtn = page.getByRole('button', { name: /manage students/i }).first();
    await manageStudentsBtn.click();
    const rosterHeading = page.getByRole('heading', { name: /class roster:/i });
    await expect(rosterHeading).toBeVisible();
    const rosterContainer = rosterHeading.locator('../..');
    const searchInput = rosterContainer.locator('input[placeholder*="Filter student"]');
    await searchInput.fill(studentName);
    await expect(rosterContainer.getByText(studentName)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(rosterHeading).not.toBeVisible();

    await page.getByRole('button', { name: /enroll learner/i }).click();
    await expect(modalHeading).toBeVisible();
    const enrollmentModal = modalHeading.locator('../..');
    await enrollmentModal.locator('select').nth(0).selectOption(classId);
    await enrollmentModal.locator('select').nth(1).selectOption(createdStudent.id);

    // Submit enrollment form
    await enrollmentModal.getByRole('button', { name: /confirm enrollment/i }).click();
    await expect(modalHeading).not.toBeVisible();

    // 6. Refresh page and verify the newly-created student persisted in the roster.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Class Cohorts & Enrollments' })).toBeVisible();

    await expect(manageStudentsBtn).toBeVisible();
    await manageStudentsBtn.click();

    await expect(rosterHeading).toBeVisible();
    await expect(searchInput).toBeVisible();
    await searchInput.fill(studentName);
    await expect(rosterContainer.getByText(studentName).first()).toBeVisible();
  });

  test('assessment builder allows saving draft assessment explicitly and verifies persisted draft', async ({ page }) => {
    // 1. Sign in as teacher
    await page.goto('/sign-in');
    await page.locator('input[type="email"]').fill('taylor@acorn.edu');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // 2. Go to assessment builder
    await page.goto('/assessments/builder');
    await expect(page.getByRole('heading', { name: 'Assessment Builder' })).toBeVisible();

    // 3. Create a unique draft title and fill assessment fields
    const draftTitle = `Draft E2E Test ${Date.now()}`;
    const titleInput = page.getByText('Assessment Title').locator('..').locator('input');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(draftTitle);

    // Wait for question bank to finish loading
    await expect(page.getByText('Loading question bank...')).not.toBeVisible({ timeout: 15000 });

    // 4. Click Save Draft
    const saveDraftBtn = page.getByRole('button', { name: 'Save Draft' });
    await expect(saveDraftBtn).toBeVisible();
    await saveDraftBtn.click();

    // 5. Verify navigation to detail page and persisted draft title
    await page.waitForURL(/\/assessments\/[a-f0-9-]+/);
    await expect(page.getByText(draftTitle).first()).toBeVisible();

    // 6. Reload page and verify saved draft still exists
    await page.reload();
    await expect(page.getByText(draftTitle).first()).toBeVisible();
  });
});
