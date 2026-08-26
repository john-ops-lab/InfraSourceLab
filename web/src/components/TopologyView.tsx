import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  ControlButton,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
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

// 钻取树形布局几何参数：父节点水平居中于子级上方，子树聚簇
// （CMDB 拓扑实践：虚拟机等子级紧贴其宿主机下方，连线短且直，避免跨层横穿造成误读）
const NODE_GAP_X = 190
const GENERATION_GAP_Y = 110
// 聚焦邻居视图（后端返回全量邻域）沿用分层网格布局，不启用钻取
const COLS = 12
const ROW_GAP_Y = 90
const LAYER_GAP_Y = 70

// 建立层级的关系：to 一侧是父节点（如 physical_server mounted_in rack）
const CHILD_TO_PARENT_TYPES = new Set(["mounted_in", "runs_on", "hosted_on", "belongs_to"])
// from 一侧是父节点（如 data_center contains rack）
const PARENT_TO_CHILD_TYPES = new Set(["contains"])
// 其余关系（depends_on/uses/has_ip）视为平级，不参与分层，仅绘制

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

interface Hierarchy {
  parents: Map<string, Set<string>>
  children: Map<string, Set<string>>
  depths: Map<string, number>
}

/**
 * 由真实关系构建层级（父在上、子在下）：Kahn 最长路径分层，
 * depth(根)=0，depth(子)=max(depth(父))+1；孤岛节点按类型顺序排在层级图下方；
 * 环上节点兜底放到已算出的最大深度之下，避免与正常节点重叠。
 */
function buildHierarchy(
  nodes: TopologyNodeLike[],
  edges: TopologyEdgeLike[],
  typeOrder: string[],
): Hierarchy {
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
    const typeDiff =
      (typeOrder.indexOf(a.type) === -1 ? typeOrder.length : typeOrder.indexOf(a.type)) -
      (typeOrder.indexOf(b.type) === -1 ? typeOrder.length : typeOrder.indexOf(b.type))
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
  return { parents, children, depths: depth }
}

/**
 * 按真实关系计算每个节点的层级（父在上、子在下）。
 * 导出仅供单元测试使用。
 */
export function computeDepths(
  nodes: TopologyNodeLike[],
  edges: TopologyEdgeLike[],
  typeOrder: string[],
): Map<string, number> {
  return buildHierarchy(nodes, edges, typeOrder).depths
}

export interface DrilldownLayout {
  visibleIds: Set<string>
  positions: Map<string, { x: number; y: number }>
  /** 每个可见节点尚未展开的隐藏子级数量（用于 +N 徽标） */
  hiddenChildCounts: Map<string, number>
}

/**
 * 钻取式布局（CMDB 拓扑实践：默认只显示顶层根节点，点击节点逐层展开）：
 * - 可见性：根节点（无父节点，含孤岛）默认可见；父节点可见且已展开时其子级可见。
 *   收起某个父节点后，仅通过它可见的后代随之隐藏（多父共享子除外）。
 * - 布局：紧凑树形（tidy tree）——父节点水平居中于其子级上方，子树聚簇，
 *   宿主机与其虚拟机紧邻，连线短且直，不会横向穿越同层节点。
 * - 多父共享子：归属最早展开且可见的父节点，其余父节点画跨区块连线。
 * 导出仅供单元测试使用。
 */
