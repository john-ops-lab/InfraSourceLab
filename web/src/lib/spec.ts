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

// 四种确定性数据质量缺陷（Issue #2）
export type DefectKind = "missing_field" | "case_drift" | "duplicate_record" | "wrong_value"

export interface QualityDefectEntry {
  kind: DefectKind
  ci_type: string
  field?: string
  ratio?: number
  count?: number
}

export interface GenerationSpec {
  name: string
  description: string
  seed: number
  ci_types: CITypeEntry[]
  relations: RelationEntry[]
  quality_defects?: QualityDefectEntry[]
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

// 关系类型中文对照（口径与后端 BUILTIN_RELATION_TYPES 一致，
// 覆盖业界 CMDB 常见关系：包含/安装/运行/托管/部署/归属/依赖/使用/连接/管理/服务提供与消费/备份）
export const RELATION_TYPE_LABELS: Record<string, string> = {
  contains: "包含",
  mounted_in: "安装于",
  runs_on: "运行于",
  hosted_on: "托管于",
  deployed_on: "部署于",
  belongs_to: "隶属于",
  depends_on: "依赖于",
  uses: "使用",
  has_ip: "拥有 IP",
  connected_to: "连接至",
  owned_by: "归属于",
  manages: "管理",
  provides: "提供服务",
  consumes: "消费服务",
  backup_of: "备份于",
}

// 关系标签展示模式：中文 / 英文 / 中英对照（如 runs_on(运行于)）
export type RelationLabelMode = "zh" | "en" | "both"

export function relationTypeLabel(type: string, mode: RelationLabelMode = "both"): string {
  const zh = RELATION_TYPE_LABELS[type]
  if (mode === "en" || !zh) return type
  if (mode === "zh") return zh
  return `${type}(${zh})`
}

export const DEFECT_KIND_LABELS: Record<DefectKind, string> = {
  missing_field: "缺失字段",
  case_drift: "大小写漂移",
  duplicate_record: "重复记录",
  wrong_value: "错误值",
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
