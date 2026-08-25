import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Database, Search, TriangleAlert, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/Pagination"
import { api, ApiError } from "@/lib/api"
import type { Paged } from "@/lib/spec"
import type { DatasetListItem } from "@/lib/api"

const PAGE_SIZE = 20

export default function DatasetsPage() {
  const [query, setQuery] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<DatasetListItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DatasetListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async (q: string, nextPage: number) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.listDatasets({ q, page: nextPage, page_size: PAGE_SIZE })
      setData(result)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "加载数据集列表失败。")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(appliedQuery, page)
  }, [load, appliedQuery, page])

  const handleSearch = () => {
    setPage(1)
    setAppliedQuery(query.trim())
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteDataset(deleteTarget.id)
      toast.success(`数据集「${deleteTarget.name}」已删除`)
      setDeleteTarget(null)
      load(appliedQuery, page)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "删除失败。")
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const items = data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">数据集列表</h1>
        <p className="text-sm text-muted-foreground">查看、搜索并管理已生成的测试数据集。</p>
      </div>

      <form
        className="flex max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          handleSearch()
        }}
      >
        <div className="relative flex-1">
          <Search
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="按名称或描述搜索"
            aria-label="搜索数据集"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="outline">
          搜索
        </Button>
      </form>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" aria-hidden />
          <AlertTitle>出错了</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Database aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{appliedQuery ? "没有匹配的数据集" : "还没有数据集"}</EmptyTitle>
            <EmptyDescription>
              {appliedQuery
                ? "换个关键词试试，或清空搜索条件查看全部。"
                : "前往「创建数据集」页面，用提示词或模板生成第一个数据集。"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead className="hidden md:table-cell">描述</TableHead>
                  <TableHead className="text-right">CI 数</TableHead>
                  <TableHead className="text-right">关系数</TableHead>
                  <TableHead className="hidden sm:table-cell">创建时间</TableHead>
                  <TableHead className="w-20 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="tabular-nums">{item.id}</TableCell>
                    <TableCell>
                      <Link
                        to={`/datasets/${item.id}`}
                        className="font-medium hover:underline"
                      >
                        {item.name}
                      </Link>
                      {item.warnings.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          <TriangleAlert className="size-3" aria-hidden />
                          {item.warnings.length} 条提醒
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-xs truncate text-muted-foreground md:table-cell">
                      {item.description}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.record_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.relation_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {item.created_at?.replace("T", " ").slice(0, 19) ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(item)}
                        aria-label={`删除数据集 ${item.name}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={data?.page ?? 1}
            pageSize={data?.page_size ?? PAGE_SIZE}
            total={data?.total ?? 0}
            onChange={setPage}
          />
        </>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除数据集？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除「{deleteTarget?.name}」及其全部
              {" "}
              {deleteTarget?.record_count.toLocaleString()} 条 CI 与
              {" "}
              {deleteTarget?.relation_count.toLocaleString()} 条关系，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