export function computeDrilldownLayout(
  nodes: TopologyNodeLike[],
  edges: TopologyEdgeLike[],
  typeOrder: string[],
  expandedIds: string[],
): DrilldownLayout {
  const { parents, children } = buildHierarchy(nodes, edges, typeOrder)
  const expanded = new Set(expandedIds)

  // 可见性传播：从根出发，父可见且已展开则暴露子级
  const visible = new Set<string>()
  const stack: string[] = []
  for (const node of nodes) {
    if (!parents.has(node.id)) {
      visible.add(node.id)
      stack.push(node.id)
    }
  }
  while (stack.length > 0) {
    const current = stack.pop()!
    if (!expanded.has(current)) continue
    for (const child of children.get(current) ?? []) {
      if (!visible.has(child)) {
        visible.add(child)
        stack.push(child)
      }
    }
  }

  // 布局父归属：多父共享子时，归属 expandedIds 中最早展开且可见的父
  const layoutParent = new Map<string, string>()
  for (const node of nodes) {
    if (!visible.has(node.id) || !parents.has(node.id)) continue
    for (const parentId of expandedIds) {
      if (visible.has(parentId) && parents.get(node.id)!.has(parentId)) {
        layoutParent.set(node.id, parentId)
        break
      }
    }
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const typeIndex = new Map(typeOrder.map((type, index) => [type, index]))
  const byOrder = (a: string, b: string) => {
    const na = nodeById.get(a)!
    const nb = nodeById.get(b)!
    const diff = (typeIndex.get(na.type) ?? 0) - (typeIndex.get(nb.type) ?? 0)
    return diff !== 0 ? diff : a.localeCompare(b)
  }

  const layoutChildren = new Map<string, string[]>()
  const roots: string[] = []
  for (const node of nodes) {
    if (!visible.has(node.id)) continue
    const parent = layoutParent.get(node.id)
    if (parent) {
      const list = layoutChildren.get(parent) ?? []
      list.push(node.id)
      layoutChildren.set(parent, list)
    } else {
      roots.push(node.id)
    }
  }
  for (const list of layoutChildren.values()) list.sort(byOrder)
  roots.sort(byOrder)

  const positions = new Map<string, { x: number; y: number }>()
  const assign = (id: string, left: number, generation: number): number => {
    const kids = layoutChildren.get(id) ?? []
    if (kids.length === 0) {
      positions.set(id, { x: left + NODE_GAP_X / 2, y: generation * GENERATION_GAP_Y })
      return 1
    }
    let width = 0
    for (const kid of kids) {
      width += assign(kid, left + width * NODE_GAP_X, generation + 1)
    }
    const first = positions.get(kids[0])!
    const last = positions.get(kids[kids.length - 1])!
    positions.set(id, { x: (first.x + last.x) / 2, y: generation * GENERATION_GAP_Y })
    return width
  }
  let cursorX = 0
  for (const root of roots) {
    const width = assign(root, cursorX, 0)
    cursorX += (width + 1) * NODE_GAP_X
  }

  const hiddenChildCounts = new Map<string, number>()
  for (const id of visible) {
    let hidden = 0
    for (const child of children.get(id) ?? []) {
      if (!visible.has(child)) hidden += 1
    }
    if (hidden > 0) hiddenChildCounts.set(id, hidden)
  }
  return { visibleIds: visible, positions, hiddenChildCounts }
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

type ExpandableNodeData = {
  id: string
  label: string
  color: string
  hiddenChildCount: number
  expanded: boolean
  /** 聚焦邻居视图传入 null：不显示展开/收起按钮 */
  onToggle: ((id: string) => void) | null
} & Record<string, unknown>

type ExpandableNode = Node<ExpandableNodeData, "expandable">

// 隐式锚点统一样式：不可见、不占空间，仅供边定位端点
const HIDDEN_HANDLE_STYLE = { opacity: 0, width: 0, height: 0, border: "none" } as const

function ExpandableNodeCard({ data }: NodeProps<ExpandableNode>) {
  const showToggle = data.onToggle !== null && (data.expanded || data.hiddenChildCount > 0)
  return (
    <div
      className="relative w-40 rounded-md border-2 bg-background px-3 py-1.5 text-center text-xs font-medium"
      style={{ borderColor: data.color }}
    >
      {/*
        隐式锚点：ReactFlow v12 自定义节点必须渲染 Handle，否则边不绘制。
        每个方向同时提供 source/target 锚点，边生成时按两端节点的布局位置
        就近接入（上节点从底部出线、下节点从顶部入线），
        避免 runs_on/mounted_in/hosted_on 等子→父方向的边被迫从子节点底部
        探出绕到父节点顶部，产生无用的探线与突兀箭头。
      */}
      <Handle type="target" position={Position.Top} id="in-top" isConnectable={false} style={HIDDEN_HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="out-bottom" isConnectable={false} style={HIDDEN_HANDLE_STYLE} />
      <Handle type="source" position={Position.Top} id="out-top" isConnectable={false} style={HIDDEN_HANDLE_STYLE} />
      <Handle type="target" position={Position.Bottom} id="in-bottom" isConnectable={false} style={HIDDEN_HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} id="out-right" isConnectable={false} style={HIDDEN_HANDLE_STYLE} />
      <Handle type="target" position={Position.Left} id="in-left" isConnectable={false} style={HIDDEN_HANDLE_STYLE} />
      <Handle type="source" position={Position.Left} id="out-left" isConnectable={false} style={HIDDEN_HANDLE_STYLE} />
      <Handle type="target" position={Position.Right} id="in-right" isConnectable={false} style={HIDDEN_HANDLE_STYLE} />
      <span className="block truncate">{data.label}</span>
      {showToggle && (
        <button
          type="button"
          className="absolute -right-2.5 -bottom-2.5 flex h-5 min-w-5 items-center justify-center rounded-full border bg-background px-1 text-[10px] leading-none font-semibold text-muted-foreground shadow-sm hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation()
            data.onToggle?.(data.id)
          }}
          aria-label={data.expanded ? `收起 ${data.label} 的子级` : `展开 ${data.label} 的 ${data.hiddenChildCount} 个子级`}
        >
          {data.expanded ? "−" : `+${data.hiddenChildCount}`}
        </button>
      )}
    </div>
  )
}

const nodeTypes = { expandable: ExpandableNodeCard }

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
  // 已展开节点（有序：多父共享子时归属最早展开的父）
  const [expandedIds, setExpandedIds] = useState<string[]>([])

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

  // 切换数据集或筛选条件时，钻取展开状态不再适用，重置为顶层
  useEffect(() => {
    setExpandedIds([])
  }, [datasetId, ciType, relationType, appliedQuery])

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

  // 展开按钮回调：切换节点的展开/收起
  const toggleNode = useCallback((id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }, [])

  const { nodes, edges, visibleCount, totalCount } = useMemo(() => {
    if (!data) {
      return { nodes: [] as Node[], edges: [] as Edge[], visibleCount: 0, totalCount: 0 }
    }
    const toNode = (
      node: TopologyNodeLike,
      position: { x: number; y: number },
      dataProps: ExpandableNodeData,
    ): Node => ({
      id: node.id,
      position,
      type: "expandable",
      data: dataProps,
    })

    let flowNodes: Node[]
    let positionMap: Map<string, { x: number; y: number }>
    if (center !== null) {
      // 聚焦邻居：后端返回全量邻域，分层网格布局，不启用钻取
      const depths = buildHierarchy(data.nodes, data.edges, typeOrder).depths
      const byDepth = new Map<number, TopologyNodeLike[]>()
      let maxDepth = 0
      for (const node of data.nodes) {
        const depth = depths.get(node.id) ?? 0
        maxDepth = Math.max(maxDepth, depth)
        const list = byDepth.get(depth) ?? []
        list.push(node)
        byDepth.set(depth, list)
      }
      const positions = new Map<string, { x: number; y: number }>()
      let layerY = 0
      for (let depth = 0; depth <= maxDepth; depth++) {
        const layer = (byDepth.get(depth) ?? []).slice().sort((a, b) => a.id.localeCompare(b.id))
        if (layer.length === 0) continue
        layer.forEach((node, index) => {
          positions.set(node.id, {
            x: (index % COLS) * NODE_GAP_X,
            y: layerY + Math.floor(index / COLS) * ROW_GAP_Y,
          })
        })
        layerY += Math.ceil(layer.length / COLS) * ROW_GAP_Y + LAYER_GAP_Y
      }
      flowNodes = data.nodes.map((node) =>
        toNode(node, positions.get(node.id) ?? { x: 0, y: 0 }, {
          id: node.id,
          label: node.name,
          color: typeColor.get(node.type) ?? "#64748b",
          hiddenChildCount: 0,
          expanded: false,
          onToggle: null,
        }),
      )
      positionMap = positions
    } else {
      // 全量视图：钻取树形布局，默认仅顶层，点击节点逐层展开
      const layout = computeDrilldownLayout(data.nodes, data.edges, typeOrder, expandedIds)
      positionMap = layout.positions
      const expandedSet = new Set(expandedIds)
      flowNodes = data.nodes
        .filter((node) => layout.visibleIds.has(node.id))
        .map((node) =>
          toNode(node, layout.positions.get(node.id) ?? { x: 0, y: 0 }, {
            id: node.id,
            label: node.name,
            color: typeColor.get(node.type) ?? "#64748b",
            hiddenChildCount: layout.hiddenChildCounts.get(node.id) ?? 0,
            expanded: expandedSet.has(node.id),
            onToggle: toggleNode,
          }),
        )
    }

    const nodeIds = new Set(flowNodes.map((node) => node.id))
    // 锚点按两端节点的布局位置就近选择：上节点从底部出线、下节点从顶部入线，
    // 同层平级用左右；箭头统一指向下方（或右侧）节点，连线始终是短正交折线
    const anchorsFor = (
      fromPos: { x: number; y: number } | undefined,
      toPos: { x: number; y: number } | undefined,
    ) => {
      if (fromPos && toPos) {
        if (fromPos.y > toPos.y) return { sourceHandle: "out-top", targetHandle: "in-bottom" }
        if (fromPos.y === toPos.y && fromPos.x !== toPos.x) {
          return fromPos.x < toPos.x
            ? { sourceHandle: "out-right", targetHandle: "in-left" }
            : { sourceHandle: "out-left", targetHandle: "in-right" }
        }
      }
      return { sourceHandle: "out-bottom", targetHandle: "in-top" }
    }
    const flowEdges: Edge[] = data.edges
      .filter((edge) => nodeIds.has(edge.from_id) && nodeIds.has(edge.to_id))
      .map((edge) => {
        const { sourceHandle, targetHandle } = anchorsFor(
          positionMap.get(edge.from_id),
          positionMap.get(edge.to_id),
        )
        return {
          id: edge.id,
          source: edge.from_id,
          target: edge.to_id,
          sourceHandle,
          targetHandle,
          // 正交折线（圆角）避免贝塞尔弧线穿越同层节点造成“同层互联”的误读
          type: "smoothstep",
          pathOptions: { borderRadius: 10 },
          label: edge.type,
          labelStyle: { fontSize: 10, fill: "#64748b" },
          labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 4,
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
        }
      })
    return {
      nodes: flowNodes,
      edges: flowEdges,
      visibleCount: flowNodes.length,
      totalCount: data.nodes.length,
    }
  }, [data, typeOrder, typeColor, center, expandedIds, toggleNode])

  const handleNodeClick: NodeMouseHandler = async (_event, node) => {
    try {
      const ci = await api.getCi(datasetId, node.id)
      setSelectedCi(ci)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "加载 CI 详情失败。")
    }
  }

  // 数据或钻取状态变化时重新挂载以重新适配视图
  const flowKey = `${ciType}|${relationType}|${appliedQuery}|${center ?? ""}|${expandedIds.join(",")}`

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
        {center === null && expandedIds.length > 0 && (
          <Button type="button" variant="ghost" onClick={() => setExpandedIds([])}>
            <Minimize2 className="size-4" aria-hidden />
            收起全部
          </Button>
        )}
      </form>

      {data?.truncated && (
        <p className="text-sm text-muted-foreground" role="status">
          节点过多，当前仅显示前 {data.node_limit} 个（共 {data.total_nodes}{" "}
          个）。可通过类型或文字筛选缩小范围，或点击节点聚焦其邻居。
        </p>
      )}
      {center === null && visibleCount < totalCount && (
        <p className="text-sm text-muted-foreground" role="status">
          请点击节点上的 + 逐层展开查看（当前显示 {visibleCount} / {totalCount} 个节点，
          点击节点主体可查看详情）。
        </p>
      )}
      {center === null && visibleCount === totalCount && expandedIds.length > 0 && (
        <p className="text-sm text-muted-foreground" role="status">
          已展开全部 {totalCount} 个节点，点击节点主体可查看详情。
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
            nodeTypes={nodeTypes}
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
