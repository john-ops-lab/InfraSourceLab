import { expect, test, type Page } from "@playwright/test"

// 设置页功能卡默认折叠：点击卡片头部（标题开头匹配）展开后再操作功能区
async function expandCard(page: Page, title: string) {
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click()
}

export async function login(page: Page) {
  await page.goto("/settings")
  await expandCard(page, "API Key（备用通道）")
  await page.getByLabel("API Key").fill("e2e-test-key")
  await page.getByRole("button", { name: "保存", exact: true }).click()
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
  await expandCard(page, "API Key（备用通道）")
  await page.getByLabel("API Key").fill("wrong-key")
  await page.getByRole("button", { name: "保存", exact: true }).click()
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

  // 功能卡默认折叠：先验证收起态，再展开验证功能区
  await expect(page.getByLabel("当前密码")).toBeHidden()
  await expandCard(page, "账户与密码")
  await expect(page.getByLabel("当前密码")).toBeVisible()
  await expect(page.getByRole("button", { name: "退出登录" })).toBeVisible()
  await expect(page.getByLabel("Base URL")).toBeHidden()
  await expandCard(page, "AI 建议服务")
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
  await expect(page.getByText(/修改 AI 配置与提示词需要管理员/)).toBeVisible()
  await expect(page.getByLabel("Base URL")).toHaveCount(0)

  // 关系类型列表 API Key 可读，但增删改需要管理员登录
  await expect(page.getByText("关系类型管理", { exact: true })).toBeVisible()
  await expandCard(page, "关系类型管理")
  await expect(page.getByRole("cell", { name: "contained_in", exact: true }).first()).toBeVisible()
  await expect(page.getByText(/增删改需要管理员登录/)).toBeVisible()
})

