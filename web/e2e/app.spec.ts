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

test("管理员登录后设置页可见 AI 建议服务配置与修改密码入口", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("用户名").fill("admin")
  await page.getByLabel("密码").fill("admin123")
  await page.getByRole("button", { name: "登录" }).click()
  await expect(page).toHaveURL(/\/create/)

  // 会话令牌可直接访问数据接口
  await page.goto("/datasets")
  await expect(page.getByRole("heading", { name: "数据集列表" })).toBeVisible()

  // AI 建议服务面板：配置、拉取模型、测试连接与提示词都在设置页内
  await page.goto("/settings")
  await expect(page.getByLabel("当前密码")).toBeVisible()
  await expect(page.getByRole("button", { name: "退出登录" })).toBeVisible()
  await expect(page.getByLabel("Base URL")).toBeVisible()
  await expect(page.getByLabel("模型名称")).toBeVisible()
  await expect(page.getByRole("button", { name: "拉取模型列表" })).toBeVisible()
  await expect(page.getByRole("button", { name: "测试连接" })).toBeVisible()
  await expect(page.getByText("系统默认提示词").first()).toBeVisible()

  // 创建页不再包含 AI 配置面板
  await page.goto("/create")
  await expect(page.getByLabel("Base URL")).toHaveCount(0)
})

