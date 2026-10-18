// Click-through audit engine: a stateful mock of the CompanionAI API, Supabase auth stubs, and a
// sweep that exercises every interactive element on a page with the keyboard (Tab-reachable,
// focus + Enter/Space/arrows) after checking the mouse can reach it, then records what happened.
import fs from "node:fs";
import path from "node:path";
import type { BrowserContext, Page, Route } from "@playwright/test";
import type { Session } from "@supabase/supabase-js";

export const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const SUPABASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");

export type Role = "logged-out" | "demo" | "user" | "admin";
export const CID_ANSWER = "aaaaaaaa-1111-4111-8111-111111111111";
export const CID_CRISIS = "bbbbbbbb-2222-4222-8222-222222222222";

const now = () => new Date().toISOString();
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const SOURCES = [
  { title: "Sleep Hygiene Basics", url: "https://www.cdc.gov/sleep/about/index.html", snippet: "Most adults need 7 or more hours." },
  {
    title: "Breathing Exercises for Stress",
    url: "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/",
    snippet: "Breathe in gently.",
  },
];

// ---------------------------------------------------------------- API mock

const sse = (events: [string, unknown][]) => events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

/** Deterministic, stateful stand-in for the API: no model calls, no rows written. */
/** Returns a reset function: call it before each element so earlier clicks don't change the data. */
export async function mockApi(context: BrowserContext, startRole: Role): Promise<() => void> {
  // A logged-out visitor who clicks a demo button becomes a demo user, as with the real API.
  const role: Role = startRole === "logged-out" ? "demo" : startRole;
  let state = freshState(role);
  const reset = () => {
    state = freshState(role);
  };
  await route(context, role, () => state);
  return reset;
}

function freshState(role: Role) {
  const me = {
    id: "00000000-0000-4000-8000-000000000001",
    email: role === "demo" ? null : role === "admin" ? "admin@example.com" : "person@example.com",
    is_anonymous: role === "demo",
    is_admin: role === "admin",
    remaining_messages: role === "demo" ? 7 : 18,
    limit: role === "demo" ? 10 : 20,
  };
  const conversations = [
    { id: CID_ANSWER, title: "How can I sleep better?", updated_at: ago(0.01) },
    { id: CID_CRISIS, title: "Feeling overwhelmed tonight", updated_at: ago(1) },
  ];
  const messages: Record<string, unknown[]> = {
    [CID_ANSWER]: [
      { id: "m1", conversation_id: CID_ANSWER, role: "user", content: "How can I sleep better?", sources: [], created_at: ago(0.02) },
      {
        id: "m2",
        conversation_id: CID_ANSWER,
        role: "assistant",
        content: "Most adults need **7 or more hours** of sleep [1]. Slow breathing can help you unwind [2].",
        route: "answer",
        label: "in_scope",
        sources: SOURCES,
        created_at: ago(0.02),
      },
    ],
    [CID_CRISIS]: [
      { id: "m3", conversation_id: CID_CRISIS, role: "user", content: "I can't do this anymore.", sources: [], created_at: ago(1) },
      {
        id: "m4",
        conversation_id: CID_CRISIS,
        role: "assistant",
        content: "I'm really glad you told me. Please call or text 988, any time.",
        route: "escalate",
        label: "crisis",
        sources: [],
        created_at: ago(1),
      },
    ],
  };
  const moods = Array.from({ length: 8 }, (_, i) => ({
    id: `mood-${i}`,
    user_id: me.id,
    score: [5, 6, 4, 6, 7, 6, 8, 7][i],
    note: i === 3 ? "Morning walk helped" : "",
    created_at: ago(8 - i),
  }));
  const escalations = [
    { id: "e1", user_id: "u1", conversation_id: "c1", reason: "crisis", summary: "I want to end my life", urgent: true, status: "open", resolved_by: null, resolved_at: null, created_at: ago(0.1) },
    { id: "e2", user_id: "u2", conversation_id: "c2", reason: "human_request", summary: "Can I talk to a real person?", urgent: false, status: "open", resolved_by: null, resolved_at: null, created_at: ago(0.5) },
    { id: "e3", user_id: "u3", conversation_id: "c3", reason: "medical_emergency", summary: "Chest pain", urgent: true, status: "resolved", resolved_by: "admin@example.com", resolved_at: ago(1), created_at: ago(2) },
  ];
  const contact = [{ id: "k1", name: "Sam", email: "sam@example.com", topic: "pro", message: "Please add me to the waitlist.", handled: false, created_at: ago(0.3) }];
  return { me, conversations, messages, moods, escalations, contact };
}

