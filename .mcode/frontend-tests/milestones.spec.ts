import { test, expect } from "@playwright/test";

test.describe("Milestone 6: no UI surface for libraries", () => {
  test("library-only milestone exposes no routes (404 plain text)", async ({ request }) => {
    for (const p of ["/export", "/import", "/analytic"]) {
      const res = await request.get(p);
      expect(res.status()).toBe(404);
      expect(await res.text()).toBe("Page not found");
    }
  });
});

test.describe("Milestone 7: placeholder page does not yet render via layout", () => {
  test("/ has no layout header/nav and no stylesheet link", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("link[rel=stylesheet]")).toHaveCount(0);
    await expect(page.locator("a")).toHaveCount(0);
    await expect(page.locator("form")).toHaveCount(0);
  });
});

test.describe("Milestone 2: migrations", () => {
  test("settings keys rendered include application_language row after migration", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("th[scope=row]", { hasText: /^application_language$/ })).toBeVisible();
  });
});
