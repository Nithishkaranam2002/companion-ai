// App flows with a mocked API (deterministic, no LLM cost) and real Supabase sign-in.
// Needs SUPABASE_SERVICE_ROLE_KEY locally; skipped when it's absent.
import type { Page, Route } from "@playwright/test";

import { captureAnonymousUser, cleanupUsers, createTestUser, deleteLater, deleteTestUser, signIn } from "./auth-helper";
import { authedTest, expect, test } from "./fixtures";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const CID = "11111111-2222-4333-8444-555555555555";
const SOURCES = [
  { title: "Sleep Hygiene Basics", url: "https://www.cdc.gov/sleep/about/index.html", snippet: "Most adults need 7 or more hours." },
  { title: "Breathing Exercises for Stress", url: "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/", snippet: "Breathe in gently." },
  { title: "Sleep Hygiene Basics", url: "https://www.cdc.gov/sleep/about/index.html", snippet: "Keep a regular schedule." },
];

type Me = { is_anonymous?: boolean; is_admin?: boolean; remaining_messages?: number; limit?: number };

const sse = (events: [string, unknown][]) => events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
}

/** Mock the CompanionAI API. `chat` returns the SSE body (or a status + JSON error) for each send. */
async function mockApi(
  page: Page,
  opts: { me?: Me; conversations?: unknown[]; chat?: (body: { message: string }) => string | { status: number; body: unknown } } = {},
) {
  const me = { id: "u", email: "e2e@example.com", is_anonymous: false, is_admin: false, remaining_messages: 20, limit: 20, ...opts.me };
  let conversations = opts.conversations ?? [];
  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (path === "/me") return json(route, me);
    if (path === "/conversations" && req.method() === "GET") return json(route, conversations);
    if (path.startsWith("/conversations/") && req.method() === "DELETE") {
      conversations = conversations.filter((c) => (c as { id: string }).id !== path.split("/")[2]);
      return route.fulfill({ status: 204, headers: cors });
    }
    if (path.endsWith("/messages")) return json(route, []);
    if (path === "/chat/stream") {
      const out = opts.chat?.(req.postDataJSON()) ?? "";
      if (typeof out !== "string") return json(route, out.body, out.status);
      conversations = [{ id: CID, title: "How can I sleep better?", updated_at: new Date().toISOString() }];
      return route.fulfill({ status: 200, headers: { ...cors, "content-type": "text/event-stream" }, body: out });
    }
    return json(route, { detail: `unmocked ${path}` }, 500);
  });
}