type MockState = ReturnType<typeof freshState>;

async function route(context: BrowserContext, role: Role, current: () => MockState) {
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });

  await context.route(`${API}/**`, async (route) => {
    const st = current();
    const { me, messages, escalations, contact } = st;
    const req = route.request();
    const method = req.method();
    const p = new URL(req.url()).pathname;
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (p === "/health") return json(route, { status: "ok", checks: {} });
    if (p === "/safety/summary") return json(route, {});
    if (p === "/contact" && method === "POST") return json(route, { ok: true }, 202);
    if (!req.headers()["authorization"]) return json(route, { detail: "Not signed in" }, 401);
    if (p === "/me") return json(route, me);
    if (p === "/conversations" && method === "GET") return json(route, st.conversations);
    const convo = /^\/conversations\/([^/]+)(\/messages)?$/.exec(p);
    if (convo && convo[2]) return json(route, messages[convo[1]] ?? []);
    if (convo && method === "DELETE") {
      st.conversations = st.conversations.filter((c) => c.id !== convo[1]);
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (convo && method === "PATCH") {
      const { title } = req.postDataJSON() as { title: string };
      st.conversations = st.conversations.map((c) => (c.id === convo[1] ? { ...c, title } : c));
      return json(route, st.conversations.find((c) => c.id === convo[1]));
    }
    if (p === "/chat/stream") {
      const asked = (req.postDataJSON() as { conversation_id?: string | null }).conversation_id;
      const id = asked ?? "cccccccc-3333-4333-8333-333333333333";
      if (!asked) st.conversations = [{ id, title: "New conversation", updated_at: now() }, ...st.conversations];
      me.remaining_messages = Math.max(0, me.remaining_messages - 1);
      return route.fulfill({
        status: 200,
        headers: { ...CORS, "content-type": "text/event-stream" },
        body: sse([
          ["meta", { route: "answer", label: "in_scope", conversation_id: id }],
          ["sources", { sources: SOURCES }],
          ["token", { text: "A steady wind-down routine can help [1]. " }],
          ["token", { text: "Try a few slow breaths before bed [2]." }],
          ["done", { message_id: "m9", escalated: false, remaining: me.remaining_messages }],
        ]),
      });
    }
    if (p === "/mood" && method === "GET") return json(route, me.is_anonymous ? [] : st.moods);
    if (p === "/mood" && method === "POST") {
      const body = req.postDataJSON() as { score: number; note: string };
      const entry = { id: `mood-${st.moods.length}`, user_id: me.id, score: body.score, note: body.note, created_at: now() };
      st.moods = [...st.moods, entry];
      return json(route, entry, 201);
    }
    if (p === "/admin/escalations") {
      if (role !== "admin") return json(route, { detail: "Admins only" }, 403);
      const status = new URL(req.url()).searchParams.get("status");
      return json(route, status ? escalations.filter((e) => e.status === status) : escalations);
    }
    const resolve = /^\/admin\/escalations\/([^/]+)\/resolve$/.exec(p);
    if (resolve && role === "admin") {
      const esc = escalations.find((e) => e.id === resolve[1])!;
      Object.assign(esc, { status: "resolved", resolved_by: me.email, resolved_at: now() });
      return json(route, esc);
    }
    if (p === "/admin/contact") return role === "admin" ? json(route, contact) : json(route, { detail: "Admins only" }, 403);
    return json(route, { detail: `unmocked ${method} ${p}` }, 500);
  });
}

/** Keeps auth side effects off the real project: no emails sent, the shared session is never
 *  revoked, and demo clicks reuse one real anonymous session instead of creating users. */
