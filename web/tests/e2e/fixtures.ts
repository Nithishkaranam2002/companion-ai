import { test as base, expect, type Page } from "@playwright/test";

export const PUBLIC_PAGES = ["/", "/pricing", "/safety", "/about", "/contact", "/privacy", "/terms", "/login"];
export const PROTECTED_PAGES = ["/chat", "/mood", "/admin"];

/** Collects console errors and failed same-origin/API requests for a page. */
export function watchErrors(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    const url = r.url();
    if (r.status() >= 400 && !url.includes("/auth/v1/")) problems.push(`${r.status()} ${r.request().method()} ${url}`);
  });
  page.on("requestfailed", (r) => {
    const reason = r.failure()?.errorText ?? "";
    // Navigations away abort in-flight prefetches; that's not a broken link.
    if (!reason.includes("ERR_ABORTED")) problems.push(`failed: ${r.url()} ${reason}`);
  });
  return problems;
}

export const test = base.extend<{ problems: string[] }>({
  problems: async ({ page }, use) => {
    const problems = watchErrors(page);
    await use(problems);
    expect(problems, "no console errors or failed requests").toEqual([]);
  },
});

export { expect };

/**
 * Signed-in tests: one throwaway Supabase user and one sign-in per worker, reused via
 * storageState (signing in per test trips Supabase's auth rate limits).
 */
export const authedTest = test.extend<object, { workerStorageState: string; workerUser: { id: string; email: string } }>({
  workerUser: [
    async ({}, use) => {
      const { createTestUser, deleteTestUser } = await import("./auth-helper");
      const user = await createTestUser();
      await use(user);
      await deleteTestUser(user.id);
    },
    { scope: "worker" },
  ],
  workerStorageState: [
    async ({ browser, workerUser }, use, workerInfo) => {
      const { signIn } = await import("./auth-helper");
      const file = `test-results/.auth/worker-${workerInfo.parallelIndex}-${workerInfo.project.name}.json`;
      const baseURL = workerInfo.project.use.baseURL!;
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await signIn(page, baseURL, workerUser.email);
      await page.waitForURL(/\/chat$/);
      await context.storageState({ path: file });
      await context.close();
      await use(file);
    },
    { scope: "worker" },
  ],
  storageState: ({ workerStorageState }, use) => use(workerStorageState),
});
