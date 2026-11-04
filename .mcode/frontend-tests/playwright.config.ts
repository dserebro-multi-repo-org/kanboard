import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://localhost:8080",
    headless: true,
    launchOptions: { executablePath: process.env.CHROME_PATH || "/l2l/.agent-browser/browsers/chrome-157.0.8103.38/chrome", args: ["--no-sandbox"] },
    screenshot: "on",
    video: "off",
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["json", { outputFile: `${process.env.MCODE_DIR}/fe_testing/playwright-results.json` }],
  ],
});