export async function stubAuth(context: BrowserContext, anon: Session) {
  await context.route(`${SUPABASE}/auth/v1/otp**`, (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await context.route(`${SUPABASE}/auth/v1/logout**`, (r) => r.fulfill({ status: 204 }));
  await context.route(`${SUPABASE}/auth/v1/signup**`, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(anon) }),
  );
}

/** Answers navigations to third-party sites with a blank page. Our own site, the API and
 *  Supabase are never stubbed, so every check of our pages still hits the real thing. */
export async function stubExternalSites(context: BrowserContext, base: string) {
  const ours = new Set([new URL(base).host, new URL(API).host, SUPABASE ? new URL(SUPABASE).host : ""]);
  await context.route(
    (url) => /^https?:$/.test(url.protocol) && !ours.has(url.host),
    (route) =>
      route.request().isNavigationRequest()
        ? route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>External site (stubbed)</title>" })
        : route.fallback(),
  );
}

// ---------------------------------------------------------------- sweep

export type Item = {
  key: string; // stable across reloads: region|role|name|href#n
  id: string;
  role: string;
  name: string;
  tag: string;
  type: string;
  href: string | null;
  target: string | null;
  rel: string | null;
  disabled: boolean;
  tabbable: boolean;
  chrome: boolean; // inside the shared site header/footer
  invalidForm: boolean;
};

export type Result = {
  page: string;
  state: Role;
  viewport: string;
  scheme: string;
  element: string;
  kind: string;
  result: "pass" | "fail";
  detail: string;
  attempt?: number;
};

/** Tags visible interactive elements under `scope` with data-audit ids and describes them. */
export async function tagItems(page: Page, scope: string | null, prefix: string): Promise<Item[]> {
  return page.evaluate(
    ([scopeSel, pre]) => {
      const SEL = [
        "a[href]",
        "button",
        "[role=button]",
        "[role=tab]",
        "[role=menuitem]",
        "[role=menuitemradio]",
        "[role=menuitemcheckbox]",
        "[role=switch]",
        "[role=checkbox]",
        "[role=radio]",
        "[role=slider]",
        "input:not([type=hidden])",
        "textarea",
        "select",
        "summary",
      ].join(",");
      const root = scopeSel ? document.querySelector(scopeSel) : document.body;
      if (!root) return [];
      const visible = (el: Element) => {
        if (!(el as HTMLElement).getClientRects().length) return false;
        if (el.closest("[aria-hidden=true], [inert], [data-sonner-toaster], nextjs-portal")) return false;
        const cs = getComputedStyle(el);
        return cs.visibility !== "hidden" && cs.display !== "none";
      };
      const name = (el: Element) => {
        const h = el as HTMLElement;
        const labelled = h.getAttribute("aria-labelledby");
        const fromLabel =
          (h.id && document.querySelector(`label[for="${h.id}"]`)?.textContent) ||
          (labelled && document.getElementById(labelled)?.textContent);
        return (
          h.getAttribute("aria-label") ||
          fromLabel ||
          h.innerText ||
          h.getAttribute("title") ||
          h.getAttribute("placeholder") ||
          h.getAttribute("name") ||
          ""
        )
          .replace(/\s+/g, " ")
          .replace(/\s*(just now|\d+[mhd] ago)$/, "") // relative times change between reloads
          .trim()
          .slice(0, 80);
      };
      const seen: Record<string, number> = {};
      const out = [];
      let i = 0;
      for (const el of Array.from(root.querySelectorAll(SEL))) {
        if (!visible(el)) continue;
        const h = el as HTMLElement & { disabled?: boolean; form?: HTMLFormElement | null };
        const role = h.getAttribute("role") || (h.tagName === "A" ? "link" : h.tagName.toLowerCase());
        const n = name(el);
        const href = h.tagName === "A" ? h.getAttribute("href") : null;
        const chrome = Boolean(h.closest("body > div header, body header, footer")) && !scopeSel;
        const base = `${chrome ? "chrome" : "page"}|${role}|${n}|${href ?? ""}`;
        seen[base] = (seen[base] ?? 0) + 1;
        const id = `${pre}${i++}`;
        h.setAttribute("data-audit", id);
        const isSubmit = (h.tagName === "BUTTON" && ((h as HTMLButtonElement).type || "submit") === "submit") || false;
        out.push({
          key: `${base}#${seen[base]}`,
          id,
          role,
          name: n,
          tag: h.tagName.toLowerCase(),
          type: h.getAttribute("type") ?? "",
          href,
          target: h.getAttribute("target"),
          rel: h.getAttribute("rel"),
          disabled: Boolean(h.disabled) || h.getAttribute("aria-disabled") === "true" || h.hasAttribute("data-disabled"),
          tabbable: h.tabIndex >= 0,
          chrome,
          invalidForm: isSubmit && Boolean(h.form) && !h.form!.checkValidity(),
        });
      }
      return out;
    },
    [scope, prefix] as const,
  );
}

