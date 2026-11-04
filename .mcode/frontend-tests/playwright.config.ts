import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://localhost:8080";
const mcodeDir = process.env.MCODE_DIR || ".";
const chromePath = process.env.CHROME_PATH;

export default defineConfig({
  testDir: ".",
  timeout: 30000,
  retries: 1,
  workers: 1,
  use: {
    baseURL,
    headless: true,
    launchOptions: { ...(chromePath ? { executablePath: chromePath } : {}), args: ["--no-sandbox"] },
    screenshot: "on",
    video: "off",
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["json", { outputFile: `${mcodeDir}/fe_testing/playwright-results.json` }],
  ],
});
