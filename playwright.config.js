const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 20000
  },
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true
  },
  webServer: {
    command: 'python -m http.server 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
