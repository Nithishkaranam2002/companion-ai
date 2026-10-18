// Behaviors the generic audit can't judge on its own: what each pricing button promises, loading
// states, rename/delete/new chat, mood logging, the demo running out, and Back after sign in/out.
// API mocked (no model calls); Supabase sign-in is real.
import fs from "node:fs";

import type { Page } from "@playwright/test";
import type { Session } from "@supabase/supabase-js";

import { API, CID_ANSWER, CID_CRISIS, mockApi, stubAuth } from "./audit-lib";
import { cleanupUsers, createTestUser, deleteLater, signIn } from "./auth-helper";
import AxeBuilder from "@axe-core/playwright";

import { authedTest, expect, test } from "./fixtures";
import { authPaths } from "./global-setup";

const hasAuth = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const anon = () => JSON.parse(fs.readFileSync(authPaths().anon, "utf8")) as Session;

/** Delays one API call so its loading state is observable. */
async function slow(page: Page, path: string, method: string, ms = 1200) {
  await page.route(`${API}${path}`, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    await new Promise((r) => setTimeout(r, ms));
    await route.fallback();
  });
}

/** The conversation list: the sidebar on desktop, the drawer (opened on demand) on mobile. */
async function conversationList(page: Page, isMobile: boolean) {
  const list = page.getByRole("navigation", { name: "Conversations" }).filter({ visible: true });
  if (isMobile && !(await list.count())) await page.getByRole("button", { name: "Open conversations" }).click();
  await expect(list).toBeVisible();
  return list;
}

async function openConversationMenu(page: Page, title: string, isMobile: boolean) {
  const list = await conversationList(page, isMobile);
  await list.getByRole("button", { name: `Options for conversation: ${title}` }).click();
}

test.describe("pricing", () => {
  test("every plan button says what happens and leads somewhere real", async ({ page, problems }) => {
    await page.goto("/pricing");
    await expect(page.getByText("No payments are collected today.")).toBeVisible();
    await expect(page.getByText("Coming soon")).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();
    // A wellness service makes no compliance or clinical-product claims.
    await expect(page.getByText(/business associate|\bBAA\b|HIPAA[- ]compliant|clinic plan/i)).toHaveCount(0);
    const plans = [
      { name: "Create a free account", note: "Email sign-in link. No card needed.", url: /\/login$/, topic: null },
      { name: "Join the Pro waitlist", note: "Opens a short form. No payment.", url: /\/contact\?topic=pro$/, topic: "pro" },
      { name: "Talk to us", note: "Opens a short form. No payment.", url: /\/contact\?topic=clinic$/, topic: "clinic" },
    ];
    for (const plan of plans) {
      await page.goto("/pricing");
      const cta = page.getByRole("link", { name: plan.name });
      await expect(cta).toHaveAccessibleDescription(plan.note);
      await cta.click();
      await expect(page).toHaveURL(plan.url);
      if (plan.topic) await expect(page.getByLabel("Topic")).toHaveValue(plan.topic);
      if (plan.topic === "clinic") await expect(page.getByLabel("Topic").locator("option:checked")).toHaveText("Teams plan");
      await expect(page.getByText(/checkout|card number/i)).toHaveCount(0);
    }
    void problems;
  });
});

test.describe("forms show loading, then a clear result", () => {
  test.skip(!hasAuth, "needs Supabase test keys");

  test("magic link: spinner, then check-your-inbox", async ({ page, context, problems }) => {
    await stubAuth(context, anon());
    await page.route("**/auth/v1/otp**", async (r) => {
      await new Promise((res) => setTimeout(res, 1000));
      await r.fallback();
    });
    await page.goto("/login");
    await page.getByLabel("Email address").fill("someone@example.com");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("Check your inbox");
    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByLabel("Email address")).toBeVisible();
    void problems;
  });

  test("contact form: required fields, spinner, then thanks", async ({ page, context, problems }) => {
    await mockApi(context, "logged-out");
    await slow(page, "/contact", "POST");
    await page.goto("/contact");
    const send = page.getByRole("button", { name: /send/i });
    await send.click();
    await expect(page).toHaveURL(/\/contact$/); // browser validation blocks the empty form
    await page.getByLabel("Name", { exact: true }).fill("Sam");
    await page.getByLabel("Email", { exact: true }).fill("sam@example.com");
    await page.getByLabel("Message", { exact: true }).fill("Please add me to the Pro waitlist.");
    await send.click();
    await expect(send).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("Thank you, message received");
    void problems;
  });

  test("demo button: spinner while the demo starts, then the chat", async ({ page, context, problems }) => {
    await stubAuth(context, anon());
    await mockApi(context, "logged-out");
    await page.route("**/auth/v1/signup**", async (r) => {
      await new Promise((res) => setTimeout(res, 1000));
      await r.fallback();
    });
    await page.goto("/");
    // The bottom button sits next to the footer's prefetched /chat link (regression: it used to bounce to /login).
    const start = page.getByRole("button", { name: "Start the demo" });
    await start.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await start.click();
    await expect(start).toBeDisabled();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByText(/Demo mode:\s*7\s*of 10/)).toBeVisible();
    void problems;
  });
});

