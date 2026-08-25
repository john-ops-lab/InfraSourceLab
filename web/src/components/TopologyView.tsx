import { useEffect, useMemo, useState } from "react"
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Crosshair, Search, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

  const [data, setData] = useState<TopologyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCi, setSelectedCi] = useState<CIRecord | null>(null)

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

  // 确定性分层网格布局：y 由类型层序与层内行号决定，x 由列号决定（层内换行避免过宽）
  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [] as Node[], edges: [] as Edge[] }
    const byType = new Map<string, { id: string; name: string; type: string }[]>()
    for (const node of data.nodes) {
      const list = byType.get(node.type) ?? []
      list.push(node)
      byType.set(node.type, list)
    }
    const positions = new Map<string, { x: number; y: number }>()
    let layerY = 0
    for (const type of typeOrder) {
      const layer = byType.get(type) ?? []
      if (layer.length === 0) continue
      layer.forEach((node, index) => {
        positions.set(node.id, {
          x: (index % COLS) * NODE_GAP_X,
          y: layerY + Math.floor(index / COLS) * ROW_GAP_Y,
        })
      })
      layerY += Math.ceil(layer.length / COLS) * ROW_GAP_Y + LAYER_GAP_Y
    }
    const flowNodes: Node[] = data.nodes.map((node) => {
      const color = typeColor.get(node.type) ?? "#64748b"
      return {
        id: node.id,
        position: positions.get(node.id) ?? { x: 0, y: 0 },
        data: { label: node.name },
        style: { borderColor: color, borderWidth: 2, fontSize: 12 },
      }
    })
    const nodeIds = new Set(data.nodes.map((node) => node.id))
    const flowEdges: Edge[] = data.edges
      .filter((edge) => nodeIds.has(edge.from_id) && nodeIds.has(edge.to_id))
      .map((edge) => ({
        id: edge.id,
        source: edge.from_id,
        target: edge.to_id,
        label: edge.type,
        labelStyle: { fontSize: 10 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      }))
    return { nodes: flowNodes, edges: flowEdges }
  }, [data, typeOrder, typeColor])

  const handleNodeClick: NodeMouseHandler = async (_event, node) => {
    try {
      const ci = await api.getCi(datasetId, node.id)
      setSelectedCi(ci)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "加载 CI 详情失败。")
    }
  }

  // 数据变化时重新挂载以重新适配视图
  const flowKey = `${ciType}|${relationType}|${appliedQuery}|${center ?? ""}`

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
        {center && (
          <Button type="button" variant="ghost" onClick={() => setCenter(null)}>
            <Undo2 className="size-4" aria-hidden />
            返回全量视图
          </Button>
        )}
      </form>

      {data?.truncated && (
        <p className="text-sm text-muted-foreground" role="status">
          节点过多，当前仅显示前 {data.node_limit} 个（共 {data.total_nodes}{" "}
          个）。可通过类型或文字筛选缩小范围，或点击节点聚焦其邻居。
        </p>
      )}
      {center && (
        <p className="text-sm text-muted-foreground" role="status">
          正在聚焦节点 <span className="font-mono">{center}</span> 及其邻居。
        </p>
      )}

      <div className="h-[480px] rounded-lg border bg-background">
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
            <Controls showInteractive={false} />
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