const OPEN_LAYERS = "[role=dialog], [role=alertdialog], [role=menu], [role=listbox]";

async function countLayers(page: Page) {
  return page.locator(OPEN_LAYERS).filter({ visible: true }).count();
}

/** Marks the newest open dialog/menu so its contents can be swept as a nested scope. */
async function markNewestLayer(page: Page, scopeId: string) {
  return page.evaluate(
    ([sel, id]) => {
      const layers = Array.from(document.querySelectorAll(sel)).filter((el) => (el as HTMLElement).getClientRects().length);
      const top = layers[layers.length - 1];
      if (!top) return null;
      top.setAttribute("data-audit-scope", id);
      return `[data-audit-scope="${id}"]`;
    },
    [OPEN_LAYERS, scopeId] as const,
  );
}

function expectedPath(href: string, role: Role, base: string, from: string) {
  const u = new URL(href, new URL(from, base));
  const protectedPath = ["/chat", "/mood", "/admin"].some((p) => u.pathname === p || u.pathname.startsWith(`${p}/`));
  if (role === "logged-out" && protectedPath) return { path: "/login", search: `?next=${encodeURIComponent(u.pathname)}` };
  if ((role === "user" || role === "admin") && u.pathname === "/login") return { path: "/chat", search: "" };
  return { path: u.pathname, search: u.search, hash: u.hash };
}

type Effect = { kind: string; detail: string; ok: boolean; opened?: string | null };

