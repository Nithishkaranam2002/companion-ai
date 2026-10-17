// @live: real API + Supabase (no LLM calls). The admin flow lives in live-api.spec.ts.
import { expect, test } from "@playwright/test";

import { createTestUser, deleteTestUser, signIn } from "./auth-helper";

test.describe("@live mood and admin", () => {
  test.skip(({ isMobile }) => isMobile, "one live run is enough");

  test("logs a mood check-in and shows it in the chart and table", async ({ page, baseURL }) => {
    const user = await createTestUser();
    try {
      await signIn(page, baseURL!, user.email, "/mood");
      await expect(page.getByRole("heading", { name: "Mood tracker" })).toBeVisible();
      await expect(page.getByText("Your chart starts with your first check-in")).toBeVisible();
      const slider = page.getByRole("slider");
      await slider.focus();
      await page.keyboard.press("ArrowRight"); // 6 -> 7
      await page.getByLabel("Note (optional)").fill("Good walk with Sam, call me at 555-123-4567");
      await page.getByRole("button", { name: "Save check-in" }).click();
      await expect(page.getByText("Check-in saved")).toBeVisible();
      const row = page.getByRole("table").getByRole("row").nth(1);
      await expect(row).toContainText("7");
      await expect(row).toContainText("<PHONE_NUMBER>");
      await expect(page.locator(".recharts-line-dot")).toHaveCount(1);
      await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
      await page.goto(`${baseURL}/admin`);
      await expect(page.getByRole("heading", { name: "Admins only" })).toBeVisible();
      await page.goto(`${baseURL}/mood`);
      await expect(page.locator(".recharts-line-dot")).toHaveCount(1);
      await page.screenshot({ path: "test-results/live-mood.png", fullPage: true });
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
