import { describe, expect, it } from "vitest"
import { computeDepths, computeDrilldownLayout } from "@/components/TopologyView"

const TYPE_ORDER = [
  "data_center",
  "rack",
  "physical_server",
  "virtual_machine",
  "application",
  "database",
]

function node(id: string, type: string) {
  return { id, type, name: id }
}

function edge(id: string, type: string, from: string, to: string) {
  return { id, type, from_id: from, to_id: to }
}

describe("computeDepths", () => {
  it("按真实关系分层：contains 向下、mounted_in/runs_on/hosted_on 向上归一为父在上", () => {
    const depths = computeDepths(
      [
        node("dc-1", "data_center"),
        node("rack-1", "rack"),
        node("server-1", "physical_server"),
        node("vm-1", "virtual_machine"),
        node("app-1", "application"),
      ],
      [
        edge("e1", "contains", "dc-1", "rack-1"),
        edge("e2", "mounted_in", "server-1", "rack-1"),
        edge("e3", "runs_on", "vm-1", "server-1"),
        edge("e4", "hosted_on", "app-1", "vm-1"),
      ],
      TYPE_ORDER,
    )
    expect(depths.get("dc-1")).toBe(0)
    expect(depths.get("rack-1")).toBe(1)
    expect(depths.get("server-1")).toBe(2)
    expect(depths.get("vm-1")).toBe(3)
    expect(depths.get("app-1")).toBe(4)
  })

  it("分层不依赖类型声明顺序（乱序 spec 也能得到正确层级）", () => {
    const depths = computeDepths(
      [node("app-1", "application"), node("dc-1", "data_center"), node("rack-1", "rack")],
      [edge("e1", "contains", "dc-1", "rack-1"), edge("e2", "hosted_on", "app-1", "rack-1")],
      // spec 声明顺序故意与层级相反
      ["application", "rack", "data_center"],
    )
    expect(depths.get("dc-1")).toBe(0)
    expect(depths.get("rack-1")).toBe(1)
    expect(depths.get("app-1")).toBe(2)
  })

  it("取最长路径深度（跨层边按最深父级计算）", () => {
    const depths = computeDepths(
      [node("dc-1", "data_center"), node("rack-1", "rack"), node("server-1", "physical_server")],
      [
        edge("e1", "contains", "dc-1", "rack-1"),
        edge("e2", "contains", "dc-1", "server-1"),
        edge("e3", "mounted_in", "server-1", "rack-1"),
      ],
      TYPE_ORDER,
    )
    expect(depths.get("rack-1")).toBe(1)
    // server 的父 rack 在第 1 层，所以 server 在第 2 层
    expect(depths.get("server-1")).toBe(2)
  })

  it("平级关系（uses/depends_on/has_ip）不参与分层", () => {
    const depths = computeDepths(
      [node("app-1", "application"), node("db-1", "database")],
      [edge("e1", "uses", "app-1", "db-1")],
      TYPE_ORDER,
    )
    // 两个孤岛按类型顺序各占一层
    expect(depths.get("app-1")).toBe(0)
    expect(depths.get("db-1")).toBe(1)
  })

  it("孤岛节点排在层级图下方", () => {
    const depths = computeDepths(
      [node("dc-1", "data_center"), node("rack-1", "rack"), node("db-1", "database")],
      [edge("e1", "contains", "dc-1", "rack-1")],
      TYPE_ORDER,
    )
    expect(depths.get("db-1")).toBe(2)
  })

  it("环节点兜底放到最大深度之下，不与正常节点同层", () => {
    const depths = computeDepths(
      [node("a", "rack"), node("b", "rack"), node("dc-1", "data_center"), node("rack-1", "rack")],
      [
        edge("e1", "contains", "dc-1", "rack-1"),
        edge("e2", "mounted_in", "a", "b"),
        edge("e3", "mounted_in", "b", "a"),
      ],
      TYPE_ORDER,
    )
    expect(depths.get("rack-1")).toBe(1)
    expect(depths.get("a")).toBeGreaterThan(1)
    expect(depths.get("b")).toBeGreaterThan(1)
  })
})

// dc -> rack -> server -> vm 四层链路（VM 只挂宿主机，不存在 VM 互连）
const CHAIN_NODES = [
  node("dc-1", "data_center"),
  node("rack-1", "rack"),
  node("server-1", "physical_server"),
  node("server-2", "physical_server"),
  node("vm-1", "virtual_machine"),
  node("vm-2", "virtual_machine"),
]
const CHAIN_EDGES = [
  edge("e1", "contains", "dc-1", "rack-1"),
  edge("e2", "mounted_in", "server-1", "rack-1"),
  edge("e3", "mounted_in", "server-2", "rack-1"),
  edge("e4", "runs_on", "vm-1", "server-1"),
  edge("e5", "runs_on", "vm-2", "server-1"),
]