authedTest.describe("chat actions (signed in)", () => {
  authedTest.skip(!hasAuth, "needs Supabase test keys");

  authedTest("send shows typing, then a cited answer; new chat clears it", async ({ page, context, isMobile, problems }) => {
    await mockApi(context, "user");
    await slow(page, "/chat/stream", "POST");
    await page.goto(`/chat/${CID_ANSWER}`);
    await page.getByLabel("Message CompanionAI").fill("Any tips for winding down?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("status", { name: "CompanionAI is typing" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Stop generating" })).toBeVisible();
    await expect(page.getByText("Try a few slow breaths before bed")).toBeVisible();
    if (isMobile) await page.getByRole("button", { name: "Open conversations" }).click();
    await page.getByRole("button", { name: "New chat" }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByRole("heading", { name: "How are you, really?" })).toBeVisible();
    void problems;
  });

  authedTest("rename: menu, dialog, saving state, new name in the sidebar", async ({ page, context, isMobile, problems }) => {
    await mockApi(context, "user");
    await slow(page, `/conversations/${CID_CRISIS}`, "PATCH");
    await page.goto("/chat");
    await openConversationMenu(page, "Feeling overwhelmed tonight", isMobile);
    await page.getByRole("menuitem", { name: "Rename" }).click();
    const dialog = page.getByRole("dialog", { name: "Rename conversation" });
    const name = dialog.getByLabel("Name");
    await expect(name).toBeFocused();
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled(); // unchanged name
    await name.fill("Tuesday check-in");
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled(); // saving
    await expect(page.getByText("Conversation renamed")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(await conversationList(page, isMobile)).toContainText("Tuesday check-in");

    // Escape cancels without saving.
    await openConversationMenu(page, "Tuesday check-in", isMobile);
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Rename conversation" })).toBeHidden();
    void problems;
  });

  authedTest("delete: confirm dialog with a working state; the open chat resets", async ({ page, context, isMobile, problems }) => {
    await mockApi(context, "user");
    await slow(page, `/conversations/${CID_ANSWER}`, "DELETE");
    await page.goto(`/chat/${CID_ANSWER}`);
    await expect(page.getByText("Slow breathing can help you unwind")).toBeVisible();
    await openConversationMenu(page, "How can I sleep better?", isMobile);
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("button", { name: "Keep it" }).click();
    await expect(confirm).toBeHidden();
    await openConversationMenu(page, "How can I sleep better?", isMobile);
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(confirm.getByRole("button", { name: "Delete" })).toBeDisabled();
    await expect(page.getByText("Conversation deleted")).toBeVisible();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(await conversationList(page, isMobile)).not.toContainText("How can I sleep better?");
    void problems;
  });

  authedTest("mood: keyboard slider, saving state, chart and table update", async ({ page, context, problems }) => {
    await mockApi(context, "user");
    await slow(page, "/mood", "POST");
    await page.goto("/mood");
    await expect(page.locator(".recharts-line-dot")).toHaveCount(8);
    // The thumb (role=slider) carries the name and spoken value, not the wrapper.
    const slider = page.getByRole("slider", { name: "Mood, 1 to 10" });
    await expect(slider).toHaveAttribute("aria-valuetext", "6 out of 10, Okay");
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "8");
    await expect(slider).toHaveAttribute("aria-valuetext", /^8 out of 10, /);
    await page.getByLabel("Note (optional)").fill("Good day");
    const save = page.getByRole("button", { name: "Save check-in" });
    await save.click();
    await expect(save).toBeDisabled();
    await expect(page.getByText("Check-in saved")).toBeVisible();
    await expect(page.getByRole("table").getByRole("row").nth(1)).toContainText("Good day");
    await expect(page.locator(".recharts-line-dot")).toHaveCount(9);
    await page.getByRole("radio", { name: "90 days" }).click();
    await expect(page.getByRole("radio", { name: "90 days" })).toHaveAttribute("aria-checked", "true");
    void problems;
  });

  authedTest("crisis banner: 988 call/text links and the chat-online link", async ({ page, context, problems }) => {
    await mockApi(context, "user");
    await page.goto(`/chat/${CID_CRISIS}`);
    const banner = page.getByRole("alert").filter({ hasText: "You don't have to go through this alone" });
    await expect(banner.getByRole("link", { name: "Call 988" })).toHaveAttribute("href", "tel:988");
    await expect(banner.getByRole("link", { name: "Text 988" })).toHaveAttribute("href", "sms:988");
    const online = banner.getByRole("link", { name: "Chat online" });
    await expect(online).toHaveAttribute("target", "_blank");
    await expect(online).toHaveAttribute("href", /988lifeline\.org/);
    void problems;
  });
});

