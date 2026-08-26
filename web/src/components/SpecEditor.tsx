import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CI_TYPE_LABELS,
  DEFECT_KIND_LABELS,
  RELATION_TYPE_LABELS,
  ciTypeLabel,
  relationTypeLabel,
  totalCiCount,
  type DefectKind,
  type GenerationSpec,
  type QualityDefectEntry,
} from "@/lib/spec"

const SINGLE_TYPE_LIMIT = 20000
const TOTAL_LIMIT = 30000

interface SpecEditorProps {
  spec: GenerationSpec
  onChange: (spec: GenerationSpec) => void
  disabled?: boolean
}

export function SpecEditor({ spec, onChange, disabled }: SpecEditorProps) {
  const total = totalCiCount(spec)
  const totalWarning = total > TOTAL_LIMIT
  const usedTypes = new Set(spec.ci_types.map((entry) => entry.type))
  const availableTypes = Object.keys(CI_TYPE_LABELS).filter((t) => !usedTypes.has(t))

  const updateCiType = (index: number, patch: Partial<GenerationSpec["ci_types"][number]>) => {
    const ciTypes = spec.ci_types.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    onChange({ ...spec, ci_types: ciTypes })
  }

  const updateRelation = (index: number, patch: Partial<GenerationSpec["relations"][number]>) => {
    const relations = spec.relations.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    onChange({ ...spec, relations })
  }

  const defects = spec.quality_defects ?? []

  const updateDefect = (index: number, patch: Partial<QualityDefectEntry>) => {
    const quality_defects = defects.map((entry, i) =>
      i === index ? { ...entry, ...patch } : entry,
    )
    onChange({ ...spec, quality_defects })
  }

  // 比例与数量二选一：切换时移除另一个字段，避免后端校验拒绝
  const setDefectAmount = (index: number, mode: "count" | "ratio", value: number) => {
    const entry = defects[index]
    const patch: QualityDefectEntry = {
      kind: entry.kind,
      ci_type: entry.ci_type,
      ...(entry.field !== undefined && entry.field !== "" ? { field: entry.field } : {}),
    }
    if (mode === "count") patch.count = Math.max(1, Math.round(value) || 1)
    else patch.ratio = Math.min(1, Math.max(0.01, value) || 0.01)
    updateDefect(index, patch)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="spec-name">数据集名称</Label>
          <Input
            id="spec-name"
            value={spec.name}
            disabled={disabled}
            onChange={(event) => onChange({ ...spec, name: event.target.value })}
            placeholder="例如：小型混合云环境"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="spec-seed">随机种子（seed）</Label>
          <Input
            id="spec-seed"
            type="number"
            value={spec.seed}
            disabled={disabled}
            onChange={(event) => onChange({ ...spec, seed: Number(event.target.value) || 0 })}
          />
          <p className="text-xs text-muted-foreground">相同规格 + 相同种子会生成完全相同的数据</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="spec-description">描述</Label>
        <Textarea
          id="spec-description"
          value={spec.description}
          disabled={disabled}
          rows={2}
          onChange={(event) => onChange({ ...spec, description: event.target.value })}
        />
      </div>

      <section className="space-y-2" aria-label="CI 类型与数量">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">CI 类型与数量</h3>
          <span className="text-sm text-muted-foreground">
            合计 {total} 条（上限 {TOTAL_LIMIT.toLocaleString()}）
          </span>
        </div>
        <div className="space-y-2">
          {spec.ci_types.map((entry, index) => (
            <div key={entry.type} className="flex flex-wrap items-center gap-2">
              <Select
                value={entry.type}
                disabled={disabled}
                onValueChange={(value) => updateCiType(index, { type: value })}
              >
                <SelectTrigger className="w-48" aria-label="CI 类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CI_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value} disabled={value !== entry.type && usedTypes.has(value)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                className="w-28"
                min={0}
                max={SINGLE_TYPE_LIMIT}
                value={entry.count}
                disabled={disabled}
                aria-label={`${ciTypeLabel(entry.type)}数量`}
                onChange={(event) =>
                  updateCiType(index, { count: Math.max(0, Number(event.target.value) || 0) })
                }
              />
              <span className="text-xs text-muted-foreground">
                单类型上限 {SINGLE_TYPE_LIMIT.toLocaleString()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive hover:text-destructive"
                disabled={disabled}
                onClick={() =>
                  onChange({ ...spec, ci_types: spec.ci_types.filter((_, i) => i !== index) })
                }
                aria-label={`移除 ${ciTypeLabel(entry.type)}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || availableTypes.length === 0}
          onClick={() =>
            onChange({
              ...spec,
              ci_types: [...spec.ci_types, { type: availableTypes[0], count: 1 }],
            })
          }
        >
          <Plus className="size-4" aria-hidden />
          添加 CI 类型
        </Button>
      </section>

      <section className="space-y-2" aria-label="关系定义">
        <h3 className="text-sm font-semibold">关系定义</h3>
        <div className="space-y-2">
          {spec.relations.map((entry, index) => (
            <div key={`${entry.type}-${entry.from_type}-${entry.to_type}-${index}`} className="flex flex-wrap items-center gap-2">
              <Select
                value={entry.type}
                disabled={disabled}
                onValueChange={(value) => updateRelation(index, { type: value })}
              >
                <SelectTrigger className="w-44" aria-label="关系类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(RELATION_TYPE_LABELS).map((value) => (
                    <SelectItem key={value} value={value}>
                      {relationTypeLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">从</span>
              <Select
                value={entry.from_type}
                disabled={disabled}
                onValueChange={(value) => updateRelation(index, { from_type: value })}
              >
                <SelectTrigger className="w-40" aria-label="起点类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {spec.ci_types.map((ci) => (
                    <SelectItem key={ci.type} value={ci.type}>
                      {ciTypeLabel(ci.type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">到</span>
              <Select
                value={entry.to_type}
                disabled={disabled}
                onValueChange={(value) => updateRelation(index, { to_type: value })}
              >
                <SelectTrigger className="w-40" aria-label="终点类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {spec.ci_types.map((ci) => (
                    <SelectItem key={ci.type} value={ci.type}>
                      {ciTypeLabel(ci.type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={entry.strategy}
                disabled={disabled}
                onValueChange={(value) => updateRelation(index, { strategy: value as "balanced" | "random_seeded" })}
              >
                <SelectTrigger className="w-40" aria-label="生成策略">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced">balanced（均匀分配）</SelectItem>
                  <SelectItem value="random_seeded">random_seeded（随机）</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={entry.coverage}
                disabled={disabled}
                onValueChange={(value) => updateRelation(index, { coverage: value as "from" | "to" })}
              >
                <SelectTrigger className="w-40" aria-label="覆盖方向">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="from">coverage=from（覆盖起点）</SelectItem>
                  <SelectItem value="to">coverage=to（覆盖终点）</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive hover:text-destructive"
                disabled={disabled}
                onClick={() =>
                  onChange({ ...spec, relations: spec.relations.filter((_, i) => i !== index) })
                }
                aria-label={`移除关系 ${entry.type}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          {spec.relations.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无关系，可以点击下方按钮添加。</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || spec.ci_types.length === 0}
          onClick={() => {
            const first = spec.ci_types[0]
            onChange({
              ...spec,
              relations: [
                ...spec.relations,
                {
                  type: "depends_on",
                  from_type: first.type,
                  to_type: first.type,
                  strategy: "balanced",
                  coverage: "from",
                },
              ],
            })
          }}
        >
          <Plus className="size-4" aria-hidden />
          添加关系
        </Button>
      </section>

      <section className="space-y-2" aria-label="数据质量缺陷">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">数据质量缺陷（可选）</h3>
          <span className="text-xs text-muted-foreground">确定性注入，受 seed 控制</span>
        </div>
        <div className="space-y-2">
          {defects.map((entry, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <Select
                value={entry.kind}
                disabled={disabled}
                onValueChange={(value) => updateDefect(index, { kind: value as DefectKind })}
              >
                <SelectTrigger className="w-36" aria-label="缺陷类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DEFECT_KIND_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={entry.ci_type}
                disabled={disabled}
                onValueChange={(value) => updateDefect(index, { ci_type: value })}
              >
                <SelectTrigger className="w-40" aria-label="缺陷目标类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {spec.ci_types.map((ci) => (
                    <SelectItem key={ci.type} value={ci.type}>
                      {ciTypeLabel(ci.type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="w-36"
                value={entry.field ?? ""}
                disabled={disabled}
                placeholder="字段（可选）"
                aria-label="缺陷目标字段"
                onChange={(event) =>
                  updateDefect(index, { field: event.target.value || undefined })
                }
              />
              <Select
                value={entry.ratio !== undefined ? "ratio" : "count"}
                disabled={disabled}
                onValueChange={(value) =>
                  setDefectAmount(index, value as "count" | "ratio", value === "ratio" ? 0.1 : 1)
                }
              >
                <SelectTrigger className="w-28" aria-label="缺陷数量方式">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">按数量</SelectItem>
                  <SelectItem value="ratio">按比例</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                className="w-24"
                min={entry.ratio !== undefined ? 0.01 : 1}
                max={entry.ratio !== undefined ? 1 : undefined}
                step={entry.ratio !== undefined ? 0.05 : 1}
                value={entry.ratio ?? entry.count ?? 1}
                disabled={disabled}
                aria-label="缺陷数量"
                onChange={(event) =>
                  setDefectAmount(
                    index,
                    entry.ratio !== undefined ? "ratio" : "count",
                    Number(event.target.value),
                  )
                }
              />
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive hover:text-destructive"
                disabled={disabled}
                onClick={() =>
                  onChange({ ...spec, quality_defects: defects.filter((_, i) => i !== index) })
                }
                aria-label={`移除缺陷规则 ${index + 1}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          {defects.length === 0 && (
            <p className="text-sm text-muted-foreground">未启用数据质量缺陷，生成干净数据。</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || spec.ci_types.length === 0}
          onClick={() =>
            onChange({
              ...spec,
              quality_defects: [
                ...defects,
                { kind: "missing_field", ci_type: spec.ci_types[0].type, count: 1 },
              ],
            })
          }
        >
          <Plus className="size-4" aria-hidden />
          添加缺陷规则
        </Button>
      </section>

      {totalWarning && (
        <p className="text-sm text-destructive" role="alert">
          CI 总数 {total} 超过上限 {TOTAL_LIMIT.toLocaleString()}，请减少数量后再创建。
        </p>
      )}
    </div>
  )
}