/** Focus + key press, then wait for something visible: navigation, popup, a new layer, or DOM change. */
async function trigger(page: Page, item: Item, base: string, role: Role, from: string, scopeId: string): Promise<Effect> {
  const loc = page.locator(`[data-audit="${item.id}"]`);
  const urlBefore = page.url();
  const layersBefore = await countLayers(page);
  const focusBefore = await page.evaluate(() => document.activeElement?.getAttribute("data-audit") ?? document.activeElement?.id ?? "");
  await page.evaluate(() => {
    const w = window as unknown as { __mut: number; __obs?: MutationObserver };
    w.__mut = 0;
    w.__obs?.disconnect();
    w.__obs = new MutationObserver((ms) => (w.__mut += ms.length));
    w.__obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  });

  const field = ["input", "textarea"].includes(item.tag) && !["checkbox", "radio", "submit", "button", "range"].includes(item.type);
  if (field) {
    const before = await loc.inputValue({ timeout: 2000 });
    await page.keyboard.type(item.type === "email" ? "a@b.co" : "Hi");
    const after = await loc.inputValue({ timeout: 2000 });
    return { kind: "field", detail: "accepts typing", ok: after !== before };
  }
  if (item.tag === "select") {
    const before = await loc.inputValue({ timeout: 2000 });
    // Type-ahead: the first letter of another option selects it without opening the native popup.
    const other = await loc.evaluate((el) => {
      const s = el as HTMLSelectElement;
      return Array.from(s.options).find((o) => o.value !== s.value)?.text ?? "";
    });
    await page.keyboard.type(other.slice(0, 1));
    const after = await loc.inputValue({ timeout: 2000 });
    return { kind: "select", detail: `changes value (${before} → ${after})`, ok: after !== before };
  }
  if (item.role === "slider") {
    const before = await loc.getAttribute("aria-valuenow");
    await page.keyboard.press(before === (await loc.getAttribute("aria-valuemax")) ? "ArrowLeft" : "ArrowRight");
    const after = await loc.getAttribute("aria-valuenow");
    return { kind: "slider", detail: `arrow keys move it (${before} → ${after})`, ok: after !== before };
  }

  const popup = page.context().waitForEvent("page", { timeout: 4000 }).catch(() => null);
  const key = ["checkbox", "radio", "switch"].includes(item.role) || item.type === "checkbox" ? "Space" : "Enter";
  await page.keyboard.press(key);

  if (item.href && item.target === "_blank") {
    const tab = await popup;
    if (!tab) return { kind: "external link", detail: "no new tab opened", ok: false };
    // External sites are stubbed (see stubExternalSites), so this checks where the link points, not
    // whether a third-party site lets an automated browser in (external-links.spec.ts checks that).
    await tab.waitForURL((u) => u.protocol.startsWith("http"), { timeout: 15_000 }).catch(() => {});
    const got = tab.url();
    await tab.close();
    const ok = got === new URL(item.href, base).href;
    return { kind: "external link", detail: ok ? `new tab → ${got}` : `new tab → ${got} (expected ${item.href})`, ok };
  }

  // Wait up to 3s for any visible effect.
  const deadline = Date.now() + 3000;
  let mutations = 0;
  while (Date.now() < deadline) {
    if (page.url() !== urlBefore) break;
    mutations = await page.evaluate(() => (window as unknown as { __mut: number }).__mut).catch(() => -1);
    if (mutations !== 0) break;
    const focusNow = await page.evaluate(() => document.activeElement?.getAttribute("data-audit") ?? document.activeElement?.id ?? "").catch(() => "");
    if (focusNow !== focusBefore) break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(250);

  if (item.href && !item.href.startsWith("#")) {
    const want = expectedPath(item.href, role, base, from);
    await page.waitForURL((u) => u.pathname === want.path, { timeout: 15_000 }).catch(() => {});
    await page.waitForLoadState("domcontentloaded");
    const u = new URL(page.url());
    const notFound = await page.getByRole("heading", { name: /couldn.t find|not found/i }).count();
    const samePageHash = Boolean(want.hash) && u.pathname === new URL(urlBefore).pathname;
    const ok =
      u.pathname === want.path && (!want.search || u.search === want.search) && notFound === 0 && (samePageHash ? u.hash === want.hash : true);
    return { kind: "link", detail: `→ ${u.pathname}${u.search}${u.hash}${notFound ? " (404 page)" : ""}`, ok };
  }

  if (page.url() !== urlBefore) return { kind: "button", detail: `navigates → ${new URL(page.url()).pathname}`, ok: true };
  const layersAfter = await countLayers(page).catch(() => layersBefore);
  if (layersAfter > layersBefore) {
    const opened = await markNewestLayer(page, scopeId);
    const what = await page.locator(opened ?? OPEN_LAYERS).last().getAttribute("role", { timeout: 1000 }).catch(() => "layer");
    return { kind: "button", detail: `opens ${what}`, ok: true, opened };
  }
  if (layersAfter < layersBefore) return { kind: "button", detail: "acts and closes its menu/dialog", ok: true };
  if (mutations !== 0) {
    const state = await loc
      .evaluate(
        (el) =>
          ["aria-expanded", "aria-pressed", "aria-checked", "aria-selected", "data-state"]
            .map((a) => el.getAttribute(a) && `${a}=${el.getAttribute(a)}`)
            .filter(Boolean)
            .join(" "),
        undefined,
        { timeout: 500 },
      )
      .catch(() => "");
    return { kind: "button", detail: state ? `updates (${state})` : "updates the page", ok: true };
  }
  const focusAfter = await page
    .evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el && el !== document.body ? el.getAttribute("aria-label") || el.id || el.tagName.toLowerCase() : "";
    })
    .catch(() => "");
  if (focusAfter && focusAfter !== focusBefore && focusAfter !== item.name)
    return { kind: "button", detail: `moves focus to "${focusAfter}"`, ok: true };
  // Tabs select on focus and toggles may already be on: being the selected option is the effect.
  const selected = await loc
    .evaluate(
      (el) =>
        ["aria-selected", "aria-checked", "aria-pressed"].some((a) => el.getAttribute(a) === "true") ||
        ["active", "on", "checked"].includes(el.getAttribute("data-state") ?? ""),
      undefined,
      { timeout: 500 },
    )
    .catch(() => false);
  if (selected) return { kind: item.role, detail: "selected (shows its view)", ok: true };
  return { kind: "button", detail: "nothing visible happened", ok: false };
}