describe("computeDrilldownLayout", () => {
  it("默认仅顶层根节点可见，隐藏子级数体现在 +N 徽标数据中", () => {
    const layout = computeDrilldownLayout(CHAIN_NODES, CHAIN_EDGES, TYPE_ORDER, [])
    expect([...layout.visibleIds]).toEqual(["dc-1"])
    expect(layout.hiddenChildCounts.get("dc-1")).toBe(1)
  })

  it("逐层展开：展开 dc 后 rack 可见，再展开 rack 后 server 可见", () => {
    const step1 = computeDrilldownLayout(CHAIN_NODES, CHAIN_EDGES, TYPE_ORDER, ["dc-1"])
    expect([...step1.visibleIds].sort()).toEqual(["dc-1", "rack-1"])
    const step2 = computeDrilldownLayout(CHAIN_NODES, CHAIN_EDGES, TYPE_ORDER, ["dc-1", "rack-1"])
    expect([...step2.visibleIds].sort()).toEqual(["dc-1", "rack-1", "server-1", "server-2"])
    const step3 = computeDrilldownLayout(CHAIN_NODES, CHAIN_EDGES, TYPE_ORDER, [
      "dc-1",
      "rack-1",
      "server-1",
    ])
    expect([...step3.visibleIds].sort()).toEqual([
      "dc-1",
      "rack-1",
      "server-1",
      "server-2",
      "vm-1",
      "vm-2",
    ])
  })

  it("子树聚簇：VM 紧贴宿主机正下方且水平居中，不再横向铺开交叉连线", () => {
    const layout = computeDrilldownLayout(CHAIN_NODES, CHAIN_EDGES, TYPE_ORDER, [
      "dc-1",
      "rack-1",
      "server-1",
    ])
    const server = layout.positions.get("server-1")!
    const vm1 = layout.positions.get("vm-1")!
    const vm2 = layout.positions.get("vm-2")!
    // VM 位于宿主机下一代的正下方
    expect(vm1.y).toBe(server.y + 110)
    expect(vm2.y).toBe(server.y + 110)
    // 宿主机水平居中于两个 VM 之间
    expect(server.x).toBe((vm1.x + vm2.x) / 2)
    expect(Math.abs(vm1.x - vm2.x)).toBe(190)
  })

  it("收起中间层后，仅经由它可见的后代随之隐藏", () => {
    // 展开 dc 与 server（rack 未展开）：rack 因 dc 展开可见，server 及其 VM 失去展开路径
    const layout = computeDrilldownLayout(CHAIN_NODES, CHAIN_EDGES, TYPE_ORDER, ["dc-1", "server-1"])
    expect([...layout.visibleIds].sort()).toEqual(["dc-1", "rack-1"])
  })

  it("多父共享子：归属最早展开且可见的父，另一父画跨区块连线", () => {
    const nodes = [
      node("dc-1", "data_center"),
      node("dc-2", "data_center"),
      node("rack-1", "rack"),
    ]
    const edges = [
      edge("e1", "contains", "dc-1", "rack-1"),
      edge("e2", "contains", "dc-2", "rack-1"),
    ]
    // 先展开 dc-2：rack-1 归属 dc-2 子树
    const layout = computeDrilldownLayout(nodes, edges, TYPE_ORDER, ["dc-2"])
    expect([...layout.visibleIds].sort()).toEqual(["dc-1", "dc-2", "rack-1"])
    const dc2 = layout.positions.get("dc-2")!
    const rack = layout.positions.get("rack-1")!
    const dc1 = layout.positions.get("dc-1")!
    expect(rack.y).toBe(dc2.y + 110)
    expect(rack.x).toBe(dc2.x)
    expect(dc1.x).toBeLessThan(dc2.x)
  })

  it("平级关系（uses）不影响可见性与树形布局", () => {
    const nodes = [
      node("dc-1", "data_center"),
      node("rack-1", "rack"),
      node("app-1", "application"),
      node("db-1", "database"),
    ]
    const edges = [
      edge("e1", "contains", "dc-1", "rack-1"),
      edge("e2", "uses", "app-1", "db-1"),
      // app 挂在 rack 下，db 只被平级引用 → db 是孤岛根
      edge("e3", "hosted_on", "app-1", "rack-1"),
    ]
    const layout = computeDrilldownLayout(nodes, edges, TYPE_ORDER, ["dc-1", "rack-1"])
    // 孤岛 db-1 无父即根，默认可见
    expect([...layout.visibleIds].sort()).toEqual(["app-1", "db-1", "dc-1", "rack-1"])
    const full = computeDrilldownLayout(nodes, edges, TYPE_ORDER, [])
    expect([...full.visibleIds].sort()).toEqual(["db-1", "dc-1"])
  })
})
