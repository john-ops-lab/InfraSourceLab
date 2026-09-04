import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  CopyPlus,
  Download,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  LoaderCircle,
  Search,
  TriangleAlert,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CodeCopy } from "@/components/CodeCopy"
import { Pagination } from "@/components/Pagination"
import { TopologyView } from "@/components/TopologyView"
import { api, ApiError, type DatasetDetail } from "@/lib/api"
import { useRelationTypes } from "@/hooks/useRelationTypes"
import { downloadJsonFile } from "@/lib/spec-file"
import {
  DEFECT_KIND_LABELS,
  ciFieldLabel,
  ciTypeLabel,
  formatRelation,
  relationTypeLabel,
  type CIRecord,
  type DatasetSummary,
  type Paged,
  type RelationRecord,
} from "@/lib/spec"

const PAGE_SIZE = 20

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export default function DatasetDetailPage() {
  const { id } = useParams()
  const datasetId = Number(id)
  const navigate = useNavigate()

  const [detail, setDetail] = useState<DatasetDetail | null>(null)
  const [summary, setSummary] = useState<DatasetSummary | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [ciType, setCiType] = useState("all")
  const [ciQuery, setCiQuery] = useState("")
  const [ciAppliedQuery, setCiAppliedQuery] = useState("")
  const [ciPage, setCiPage] = useState(1)
  const [cis, setCis] = useState<Paged<CIRecord> | null>(null)
  const [ciLoading, setCiLoading] = useState(false)

  const [relationType, setRelationType] = useState("all")
  const [relationPage, setRelationPage] = useState(1)
  const [relations, setRelations] = useState<Paged<RelationRecord> | null>(null)
  const [relationLoading, setRelationLoading] = useState(false)

  const [selectedCi, setSelectedCi] = useState<CIRecord | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  // 关系类型注册表：关系列表/筛选/规格展示的中英文对照动态化
  const { registry } = useRelationTypes()

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getDataset(datasetId), api.summary(datasetId)])
      .then(([detailResult, summaryResult]) => {
        if (cancelled) return
        setDetail(detailResult)
        setSummary(summaryResult)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.detail : "加载数据集失败。")
      })
    return () => {
      cancelled = true
    }
  }, [datasetId])

  const loadCis = useCallback(async () => {
    setCiLoading(true)
    try {
      const result = await api.listCis(datasetId, {
        type: ciType === "all" ? undefined : ciType,
        q: ciAppliedQuery || undefined,
        page: ciPage,
        page_size: PAGE_SIZE,
      })
      setCis(result)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "加载 CI 列表失败。")
    } finally {
      setCiLoading(false)
    }
  }, [datasetId, ciType, ciAppliedQuery, ciPage])

  useEffect(() => {
    if (!loadError) loadCis()
  }, [loadCis, loadError])

  const loadRelations = useCallback(async () => {
    setRelationLoading(true)
    try {
      const result = await api.listRelations(datasetId, {
        type: relationType === "all" ? undefined : relationType,
        page: relationPage,
        page_size: PAGE_SIZE,
      })
      setRelations(result)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "加载关系列表失败。")
    } finally {
      setRelationLoading(false)
    }
  }, [datasetId, relationType, relationPage])

  useEffect(() => {
    if (!loadError) loadRelations()
  }, [loadRelations, loadError])

  const handleExport = async (format: "json" | "csv" | "xlsx") => {
    setExporting(format)
    try {
      await api.downloadExport(datasetId, format)
      toast.success("导出已开始下载")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "导出失败。")
    } finally {
      setExporting(null)
    }
  }

  const handleDelete = async () => {
    if (!detail) return
    try {
      await api.deleteDataset(datasetId)
      toast.success(`数据集「${detail.name}」已删除`)
      navigate("/datasets")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "删除失败。")
    }
  }

  const handleReuseSpec = () => {
    if (!detail) return
    navigate("/create", {
      state: {
        spec: structuredClone(detail.spec),
        sourceDatasetName: detail.name,
      },
    })
  }

  const handleDownloadSpec = () => {
    if (!detail) return
    downloadJsonFile(`dataset-${detail.id}-spec.json`, detail.spec)
  }

  const handleDownloadQualityReport = () => {
    if (!detail) return
    downloadJsonFile(`dataset-${detail.id}-quality-report.json`, {
      dataset_id: detail.id,
      dataset_name: detail.name,
      generator_version: detail.generator_version,
      quality_report: detail.quality_report,
    })
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="size-4" aria-hidden />
        <AlertTitle>无法加载数据集</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    )
  }

  if (!detail) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const baseUrl = window.location.origin
  const relationTypes = detail.spec.relations.map((entry) => entry.type)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {detail.name}
            <Badge variant="secondary">#{detail.id}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {detail.record_count.toLocaleString()} 条 CI ·{" "}
            {detail.relation_count.toLocaleString()} 条关系 · seed {detail.seed} · 生成器{" "}
            {detail.generator_version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadSpec}>
            <Download data-icon="inline-start" aria-hidden />
            下载规格
          </Button>
          <Button size="sm" onClick={handleReuseSpec}>
            <CopyPlus data-icon="inline-start" aria-hidden />
            基于此规格新建
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="border-destructive/40 bg-background hover:bg-destructive/10"
            onClick={handleDelete}
          >
            删除数据集
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="cis">CI 数据</TabsTrigger>
          <TabsTrigger value="relations">关系</TabsTrigger>
          <TabsTrigger value="topology">拓扑</TabsTrigger>
          <TabsTrigger value="export">API 与导出</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}
          {detail.warnings.length > 0 && (
            <Alert>
              <TriangleAlert className="size-4" aria-hidden />
              <AlertTitle>生成提醒</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-4">
                  {detail.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {detail.quality_report.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>质量缺陷明细</CardTitle>
                <CardDescription>
                  精确记录缺陷类型、字段和受影响 CI。页面预览前 12 条，下载文件包含全部记录。
                </CardDescription>
                <CardAction>
                  <Button variant="outline" size="sm" onClick={handleDownloadQualityReport}>
                    <Download data-icon="inline-start" aria-hidden />
                    下载完整质量报告
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {detail.quality_report.map((report, index) => (
                  <div
                    key={`${report.kind}-${report.ci_type}-${report.field ?? "record"}-${index}`}
                    className="flex flex-col gap-2 rounded-lg border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{DEFECT_KIND_LABELS[report.kind]}</Badge>
                      <span className="text-sm font-medium">
                        {ciTypeLabel(report.ci_type)}
                        {report.field ? ` · ${ciFieldLabel(report.field)}` : ""}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        实际 {report.affected_count} / 请求 {report.requested_count} 条
                      </span>
                    </div>
                    {report.applied_value !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        写入错误值：<code>{formatValue(report.applied_value)}</code>
                      </p>
                    )}
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {report.affected_ids.length > 0
                        ? report.affected_ids.slice(0, 12).join("、")
                        : "未实际命中记录"}
                      {report.affected_ids.length > 12
                        ? ` ……另有 ${report.affected_ids.length - 12} 条，请下载完整报告查看`
                        : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>CI 类型分布</CardTitle>
                <CardDescription>按类型统计的 CI 数量</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(summary?.ci_counts_by_type ?? {}).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <span>{ciTypeLabel(type)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>关系规格</CardTitle>
                <CardDescription>本次数据集定义的关系</CardDescription>
              </CardHeader>
              <CardContent>
                {detail.spec.relations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">未定义关系。</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.spec.relations.map((entry, index) => (
                      <li key={index} className="text-sm">
                        {formatRelation(entry, registry)}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
          {detail.prompt && (
            <Card>
              <CardHeader>
                <CardTitle>创建提示词</CardTitle>
                <CardDescription>创建该数据集时使用的原始需求描述</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                  {detail.prompt}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cis" className="space-y-4 pt-4">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              setCiPage(1)
              setCiAppliedQuery(ciQuery.trim())
            }}
          >
            <Select
              value={ciType}
              onValueChange={(value) => {
                setCiType(value)
                setCiPage(1)
              }}
            >
              <SelectTrigger className="w-48" aria-label="按类型筛选">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {detail.spec.ci_types.map((entry) => (
                  <SelectItem key={entry.type} value={entry.type}>
                    {ciTypeLabel(entry.type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative min-w-52 flex-1">
              <Search
                className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={ciQuery}
                onChange={(event) => setCiQuery(event.target.value)}
                placeholder="搜索名称、主机名、IP、序列号、编码"
                aria-label="搜索 CI"
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="outline">
              搜索
            </Button>
          </form>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">ID</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead className="hidden md:table-cell">属性摘要</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ciLoading ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ) : cis && cis.items.length > 0 ? (
                  cis.items.map((ci) => (
                    <TableRow
                      key={ci.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedCi(ci)}
                    >
                      <TableCell className="font-mono text-xs">{ci.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ciTypeLabel(ci.type)}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{ci.name}</TableCell>
                      <TableCell className="hidden max-w-xs truncate text-muted-foreground md:table-cell">
                        {Object.entries(ci.attributes)
                          .slice(0, 3)
                          .map(([key, value]) => `${ciFieldLabel(key)}=${formatValue(value)}`)
                          .join(" · ")}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      没有匹配的 CI。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={cis?.page ?? 1}
            pageSize={cis?.page_size ?? PAGE_SIZE}
            total={cis?.total ?? 0}
            onChange={setCiPage}
          />
        </TabsContent>

        <TabsContent value="relations" className="space-y-4 pt-4">
          <Select
            value={relationType}
            onValueChange={(value) => {
              setRelationType(value)
              setRelationPage(1)
            }}
          >
            <SelectTrigger className="w-56" aria-label="按关系类型筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部关系</SelectItem>
              {[...new Set(relationTypes)].map((type) => (
                <SelectItem key={type} value={type}>
                  {relationTypeLabel(type, "both", registry)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">ID</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>起点</TableHead>
                  <TableHead>终点</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relationLoading ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ) : relations && relations.items.length > 0 ? (
                  relations.items.map((relation) => (
                    <TableRow key={relation.id}>
                      <TableCell className="font-mono text-xs">{relation.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{relationTypeLabel(relation.type, "both", registry)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{relation.from_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {ciTypeLabel(relation.from_type)} · {relation.from_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{relation.to_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {ciTypeLabel(relation.to_type)} · {relation.to_id}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      没有匹配的关系。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={relations?.page ?? 1}
            pageSize={relations?.page_size ?? PAGE_SIZE}
            total={relations?.total ?? 0}
            onChange={setRelationPage}
          />
        </TabsContent>

        <TabsContent value="topology" className="space-y-4 pt-4">
          <TopologyView
            datasetId={datasetId}
            ciTypes={detail.spec.ci_types}
            relationTypes={[...new Set(relationTypes)]}
          />
        </TabsContent>

        <TabsContent value="export" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>通过 API 访问</CardTitle>
              <CardDescription>
                所有接口需要 Bearer Token。将 $ISL_API_KEY 替换为你的密钥，或将请求交给集成系统。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CodeCopy
                label="分页查询 CI"
                code={`curl -s -H "Authorization: Bearer $ISL_API_KEY" \\\n  "${baseUrl}/api/v1/datasets/${datasetId}/cis?page=1&page_size=20"`}
              />
              <CodeCopy
                label="按类型与关键词查询 CI"
                code={`curl -s -H "Authorization: Bearer $ISL_API_KEY" \\\n  "${baseUrl}/api/v1/datasets/${datasetId}/cis?type=virtual_machine&q=prod"`}
              />
              <CodeCopy
                label="查询关系"
                code={`curl -s -H "Authorization: Bearer $ISL_API_KEY" \\\n  "${baseUrl}/api/v1/datasets/${datasetId}/relations?page=1&page_size=20"`}
              />
              <CodeCopy
                label="获取数据集摘要"
                code={`curl -s -H "Authorization: Bearer $ISL_API_KEY" \\\n  "${baseUrl}/api/v1/datasets/${datasetId}/summary"`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>导出文件</CardTitle>
              <CardDescription>
                JSON 为单文件；CSV 为 ZIP 压缩包（含 summary 与按类型分表）；XLSX 含公式注入防护。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={exporting !== null} onClick={() => handleExport("json")}>
                {exporting === "json" ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <FileJson className="size-4" aria-hidden />
                )}
                下载 JSON
              </Button>
              <Button variant="outline" disabled={exporting !== null} onClick={() => handleExport("csv")}>
                {exporting === "csv" ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <FileArchive className="size-4" aria-hidden />
                )}
                下载 CSV（ZIP）
              </Button>
              <Button variant="outline" disabled={exporting !== null} onClick={() => handleExport("xlsx")}>
                {exporting === "xlsx" ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <FileSpreadsheet className="size-4" aria-hidden />
                )}
                下载 XLSX
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
              <div>
                <h3 className="mb-2 text-sm font-semibold">属性</h3>
                <div className="space-y-1.5">
                  {Object.entries(selectedCi.attributes).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{ciFieldLabel(key)}</span>
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
                      {ciFieldLabel(key)}={value}
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
