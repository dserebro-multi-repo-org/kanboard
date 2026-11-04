import { test, expect } from "@playwright/test";

const USER = process.env.KB_USER || "admin";
const PASS = process.env.KB_PASS || "admin";

async function login(page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Username" }).fill(USER);
  await page.getByRole("textbox", { name: "Password" }).fill(PASS);
  await page.getByRole("button", { name: "Sign in" }).click();
}

// Milestones 2 and 3 are docs-only; the frontend must be unchanged and the
// docs files must not be exposed in the UI.
for (const [n, file] of [
  [2, "CHECKMATE-j7-b.md"],
  [3, "CHECKMATE-j7-c.md"],
] as const) {
  test.describe(`Milestone ${n}: login page and dashboard`, () => {
    test("root redirects to the login page with expected form elements", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/controller=AuthController&action=login/);
      await expect(page.getByRole("textbox", { name: "Username" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
      await expect(page.getByRole("checkbox", { name: "Remember Me" })).toBeChecked();
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
    });

    test("admin can sign in and sees the dashboard", async ({ page }) => {
      await login(page);
      await expect(page.getByRole("heading", { name: "KB Dashboard for admin" })).toBeVisible();
      for (const name of [
        "New project",
        "New personal project",
        "My dashboard",
        "Projects management",
        "Users management",
        "Settings",
        "Logout",
      ]) {
        await expect(page.getByRole("link", { name, exact: true }).first()).toBeAttached();
      }
    });

    test(`docs/${file} is not served to anonymous users`, async ({ page }) => {
      const res = await page.goto(`/docs/${file}`);
      await expect(page).toHaveURL(/controller=AuthController&action=login/);
      expect(res?.status()).toBe(200);
      await expect(page.locator("body")).not.toContainText("CHECKMATE");
    });
  });
}
