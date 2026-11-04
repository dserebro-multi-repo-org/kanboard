import { test, expect, Page } from "@playwright/test";

// Milestones 2 and 3 only added docs files; these smoke tests confirm the
// login page and dashboard are unaffected.
async function login(page: Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Username" }).fill("admin");
  await page.getByRole("textbox", { name: "Password" }).fill("admin");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
}

for (const m of [2, 3]) {
  test.describe(`Milestone ${m}: docs-only change leaves UI intact`, () => {
    test("login page loads styled with expected controls", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveTitle(/Login/);
      await expect(page).toHaveURL(/controller=AuthController&action=login/);
      await expect(page.getByRole("textbox", { name: "Username" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
      await expect(page.getByRole("checkbox", { name: "Remember Me" })).toBeChecked();
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bg).toBe("rgb(255, 255, 255)");
    });

    test("dashboard loads after sign in", async ({ page }) => {
      await login(page);
      await expect(page.getByRole("heading", { name: "Dashboard for admin" })).toBeVisible();
      for (const name of ["New project", "New personal project", "Project management", "My activity stream"]) {
        await expect(page.getByRole("link", { name }).first()).toBeVisible();
      }
      await expect(page.getByRole("textbox", { name: "Search" })).toBeVisible();
    });
  });
}
