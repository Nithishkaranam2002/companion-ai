// Click-through audit: every interactive element on every page, in four account states
// (logged out, demo, signed in, admin) x desktop/mobile (projects) x light/dark.
// The API is mocked (no model calls, nothing written); Supabase sign-in is real.
// Results: .e2e-state/audit/<run id>/*.jsonl -> `npm run audit:report` -> tests/ui-audit.md + tests/ui-inventory.md
import fs from "node:fs";

import type { Session } from "@supabase/supabase-js";
import { test as base, expect } from "@playwright/test";

import {
  CID_ANSWER,
  CID_CRISIS,
  mockApi,
  saveResults,
  stubAuth,
  stubExternalSites,
  sweepPage,
  type Item,
  type Role,
} from "./audit-lib";
import { API as API_URL } from "./audit-lib";
import { watchErrors } from "./fixtures";
import { authPaths } from "./global-setup";

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
    await use(role === "logged-out" ? undefined : role === "demo" ? authPaths().demoState : authPaths().userState);
  },
});
const anonSession = () => JSON.parse(fs.readFileSync(authPaths().anon, "utf8")) as Session;

test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY for test users");

for (const role of ["logged-out", "demo", "user", "admin"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`@audit ${role}, ${scheme}`, () => {
      test.use({ role, colorScheme: scheme, actionTimeout: 10_000, navigationTimeout: 20_000 });
      // Remote runs get one retry for network blips; the report keeps only the final attempt.
      test.describe.configure({ mode: "parallel", retries: process.env.E2E_BASE_URL ? 1 : 0 });

      for (const path of PAGES[role]) {
        test(`${path}`, async ({ page, context, baseURL }, info) => {
          test.setTimeout(15 * 60_000);
          await stubExternalSites(context, baseURL!);
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
          // A replacement page (after a stuck step) reports into the same list.
          const freshPage = async () => {
            const next = await context.newPage();
            const more = watchErrors(next);
            const push = more.push.bind(more);
            more.push = (...items: string[]) => (problems.push(...items), push(...items));
            return next;
          };
          if (process.env.AUDIT_DEBUG_401) {
            const t0 = Date.now();
            page.on("request", (r) => {
              if (r.url().startsWith(API_URL))
                console.log(`+${Date.now() - t0}ms req ${r.method()} ${new URL(r.url()).pathname} frame=${r.frame().url()} referer=${r.headers().referer ?? "-"} auth=${Boolean(r.headers().authorization)}`);
            });
            page.on("response", (r) => {
              if (r.status() === 401) console.log(`+${Date.now() - t0}ms 401 ${new URL(r.url()).pathname} frame-now=${r.frame().url()}`);
            });
            page.on("framenavigated", (f) => f === page.mainFrame() && console.log(`+${Date.now() - t0}ms nav ${f.url()}`));
          }
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
            freshPage,
            reset: async (current) => {
              if (process.env.AUDIT_DEBUG_401) console.log(`reset (page was ${page.url()})`);
              resetData();
              await context.clearCookies();
              if (cookies.length) await context.addCookies(cookies);
              for (const p of context.pages()) if (p !== current) await p.close();
            },
            skip: (item: Item) => DEDICATED.find(([re]) => re.test(item.key))?.[1] ?? null,
          });
          const slug = path.replace(/[^a-z0-9]+/gi, "_") || "root";
          saveResults(
            results.map((r) => ({ ...r, attempt: info.retry })),
            `.e2e-state/audit/${process.env.E2E_RUN_ID ?? "local"}/${info.project.name}-${role}-${scheme}-${slug}-r${info.retry}.jsonl`,
          );

          const failures = results.filter((r) => r.result === "fail").map((r) => `${r.element}: ${r.detail}`);
          expect(results.length, "found interactive elements").toBeGreaterThan(0);
          expect(failures, "every element does something visible and correct").toEqual([]);
          // The 404 page answers 404 by design; everything else must load cleanly.
          const unexpected =
            path === "/no-such-page"
              ? problems.filter((p) => !p.includes("/no-such-page") && !/status of 404 \((Not Found)?\)/.test(p))
              : problems;
          expect(unexpected, "no console errors, 404s or failed requests").toEqual([]);
        });
      }
    });
  }
}
