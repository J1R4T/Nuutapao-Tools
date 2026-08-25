const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/ui',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: { trace: 'retain-on-failure' }
});
