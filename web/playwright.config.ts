import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

// E2E 直接验证生产形态：uvicorn 内置 web/dist 静态产物 + SQLite + Bearer Token。
// 不配置 AI，用于覆盖「未配置 AI 时走模板」的合同路径。
const here = import.meta.dirname
const dataDir = path.resolve(here, `../.e2e-data-${Date.now()}`)

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8090",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "uv run python -m app.main",
    cwd: path.resolve(here, "../backend"),
    env: {
      ISL_API_KEY: "e2e-test-key",
      ISL_DATA_DIR: dataDir,
      ISL_HOST: "127.0.0.1",
      ISL_PORT: "8090",
    },
    url: "http://127.0.0.1:8090/health",
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
