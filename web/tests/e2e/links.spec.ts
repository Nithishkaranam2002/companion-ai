import { PROTECTED_PAGES, PUBLIC_PAGES, expect, test } from "./fixtures";

test.describe("every page and internal link works", () => {
  for (const path of PUBLIC_PAGES) {
    test(`page ${path} loads cleanly with a title and one h1`, async ({ page, problems }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page).toHaveTitle(/CompanionAI/);
      await expect(page.locator("h1")).toHaveCount(1);
      await page.waitForLoadState("networkidle");
      void problems;
    });
  }

  for (const path of PROTECTED_PAGES) {
    test(`protected ${path} redirects signed-out visitors to sign in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
      await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
    });
  }

  test("crawl: every internal link on every public page resolves", async ({ page, request }) => {
    const seen = new Set<string>();
    for (const path of PUBLIC_PAGES) {
      await page.goto(path);
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
      for (const href of hrefs) if (href.startsWith("/") && !href.startsWith("//")) seen.add(href.split("#")[0] || "/");
    }
    expect(seen.size).toBeGreaterThan(10);
    const broken: string[] = [];
    for (const href of seen) {
      const res = await request.get(href, { maxRedirects: 5 });
      if (res.status() >= 400) broken.push(`${res.status()} ${href}`);
    }
    expect(broken).toEqual([]);
  });

  test("in-page anchors point at real sections", async ({ page }) => {
    await page.goto("/");
    const anchors = await page.$$eval("a[href^='/#'], a[href^='#']", (as) => as.map((a) => a.getAttribute("href")!));
    for (const a of new Set(anchors)) {
      const id = a.split("#")[1];
      if (id) await expect(page.locator(`#${id}`), `anchor #${id}`).toHaveCount(1);
    }
  });

  test("unknown routes show the custom 404 with working links", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /doesn.t lead anywhere/ })).toBeVisible();
    await page.getByRole("link", { name: "Back home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("clicking navigation", () => {
  test("header and footer links navigate to the right pages", async ({ page, isMobile, problems }) => {
    await page.goto("/");
    const footerHrefs = await page
      .locator("footer a[href^='/']")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    expect(footerHrefs.length).toBeGreaterThan(8);
    for (const [i, href] of footerHrefs.entries()) {
      await page.goto("/");
      await page.locator("footer a[href^='/']").nth(i).click();
      const expected = PROTECTED_PAGES.includes(href) ? "/login" : href;
      await expect(page, `footer link ${href}`).toHaveURL(new RegExp(`${expected}(\\?|$)`));
    }

    const navItems = [
      { name: "How it works", url: /\/#how-it-works$/ },
      { name: "Safety", url: /\/safety$/ },
      { name: "Pricing", url: /\/pricing$/ },
      { name: "About", url: /\/about$/ },
    ];
    for (const item of navItems) {
      await page.goto("/");
      if (isMobile) {
        await page.getByRole("button", { name: "Open menu" }).click();
        await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: item.name }).click();
      } else {
        await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: item.name }).click();
      }
      await expect(page, `nav "${item.name}"`).toHaveURL(item.url);
    }

    await page.goto("/");
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "Sign in" }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole("link", { name: "CompanionAI home" }).click();
    await expect(page).toHaveURL(/\/$/);
    void problems;
  });

  test("pricing and safety calls to action lead to working pages", async ({ page, problems }) => {
    await page.goto("/pricing");
    await page.getByRole("link", { name: "Join the Pro waitlist" }).click();
    await expect(page).toHaveURL(/\/contact\?topic=pro$/);
    await expect(page.getByLabel("Topic")).toHaveValue("pro");
    await page.goto("/pricing");
    await page.getByRole("link", { name: "Talk to us" }).click();
    await expect(page.getByLabel("Topic")).toHaveValue("clinic");
    await page.goto("/");
    await page.getByRole("link", { name: "See the full results" }).click();
    await expect(page).toHaveURL(/\/safety$/);
    void problems;
  });

  test("theme toggle switches between light and dark", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Change color theme" }).first().click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "Change color theme" }).first().click();
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("FAQ items open with the keyboard", async ({ page }) => {
    await page.goto("/#faq");
    const first = page.getByRole("button", { name: "Is CompanionAI a therapist or a medical service?" });
    await first.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/does not diagnose, prescribe/)).toBeVisible();
  });
});
