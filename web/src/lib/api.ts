// API 客户端：会话令牌与 API Key 都只保存在 sessionStorage，不写入 URL、日志或构建产物。
// 认证双通道：管理员登录会话令牌为主，环境变量 ISL_API_KEY 作为备用。


import type {
  CIRecord,
  DatasetSummary,
  GenerationSpec,
  Paged,
  RelationRecord,
  SpecProposal,
  TemplateInfo,
} from "./spec"

const KEY_STORAGE = "isl_api_key"
const TOKEN_STORAGE = "isl_session_token"
const USER_STORAGE = "isl_session_user"

// 401 时通知界面跳转到登录页
let unauthorizedHandler: (() => void) | null = null

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler
}

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

export function getApiKey(): string {
  return sessionStorage.getItem(KEY_STORAGE) ?? ""
}

export function setApiKey(key: string): void {
  sessionStorage.setItem(KEY_STORAGE, key.trim())
}

export function clearApiKey(): void {
  sessionStorage.removeItem(KEY_STORAGE)
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0
}

export function getSessionToken(): string {
  return sessionStorage.getItem(TOKEN_STORAGE) ?? ""
}

export function getSessionUser(): string {
  return sessionStorage.getItem(USER_STORAGE) ?? ""
}

export function setSession(token: string, username: string): void {
  sessionStorage.setItem(TOKEN_STORAGE, token)
  sessionStorage.setItem(USER_STORAGE, username)
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_STORAGE)
  sessionStorage.removeItem(USER_STORAGE)
}

export function hasSession(): boolean {
  return getSessionToken().length > 0
}

/** 认证令牌：会话令牌优先，API Key 备用。 */
export function getAuthToken(): string {
  return getSessionToken() || getApiKey()
}

