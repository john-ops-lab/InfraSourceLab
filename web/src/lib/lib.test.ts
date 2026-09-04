import { describe, expect, it } from "vitest"
import {
  ciTypeLabel,
  formatRelation,
  totalCiCount,
  type GenerationSpec,
} from "./spec"
import { extractDetail } from "./api"
import { nextSeed, parseGenerationSpecJson } from "./spec-file"

const spec: GenerationSpec = {
  name: "demo",
  description: "",
  seed: 42,
  ci_types: [
    { type: "rack", count: 4 },
    { type: "physical_server", count: 16 },
  ],
  relations: [],
}

describe("ciTypeLabel", () => {
  it("返回内置类型的中文标签", () => {
    expect(ciTypeLabel("physical_server")).toBe("物理服务器")
    expect(ciTypeLabel("kubernetes_workload")).toBe("Kubernetes 工作负载")
  })

  it("未知类型原样返回", () => {
    expect(ciTypeLabel("unknown_type")).toBe("unknown_type")
  })
})

describe("totalCiCount", () => {
  it("汇总所有类型的数量", () => {
    expect(totalCiCount(spec)).toBe(20)
  })
})

describe("formatRelation", () => {
  it("展示 strategy 与 coverage 语义", () => {
    const text = formatRelation({
      type: "mounted_in",
      from_type: "physical_server",
      to_type: "rack",
      strategy: "balanced",
      coverage: "from",
    })
    expect(text).toContain("mounted_in")
    expect(text).toContain("physical_server → rack")
    expect(text).toContain("balanced")
    expect(text).toContain("coverage=from")
  })

  it("展示每个覆盖对象的关系数量范围", () => {
    const text = formatRelation({
      type: "uses",
      from_type: "application",
      to_type: "database",
      strategy: "random_seeded",
      coverage: "from",
      min_links: 2,
      max_links: 3,
    })
    expect(text).toContain("每个起点 2~3 条")
  })
})

describe("GenerationSpec 文件辅助", () => {
  it("只接受 JSON 对象", () => {
    expect(parseGenerationSpecJson('{"name":"demo"}')).toEqual({ name: "demo" })
    expect(() => parseGenerationSpecJson("[]")).toThrow("JSON 对象")
    expect(() => parseGenerationSpecJson("not json")).toThrow("不是有效的 JSON")
  })

  it("新 seed 即使遇到相同随机值也会变化", () => {
    expect(nextSeed(42, 42)).toBe(43)
    expect(nextSeed(2_147_483_647, 2_147_483_647)).toBe(0)
  })
})

describe("extractDetail", () => {
  it("解析字符串 detail", () => {
    expect(extractDetail({ detail: "认证失败" }, "fallback")).toBe("认证失败")
  })

  it("解析校验错误列表", () => {
    expect(
      extractDetail({ detail: { errors: ["关系端点不存在", "数量超出上限"] } }, "fallback"),
    ).toBe("关系端点不存在；数量超出上限")
  })

  it("未知结构回退到默认文案", () => {
    expect(extractDetail(null, "fallback")).toBe("fallback")
  })
})
