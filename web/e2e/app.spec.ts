import { expect, test, type Page } from "@playwright/test"

export async function login(page: Page) {
  await page.goto("/settings")
  await page.getByLabel("API Key").fill("e2e-test-key")
  await page.getByRole("button", { name: "保存" }).click()
  await expect(page.getByText("当前会话已配置 API Key")).toBeVisible()
}

test("主路径：密钥 → 模板 → 生成 → 查看 CI/关系/API 与导出", async ({ page }) => {
  await login(page)

  // 模板入口（AI 未配置时仍可用）
  await page.goto("/create")
  await expect(page.getByRole("heading", { name: "内置模板" })).toBeVisible()
  await page
    .locator("div", { hasText: "小型数据中心" })
    .getByRole("button", { name: "使用此模板" })
    .first()
    .click()
  await expect(page.getByText("确认生成规格")).toBeVisible()

  // 唯一主按钮创建数据集
  await page.getByRole("button", { name: "生成数据集", exact: true }).click()
  await expect(page).toHaveURL(/\/datasets\/\d+/)

  // CI 数据页签：服务端分页表格
  await page.getByRole("tab", { name: "CI 数据" }).click()
  await expect(page.getByRole("table").first().locator("tbody tr").first()).toBeVisible()

  // 关系页签
  await page.getByRole("tab", { name: "关系" }).click()
  await expect(page.getByRole("table").first().locator("tbody tr").first()).toBeVisible()

  // API 与导出页签
  await page.getByRole("tab", { name: "API 与导出" }).click()
  await expect(page.getByText("分页查询 CI")).toBeVisible()
  await expect(page.getByRole("button", { name: "下载 JSON" })).toBeVisible()
  await expect(page.getByRole("button", { name: "下载 CSV（ZIP）" })).toBeVisible()
  await expect(page.getByRole("button", { name: "下载 XLSX" })).toBeVisible()

  // 列表页可见
  await page.getByRole("link", { name: "数据集列表" }).click()
  await expect(page.getByRole("table").locator("tbody tr")).not.toHaveCount(0)
})

test("未配置密钥访问受保护页面会被引导到登录页", async ({ page }) => {
  await page.goto("/datasets")
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText("认证失败（401）")).toBeVisible()
})

test("AI 未配置时提示词建议给出明确错误并引导模板", async ({ page }) => {
  await login(page)
  await page.goto("/create")
  await page.getByLabel("需求描述").fill("1 个数据中心，4 个机柜，8 台服务器")
  await page.getByRole("button", { name: "让 AI 生成建议规格" }).click()
  await expect(page.getByText(/AI 未配置/)).toBeVisible()
  await expect(page.getByRole("heading", { name: "内置模板" })).toBeVisible()
})

test("错误的 API Key 会触发 401 引导到登录页", async ({ page }) => {
  await page.goto("/settings")
  await page.getByLabel("API Key").fill("wrong-key")
  await page.getByRole("button", { name: "保存" }).click()
  await page.goto("/datasets")
  await expect(page).toHaveURL(/\/login/)
})

test("管理员登录后可访问 AI 配置页与修改密码入口", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("用户名").fill("admin")
  await page.getByLabel("密码").fill("admin123")
  await page.getByRole("button", { name: "登录" }).click()
  await expect(page).toHaveURL(/\/create/)

  // 会话令牌可直接访问数据接口
  await page.goto("/datasets")
  await expect(page.getByRole("heading", { name: "数据集列表" })).toBeVisible()

  // AI 配置页对管理员会话可见
  await page.goto("/settings/ai")
  await expect(page.getByLabel("Base URL")).toBeVisible()
  await expect(page.getByLabel("模型名称")).toBeVisible()

  // 设置页出现修改密码入口（不强制）
  await page.goto("/settings")
  await expect(page.getByLabel("当前密码")).toBeVisible()
  await expect(page.getByRole("button", { name: "退出登录" })).toBeVisible()
})

test("错误密码登录被拒绝", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("用户名").fill("admin")
  await page.getByLabel("密码").fill("wrong-password")
  await page.getByRole("button", { name: "登录" }).click()
  await expect(page.getByText("用户名或密码错误")).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test("API Key 会话不能修改 AI 配置（403）", async ({ page }) => {
  await login(page)
  await page.goto("/settings/ai")
  await expect(page.getByText(/请先使用管理员账号|当前会话无权访问/)).toBeVisible()
})