test.describe("demo running out", () => {
  test.skip(!hasAuth, "needs Supabase test keys");

  test("last message → 'Demo complete' with sign-up; still clear after a reload", async ({ page, context, problems }) => {
    await stubAuth(context, anon());
    await mockApi(context, "logged-out"); // becomes the demo user after sign-in
    await page.goto("/");
    await page.getByRole("button", { name: "Try it free — no sign-up" }).first().click();
    await expect(page).toHaveURL(/\/chat$/);
    // The mock starts demo users at 7 left; use them up.
    for (let left = 7; left > 0; left--) {
      await page.getByLabel("Message CompanionAI").fill(`message ${left}`);
      await page.getByRole("button", { name: "Send message" }).click();
      await expect(page.getByText(new RegExp(`Demo mode:\\s*${left - 1}\\s*of 10`))).toBeVisible();
    }
    const notice = page.getByRole("alert").filter({ hasText: "Demo complete" });
    await expect(notice).toBeVisible();
    await expect(page.getByLabel("Message CompanionAI")).toBeDisabled();
    await page.reload();
    await expect(page.getByRole("alert").filter({ hasText: "Demo complete" })).toBeVisible();
    await page.getByRole("alert").getByRole("link", { name: "Create a free account" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
    void problems;
  });
});

test.describe("back button after signing in and out", () => {
  test.skip(!hasAuth, "needs Supabase test keys");
  test.afterEach(cleanupUsers);

  test("after sign-in, Back doesn't show the sign-in form again", async ({ page, context, baseURL }) => {
    await mockApi(context, "user");
    const user = await createTestUser();
    deleteLater(user.id);
    await page.goto("/login?next=/mood");
    await signIn(page, baseURL!, user.email, "/mood");
    await expect(page).toHaveURL(/\/mood$/);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toHaveCount(0);
  });

  test("after sign-out, Back can't reopen private pages", async ({ page, context, baseURL }) => {
    await mockApi(context, "user");
    const user = await createTestUser();
    deleteLater(user.id);
    await signIn(page, baseURL!, user.email, "/mood");
    await expect(page.getByRole("heading", { name: "Mood tracker" })).toBeVisible();
    await page.goto(`/chat/${CID_ANSWER}`);
    await expect(page.getByText("Slow breathing can help you unwind")).toBeVisible();
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "Account menu" })).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.getByText("Slow breathing can help you unwind")).toHaveCount(0);
    await page.goto("/mood");
    await expect(page).toHaveURL(/\/login\?next=%2Fmood/);
  });
});

