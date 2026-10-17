// @live: the real API and database, with no model calls. Data is seeded with the service role and
// removed afterwards. Admin: E2E_ADMIN_EMAIL must be in the API's ADMIN_EMAILS (defaults to the
// local e2e admin); against production, pass the real admin email.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { cleanupUsers, createAnonymousSession, createTestUser, deleteLater, signIn } from "./auth-helper";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.com";

function db(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

test.describe("@live real API (no model calls)", () => {
  test.skip(({ isMobile }) => isMobile, "one live run is enough");
  test.setTimeout(180_000); // a free Render instance may be waking up
  test.afterEach(cleanupUsers);

  test("rename and delete a saved conversation", async ({ page, baseURL }) => {
    const user = await createTestUser();
    deleteLater(user.id);
    const { data: convo, error } = await db()
      .from("conversations")
      .insert({ user_id: user.id, title: "Sleep questions" })
      .select()
      .single();
    if (error) throw error;
    await db().from("messages").insert([
      { conversation_id: convo.id, user_id: user.id, role: "user", content: "How can I sleep better?" },
      { conversation_id: convo.id, user_id: user.id, role: "assistant", content: "A steady bedtime helps.", route: "answer", label: "in_scope" },
    ]);

    await signIn(page, baseURL!, user.email, `/chat/${convo.id}`);
    await expect(page.getByText("A steady bedtime helps.")).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Options for conversation: Sleep questions" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByRole("dialog").getByLabel("Name").fill("Bedtime plan, call 555-123-4567");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Conversation renamed")).toBeVisible();
    // The API redacts names you give conversations, like everything else it stores.
    await expect(page.getByRole("navigation", { name: "Conversations" })).toContainText("Bedtime plan, call <PHONE_NUMBER>");
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Conversations" })).toContainText("Bedtime plan");

    await page.getByRole("button", { name: /^Options for conversation: Bedtime plan/ }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Conversation deleted")).toBeVisible();
    await expect(page).toHaveURL(/\/chat$/);
    const { count } = await db().from("conversations").select("*", { count: "exact", head: true }).eq("user_id", user.id);
    expect(count).toBe(0);
  });

  test("a used-up demo says to sign up, and the API refuses more messages", async ({ page, context, baseURL }) => {
    const session = await createAnonymousSession();
    deleteLater(session.user.id);
    await db()
      .from("usage_events")
      .insert(Array.from({ length: 10 }, () => ({ user_id: session.user.id, is_demo: true })));
    // Hand the browser this demo session through the normal demo button.
    await context.route("**/auth/v1/signup**", (r) => r.fulfill({ json: session }));
    await page.goto(`${baseURL}/`);
    await page.getByRole("button", { name: "Try it free — no sign-up" }).first().click();
    await expect(page).toHaveURL(/\/chat$/, { timeout: 30_000 });
    await expect(page.getByText(/Demo mode:\s*0\s*of 10 messages left/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("alert").filter({ hasText: "Demo complete" })).toBeVisible();
    await expect(page.getByLabel("Message CompanionAI")).toBeDisabled();

    const api = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
    const res = await fetch(`${api}/chat/stream`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    expect(res.status).toBe(429);
    expect(((await res.json()) as { detail: { reason: string } }).detail.reason).toBe("demo_total");
    await page.getByRole("alert").getByRole("link", { name: "Create a free account" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("admin sees, resolves and files a ticket", async ({ page, baseURL }) => {
    test.skip(
      Boolean(process.env.E2E_BASE_URL) && !process.env.E2E_ADMIN_EMAIL,
      "set E2E_ADMIN_EMAIL to an address in the API's ADMIN_EMAILS",
    );
    const sb = db();
    const existing = (await sb.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === ADMIN_EMAIL);
    let adminId = existing?.id;
    if (!adminId) {
      const { data, error } = await sb.auth.admin.createUser({ email: ADMIN_EMAIL, email_confirm: true });
      if (error) throw error;
      adminId = data.user.id;
      deleteLater(adminId); // only remove an admin account this test created
    }
    const reporter = await createTestUser();
    deleteLater(reporter.id); // also removes its tickets
    const summary = `Audit ticket ${Date.now()}: can I talk to a real person?`;
    const { error } = await sb.from("escalations").insert({ user_id: reporter.id, reason: "human_request", summary, urgent: false });
    if (error) throw error;

    await signIn(page, baseURL!, ADMIN_EMAIL, "/admin");
    await expect(page.getByRole("heading", { name: "Escalation queue" })).toBeVisible({ timeout: 60_000 });
    const card = page.locator("div[data-slot=card]").filter({ hasText: summary });
    await expect(card).toContainText("Asked for a person");
    await card.getByRole("button", { name: "Mark resolved" }).click();
    await expect(page.getByText("Ticket resolved")).toBeVisible();
    await page.getByRole("tab", { name: /Resolved/ }).click();
    await expect(page.getByText(summary)).toBeVisible();
    await page.getByRole("tab", { name: /Contact/ }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
    // Sign out of the admin session in this browser only (other devices stay signed in).
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