async function send(page: Page, text: string) {
  await page.getByLabel("Message CompanionAI").fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

authedTest.describe("signed-in app (mocked API)", () => {
  authedTest.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY for test sign-in");
  const test = authedTest;

  test("streams a cited answer with clickable sources", async ({ page, baseURL, isMobile, problems }) => {
    await mockApi(page, {
      chat: () =>
        sse([
          ["meta", { route: "answer", label: "in_scope", conversation_id: CID }],
          ["sources", { sources: SOURCES }],
          ["token", { text: "Most adults need **7 or more hours** [1]. " }],
          ["token", { text: "Slow breathing can help you unwind [2]." }],
          ["done", { message_id: "m1", escalated: false, remaining: 19 }],
        ]),
    });
    await page.goto(`${baseURL}/chat`);
    await expect(page.getByRole("heading", { name: "How are you, really?" })).toBeVisible();
    await expect(page.getByText("Not a medical service. In crisis, call or text 988.")).toBeVisible();
    await send(page, "How can I sleep better?");

    await expect(page.getByText("Slow breathing can help you unwind")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/chat/${CID}$`));
    const chip = page.getByRole("link", { name: /^Source 2: Breathing Exercises for Stress/ });
    await expect(chip).toHaveAttribute("href", SOURCES[1].url);
    // Duplicate URLs collapse into one card listing both citation numbers.
    const card = page.getByRole("link", { name: /\[1, 3\] Sleep Hygiene Basics/ });
    await expect(card).toHaveAttribute("href", SOURCES[0].url);
    await expect(card).toHaveAttribute("target", "_blank");
    if (isMobile) await page.getByRole("button", { name: "Open conversations" }).click();
    await expect(page.getByRole("navigation", { name: "Conversations" })).toContainText("How can I sleep better?");
    void problems;
  });

  test("crisis reply shows the 988 banner, which can be dismissed", async ({ page, baseURL, problems }) => {
    await mockApi(page, {
      chat: () =>
        sse([
          ["meta", { route: "escalate", label: "crisis", conversation_id: CID }],
          ["token", { text: "I'm really glad you told me. Please call or text 988." }],
          ["done", { message_id: "m1", escalated: true, remaining: 19 }],
        ]),
    });
    await page.goto(`${baseURL}/chat`);
    await send(page, "I want to end my life");
    const banner = page.getByRole("alert").filter({ hasText: "You don't have to go through this alone" });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("link", { name: "Call 988" })).toHaveAttribute("href", "tel:988");
    await expect(banner.getByRole("link", { name: "Text 988" })).toHaveAttribute("href", "sms:988");
    await expect(page.getByText("Safety response")).toBeVisible();
    await banner.getByRole("button", { name: "Hide crisis resources" }).click();
    await expect(banner).toBeHidden();
    void problems;
  });

  test("medical emergency banner offers 911", async ({ page, baseURL, problems }) => {
    await mockApi(page, {
      chat: () =>
        sse([
          ["meta", { route: "escalate", label: "medical_emergency", conversation_id: CID }],
          ["token", { text: "This sounds like it could be a medical emergency." }],
          ["done", { escalated: true, remaining: 19 }],
        ]),
    });
    await page.goto(`${baseURL}/chat`);
    await send(page, "My dad has chest pain");
    await expect(page.getByRole("link", { name: "Call 911" })).toHaveAttribute("href", "tel:911");
    void problems;
  });

  test("an unsafe streamed sentence is replaced, never shown", async ({ page, baseURL, problems }) => {
    await mockApi(page, {
      chat: () =>
        sse([
          ["meta", { route: "answer", label: "in_scope", conversation_id: CID }],
          ["sources", { sources: SOURCES }],
          ["token", { text: "Rest is important. " }],
          ["replace", { text: "It makes sense to want answers. I'm a wellness companion rather than a medical provider." }],
          ["done", { escalated: false, remaining: 19 }],
        ]),
    });
    await page.goto(`${baseURL}/chat`);
    await send(page, "I can't sleep");
    await expect(page.getByText("rather than a medical provider")).toBeVisible();
    await expect(page.getByText("Outside what I can help with")).toBeVisible();
    await expect(page.getByText("Sources", { exact: true })).toHaveCount(0);
    void problems;
  });

  test("hourly limit shows a friendly notice", async ({ page, baseURL }) => {
    await mockApi(page, {
      chat: () => ({ status: 429, body: { detail: { reason: "user_hourly", message: "You've reached the hourly message limit. Please try again a bit later." } } }),
    });
    await page.goto(`${baseURL}/chat`);
    await send(page, "hello");
    await expect(page.getByText("Let's take a short pause")).toBeVisible();
    await expect(page.getByText("hourly message limit")).toBeVisible();
  });

  test("demo mode shows remaining messages and the sign-up prompt when used up", async ({ page, baseURL }) => {
    await mockApi(page, {
      me: { is_anonymous: true, remaining_messages: 1, limit: 10 },
      chat: () => ({ status: 429, body: { detail: { reason: "demo_total", message: "You've used all demo messages. Create a free account to keep chatting." } } }),
    });
    await page.goto(`${baseURL}/chat`);
    await expect(page.getByText(/Demo mode:\s*1\s*of 10 messages left/)).toBeVisible();
    await send(page, "hello");
    await expect(page.getByText("Demo complete")).toBeVisible();
    await expect(page.getByLabel("Message CompanionAI")).toBeDisabled();
    // (The test user is a real account with a mocked demo profile, so following the link would
    // redirect back to /chat; special-flows.spec.ts follows it as a real demo user.)
    await expect(page.getByRole("alert").getByRole("link", { name: "Create a free account" })).toHaveAttribute("href", "/login");
  });

  test("conversations can be deleted after confirming", async ({ page, baseURL, isMobile, problems }) => {
    await mockApi(page, { conversations: [{ id: CID, title: "Evening worries", updated_at: new Date().toISOString() }] });
    await page.goto(`${baseURL}/chat`);
    const nav = page.getByRole("navigation", { name: "Conversations" });
    if (isMobile) await page.getByRole("button", { name: "Open conversations" }).click();
    await expect(page.getByRole("button", { name: /Evening worries/ }).last()).toBeVisible();
    await page.getByRole("button", { name: "Options for conversation: Evening worries" }).last().click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Conversation deleted")).toBeVisible();
    await expect(nav.first()).not.toContainText("Evening worries");
    void problems;
  });

  test("mood: demo users are invited to sign up; admins-only page is guarded", async ({ page, baseURL, problems }) => {
    await mockApi(page, { me: { is_anonymous: true } });
    await page.goto(`${baseURL}/mood`);
    await expect(page.getByRole("heading", { name: "Track your mood with a free account" })).toBeVisible();
    await page.goto(`${baseURL}/admin`);
    await expect(page.getByRole("heading", { name: "Admins only" })).toBeVisible();
    await page.getByRole("link", { name: "Back to chat" }).click();
    await expect(page).toHaveURL(/\/chat$/);
    void problems;
  });

});

// Own user: signing out revokes the session, so it can't share the worker's login.
test("account menu signs out", async ({ page, baseURL }) => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY for test sign-in");
  const user = await createTestUser();
  try {
    await mockApi(page);
    await signIn(page, baseURL!, user.email);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto(`${baseURL}/chat`);
    await expect(page).toHaveURL(/\/login\?next=%2Fchat/);
  } finally {
    await deleteTestUser(user.id);
  }
});

test.afterEach(cleanupUsers);

test("demo button starts a demo or explains why it can't", async ({ page }) => {
  await page.goto("/");
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) void captureAnonymousUser(page).then(deleteLater, () => {});
  await page.getByRole("button", { name: "Try it free — no sign-up" }).click();
  await expect(
    page.getByText("The demo isn't available right now").or(page.getByRole("heading", { name: "How are you, really?" })),
  ).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle"); // let the sign-up response register for cleanup
});
