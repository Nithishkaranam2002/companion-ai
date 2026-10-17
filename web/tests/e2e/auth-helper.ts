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

export async function createTestUser(): Promise<{ id: string; email: string }> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { data, error } = await admin().auth.admin.createUser({ email, email_confirm: true });
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
  return page
    .waitForResponse((r) => r.url().includes("/auth/v1/signup") && r.request().method() === "POST" && r.ok(), {
      timeout: 30_000,
    })
    .then(async (r) => ((await r.json()) as { user: { id: string } }).user.id);
}
