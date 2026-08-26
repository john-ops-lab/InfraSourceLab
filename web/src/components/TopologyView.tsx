import { useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  ControlButton,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Crosshair, Maximize2, Minimize2, Search, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError, type TopologyData } from "@/lib/api"
import { ciTypeLabel, type CIRecord, type CITypeEntry } from "@/lib/spec"

const COLS = 12
const NODE_GAP_X = 190
const ROW_GAP_Y = 90
const LAYER_GAP_Y = 70

// 超过 6 层时，第 7 层及以下默认折叠（点击占位块展开）
const MAX_VISIBLE_LAYERS = 6

// 建立层级的关系：to 一侧是父节点（如 physical_server mounted_in rack）
const CHILD_TO_PARENT_TYPES = new Set(["mounted_in", "runs_on", "hosted_on", "belongs_to"])
// from 一侧是父节点（如 data_center contains rack）
const PARENT_TO_CHILD_TYPES = new Set(["contains"])
// 其余关系（depends_on/uses/has_ip）视为平级，不参与分层，仅绘制

const COLLAPSED_NODE_ID = "__collapsed_layers__"

interface TopologyNodeLike {
  id: string
  type: string
  name: string
}

interface TopologyEdgeLike {
  id: string
  type: string
  from_id: string
  to_id: string
}

/**
 * 按真实关系计算每个节点的层级（父在上、子在下）：
 * Kahn 最长路径分层，depth(根)=0，depth(子)=max(depth(父))+1。
 * 不参与层级边的孤岛节点按类型顺序排在层级图下方；
 * 环上节点兜底放到已算出的最大深度之下，避免与正常节点重叠。
 * 导出仅供单元测试使用。
 */
export function computeDepths(
  nodes: TopologyNodeLike[],
  edges: TopologyEdgeLike[],
  typeOrder: string[],
): Map<string, number> {
  const ids = new Set(nodes.map((node) => node.id))
  const parents = new Map<string, Set<string>>()
  const children = new Map<string, Set<string>>()
  for (const edge of edges) {
    if (!ids.has(edge.from_id) || !ids.has(edge.to_id)) continue
    let parent: string
    let child: string
    if (CHILD_TO_PARENT_TYPES.has(edge.type)) {
      parent = edge.to_id
      child = edge.from_id
    } else if (PARENT_TO_CHILD_TYPES.has(edge.type)) {
      parent = edge.from_id
      child = edge.to_id
    } else {
      continue
    }
    ;(parents.get(child) ?? parents.set(child, new Set()).get(child)!).add(parent)
    ;(children.get(parent) ?? children.set(parent, new Set()).get(parent)!).add(child)
  }

  const depth = new Map<string, number>()
  const pending = new Map<string, number>()
  const queue: string[] = []
  for (const node of nodes) {
    // 孤岛（无任何层级边）不参与 Kahn，交给后面的孤岛排序逻辑
    if (parents.has(node.id)) {
      pending.set(node.id, parents.get(node.id)!.size)
    } else if (children.has(node.id)) {
      depth.set(node.id, 0)
      queue.push(node.id)
    }
  }
  while (queue.length > 0) {
    const current = queue.shift()!
    const currentDepth = depth.get(current) ?? 0
    for (const child of children.get(current) ?? []) {
      depth.set(child, Math.max(depth.get(child) ?? 0, currentDepth + 1))
      const left = (pending.get(child) ?? 1) - 1
      pending.set(child, left)
      if (left === 0) queue.push(child)
    }
  }

  // 环上剩余节点：统一放到已算出的最大深度之下
  let maxDepth = -1
  for (const value of depth.values()) maxDepth = Math.max(maxDepth, value)
  for (const node of nodes) {
    if ((pending.get(node.id) ?? 0) > 0) depth.set(node.id, maxDepth + 1)
  }

  // 孤岛节点（未参与任何层级边）：按类型顺序排在层级图下方逐层排列
  maxDepth = -1
  for (const value of depth.values()) maxDepth = Math.max(maxDepth, value)
  const orphans = nodes.filter((node) => !parents.has(node.id) && !children.has(node.id))
  orphans.sort((a, b) => {
    const typeDiff = typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)
    return typeDiff !== 0 ? typeDiff : a.id.localeCompare(b.id)
  })
  let orphanType: string | null = null
  for (const orphan of orphans) {
    if (orphan.type !== orphanType) {
      maxDepth += 1
      orphanType = orphan.type
    }
    depth.set(orphan.id, maxDepth)
  }
  return depth
}