/** Checks static properties first: dead links, unsafe new tabs, tel/sms targets, Tab reachability. */
function staticCheck(item: Item, page: Page): Effect | null {
  if (item.href !== null) {
    const h = item.href.trim();
    if (!h || h === "#" || h.startsWith("javascript:")) return { kind: "link", detail: `dead href "${h}"`, ok: false };
    if (/^(tel|sms|mailto):/.test(h)) {
      const valid = /^(tel|sms):\+?[\d-]+$/.test(h) || /^mailto:[^@\s]+@[^@\s]+$/.test(h);
      return { kind: h.split(":")[0] + " link", detail: valid ? h : `malformed ${h}`, ok: valid };
    }
    const external = /^https?:/.test(h) && new URL(h).origin !== new URL(page.url()).origin;
    if (external && (item.target !== "_blank" || !/noopener|noreferrer/.test(item.rel ?? "")))
      return { kind: "external link", detail: `opens in same tab or without noopener (target=${item.target}, rel=${item.rel})`, ok: false };
  }
  if (!item.tabbable && !["menuitem", "menuitemradio", "menuitemcheckbox", "tab", "radio", "slider"].includes(item.role))
    return { kind: item.role, detail: "not reachable with Tab (tabindex -1)", ok: false };
  return null;
}

export type SweepOptions = {
  page: Page;
  path: string;
  role: Role;
  base: string;
  viewport: string;
  scheme: string;
  includeChrome: boolean;
  reset: () => Promise<void>; // restore cookies/storage between elements
  skip?: (item: Item) => string | null; // reason to skip (covered by a dedicated test)
  maxDepth?: number;
};

async function findAgain(page: Page, scope: string | null, depth: number, key: string): Promise<Item | undefined> {
  const deadline = Date.now() + 8000;
  for (;;) {
    const found = (await tagItems(page, scope, `d${depth}-`)).find((i) => i.key === key);
    if (found || Date.now() > deadline) return found;
    await page.waitForTimeout(250);
  }
}

