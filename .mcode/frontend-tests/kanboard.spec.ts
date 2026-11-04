import { test, expect, Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Username" }).fill("admin");
  await page.getByRole("textbox", { name: "Password" }).fill("admin");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Dashboard for admin/ })).toBeVisible();
}

test.describe("Login", () => {
  test("redirects to login form with expected controls", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/controller=AuthController&action=login/);
    await expect(page.getByRole("textbox", { name: "Username" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Remember Me" })).toBeChecked();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
  });

  test("admin/admin logs in to dashboard", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("link", { name: "New project" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "My activity stream" })).toBeVisible();
  });
});

test.describe("Dashboard", () => {
  test("shows dashboard navigation", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("link", { name: "New personal project" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Project management" })).toBeVisible();
  });
});

test.describe("Project and board", () => {
  test("creates a project and shows empty board with default columns", async ({ page }) => {
    await login(page);
    await page.goto("/?controller=ProjectCreationController&action=create");
    const name = `E2E Project ${Date.now()}`;
    await page.getByRole("textbox", { name: "Name" }).fill(name);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/controller=ProjectViewController&action=show&project_id=\d+/);
    await expect(page.getByText("Your project has been created successfully.")).toBeVisible();

    await page.getByRole("link", { name: "Board" }).first().click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/controller=BoardViewController&action=show/);
    await expect(page.locator("#board-container")).toBeVisible();
    await expect(page.locator("#board")).toBeVisible();
    const headers = page.locator(".board-column-header");
    await expect(headers).toHaveCount(4);
    for (const col of ["Backlog", "Ready", "Work in progress", "Done"]) {
      await expect(page.locator("#board")).toContainText(col);
    }
    await expect(page.locator(".task-board")).toHaveCount(0);
  });
});
