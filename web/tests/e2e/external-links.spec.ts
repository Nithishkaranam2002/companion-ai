import { PUBLIC_PAGES, expect, test } from "./fixtures";

// Some public-health sites answer automated requests with 401/403/429 (bot protection).
// Those hosts are reachable for people, so they count as OK; 404s, 5xx and DNS failures fail.
const BOT_BLOCKED = new Set([401, 403, 429]);

test("external links (pages + knowledge-base sources) are reachable", async ({ page, request, isMobile }) => {
  test.skip(isMobile, "run once");
  test.setTimeout(180_000);
  const urls = new Set<string>();
  for (const path of PUBLIC_PAGES) {
    await page.goto(path);
    for (const href of await page.$$eval("a[href^='http']", (as) => as.map((a) => (a as HTMLAnchorElement).href))) {
      urls.add(href);
    }
  }
  // Every knowledge-base doc's citation URL, as shown on source cards.
  const fs = await import("node:fs");
  const path = await import("node:path");
  const kb = path.join(process.cwd(), "..", "data", "kb");
  for (const f of fs.readdirSync(kb)) {
    const url = /^url:\s*(\S+)/m.exec(fs.readFileSync(path.join(kb, f), "utf8"))?.[1];
    if (url) urls.add(url);
  }
  expect(urls.size).toBeGreaterThan(15);

  const broken: string[] = [];
  const blocked: string[] = [];
  for (const url of urls) {
    try {
      const res = await request.get(url, {
        timeout: 20_000,
        maxRedirects: 10,
        headers: { "User-Agent": "Mozilla/5.0 (CompanionAI link check)" },
      });
      if (BOT_BLOCKED.has(res.status())) blocked.push(`${res.status()} ${url}`);
      else if (res.status() >= 400) broken.push(`${res.status()} ${url}`);
    } catch (e) {
      broken.push(`ERR ${url} ${(e as Error).message.split("\n")[0]}`);
    }
  }
  if (blocked.length) console.log("Reachable but bot-blocked:\n" + blocked.join("\n"));
  expect(broken).toEqual([]);
});