test("错误密码登录被拒绝", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("用户名").fill("admin")
  await page.getByLabel("密码").fill("wrong-password")
  await page.getByRole("button", { name: "登录" }).click()
  await expect(page.getByText("用户名或密码错误")).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test("API Key 会话不能修改 AI 建议服务配置（403）", async ({ page }) => {
  await login(page)
  await page.goto("/settings")
  await expect(page.getByText(/需要管理员/)).toBeVisible()
  await expect(page.getByLabel("Base URL")).toHaveCount(0)
})

test("拓扑路径：查看节点 → 点击详情 → 聚焦邻居", async ({ page }) => {
  await login(page)
  await page.goto("/create")
  await page
    .locator("div", { hasText: "小型数据中心" })
    .getByRole("button", { name: "使用此模板" })
    .first()
    .click()
  await page.getByRole("button", { name: "生成数据集", exact: true }).click()
  await expect(page).toHaveURL(/\/datasets\/\d+/)

  // 拓扑页签：节点渲染可见（有界抽样）
  await page.getByRole("tab", { name: "拓扑" }).click()
  const firstNode = page.locator(".react-flow__node").first()
  await expect(firstNode).toBeVisible()

  // 点击节点：侧边抽屉展示 CI 详情
  await firstNode.click()
  await expect(page.getByRole("button", { name: "聚焦邻居" })).toBeVisible()

  // 聚焦邻居：以该节点为中心重新拉取
  await page.getByRole("button", { name: "聚焦邻居" }).click()
  await expect(page.getByText(/正在聚焦节点/)).toBeVisible()
  await expect(page.locator(".react-flow__node").first()).toBeVisible()

  // 返回全量视图
  await page.getByRole("button", { name: "返回全量视图" }).click()
  await expect(page.getByText(/正在聚焦节点/)).not.toBeVisible()
})

test("拓扑超过 6 层时第 7 层起默认折叠，可展开与重新折叠", async ({ page }) => {
  await login(page)

  // 直接通过 API 构造 7 层数据集：dc > rack > server > vm > k8s_node > k8s_workload > app
  const spec = {
    name: "e2e-7layers",
    description: "七层链路用于验证深层折叠",
    seed: 7,
    ci_types: [
      { type: "data_center", count: 1 },
      { type: "rack", count: 2 },
      { type: "physical_server", count: 2 },
      { type: "virtual_machine", count: 4 },
      { type: "kubernetes_node", count: 2 },
      { type: "kubernetes_workload", count: 2 },
      { type: "application", count: 2 },
    ],
    relations: [
      { type: "contains", from_type: "data_center", to_type: "rack", strategy: "balanced", coverage: "to" },
      { type: "mounted_in", from_type: "physical_server", to_type: "rack", strategy: "balanced", coverage: "from" },
      { type: "runs_on", from_type: "virtual_machine", to_type: "physical_server", strategy: "balanced", coverage: "from" },
      { type: "hosted_on", from_type: "kubernetes_node", to_type: "virtual_machine", strategy: "balanced", coverage: "from" },
      { type: "hosted_on", from_type: "kubernetes_workload", to_type: "kubernetes_node", strategy: "balanced", coverage: "from" },
      { type: "hosted_on", from_type: "application", to_type: "kubernetes_workload", strategy: "balanced", coverage: "from" },
    ],
  }
  const created = await page.request.post("/api/v1/datasets", {
    data: { spec, prompt: "e2e 七层折叠" },
    headers: { Authorization: "Bearer e2e-test-key" },
  })
  expect(created.ok()).toBeTruthy()
  const datasetId = (await created.json()).id

  await page.goto(`/datasets/${datasetId}`)
  await page.getByRole("tab", { name: "拓扑" }).click()

  // 默认折叠：第 7 层（application）不显示，出现折叠提示与占位块
  // 共 15 个 CI：可见 13 + 折叠占位块 1 = 14
  await expect(page.getByText(/第 7~7 层共 2 个节点已折叠/)).toBeVisible()
  const collapsedNode = page.locator(".react-flow__node", { hasText: "已折叠第 7~7 层" })
  await expect(collapsedNode).toBeVisible()
  await expect(page.locator(".react-flow__node")).toHaveCount(14)

  // 点击占位块展开：全部 15 个节点出现
  await collapsedNode.click()
  await expect(page.locator(".react-flow__node")).toHaveCount(15)
  await expect(page.getByText(/第 7~7 层/)).not.toBeVisible()

  // 重新折叠入口可用
  await page.getByRole("button", { name: /折叠第 7 层以下/ }).click()
  await expect(page.getByText(/第 7~7 层共 2 个节点已折叠/)).toBeVisible()
})

test("拓扑全屏按钮进入与退出全屏", async ({ page }) => {
  await login(page)
  await page.goto("/create")
  await page
    .locator("div", { hasText: "小型数据中心" })
    .getByRole("button", { name: "使用此模板" })
    .first()
    .click()
  await page.getByRole("button", { name: "生成数据集", exact: true }).click()
  await page.waitForURL(/\/datasets\/\d+/)

  await page.getByRole("tab", { name: "拓扑" }).click()
  const enterButton = page.getByRole("button", { name: "全屏", exact: true })
  await expect(enterButton).toBeVisible()
  await enterButton.click()

  // 进入全屏：容器成为全屏元素，按钮变为退出全屏
  await expect(async () => {
    expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true)
  }).toPass()

  // 顶部工具栏被全屏画布遮挡，从画布内 Controls 按钮退出（ESC 亦可）
  await page
    .locator(".react-flow__controls")
    .getByRole("button", { name: "退出全屏" })
    .click()
  await expect(async () => {
    expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false)
  }).toPass()
  await expect(page.getByRole("button", { name: "全屏", exact: true })).toBeVisible()
})

test("脏数据路径：启用缺陷规则后生成并看到注入提醒", async ({ page }) => {
  await login(page)
  await page.goto("/create")
  await page
    .locator("div", { hasText: "小型数据中心" })
    .getByRole("button", { name: "使用此模板" })
    .first()
    .click()
  await expect(page.getByText("确认生成规格")).toBeVisible()

  // 添加一条默认的缺失字段缺陷规则（按数量 1）
  await page.getByRole("button", { name: "添加缺陷规则" }).click()
  await expect(page.getByText("未启用数据质量缺陷，生成干净数据。")).not.toBeVisible()

  await page.getByRole("button", { name: "生成数据集", exact: true }).click()
  await expect(page).toHaveURL(/\/datasets\/\d+/)

  // 概览页签展示生成提醒：缺失字段注入警告
  await expect(page.getByText("生成提醒")).toBeVisible()
  await expect(page.getByText(/已注入 1 条缺失字段/)).toBeVisible()
})
