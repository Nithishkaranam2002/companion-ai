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

/** Signed-in tests share one test user per run, signed in once by global setup (signing in per
 *  test or per worker trips Supabase's auth rate limits). */
export const authedTest = test.extend({
  storageState: async ({}, use) => {
    const { authPaths } = await import("./global-setup");
    await use(authPaths().userState);
  },
});
