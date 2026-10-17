// @screenshots: refreshes the README images. Real site, real API and model replies.
//   SCREENSHOTS=1 E2E_BASE_URL=https://companion-ai-tawny.vercel.app npx playwright test screenshots
// The admin shot needs an API whose ADMIN_EMAILS includes e2e-admin@example.com (a local API).
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { cleanupUsers, createTestUser, deleteLater, signIn } from "./auth-helper";

const OUT = "../docs/screenshots";
const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

async function ask(page: Page, text: string) {
  await page.getByLabel("Message CompanionAI").fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("button", { name: "Stop generating" })).toBeHidden({ timeout: 90_000 });
}

/** Scroll the chat so the reply carrying `label` is in view. */
async function showReply(page: Page, label: string) {
  await page.getByText(label).last().evaluate((el) => {
    el.scrollIntoView({ block: "center" });
    window.scrollTo(0, 0); // only the message list should move, not the page
  });
  await page.waitForTimeout(400);
}

test.describe("@screenshots", () => {
  test.skip(({ isMobile }) => isMobile, "mobile shots use an explicit viewport");
  test.setTimeout(240_000);
  test.use({ viewport: { width: 1280, height: 800 } });
  test.afterEach(cleanupUsers);

  test("marketing pages", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.screenshot({ path: `${OUT}/landing.png` });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto("/");
    await page.screenshot({ path: `${OUT}/landing-dark.png` });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("/safety");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.screenshot({ path: `${OUT}/safety.png`, fullPage: true });
  });

  test("chat: cited answer, medical refusal, crisis", async ({ page, baseURL }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const user = await createTestUser();
    deleteLater(user.id);
    await signIn(page, baseURL!, user.email);
    await ask(page, "How can I wind down before bed? My mind races at night.");
    await expect(page.getByText("Sources", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Conversations" })).toContainText("wind down");
    await page.screenshot({ path: `${OUT}/chat-answer.png` });

    await ask(page, "Should I double my sertraline dose? I still feel low.");
    await expect(page.getByText("Outside what I can help with")).toBeVisible();
    await showReply(page, "Outside what I can help with");
    await page.screenshot({ path: `${OUT}/chat-refusal.png` });

    await page.getByRole("button", { name: "New chat" }).first().click();
    await ask(page, "I can't do this anymore. I've been thinking about ending my life.");
    await expect(page.getByRole("alert").filter({ hasText: "You don't have to go through this alone" })).toBeVisible();
    await page.screenshot({ path: `${OUT}/chat-crisis.png` });

    await page.setViewportSize({ width: 412, height: 860 });
    await page.reload();
    await expect(page.getByRole("alert").filter({ hasText: "You don't have to go through this alone" })).toBeVisible();
    await page.screenshot({ path: `${OUT}/mobile-chat.png` });
  });

  test("mood tracker with three weeks of check-ins", async ({ page, baseURL }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const user = await createTestUser();
    deleteLater(user.id);
    const scores = [5, 4, 6, 5, 6, 7, 5, 4, 6, 7, 7, 6, 8, 7, 6, 7, 8, 8, 7, 8];
    const notes: Record<number, string> = { 1: "Rough day at work", 12: "Morning walk helped", 18: "Slept well" };
    const day = 86_400_000;
    const rows = scores.map((score, i) => ({
      user_id: user.id,
      score,
      note: notes[i] ?? "",
      created_at: new Date(Date.now() - (scores.length - i) * day + 9 * 3_600_000).toISOString(),
    }));
    const { error } = await admin().from("mood_entries").insert(rows);
    if (error) throw error;
    await signIn(page, baseURL!, user.email, "/mood");
    await expect(page.locator(".recharts-line-dot").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/mood.png`, fullPage: true });
  });

  test("admin escalation queue", async ({ page, baseURL }) => {
    test.skip(process.env.ADMIN_SHOT !== "1", "needs a local API with the e2e admin email");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const sb = admin();
    const old = (await sb.auth.admin.listUsers()).data.users.find((u) => u.email === "e2e-admin@example.com");
    if (old) await sb.auth.admin.deleteUser(old.id);
    const { data } = await sb.auth.admin.createUser({ email: "e2e-admin@example.com", email_confirm: true });
    deleteLater(data.user!.id);
    const reporters = [await createTestUser(), await createTestUser()];
    reporters.forEach((r) => deleteLater(r.id));
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const messages = ["Can I talk to a real person please?", "My chest hurts and my left arm feels numb"];
    for (const [i, r] of reporters.entries()) {
      const { data: link } = await sb.auth.admin.generateLink({ type: "magiclink", email: r.email });
      const { data: s } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties!.hashed_token });
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { Authorization: `Bearer ${s.session!.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: messages[i] }),
      });
      await res.text();
    }
    await signIn(page, baseURL!, "e2e-admin@example.com", "/admin");
    await expect(page.getByText(messages[1]).first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${OUT}/admin.png` });
  });
});
