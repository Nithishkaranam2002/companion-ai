// @live: hits the real API + OpenAI. Run with LIVE=1 against a running API (costs a few cents).
import { expect, test } from "@playwright/test";

import { createTestUser, deleteTestUser, signIn } from "./auth-helper";

test.describe("@live chat", () => {
  test.skip(({ isMobile }) => isMobile, "one live run is enough");
  let user: { id: string; email: string };

  test.beforeAll(async () => {
    user = await createTestUser();
  });
  test.afterAll(async () => {
    if (user) await deleteTestUser(user.id);
  });

  test("streams a cited answer, then escalates a crisis message", async ({ page, baseURL }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.request().method()} ${r.url()}`));
    await signIn(page, baseURL!, user.email);
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByRole("heading", { name: "How are you, really?" })).toBeVisible();

    await page.getByLabel("Message CompanionAI").fill("How can I sleep better? I keep waking up tired.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("status", { name: "CompanionAI is typing" })).toBeVisible();
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByText("Sources", { exact: true })).toBeVisible({ timeout: 60_000 });
    const firstCard = page.locator("a[target=_blank]").filter({ hasText: /\[\d/ }).first();
    await expect(firstCard).toHaveAttribute("href", /^https:\/\//);
    await page.screenshot({ path: "test-results/live-answer.png", fullPage: false });

    await page.getByLabel("Message CompanionAI").fill("I don't see the point anymore. I've been thinking about ending my life.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "You don't have to go through this alone" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Call 988" })).toHaveAttribute("href", "tel:988");
    await page.screenshot({ path: "test-results/live-crisis.png", fullPage: false });

    // History persists across reloads and appears in the sidebar.
    await page.reload();
    await expect(page.getByText("ending my life", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("navigation", { name: "Conversations" }).getByRole("button").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});
