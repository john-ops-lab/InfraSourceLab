// GenerationSpec 类型与展示辅助：后端 GenerationSpec 是唯一权威模型

export type RelationStrategy = "balanced" | "random_seeded"
export type RelationCoverage = "from" | "to"

export interface CITypeEntry {
  type: string
  count: number
  overrides?: Record<string, string>
}

export interface RelationEntry {
  type: string
  from_type: string
  to_type: string
  strategy: RelationStrategy
  coverage: RelationCoverage
}

export interface GenerationSpec {
  name: string
  description: string
  seed: number
  ci_types: CITypeEntry[]
  relations: RelationEntry[]
  metadata?: Record<string, string>
}

export interface SpecProposal {
  message: string
  spec: GenerationSpec
  warnings: string[]
}

export interface DatasetSummary {
  id: number
  name: string
  description: string
  prompt: string
  seed: number
  generator_version: string
  record_count: number
  relation_count: number
  warnings: string[]
  spec: GenerationSpec
  ci_counts_by_type: Record<string, number>
  relation_counts_by_type: Record<string, number>
  created_at: string | null
}

export interface CIRecord {
  id: string
  type: string
  name: string
  attributes: Record<string, unknown>
  tags: Record<string, string>
}

export interface RelationRecord {
  id: string
  type: string
  from_id: string
  from_type: string
  from_name: string
  to_id: string
  to_type: string
  to_name: string
  attributes: Record<string, unknown>
}

export interface Paged<T> {
  items: T[]
  page: number
  page_size: number
  total: number
}

export interface TemplateInfo {
  id: string
  name: string
  description: string
  spec: GenerationSpec
}

// CI 类型中文标签
export const CI_TYPE_LABELS: Record<string, string> = {
  data_center: "数据中心",
  rack: "机柜",
  physical_server: "物理服务器",
  virtual_machine: "虚拟机",
  network_device: "网络设备",
  ip_address: "IP 地址",
  application: "应用",
  database: "数据库",
  middleware: "中间件",
  kubernetes_cluster: "Kubernetes 集群",
  kubernetes_node: "Kubernetes 节点",
  kubernetes_workload: "Kubernetes 工作负载",
}

export const RELATION_TYPE_LABELS: Record<string, string> = {
  contains: "包含（contains）",
  mounted_in: "安装于（mounted_in）",
  runs_on: "运行于（runs_on）",
  hosted_on: "承载于（hosted_on）",
  belongs_to: "属于（belongs_to）",
  depends_on: "依赖（depends_on）",
  uses: "使用（uses）",
  has_ip: "拥有 IP（has_ip）",
}

export function ciTypeLabel(type: string): string {
  return CI_TYPE_LABELS[type] ?? type
}

export function formatRelation(entry: RelationEntry): string {
  const coverage =
    entry.coverage === "from" ? "coverage=from（覆盖每个起点）" : "coverage=to（覆盖每个终点）"
  return `${entry.type}：${entry.from_type} → ${entry.to_type}（${entry.strategy}，${coverage}）`
}

export function totalCiCount(spec: GenerationSpec): number {
  return spec.ci_types.reduce((sum, entry) => sum + entry.count, 0)
}
