import { describe, expect, it } from "vitest"
import { computeDepths } from "@/components/TopologyView"

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
