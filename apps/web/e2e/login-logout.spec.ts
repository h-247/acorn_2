import { test, expect } from '@playwright/test';
import { resolveApiBase } from '../src/lib/api';

test.describe('API Base Selection Regression', () => {
  test('production client API base resolves to /api even if NEXT_PUBLIC_API_URL is present', () => {
    expect(resolveApiBase('production', 'https://acorn-2.onrender.com/api')).toBe('/api');
    expect(resolveApiBase('production', 'http://127.0.0.1:4100/api')).toBe('/api');
    expect(resolveApiBase('production', undefined)).toBe('/api');
    expect(resolveApiBase('production', '')).toBe('/api');
  });

  test('development and test environments preserve explicit NEXT_PUBLIC_API_URL', () => {
    expect(resolveApiBase('development', 'http://127.0.0.1:4100/api')).toBe('http://127.0.0.1:4100/api');
    expect(resolveApiBase('development', 'http://127.0.0.1:4100/api/')).toBe('http://127.0.0.1:4100/api');
    expect(resolveApiBase('test', 'http://127.0.0.1:4100/api')).toBe('http://127.0.0.1:4100/api');
    expect(resolveApiBase('development', undefined)).toBe('http://localhost:4000/api');
    expect(resolveApiBase('development', '')).toBe('http://localhost:4000/api');
  });
});

test.describe('Teacher Cookie Login and Logout Smoke Test', () => {
  test('should sign in teacher, verify Teacher Home and Sign Out, click Sign Out, and verify sign-in page', async ({
    page,
    context,
  }) => {
    // 1. Navigate to the sign-in page
    await page.goto('/sign-in');
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole('heading', { name: /sign in to acorn/i })).toBeVisible();

    // 2. Fill in teacher credentials from the documented dev seed
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await emailInput.fill('taylor@acorn.edu');
    await passwordInput.fill('password123');

    // 3. Submit login form
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeEnabled();
    await signInButton.click();

    // 4. Verify redirected to Teacher Home
    await expect(page).toHaveURL('http://127.0.0.1:3000/');
    await expect(page.getByRole('heading', { name: 'Teacher Home' })).toBeVisible();
    await expect(page.getByText('Welcome back, Ms. Taylor!')).toBeVisible();

    // 5. Verify the auth cookie was set via the cookie authentication flow
    const cookiesAfterLogin = await context.cookies();
    const authCookie = cookiesAfterLogin.find((c) => c.name === 'acorn_token');
    expect(authCookie).toBeDefined();
    expect(authCookie?.value).toBeTruthy();

    // 6. Locate and verify the Sign Out button is present
    const signOutButton = page.getByRole('button', { name: /sign out/i });
    await expect(signOutButton).toBeVisible();

    // 7. Click Sign Out
    await signOutButton.click();

    // 8. Verify redirected back to the sign-in page
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole('heading', { name: /sign in to acorn/i })).toBeVisible();

    // 9. Verify cookie is cleared or invalidated after sign out
    const cookiesAfterLogout = await context.cookies();
    const authCookieAfterLogout = cookiesAfterLogout.find((c) => c.name === 'acorn_token');
    const isCleared =
      !authCookieAfterLogout ||
      !authCookieAfterLogout.value ||
      (authCookieAfterLogout.expires !== -1 && authCookieAfterLogout.expires <= Date.now() / 1000);
    expect(isCleared).toBe(true);
  });
});
