// Shared sessions for the whole run: one signed-in test user and one anonymous (demo) user.
// Supabase rate-limits sign-ins and anonymous sign-ups per IP, so parallel workers reuse these
// storage states instead of signing in themselves. Cookies are written by @supabase/ssr itself,
// so they match what the app sets. Global teardown deletes both users.
import fs from "node:fs";

import type { FullConfig } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient, type Session } from "@supabase/supabase-js";

import { createAnonymousSession, createTestUser } from "./auth-helper";

export const AUTH_DIR = "test-results/.auth";
export const ANON_FILE = `${AUTH_DIR}/anon-session.json`;
export const USER_FILE = `${AUTH_DIR}/user.json`; // { id, email }
export const USER_STATE = `${AUTH_DIR}/user-state.json`;
export const DEMO_STATE = `${AUTH_DIR}/demo-state.json`;

/** Turns a Supabase session into a Playwright storage state with the app's auth cookies. */
async function storageStateFor(session: Session, baseURL: string) {
  let jar: { name: string; value: string }[] = [];
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => jar,
      setAll: (cookies) => {
        jar = cookies.map(({ name, value }) => ({ name, value }));
      },
    },
  });
  const { error } = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (error) throw error;
  const url = new URL(baseURL);
  return {
    cookies: jar.map(({ name, value }) => ({
      name,
      value,
      domain: url.hostname,
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 3600 * 4,
      httpOnly: false,
      secure: url.protocol === "https:",
      sameSite: "Lax" as const,
    })),
    origins: [],
  };
}

async function signInSession(email: string): Promise<Session> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data, error: verifyError } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (verifyError || !data.session) throw verifyError ?? new Error("verifyOtp returned no session");
  return data.session;
}

export default async function globalSetup(config: FullConfig) {
  for (const file of [".env.local", ".env.development.local"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      /* optional */
    }
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  const baseURL = config.projects[0].use.baseURL!;
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const write = (file: string, data: unknown) => fs.writeFileSync(file, JSON.stringify(data), { mode: 0o600 });

  const anon = await createAnonymousSession();
  write(ANON_FILE, anon);
  write(DEMO_STATE, await storageStateFor(anon, baseURL));

  const user = await createTestUser();
  write(USER_FILE, user);
  write(USER_STATE, await storageStateFor(await signInSession(user.email), baseURL));
}