/** Sweeps one page; returns one result per element (nested dialogs/menus included). */
export async function sweepPage(o: SweepOptions): Promise<Result[]> {
  const results: Result[] = [];
  let last = Date.now();
  const record = (item: Item, chain: string[], e: Effect) => {
    if (process.env.AUDIT_DEBUG) console.log(`${Date.now() - last}ms ${e.ok ? "ok  " : "FAIL"} ${describe(item)}: ${e.detail}`);
    last = Date.now();
    results.push({
      page: o.path,
      state: o.role,
      viewport: o.viewport,
      scheme: o.scheme,
      element: [...chain, describe(item)].join(" › "),
      kind: e.kind,
      result: e.ok ? "pass" : "fail",
      detail: e.detail,
    });
  };

  const load = async () => {
    await o.reset();
    // One retry absorbs a dropped connection; a page that really fails to load fails both times.
    await o.page.goto(o.path).catch(async () => {
      await o.page.waitForTimeout(2000);
      await o.page.goto(o.path);
    });
    await o.page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
    await o.page.waitForTimeout(200);
  };

  /** Re-opens a chain of layers (by stable keys) and returns the scope selector of the last one. */
  const reopen = async (chain: string[]) => {
    let scope: string | null = null;
    for (const [depth, key] of chain.entries()) {
      const items = await tagItems(o.page, scope, `d${depth}-`);
      const item = items.find((i) => i.key === key);
      if (!item) return undefined;
      await o.page.locator(`[data-audit="${item.id}"]`).focus();
      const e = await trigger(o.page, item, o.base, o.role, o.path, `s${depth}`);
      if (!e.opened) return undefined;
      scope = e.opened;
    }
    return scope;
  };

  const sweep = async (chain: string[], chainNames: string[], scope: string | null) => {
    const depth = chain.length;
    const items = await tagItems(o.page, scope, `d${depth}-`);
    for (const listed of items) {
      if (depth === 0 && listed.chrome && !o.includeChrome) continue;
      if (process.env.AUDIT_ONLY && depth === 0 && !new RegExp(process.env.AUDIT_ONLY).test(listed.key)) continue;
      const skipReason = o.skip?.(listed);
      if (skipReason) {
        record(listed, chainNames, { kind: listed.role, detail: `covered by: ${skipReason}`, ok: true });
        continue;
      }
      if (listed.disabled) {
        record(listed, chainNames, { kind: listed.role, detail: "disabled here (by design)", ok: true });
        continue;
      }
      const pre = staticCheck(listed, o.page);
      if (pre) {
        record(listed, chainNames, pre);
        continue;
      }
      let s: string | null | undefined = null;
      try {
        await load();
        s = depth ? await reopen(chain) : null;
      } catch (e) {
        record(listed, chainNames, { kind: listed.role, detail: `page didn't load: ${(e as Error).message.split("\n")[0]}`, ok: false });
        continue;
      }
      if (depth && s === undefined) {
        record(listed, chainNames, { kind: listed.role, detail: "could not reopen its menu/dialog", ok: false });
        continue;
      }
      // Lists, forms and sidebars render after their data loads: wait for the element to come back.
      const fresh = await findAgain(o.page, s ?? null, depth, listed.key);
      if (!fresh) {
        record(listed, chainNames, { kind: listed.role, detail: "element missing after reload (waited 8s)", ok: false });
        continue;
      }
      const loc = o.page.locator(`[data-audit="${fresh.id}"]`);
      let effect: Effect;
      try {
        // Focus first: some controls (the skip link, hover-revealed icons) only appear on focus.
        const focused = await loc.evaluate(
          (el) => {
            (el as HTMLElement).focus();
            return document.activeElement === el;
          },
          undefined,
          { timeout: 3000 },
        );
        await loc.scrollIntoViewIfNeeded({ timeout: 10_000 });
        await loc.click({ trial: true, timeout: 10_000 }); // the mouse can reach it (not covered)
        effect = focused
          ? fresh.invalidForm
            ? { kind: "submit", detail: "blocked until required fields are filled (browser shows which)", ok: true }
            : await trigger(o.page, fresh, o.base, o.role, o.path, `s${depth}`)
          : { kind: fresh.role, detail: "can't receive keyboard focus", ok: false };
      } catch (e) {
        effect = { kind: fresh.role, detail: `error: ${(e as Error).message.split("\n")[0]}`, ok: false };
      }
      record(fresh, chainNames, effect);
      if (effect.opened && depth < (o.maxDepth ?? 3)) {
        await sweep([...chain, fresh.key], [...chainNames, describe(fresh)], effect.opened);
      }
    }
  };

  try {
    await load();
  } catch (e) {
    results.push({ page: o.path, state: o.role, viewport: o.viewport, scheme: o.scheme, element: "page load", kind: "page", result: "fail", detail: (e as Error).message.split("\n")[0] });
    return results;
  }
  const overflow = await o.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  results.push({
    page: o.path,
    state: o.role,
    viewport: o.viewport,
    scheme: o.scheme,
    element: "page layout",
    kind: "layout",
    result: overflow > 1 ? "fail" : "pass",
    detail: overflow > 1 ? `scrolls sideways by ${overflow}px` : "fits the screen (no sideways scroll)",
  });
  await sweep([], [], null);
  return results;
}

function describe(item: Item) {
  const label = item.name || "(unnamed)";
  return item.role === "link" ? `link "${label}"` : `${item.role} "${label}"`;
}

export function saveResults(results: Result[], file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, results.map((r) => JSON.stringify(r)).join("\n") + (results.length ? "\n" : ""));
}