// The public pages are scanned in a11y.spec.ts; these are the signed-in ones (mocked API).
for (const scheme of ["light", "dark"] as const) {
  authedTest.describe(`signed-in pages are accessible (${scheme})`, () => {
    authedTest.skip(!hasAuth, "needs Supabase test keys");
    authedTest.use({ colorScheme: scheme });
    for (const [path, role] of [
      ["/chat", "user"],
      [`/chat/${CID_ANSWER}`, "user"],
      [`/chat/${CID_CRISIS}`, "user"],
      ["/mood", "user"],
      ["/admin", "admin"],
    ] as const) {
      authedTest(`${path} (${role}) has no serious or critical axe violations`, async ({ page, context }) => {
        await mockApi(context, role);
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(800); // entrance animations settle before contrast checks
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const serious = results.violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => `${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
        expect(serious).toEqual([]);
      });
    }
  });
}

authedTest.describe("when the session ends under an open page", () => {
  authedTest.skip(!hasAuth, "needs Supabase test keys");

  /** Console errors other than the browser's own "Failed to load resource" line for a 401. */
  function watchUnexpected(page: Page) {
    const unexpected: string[] = [];
    page.on("pageerror", (e) => unexpected.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !/status of 401/.test(m.text())) unexpected.push(m.text());
    });
    return unexpected;
  }

  authedTest("API rejects the session: one redirect to sign-in with a note, no loop", async ({ page, context }) => {
    await stubAuth(context, anon()); // keeps the shared session from being revoked server-side
    await mockApi(context, "user");
    let meCalls = 0;
    for (const path of ["/me", "/conversations"]) {
      await page.route(`${API}${path}`, async (route) => {
        if (path === "/me") meCalls++;
        await route.fulfill({ status: 401, headers: { "access-control-allow-origin": "*" }, json: { detail: "Invalid token" } });
      });
    }
    const unexpected = watchUnexpected(page);
    await page.goto("/chat");
    await expect(page).toHaveURL(/\/login\?next=%2Fchat&expired=1$/);
    await expect(page.getByRole("status")).toContainText("Your session ended");
    await page.waitForTimeout(2500); // a loop would keep calling /me and navigating
    await expect(page).toHaveURL(/\/login\?next=%2Fchat&expired=1$/);
    expect(meCalls).toBeLessThanOrEqual(1);
    expect(await context.cookies()).toEqual(expect.not.arrayContaining([expect.objectContaining({ name: expect.stringMatching(/-auth-token/) })]));
    expect(unexpected).toEqual([]);
  });

  authedTest("signing out while requests are in flight lands on home, not 'session ended'", async ({ page, context }) => {
    await stubAuth(context, anon());
    await mockApi(context, "user");
    for (const path of ["/conversations", `/conversations/${CID_ANSWER}/messages`]) await slow(page, path, "GET", 2000);
    const unexpected = watchUnexpected(page);
    await page.goto(`/chat/${CID_ANSWER}`);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.waitForTimeout(2500); // late responses from the old page must not redirect
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Your session ended")).toHaveCount(0);
    expect(unexpected).toEqual([]);
  });

  authedTest("session cleared under an open page: the next action goes to sign-in", async ({ page, context }) => {
    await stubAuth(context, anon());
    await mockApi(context, "user"); // answers 401 to requests without a token, like the API
    const unexpected = watchUnexpected(page);
    await page.goto("/mood");
    await expect(page.getByRole("button", { name: "Save check-in" })).toBeVisible();
    await context.clearCookies(); // e.g. cleared site data, or a sign-out in another tab
    await page.getByRole("button", { name: "Save check-in" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fmood&expired=1$/);
    await expect(page.getByRole("status")).toContainText("Your session ended");
    expect(unexpected).toEqual([]);
  });
});

test("signed out, links to private pages aren't prefetched (no cached redirects, no 404s)", async ({ page, problems }) => {
  const privateRequests: string[] = [];
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (/^\/(chat|mood|admin)(\/|$)/.test(path)) privateRequests.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("contentinfo").scrollIntoViewIfNeeded(); // footer: Chat, Mood tracker
  await page.getByRole("contentinfo").getByRole("link", { name: "Chat" }).hover();
  await page.waitForTimeout(1500);
  expect(privateRequests).toEqual([]);
  await page.getByRole("contentinfo").getByRole("link", { name: "Chat" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fchat$/); // the real click still goes to sign-in
  void problems;
});
