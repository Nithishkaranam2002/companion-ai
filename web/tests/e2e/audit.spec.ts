// Click-through audit: every interactive element on every page, in four account states
// (logged out, demo, signed in, admin) x desktop/mobile (projects) x light/dark.
// The API is mocked (no model calls, nothing written); Supabase sign-in is real.
// Results: test-results/audit/*.jsonl -> `npm run audit:report` -> tests/ui-audit.md + tests/ui-inventory.md
import fs from "node:fs";

import type { Session } from "@supabase/supabase-js";
import { test as base, expect } from "@playwright/test";

import { CID_ANSWER, CID_CRISIS, mockApi, saveResults, stubAuth, sweepPage, type Item, type Role } from "./audit-lib";
import { watchErrors } from "./fixtures";
import { ANON_FILE, DEMO_STATE, USER_STATE } from "./global-setup";

const PUBLIC = ["/", "/pricing", "/safety", "/about", "/contact", "/privacy", "/terms", "/login", "/auth/error", "/no-such-page"];
const APP = ["/chat", `/chat/${CID_ANSWER}`, `/chat/${CID_CRISIS}`, "/mood", "/admin"];

const PAGES: Record<Role, string[]> = {
  "logged-out": PUBLIC,
  // Signed-in states: the public pages whose header or calls to action change, plus the app.
  demo: ["/", "/pricing", "/login", ...APP],
  user: ["/", "/pricing", ...APP],
  admin: ["/", ...APP],
};
// Shared header/footer are swept once per layout instead of on every page.
const CHROME_PAGES = new Set(["/", "/chat", "/no-such-page", "/login", "/auth/error"]);

// Elements whose real behavior has a dedicated test (see special-flows.spec.ts).
const DEDICATED: [RegExp, string][] = [[/^button\|Send message\|/, "special-flows: send + loading"]];

const test = base.extend<{ role: Role }>({
  role: ["logged-out", { option: true }],
  // Shared sessions from global setup; admin = the signed-in user with admin API responses.
  storageState: async ({ role }, use) => {
    await use(role === "logged-out" ? undefined : role === "demo" ? DEMO_STATE : USER_STATE);
  },
});
const anonSession = () => JSON.parse(fs.readFileSync(ANON_FILE, "utf8")) as Session;

test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY for test users");

for (const role of ["logged-out", "demo", "user", "admin"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`@audit ${role}, ${scheme}`, () => {
      test.use({ role, colorScheme: scheme, actionTimeout: 10_000, navigationTimeout: 20_000 });
      test.describe.configure({ mode: "parallel" });

      for (const path of PAGES[role]) {
        test(`${path}`, async ({ page, context, baseURL }, info) => {
          test.setTimeout(15 * 60_000);
          await stubAuth(context, anonSession());
          const resetData = await mockApi(context, role);
          // Each element starts from the same cookies and no saved theme override.
          await context.addInitScript(() => {
            try {
              window.localStorage.removeItem("theme");
            } catch {}
          });
          const cookies = await context.cookies();
          const problems = watchErrors(page);
          if (process.env.AUDIT_DEBUG) {
            page.on("framenavigated", (f) => f === page.mainFrame() && console.log("  nav", f.url()));
            page.on("request", async (r) => {
              if (r.url().includes("/auth/v1") || new URL(r.url()).pathname === "/chat")
                console.log("  req", r.method(), r.url().slice(0, 90), "cookie:", ((await r.allHeaders()).cookie ?? "").length);
            });
            page.on("response", (r) => r.url().includes("/auth/v1") && console.log("  res", r.status(), r.url().slice(0, 90)));
          }

          const results = await sweepPage({
            page,
            path,
            role,
            base: baseURL!,
            viewport: info.project.name,
            scheme,
            includeChrome: CHROME_PAGES.has(path),
            reset: async () => {
              resetData();
              await context.clearCookies();
              if (cookies.length) await context.addCookies(cookies);
              for (const p of context.pages()) if (p !== page) await p.close();
            },
            skip: (item: Item) => DEDICATED.find(([re]) => re.test(item.key))?.[1] ?? null,
          });
          saveResults(results, `test-results/audit/${info.project.name}-${role}-${scheme}.jsonl`);

          const failures = results.filter((r) => r.result === "fail").map((r) => `${r.element}: ${r.detail}`);
          expect(results.length, "found interactive elements").toBeGreaterThan(0);
          expect(failures, "every element does something visible and correct").toEqual([]);
          // The 404 page answers 404 by design; everything else must load cleanly.
          const unexpected =
            path === "/no-such-page"
              ? problems.filter((p) => !p.includes("/no-such-page") && !p.includes("status of 404 (Not Found)"))
              : problems;
          expect(unexpected, "no console errors, 404s or failed requests").toEqual([]);
        });
      }
    });
  }
}
