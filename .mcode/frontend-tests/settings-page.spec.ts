import { test, expect } from "@playwright/test";

test.describe("Placeholder settings page (/)", () => {
  test("returns 200 text/html with title and headings", async ({ page, request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/html");
    await page.goto("/");
    await expect(page).toHaveTitle("Kanboard");
    await expect(page.locator("h1")).toHaveText("Kanboard");
    await expect(page.locator("h2")).toHaveText("Application settings");
    await expect(page.getByText(/^Version /)).toBeVisible();
  });

  test("lists 23 settings rows in a table", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("table tbody tr")).toHaveCount(23);
  });

  const value = (page: import("@playwright/test").Page, key: string) =>
    page.locator("tr", { has: page.locator("th", { hasText: new RegExp(`^${key}$`) }) }).locator("td");

  test("shows known default values", async ({ page }) => {
    await page.goto("/");
    await expect(value(page, "application_language")).toHaveText("en_US");
    await expect(value(page, "application_timezone")).toHaveText("UTC");
    await expect(value(page, "application_date_format")).toHaveText("m/d/Y");
    await expect(value(page, "application_currency")).toHaveText("USD");
    await expect(value(page, "default_color")).toHaveText("yellow");
    await expect(value(page, "board_highlight_period")).toHaveText("172800");
    await expect(value(page, "application_url")).toHaveText("");
  });

  test("masks api_token and webhook_token", async ({ page }) => {
    await page.goto("/");
    await expect(value(page, "api_token")).toHaveText("********");
    await expect(value(page, "webhook_token")).toHaveText("********");
  });

  test("no raw 60-hex token appears anywhere in the page", async ({ request }) => {
    const body = await (await request.get("/")).text();
    expect(body).not.toMatch(/[0-9a-f]{60}/);
  });
});

test.describe("Healthcheck", () => {
  test("GET /healthcheck returns JSON ok", async ({ request }) => {
    const res = await request.get("/healthcheck");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/json");
    expect(await res.json()).toEqual({ status: 200, message: "Database connection is OK" });
  });
});

test.describe("Unknown paths", () => {
  for (const path of ["/nope", "/index.php", "/?controller=x"]) {
    test(`GET ${path} returns plain-text 404`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(404);
      expect(res.headers()["content-type"]).toContain("text/plain");
      expect(await res.text()).toBe("Page not found");
    });
  }

  test("browser navigation to unknown path shows Page not found", async ({ page }) => {
    const res = await page.goto("/nope");
    expect(res?.status()).toBe(404);
    await expect(page.locator("body")).toHaveText("Page not found");
  });

});