// 按 CI 类型分层着色（循环取色，确定性）
const TYPE_COLORS = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
]

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

interface TopologyViewProps {
  datasetId: number
  ciTypes: CITypeEntry[]
  relationTypes: string[]
}

export function TopologyView({ datasetId, ciTypes, relationTypes }: TopologyViewProps) {
  const [ciType, setCiType] = useState("all")
  const [relationType, setRelationType] = useState("all")
  const [query, setQuery] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const [center, setCenter] = useState<string | null>(null)
  const [collapsedDeep, setCollapsedDeep] = useState(true)

  const [data, setData] = useState<TopologyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCi, setSelectedCi] = useState<CIRecord | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void containerRef.current?.requestFullscreen()
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .topology(datasetId, {
        ci_type: ciType === "all" ? undefined : ciType,
        relation_type: relationType === "all" ? undefined : relationType,
        q: appliedQuery || undefined,
        center: center ?? undefined,
      })
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof ApiError ? err.detail : "加载拓扑失败。")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [datasetId, ciType, relationType, appliedQuery, center])

  const typeOrder = useMemo(() => ciTypes.map((entry) => entry.type), [ciTypes])

  const typeColor = useMemo(() => {
    const map = new Map<string, string>()
    typeOrder.forEach((type, index) => {
      map.set(type, TYPE_COLORS[index % TYPE_COLORS.length])
    })
    return map
  }, [typeOrder])

  // 按真实关系分层的确定性网格布局：
  // 深度由关系图计算（父在上、子在下），同层按类型分组，层内换行避免过宽
  const { nodes, edges, hiddenCount, hiddenFromLayer, maxLayer } = useMemo(() => {
    if (!data) {
      return {
        nodes: [] as Node[],
        edges: [] as Edge[],
        hiddenCount: 0,
        hiddenFromLayer: 0,
        maxLayer: 0,
      }
    }
    const depths = computeDepths(data.nodes, data.edges, typeOrder)
    const byDepth = new Map<number, TopologyNodeLike[]>()
    let maxLayerValue = 0
    for (const node of data.nodes) {
      const depth = depths.get(node.id) ?? 0
      maxLayerValue = Math.max(maxLayerValue, depth)
      const list = byDepth.get(depth) ?? []
      list.push(node)
      byDepth.set(depth, list)
    }
    // 聚焦邻居模式不折叠；全量视图超过 6 层时第 7 层起默认折叠
    const shouldCollapse = collapsedDeep && center === null && maxLayerValue >= MAX_VISIBLE_LAYERS
    const hiddenNodes = shouldCollapse
      ? data.nodes.filter((node) => (depths.get(node.id) ?? 0) >= MAX_VISIBLE_LAYERS)
      : []

    const typeIndex = new Map(typeOrder.map((type, index) => [type, index]))
    const positions = new Map<string, { x: number; y: number }>()
    let layerY = 0
    for (let depth = 0; depth <= maxLayerValue; depth++) {
      const layer = (byDepth.get(depth) ?? []).slice().sort((a, b) => {
        const diff = (typeIndex.get(a.type) ?? 0) - (typeIndex.get(b.type) ?? 0)
        return diff !== 0 ? diff : a.id.localeCompare(b.id)
      })
      if (layer.length === 0) continue
      layer.forEach((node, index) => {
        positions.set(node.id, {
          x: (index % COLS) * NODE_GAP_X,
          y: layerY + Math.floor(index / COLS) * ROW_GAP_Y,
        })
      })
      layerY += Math.ceil(layer.length / COLS) * ROW_GAP_Y + LAYER_GAP_Y
    }

    const flowNodes: Node[] = data.nodes
      .filter((node) => !hiddenNodes.some((hidden) => hidden.id === node.id))
      .map((node) => {
        const color = typeColor.get(node.type) ?? "#64748b"
        return {
          id: node.id,
          position: positions.get(node.id) ?? { x: 0, y: 0 },
          data: { label: node.name },
          style: { borderColor: color, borderWidth: 2, fontSize: 12 },
        }
      })

    if (shouldCollapse && hiddenNodes.length > 0) {
      flowNodes.push({
        id: COLLAPSED_NODE_ID,
        position: { x: 0, y: layerY },
        data: {
          label: `已折叠第 ${MAX_VISIBLE_LAYERS + 1}~${maxLayerValue + 1} 层（${hiddenNodes.length} 个节点），点击展开`,
        },
        style: {
          borderStyle: "dashed",
          borderColor: "#94a3b8",
          borderWidth: 2,
          fontSize: 12,
          background: "#f8fafc",
          width: 360,
        },
      })
    }

    const nodeIds = new Set(flowNodes.map((node) => node.id))
    const flowEdges: Edge[] = data.edges
      .filter((edge) => nodeIds.has(edge.from_id) && nodeIds.has(edge.to_id))
      .map((edge) => ({
        id: edge.id,
        source: edge.from_id,
        target: edge.to_id,
        // 正交折线避免贝塞尔弧线穿越同层节点造成“同层互联”的误读
        type: "smoothstep",
        label: edge.type,
        labelStyle: { fontSize: 10 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      }))
    return {
      nodes: flowNodes,
      edges: flowEdges,
      hiddenCount: hiddenNodes.length,
      hiddenFromLayer: MAX_VISIBLE_LAYERS + 1,
      maxLayer: maxLayerValue + 1,
    }
  }, [data, typeOrder, typeColor, collapsedDeep, center])

  const handleNodeClick: NodeMouseHandler = async (_event, node) => {
    if (node.id === COLLAPSED_NODE_ID) {
      setCollapsedDeep(false)
      return
    }
    try {
      const ci = await api.getCi(datasetId, node.id)
      setSelectedCi(ci)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "加载 CI 详情失败。")
    }
  }

  // 数据变化时重新挂载以重新适配视图；深层折叠切换后同样重新适配
  const flowKey = `${ciType}|${relationType}|${appliedQuery}|${center ?? ""}|${collapsedDeep ? 1 : 0}`

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setCenter(null)
          setAppliedQuery(query.trim())
        }}
      >
        <Select
          value={ciType}
          onValueChange={(value) => {
            setCiType(value)
            setCenter(null)
          }}
        >
          <SelectTrigger className="w-48" aria-label="拓扑按类型筛选">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {ciTypes.map((entry) => (
              <SelectItem key={entry.type} value={entry.type}>
                {ciTypeLabel(entry.type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={relationType}
          onValueChange={(value) => {
            setRelationType(value)
            setCenter(null)
          }}
        >
          <SelectTrigger className="w-48" aria-label="拓扑按关系类型筛选">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部关系</SelectItem>
            {relationTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-48 flex-1">
          <Search
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="按名称或 ID 筛选节点"
            aria-label="拓扑文字筛选"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="outline">
          筛选
        </Button>
        <Button type="button" variant="outline" onClick={toggleFullscreen}>
          {isFullscreen ? (
            <Minimize2 className="size-4" aria-hidden />
          ) : (
            <Maximize2 className="size-4" aria-hidden />
          )}
          {isFullscreen ? "退出全屏" : "全屏"}
        </Button>
        {center && (
          <Button type="button" variant="ghost" onClick={() => setCenter(null)}>
            <Undo2 className="size-4" aria-hidden />
            返回全量视图
          </Button>
        )}
        {center === null && maxLayer > MAX_VISIBLE_LAYERS && !collapsedDeep && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCollapsedDeep(true)}
          >
            <Minimize2 className="size-4" aria-hidden />
            折叠第 {MAX_VISIBLE_LAYERS + 1} 层以下
          </Button>
        )}
      </form>

      {data?.truncated && (
        <p className="text-sm text-muted-foreground" role="status">
          节点过多，当前仅显示前 {data.node_limit} 个（共 {data.total_nodes}{" "}
          个）。可通过类型或文字筛选缩小范围，或点击节点聚焦其邻居。
        </p>
      )}
      {collapsedDeep && hiddenCount > 0 && center === null && (
        <p className="text-sm text-muted-foreground" role="status">
          层级超过 {MAX_VISIBLE_LAYERS} 层：第 {hiddenFromLayer}~{maxLayer} 层共{" "}
          {hiddenCount} 个节点已折叠，点击图中的虚线占位块可展开。
        </p>
      )}
      {center && (
        <p className="text-sm text-muted-foreground" role="status">
          正在聚焦节点 <span className="font-mono">{center}</span> 及其邻居。
        </p>
      )}

      <div
        ref={containerRef}
        className={cn(
          "rounded-lg border bg-background",
          isFullscreen ? "h-screen w-screen rounded-none" : "h-[480px]",
        )}
      >
        {loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : nodes.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">没有匹配的节点。</p>
        ) : (
          <ReactFlow
            key={flowKey}
            nodes={nodes}
            edges={edges}
            fitView
            minZoom={0.05}
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeClick={handleNodeClick}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} />
            <Controls showInteractive={false}>
              {/* 画布内全屏切换：进入全屏后顶部工具栏会被画布遮挡，只能从这里退出（ESC 亦可） */}
              <ControlButton onClick={toggleFullscreen} aria-label={isFullscreen ? "退出全屏" : "进入全屏"}>
                {isFullscreen ? (
                  <Minimize2 className="size-4" aria-hidden />
                ) : (
                  <Maximize2 className="size-4" aria-hidden />
                )}
              </ControlButton>
            </Controls>
          </ReactFlow>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {typeOrder.map((type) => (
          <Badge key={type} variant="outline" style={{ borderColor: typeColor.get(type) }}>
            {ciTypeLabel(type)}
          </Badge>
        ))}
      </div>

      <Sheet open={selectedCi !== null} onOpenChange={(open) => !open && setSelectedCi(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedCi?.name}</SheetTitle>
            <SheetDescription>
              {selectedCi ? `${selectedCi.id} · ${ciTypeLabel(selectedCi.type)}` : ""}
            </SheetDescription>
          </SheetHeader>
          {selectedCi && (
            <div className="mt-4 space-y-4 overflow-y-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCenter(selectedCi.id)
                  setSelectedCi(null)
                }}
              >
                <Crosshair className="size-4" aria-hidden />
                聚焦邻居
              </Button>
              <div>
                <h3 className="mb-2 text-sm font-semibold">属性</h3>
                <div className="space-y-1.5">
                  {Object.entries(selectedCi.attributes).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="text-right font-mono text-xs break-all">
                        {formatValue(value)}
                      </span>
                    </div>
                  ))}
                  {Object.keys(selectedCi.attributes).length === 0 && (
                    <p className="text-sm text-muted-foreground">无属性。</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">标签</h3>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(selectedCi.tags).map(([key, value]) => (
                    <Badge key={key} variant="secondary">
                      {key}={value}
                    </Badge>
                  ))}
                  {Object.keys(selectedCi.tags).length === 0 && (
                    <p className="text-sm text-muted-foreground">无标签。</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
