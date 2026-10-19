// Test-only helper: creates a throwaway confirmed user with the Supabase admin API and
// signs the browser in through our real /auth/callback route. Never imported by app code.
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("E2E auth needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Every user a test creates carries this tag (plus an e2e-...@example.com email when it has one),
 *  so scripts/e2e-cleanup.mjs can find exactly those users and never anyone else. */
export function testUserTag() {
  return { e2e: true, e2e_run: process.env.E2E_RUN_ID ?? "local" };
}

export async function createTestUser(): Promise<{ id: string; email: string }> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { data, error } = await admin().auth.admin.createUser({ email, email_confirm: true, user_metadata: testUserTag() });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return { id: data.user.id, email };
}

/** Removes the user and any escalation tickets they created, so tests never leave
 *  entries in the real review queue (tickets otherwise outlive deleted accounts). */
export async function deleteTestUser(id: string) {
  const sb = admin();
  await sb.from("escalations").delete().eq("user_id", id);
  await sb.auth.admin.deleteUser(id);
}

export async function signIn(page: Page, baseURL: string, email: string, next = "/chat") {
  const { data, error } = await admin().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const hash = data.properties.hashed_token;
  await page.goto(`${baseURL}/auth/callback?token_hash=${hash}&type=magiclink&next=${encodeURIComponent(next)}`);
}

const pending = new Set<string>();

/** Register a user for deletion by `cleanupUsers()`, which test files call in afterEach:
 *  hooks still run when a test times out, unlike a `finally` block. */
export function deleteLater(id: string) {
  pending.add(id);
}

export async function cleanupUsers() {
  for (const id of [...pending]) {
    await deleteTestUser(id);
    pending.delete(id);
  }
}

/** Anonymous (demo) sign-ups create real auth users; resolves with the new user's id. */
export function captureAnonymousUser(page: Page): Promise<string> {
  // Pass the real sign-up through, tagged as a test user, and read its id here: the demo button
  // navigates as soon as sign-up returns, so the page's own response body is gone by then.
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no anonymous sign-up within 30s")), 30_000);
    void page.route("**/auth/v1/signup**", async (route) => {
      const req = route.request();
      if (req.method() !== "POST") return route.continue();
      const body = JSON.parse(req.postData() || "{}") as { data?: object };
      body.data = { ...body.data, ...testUserTag() };
      const res = await route.fetch({ postData: JSON.stringify(body) });
      const json = (await res.json()) as { user?: { id: string } };
      if (json.user?.id) {
        clearTimeout(timer);
        resolve(json.user.id);
      }
      await route.fulfill({ response: res, json });
    });
  });
}

/** A real anonymous (demo) session created server-side, so tests can hand it to the browser
 *  instead of creating a new anonymous user on every demo click (Supabase rate-limits those). */
export async function createAnonymousSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInAnonymously({ options: { data: testUserTag() } });
  if (error || !data.session) throw error ?? new Error("anonymous sign-in returned no session");
  return data.session;
}
