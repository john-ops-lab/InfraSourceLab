// 关系类型注册表共享 hook：拓扑/编辑器/详情页读对照名与方向，
// 设置页增删改后调 invalidateRelationTypes() 清缓存，其余页面下次挂载重新拉取。
// 拉取失败时保持空注册表，展示回退到内置默认标签，不打断页面。

import { useEffect, useMemo, useState } from "react"
import { api, type RelationTypeInfo } from "@/lib/api"

let cached: RelationTypeInfo[] | null = null
let inflight: Promise<RelationTypeInfo[]> | null = null

function fetchRows(): Promise<RelationTypeInfo[]> {
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = api
      .getRelationTypes()
      .then((rows) => {
        cached = rows
        return rows
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** 清空缓存：设置页对关系类型做增删改后调用。 */
export function invalidateRelationTypes() {
  cached = null
}

/**
 * 读取关系类型注册表：
 * - registry 供 relationTypeLabel(type, mode, registry) 做中英文对照覆盖
 * - relationTypes 为原始清单（设置页表格直接使用）
 */
export function useRelationTypes() {
  const [rows, setRows] = useState<RelationTypeInfo[]>(() => cached ?? [])

  useEffect(() => {
    let cancelled = false
    fetchRows().then(
      (result) => {
        if (!cancelled) setRows(result)
      },
      () => {
        // 失败不缓存：保持空注册表，展示回退内置标签
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const registry = useMemo(
    () => new Map<string, RelationTypeInfo>(rows.map((row) => [row.type, row])),
    [rows],
  )
  return { relationTypes: rows, registry }
}
