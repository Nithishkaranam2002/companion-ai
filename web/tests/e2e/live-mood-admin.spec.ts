// @live: real API + Supabase (no LLM calls). Admin test needs the API started with
// ADMIN_EMAILS including e2e-admin@example.com (local runs only).
import { createClient } from "@supabase/supabase-js";
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

  test("admin sees and resolves an escalation ticket", async ({ page, baseURL }) => {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const existing = (await sb.auth.admin.listUsers()).data.users.find((u) => u.email === "e2e-admin@example.com");
    if (existing) await sb.auth.admin.deleteUser(existing.id);
    const { data } = await sb.auth.admin.createUser({ email: "e2e-admin@example.com", email_confirm: true });
    const adminId = data.user!.id;
    try {
      // Create a real ticket through the API as a separate user (no LLM: escalation path).
      const reporter = await createTestUser();
      const { data: link, error: linkError } = await sb.auth.admin.generateLink({ type: "magiclink", email: reporter.email });
      if (linkError || !link.properties) throw linkError ?? new Error("generateLink returned no token");
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false },
      });
      const { data: session } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/chat/stream`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.session!.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Can I talk to a real person please?" }),
      });
      expect(res.ok).toBeTruthy();
      await res.text();

      await signIn(page, baseURL!, "e2e-admin@example.com", "/admin");
      await expect(page.getByRole("heading", { name: "Escalation queue" })).toBeVisible();
      const card = page.locator("div[data-slot=card]").filter({ hasText: "Can I talk to a real person please?" });
      await expect(card).toBeVisible();
      await expect(card).toContainText("Asked for a person");
      await page.screenshot({ path: "test-results/live-admin.png", fullPage: true });
      await card.getByRole("button", { name: "Mark resolved" }).click();
      await expect(page.getByText("Ticket resolved")).toBeVisible();
      await page.getByRole("tab", { name: /Resolved/ }).click();
      await expect(page.getByText("Can I talk to a real person please?").first()).toBeVisible();
      await deleteTestUser(reporter.id);
    } finally {
      await sb.auth.admin.deleteUser(adminId);
    }
  });
});