test("管理员可在设置页维护关系类型：改名、新增、删除", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("用户名").fill("admin")
  await page.getByLabel("密码").fill("admin123")
  await page.getByRole("button", { name: "登录" }).click()
  await page.waitForURL(/\/create/)
  await page.goto("/settings")
  await expandCard(page, "关系类型管理")

  // 内置关系是内置模板的稳定依赖，只能修改，不能删除
  await expect(page.getByRole("button", { name: "删除 contained_in" })).toBeDisabled()

  // 修改内置关系 runs_on 的中文名称
  await page.getByRole("button", { name: "编辑 runs_on" }).click()
  await page.getByLabel("runs_on 中文名称").fill("运行在")
  await page.getByRole("button", { name: "保存 runs_on 的修改" }).click()
  await expect(page.getByLabel("runs_on 中文名称")).toHaveCount(0)
  await expect(page.getByRole("cell", { name: "运行在" })).toBeVisible()

  // 新增自定义关系 monitors
  await page.getByRole("button", { name: "新增关系类型" }).click()
  await page.getByLabel("类型标识").fill("monitors")
  await page.getByLabel("中文名称", { exact: true }).fill("监控")
  await page.getByRole("button", { name: "保存新增", exact: true }).click()
  await expect(page.getByRole("cell", { name: "monitors", exact: true }).first()).toBeVisible()

  // 删除未被引用的自定义关系
  await page.getByRole("button", { name: "删除 monitors" }).click()
  await page.getByRole("button", { name: "删除", exact: true }).click()
  await expect(page.getByRole("cell", { name: "monitors", exact: true })).toHaveCount(0)
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

test("拓扑节点详情显示完整记录，内容超高时在面板内部滚动", async ({ page }) => {
  await login(page)

  const createResponse = await page.request.post("/api/v1/datasets", {
    headers: { Authorization: "Bearer e2e-test-key" },
    data: {
      spec: {
        name: "e2e-topology-detail",
        description: "验证拓扑详情完整属性与滚动",
        seed: 20260904,
        ci_types: [{ type: "physical_server", count: 1 }],
        relations: [],
      },
    },
  })
  expect(createResponse.ok()).toBeTruthy()
  const dataset = await createResponse.json()

  const ciResponse = await page.request.get(`/api/v1/datasets/${dataset.id}/cis`, {
    headers: { Authorization: "Bearer e2e-test-key" },
  })
  expect(ciResponse.ok()).toBeTruthy()
  const ci = (await ciResponse.json()).items[0]

  await page.setViewportSize({ width: 1280, height: 480 })
  await page.goto(`/datasets/${dataset.id}`)
  await page.getByRole("tab", { name: "拓扑" }).click()
  await page.locator(".react-flow__node").first().click()

  const detail = page.getByRole("dialog")
  expect(await detail.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(500)
  await expect(detail.getByRole("heading", { name: `全部属性（${Object.keys(ci.attributes).length}）` })).toBeVisible()
  await expect(detail.locator('[data-detail-kind="basic"]')).toHaveCount(3)
  await expect(detail.locator('[data-detail-kind="attribute"]')).toHaveCount(
    Object.keys(ci.attributes).length,
  )
  await expect(detail.locator('[data-detail-kind="tag"]')).toHaveCount(Object.keys(ci.tags).length)

  for (const [key, value] of Object.entries(ci.attributes)) {
    const row = detail.locator(`[data-detail-kind="attribute"][data-detail-key="${key}"]`)
    await expect(row).toContainText(String(value))
  }

  const scrollViewport = detail.locator('[data-slot="scroll-area-viewport"]')
  const scrollBar = detail.locator('[data-slot="scroll-area-scrollbar"]')
  await expect(scrollViewport).toBeVisible()
  await expect(scrollBar).toBeVisible()
  expect(
    await scrollViewport.evaluate((element) => element.scrollHeight > element.clientHeight),
  ).toBe(true)
  await scrollViewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(detail.getByRole("heading", { name: `全部标签（${Object.keys(ci.tags).length}）` })).toBeVisible()
})

test("拓扑默认从顶层折叠，点击节点逐层展开", async ({ page }) => {
  await login(page)

  // 直接通过 API 构造 7 层数据集：dc > rack > server > vm > k8s_node > k8s_workload > app
  const spec = {
    name: "e2e-drilldown",
    description: "七层链路用于验证钻取式展开",
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
      { type: "contained_in", from_type: "rack", to_type: "data_center", strategy: "balanced", coverage: "from" },
      { type: "mounted_in", from_type: "physical_server", to_type: "rack", strategy: "balanced", coverage: "from" },
      { type: "runs_on", from_type: "virtual_machine", to_type: "physical_server", strategy: "balanced", coverage: "from" },
      { type: "hosted_on", from_type: "kubernetes_node", to_type: "virtual_machine", strategy: "balanced", coverage: "from" },
      { type: "hosted_on", from_type: "kubernetes_workload", to_type: "kubernetes_node", strategy: "balanced", coverage: "from" },
      { type: "hosted_on", from_type: "application", to_type: "kubernetes_workload", strategy: "balanced", coverage: "from" },
    ],
  }
  const created = await page.request.post("/api/v1/datasets", {
    data: { spec, prompt: "e2e 钻取展开" },
    headers: { Authorization: "Bearer e2e-test-key" },
  })
  expect(created.ok()).toBeTruthy()
  const datasetId = (await created.json()).id

  await page.goto(`/datasets/${datasetId}`)
  await page.getByRole("tab", { name: "拓扑" }).click()

  const nodes = page.locator(".react-flow__node")

  // 默认只显示顶层根节点（1 个数据中心），提示逐层展开
  await expect(page.getByText(/请点击节点上的 \+ 逐层展开查看/)).toBeVisible()
  await expect(nodes).toHaveCount(1)

  // 点击根节点的 + 展开机柜层
  await nodes.getByRole("button").first().click()
  await expect(nodes).toHaveCount(3)

  // 点击机柜 rack-0001 的 + 展开其服务器（balanced：每机柜 1 台）
  await page.locator(".react-flow__node", { hasText: "rack-0001" }).getByRole("button").click()
  await expect(nodes).toHaveCount(4)

  // 点击 server-0001 的 + 展开其虚拟机：子树聚簇，VM 紧贴宿主机正下方直连
  await page
    .locator(".react-flow__node", { hasText: "server-0001" })
    .getByRole("button")
    .click()
  await expect(nodes).toHaveCount(6)
  // 连线正常绘制：其 2 台 VM 各有一条 runs_on 边直连宿主机（自定义节点需渲染 Handle）
  await expect(
    page.locator(".react-flow__edge").filter({ hasText: "runs_on" }),
  ).toHaveCount(2)
  const serverBox = await page
    .locator(".react-flow__node", { hasText: "server-0001" })
    .boundingBox()
  const vmBox = await page.locator(".react-flow__node", { hasText: "vm-0001" }).boundingBox()
  expect(vmBox!.y).toBeGreaterThan(serverBox!.y)

  // 展开进度提示：当前显示 6 / 15
  await expect(page.getByText(/当前显示 6 \/ 15 个节点/)).toBeVisible()

  // 收起全部回到顶层
  await page.getByRole("button", { name: "收起全部" }).click()
  await expect(nodes).toHaveCount(1)
  await expect(page.getByText(/请点击节点上的 \+ 逐层展开查看/)).toBeVisible()
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
  await expect(page.getByText("质量缺陷明细")).toBeVisible()
  await expect(page.getByText(/实际 1 \/ 请求 1 条/)).toBeVisible()
  await expect(page.getByText(/dc-0001|rack-0001|server-0001/)).toBeVisible()

  const reportDownload = page.waitForEvent("download")
  await page.getByRole("button", { name: "下载完整质量报告" }).click()
  await expect((await reportDownload).suggestedFilename()).toMatch(/quality-report\.json$/)
})

test("规格可下载、从旧数据集复用、换 seed 后再导入", async ({ page }) => {
  await login(page)
  await page.goto("/create")
  await page
    .locator("div", { hasText: "小型数据中心" })
    .getByRole("button", { name: "使用此模板" })
    .first()
    .click()
  await page.getByRole("button", { name: "生成数据集", exact: true }).click()
  await page.waitForURL(/\/datasets\/\d+/)

  const specDownload = page.waitForEvent("download")
  await page.getByRole("button", { name: "下载规格", exact: true }).click()
  const downloaded = await specDownload
  expect(downloaded.suggestedFilename()).toMatch(/dataset-\d+-spec\.json$/)
  const downloadedPath = await downloaded.path()
  expect(downloadedPath).not.toBeNull()

  await page.getByRole("button", { name: "基于此规格新建" }).click()
  await expect(page).toHaveURL(/\/create$/)
  await expect(page.getByText(/已从数据集「小型数据中心」复制规格/)).toBeVisible()
  const seedInput = page.getByLabel("随机种子（seed）")
  const originalSeed = await seedInput.inputValue()
  await page.getByRole("button", { name: "换一个 seed" }).click()
  await expect(seedInput).not.toHaveValue(originalSeed)

  await page.getByLabel("GenerationSpec JSON 文件").setInputFiles(downloadedPath!)
  await expect(page.getByText(/已导入并校验/)).toBeVisible()
  await expect(seedInput).toHaveValue(originalSeed)
})

test("应用关系模板会给每个应用生成一到多条真实关系", async ({ page }) => {
  await login(page)
  await page.goto("/create")
  await page
    .locator('[data-slot="card"]', { hasText: "应用与数据库" })
    .getByRole("button", { name: "使用此模板" })
    .click()

  await expect(page.getByLabel("关系 1 最少连接数")).toHaveValue("1")
  await expect(page.getByLabel("关系 1 最多连接数")).toHaveValue("3")
  await page.getByRole("button", { name: "生成数据集", exact: true }).click()
  await page.waitForURL(/\/datasets\/(\d+)/)
  const datasetId = Number(page.url().match(/\/datasets\/(\d+)/)?.[1])

  const response = await page.request.get(
    `/api/v1/datasets/${datasetId}/relations?type=uses&page_size=200`,
    { headers: { Authorization: "Bearer e2e-test-key" } },
  )
  expect(response.ok()).toBeTruthy()
  const payload = await response.json()
  const counts = new Map<string, number>()
  for (const relation of payload.items) {
    counts.set(relation.from_id, (counts.get(relation.from_id) ?? 0) + 1)
  }
  expect(counts.size).toBe(40)
  expect([...counts.values()].every((count) => count >= 1 && count <= 3)).toBe(true)
  expect([...counts.values()].some((count) => count > 1)).toBe(true)
})