export function extractDetail(payload: unknown, fallback: string): string {
  if (typeof payload === "string") return payload
  if (payload && typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail
    if (typeof detail === "string") return detail
    if (detail && typeof detail === "object") {
      const errors = (detail as { errors?: unknown }).errors
      if (Array.isArray(errors)) return errors.join("；")
      try {
        return JSON.stringify(detail)
      } catch {
        return fallback
      }
    }
  }
  return fallback
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal,
  notify401 = true,
): Promise<T> {
  const headers = new Headers(options.headers)
  const token = getAuthToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (options.body) headers.set("Content-Type", "application/json")

  let response: Response
  try {
    response = await fetch(path, { ...options, headers, signal })
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error
    throw new ApiError(0, "无法连接服务端，请确认应用正在运行。")
  }

  if (!response.ok) {
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
    if (response.status === 401 && notify401 && unauthorizedHandler) unauthorizedHandler()
    throw new ApiError(response.status, extractDetail(payload, `请求失败（HTTP ${response.status}）`))
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export interface DatasetListItem {
  id: number
  name: string
  description: string
  seed: number
  record_count: number
  relation_count: number
  created_at: string | null
  warnings: string[]
}

export interface DatasetDetail extends DatasetListItem {
  prompt: string
  generator_version: string
  spec: GenerationSpec
}

export interface AIConfigInfo {
  base_url: string
  model: string
  timeout_seconds: number
  api_key_configured: boolean
  api_key_hint: string
  ai_configured: boolean
}

export interface AIPromptConfig {
  default_prompt: string
  custom_prompt: string
  active: "default" | "custom"
}

export interface TopologyNode {
  id: string
  type: string
  name: string
}

export interface TopologyEdge {
  id: string
  type: string
  from_id: string
  to_id: string
}

export interface TopologyData {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  truncated: boolean
  total_nodes: number
  node_limit: number
}

export const api = {
  status: () =>
    request<{ ai_configured: boolean; default_api_key: string }>("/api/v1/status"),

  // 登录接口不携带令牌，也不触发全局 401 跳转（密码错误的 401 由页面自己处理）
  login: (username: string, password: string) =>
    request<{ token: string; username: string; expires_at: string }>(
      "/api/v1/auth/login",
      { method: "POST", body: JSON.stringify({ username, password }) },
      undefined,
      false,
    ),

  logout: () => request<void>("/api/v1/auth/logout", { method: "POST" }),

  changePassword: (oldPassword: string, newPassword: string) =>
    request<void>("/api/v1/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    }),

  getAIConfig: () => request<AIConfigInfo>("/api/v1/admin/ai-config"),

  updateAIConfig: (payload: {
    base_url: string
    api_key: string | null
    model: string
    timeout_seconds: number
  }) =>
    request<AIConfigInfo>("/api/v1/admin/ai-config", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  // 拉取 AI 服务端最新模型 ID 列表（需先保存配置）
  listAIModels: () => request<{ models: string[] }>("/api/v1/admin/ai-config/models"),

  // 测试当前 AI 配置的连通性；未配置返回 ok: false 而非报错
  testAIConnection: () =>
    request<{ ok: boolean; message: string }>("/api/v1/admin/ai-config/test", {
      method: "POST",
    }),

  getAIPrompts: () => request<AIPromptConfig>("/api/v1/admin/ai-prompts"),

  updateAIPrompts: (payload: { active: "default" | "custom"; custom_prompt?: string }) =>
    request<AIPromptConfig>("/api/v1/admin/ai-prompts", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  templates: () =>
    request<{ templates: TemplateInfo[]; ci_types: string[]; relation_types: string[] }>(
      "/api/v1/templates",
    ),

  fromPrompt: (prompt: string, signal?: AbortSignal) =>
    request<SpecProposal>(
      "/api/v1/specs/from-prompt",
      { method: "POST", body: JSON.stringify({ prompt }) },
      signal,
    ),

  createDataset: (spec: GenerationSpec, prompt: string) =>
    request<DatasetDetail>("/api/v1/datasets", {
      method: "POST",
      body: JSON.stringify({ spec, prompt }),
    }),

  listDatasets: (params: { q?: string; page?: number; page_size?: number }) => {
    const search = new URLSearchParams()
    if (params.q) search.set("q", params.q)
    search.set("page", String(params.page ?? 1))
    search.set("page_size", String(params.page_size ?? 20))
    return request<Paged<DatasetListItem>>(`/api/v1/datasets?${search.toString()}`)
  },

  getDataset: (id: number) => request<DatasetDetail>(`/api/v1/datasets/${id}`),

  deleteDataset: (id: number) =>
    request<void>(`/api/v1/datasets/${id}`, { method: "DELETE" }),

  summary: (id: number) => request<DatasetSummary>(`/api/v1/datasets/${id}/summary`),

  listCis: (
    id: number,
    params: { type?: string; q?: string; page?: number; page_size?: number },
  ) => {
    const search = new URLSearchParams()
    if (params.type) search.set("type", params.type)
    if (params.q) search.set("q", params.q)
    search.set("page", String(params.page ?? 1))
    search.set("page_size", String(params.page_size ?? 20))
    return request<Paged<CIRecord>>(`/api/v1/datasets/${id}/cis?${search.toString()}`)
  },

  getCi: (id: number, ciId: string) =>
    request<CIRecord>(`/api/v1/datasets/${id}/cis/${encodeURIComponent(ciId)}`),

  listRelations: (
    id: number,
    params: { type?: string; from_id?: string; to_id?: string; page?: number; page_size?: number },
  ) => {
    const search = new URLSearchParams()
    if (params.type) search.set("type", params.type)
    if (params.from_id) search.set("from_id", params.from_id)
    if (params.to_id) search.set("to_id", params.to_id)
    search.set("page", String(params.page ?? 1))
    search.set("page_size", String(params.page_size ?? 20))
    return request<Paged<RelationRecord>>(`/api/v1/datasets/${id}/relations?${search.toString()}`)
  },

  // 简单拓扑：有界返回，支持类型/文字筛选与聚焦邻居（center）
  topology: (
    id: number,
    params: { ci_type?: string; relation_type?: string; q?: string; center?: string },
  ) => {
    const search = new URLSearchParams()
    if (params.ci_type) search.set("ci_type", params.ci_type)
    if (params.relation_type) search.set("relation_type", params.relation_type)
    if (params.q) search.set("q", params.q)
    if (params.center) search.set("center", params.center)
    return request<TopologyData>(`/api/v1/datasets/${id}/topology?${search.toString()}`)
  },

  // 导出需要携带 Authorization 请求头，因此走 fetch + Blob 下载
  downloadExport: async (id: number, format: "json" | "csv" | "xlsx") => {
    const token = getAuthToken()
    const response = await fetch(`/api/v1/datasets/${id}/export?format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) {
      if (response.status === 401 && unauthorizedHandler) unauthorizedHandler()
      throw new ApiError(response.status, `导出失败（HTTP ${response.status}）`)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    const extension = format === "csv" ? "zip" : format
    anchor.href = url
    anchor.download = `dataset-${id}.${extension}`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  },
}
