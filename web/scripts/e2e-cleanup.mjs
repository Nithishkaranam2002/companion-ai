// Deletes Supabase users (and their escalation tickets) created by e2e tests, and nothing else.
//
//   node scripts/e2e-cleanup.mjs --run <E2E_RUN_ID>     this run's users (CI's always-run step)
//   node scripts/e2e-cleanup.mjs --stale-hours 6        test users older than 6h (leftovers)
//   add --dry-run to list without deleting
//
// A user counts as a test user only if its email is e2e-...@example.com, or it is anonymous AND
// tagged user_metadata.e2e = true (tests/e2e/auth-helper.ts testUserTag). Any other account,
// including real people and admins, can never match. Untagged anonymous users (real demo visitors,
// or test runs from before tagging) are listed but never deleted.
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; prints no secrets.
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* CI passes env directly */
  }
}

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const runId = opt("--run");
const staleHours = opt("--stale-hours");
const dryRun = args.includes("--dry-run");
if (!runId && !staleHours) {
  console.error("usage: e2e-cleanup.mjs (--run <id> | --stale-hours <h>) [--dry-run]");
  process.exit(2);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("Supabase keys not set; nothing to clean up.");
  process.exit(0);
}

const TEST_EMAIL = /^e2e-[a-z0-9-]+@example\.com$/i;
const isTestUser = (u) =>
  (u.email ? TEST_EMAIL.test(u.email) : false) || (u.is_anonymous === true && u.user_metadata?.e2e === true);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  users.push(...data.users);
  if (data.users.length < 1000) break;
}

const cutoff = staleHours ? Date.now() - Number(staleHours) * 3600_000 : null;
const targets = users.filter(
  (u) =>
    isTestUser(u) &&
    (runId ? u.user_metadata?.e2e_run === runId : true) &&
    (cutoff ? Date.parse(u.created_at) < cutoff : true),
);
const untaggedAnon = users.filter((u) => u.is_anonymous && u.user_metadata?.e2e !== true);

const label = (u) => `${u.email || "(anonymous)"}  id=${u.id}  created=${u.created_at}  run=${u.user_metadata?.e2e_run ?? "-"}`;
let tickets = 0;
for (const u of targets) {
  const { count } = await sb.from("escalations").select("id", { count: "exact", head: true }).eq("user_id", u.id);
  tickets += count ?? 0;
  console.log(`${dryRun ? "would delete" : "deleting"}: ${label(u)}  tickets=${count ?? 0}`);
  if (dryRun) continue;
  await sb.from("escalations").delete().eq("user_id", u.id);
  const { error } = await sb.auth.admin.deleteUser(u.id);
  if (error) console.log(`  failed: ${error.message}`);
}
console.log(
  `${dryRun ? "Would delete" : "Deleted"} ${targets.length} test user(s) and ${tickets} ticket(s) ` +
    `(${users.length} users total, ${users.length - targets.length} untouched).`,
);
if (untaggedAnon.length) {
  console.log(`Untagged anonymous users (not deleted; may be real demo visitors): ${untaggedAnon.length}`);
  for (const u of untaggedAnon) console.log(`  ${label(u)}`);
}
