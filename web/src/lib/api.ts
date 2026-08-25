// API 客户端：Bearer Token 只保存在 sessionStorage，不写入 URL、日志或构建产物

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

// 401 时通知界面跳转到设置页重新填写 API Key
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
): Promise<T> {
  const headers = new Headers(options.headers)
  const key = getApiKey()
  if (key) headers.set("Authorization", `Bearer ${key}`)
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
    if (response.status === 401 && unauthorizedHandler) unauthorizedHandler()
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

export const api = {
  status: () => request<{ ai_configured: boolean }>("/api/v1/status"),

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

  // 导出需要携带 Authorization 请求头，因此走 fetch + Blob 下载
  downloadExport: async (id: number, format: "json" | "csv" | "xlsx") => {
    const key = getApiKey()
    const response = await fetch(`/api/v1/datasets/${id}/export?format=${format}`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
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
