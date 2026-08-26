import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { LoaderCircle, Network, Pencil, Plus, Save, Trash2, X } from "lucide-react"
import { toast } from "sonner"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ApiError, api, extractDetail, hasSession, type RelationTypeInfo } from "@/lib/api"
import { invalidateRelationTypes } from "@/hooks/useRelationTypes"

// 与后端 relation_types API 的类型标识规则一致
const TYPE_PATTERN = /^[a-z][a-z0-9_]{1,39}$/

const DIRECTION_LABELS: Record<RelationTypeInfo["direction"], string> = {
  child_to_parent: "层级（子→父）",
  peer: "平级",
}

const DIRECTION_OPTIONS: RelationTypeInfo["direction"][] = ["child_to_parent", "peer"]

function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}

function DirectionSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: RelationTypeInfo["direction"]
  onChange: (value: RelationTypeInfo["direction"]) => void
  ariaLabel: string
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as RelationTypeInfo["direction"])}>
      <SelectTrigger className="w-36" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DIRECTION_OPTIONS.map((option) => (
          <SelectItem key={option} value={option}>
            {DIRECTION_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * 关系类型管理面板：修改默认关系的中英文名称与方向，新增/删除关系类型。
 * 列表对登录会话（含 API Key）可见；增删改需要管理员登录会话。
 * 变更后同步失效共享注册表缓存，拓扑/编辑器/AI 提示词随之生效。
 */
export function RelationTypesPanel() {
  const [rows, setRows] = useState<RelationTypeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [newType, setNewType] = useState("")
  const [newNameZh, setNewNameZh] = useState("")
  const [newNameEn, setNewNameEn] = useState("")
  const [newDirection, setNewDirection] = useState<RelationTypeInfo["direction"]>("peer")
  const [savingNew, setSavingNew] = useState(false)

  const [editType, setEditType] = useState<string | null>(null)
  const [editNameZh, setEditNameZh] = useState("")
  const [editNameEn, setEditNameEn] = useState("")
  const [editDirection, setEditDirection] = useState<RelationTypeInfo["direction"]>("peer")
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<RelationTypeInfo | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    api
      .getRelationTypes()
      .then((result) => {
        setRows(result)
        setForbidden(false)
      })
      .catch((error) => {
        if (isAuthError(error)) {
          setForbidden(true)
        } else {
          toast.error("读取关系类型失败", { description: extractDetail(error, "无法连接服务端") })
        }
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const startEdit = (row: RelationTypeInfo) => {
    setEditType(row.type)
    setEditNameZh(row.name_zh)
    setEditNameEn(row.name_en)
    setEditDirection(row.direction)
  }

  const handleUpdate = async () => {
    if (editType === null) return
    if (!editNameZh.trim()) {
      toast.error("中文名称不能为空")
      return
    }
    setSavingEdit(true)
    try {
      const updated = await api.updateRelationType(editType, {
        name_zh: editNameZh.trim(),
        name_en: editNameEn.trim() || editType,
        direction: editDirection,
      })
      setRows((prev) => prev.map((row) => (row.type === editType ? updated : row)))
      setEditType(null)
      invalidateRelationTypes()
      toast.success(`关系 ${editType} 已更新`, {
        description: "中英文对照与 AI 提示词同步生效。",
      })
    } catch (error) {
      if (isAuthError(error)) {
        toast.error("修改关系类型需要管理员登录", { description: "API Key 不具备管理权限。" })
      } else {
        toast.error("更新失败", { description: extractDetail(error, "请求失败") })
      }
    } finally {
      setSavingEdit(false)
    }
  }

  const handleCreate = async () => {
    const type = newType.trim()
    if (!TYPE_PATTERN.test(type)) {
      toast.error("类型标识格式不正确", {
        description: "小写字母开头，仅含小写字母/数字/下划线，2~40 位。",
      })
      return
    }
    if (!newNameZh.trim()) {
      toast.error("中文名称不能为空")
      return
    }
    setSavingNew(true)
    try {
      await api.createRelationType({
        type,
        name_zh: newNameZh.trim(),
        name_en: newNameEn.trim() || type,
        direction: newDirection,
      })
      toast.success(`关系 ${type} 已添加`, {
        description: "规格编辑器与 AI 提示词立即接受该类型。",
      })
      setNewType("")
      setNewNameZh("")
      setNewNameEn("")
      setNewDirection("peer")
      setShowCreate(false)
      invalidateRelationTypes()
      load()
    } catch (error) {
      if (isAuthError(error)) {
        toast.error("新增关系类型需要管理员登录", { description: "API Key 不具备管理权限。" })
      } else {
        toast.error("新增失败", { description: extractDetail(error, "请求失败") })
      }
    } finally {
      setSavingNew(false)
    }
  }

  const handleDelete = async () => {
    if (deleteTarget === null) return
    setDeleting(true)
    try {
      await api.deleteRelationType(deleteTarget.type)
      setRows((prev) => prev.filter((row) => row.type !== deleteTarget.type))
      setDeleteTarget(null)
      invalidateRelationTypes()
      toast.success(`关系 ${deleteTarget.type} 已删除`)
    } catch (error) {
      if (isAuthError(error)) {
        toast.error("删除关系类型需要管理员登录", { description: "API Key 不具备管理权限。" })
      } else {
        // 被数据集规格引用时后端返回 409，detail 说明引用数
        toast.error("删除失败", { description: extractDetail(error, "请求失败") })
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="size-5" aria-hidden />
          关系类型管理
        </CardTitle>
        <CardDescription>
          维护 CMDB 关系类型的中英文名称与方向：层级（子→父）参与拓扑分层，平级仅绘制连线。
          修改保存到数据库，规格校验、AI 提示词与界面对照立即生效。
          {!hasSession() && " 增删改需要管理员登录（API Key 不具备管理权限）。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">正在读取关系类型…</p>
        ) : forbidden ? (
          <p className="text-sm text-muted-foreground">
            读取关系类型需要
            <Link to="/login" className="mx-1 text-primary underline-offset-4 hover:underline">
              登录
            </Link>
            （管理员会话或已保存的 API Key 均可）。
          </p>
        ) : (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>类型标识</TableHead>
                    <TableHead>中文名称</TableHead>
                    <TableHead>英文名称</TableHead>
                    <TableHead>方向</TableHead>
                    <TableHead className="hidden sm:table-cell">来源</TableHead>
                    <TableHead className="w-24 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) =>
                    editType === row.type ? (
                      <TableRow key={row.type}>
                        <TableCell className="font-mono text-xs">{row.type}</TableCell>
                        <TableCell>
                          <Input
                            value={editNameZh}
                            onChange={(event) => setEditNameZh(event.target.value)}
                            aria-label={`${row.type} 中文名称`}
                            className="w-36"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editNameEn}
                            onChange={(event) => setEditNameEn(event.target.value)}
                            aria-label={`${row.type} 英文名称`}
                            className="w-36"
                          />
                        </TableCell>
                        <TableCell>
                          <DirectionSelect
                            value={editDirection}
                            onChange={setEditDirection}
                            ariaLabel={`${row.type} 方向`}
                          />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {row.is_builtin ? <Badge variant="secondary">内置</Badge> : <Badge variant="outline">自定义</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleUpdate}
                              disabled={savingEdit}
                              aria-label={`保存 ${row.type} 的修改`}
                            >
                              {savingEdit ? (
                                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                              ) : (
                                <Save className="size-4" aria-hidden />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditType(null)}
                              disabled={savingEdit}
                              aria-label={`取消编辑 ${row.type}`}
                            >
                              <X className="size-4" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={row.type}>
                        <TableCell className="font-mono text-xs">{row.type}</TableCell>
                        <TableCell>{row.name_zh}</TableCell>
                        <TableCell className="text-muted-foreground">{row.name_en}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {DIRECTION_LABELS[row.direction]}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {row.is_builtin ? <Badge variant="secondary">内置</Badge> : <Badge variant="outline">自定义</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(row)}
                              aria-label={`编辑 ${row.type}`}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(row)}
                              aria-label={`删除 ${row.type}`}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </div>

            {showCreate ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold">新增关系类型</h3>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="relation-new-type">类型标识</Label>
                    <Input
                      id="relation-new-type"
                      value={newType}
                      onChange={(event) => setNewType(event.target.value)}
                      placeholder="例如 monitors"
                      className="font-mono"
                      aria-describedby="relation-new-type-hint"
                    />
                    <p id="relation-new-type-hint" className="text-xs text-muted-foreground">
                      小写字母开头，仅含小写字母/数字/下划线
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="relation-new-name-zh">中文名称</Label>
                    <Input
                      id="relation-new-name-zh"
                      value={newNameZh}
                      onChange={(event) => setNewNameZh(event.target.value)}
                      placeholder="例如 监控"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="relation-new-name-en">英文名称</Label>
                    <Input
                      id="relation-new-name-en"
                      value={newNameEn}
                      onChange={(event) => setNewNameEn(event.target.value)}
                      placeholder="留空时使用类型标识"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>方向</Label>
                    <DirectionSelect
                      value={newDirection}
                      onChange={setNewDirection}
                      ariaLabel="新增关系类型方向"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={savingNew}>
                    {savingNew ? (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Save className="size-4" aria-hidden />
                    )}
                    {savingNew ? "保存中…" : "保存新增"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreate(false)}
                    disabled={savingNew}
                  >
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="size-4" aria-hidden />
                新增关系类型
              </Button>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除关系类型？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleteTarget?.name_zh}（{deleteTarget?.type}）」。被数据集规格引用的关系类型无法删除；
              已生成数据中的历史关系不受影响，但无法再用于新规格。
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
    </Card>
  )
}
