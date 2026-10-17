import AxeBuilder from "@axe-core/playwright";

import { PUBLIC_PAGES, expect, test } from "./fixtures";

for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    for (const path of [...PUBLIC_PAGES, "/this-page-does-not-exist"]) {
      test(`${path} has no serious or critical axe violations`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        // Let entrance animations finish so contrast is measured on final colors.
        await page.waitForTimeout(800);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const serious = results.violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => `${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
        expect(serious).toEqual([]);
      });
    }
  });
}

test("keyboard: skip link moves focus to main content", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard test on desktop");
  await page.goto("/about");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("images and icons have text alternatives", async ({ page }) => {
  for (const path of ["/", "/safety"]) {
    await page.goto(path);
    const unlabeled = await page.$$eval("img:not([alt]), svg:not([aria-hidden='true']):not([role='img'])", (els) =>
      els.filter((el) => !el.closest("[aria-label]") && !el.closest("button[aria-label]")).length,
    );
    expect(unlabeled, `${path} unlabeled images/svgs`).toBe(0);
  }
});
