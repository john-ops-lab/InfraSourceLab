import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { FileText, LoaderCircle, RefreshCw, Sparkles, TriangleAlert, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { SpecEditor } from "@/components/SpecEditor"
import { api, ApiError } from "@/lib/api"
import { totalCiCount, type GenerationSpec, type TemplateInfo } from "@/lib/spec"

const PROMPT_LIMIT = 4000
const PROPOSE_TIMEOUT_MS = 60000

type Phase = "idle" | "proposing" | "proposed" | "creating"

export default function CreatePage() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState("")
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [spec, setSpec] = useState<GenerationSpec | null>(null)
  const [proposalMessage, setProposalMessage] = useState("")
  const [proposalWarnings, setProposalWarnings] = useState<string[]>([])
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const timedOutRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    api
      .templates()
      .then((result) => {
        if (!cancelled) setTemplates(result.templates)
      })
      .catch(() => {
        // 401 等错误由全局处理，模板区保持空列表即可
      })
    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
  }, [])

  const handlePropose = async () => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      setError("请先输入需求描述，再让 AI 生成建议规格。")
      return
    }
    setError(null)
    setPhase("proposing")
    timedOutRef.current = false
    const controller = new AbortController()
    abortRef.current = controller
    const timer = window.setTimeout(() => {
      timedOutRef.current = true
      controller.abort()
    }, PROPOSE_TIMEOUT_MS)
    try {
      const result = await api.fromPrompt(trimmed, controller.signal)
      setSpec(result.spec)
      setProposalMessage(result.message)
      setProposalWarnings(result.warnings)
      setPhase("proposed")
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        if (timedOutRef.current) {
          setError("AI 建议超时（60 秒），请重试或改用内置模板。")
        } else {
          setPhase("idle")
          return
        }
      } else if (err instanceof ApiError) {
        setError(
          err.status === 503
            ? `AI 未配置：${err.detail} 你可以改用内置模板。`
            : err.detail,
        )
      } else {
        setError("请求失败，请稍后重试。")
      }
      setPhase("idle")
    } finally {
      window.clearTimeout(timer)
      abortRef.current = null
    }
  }

  const handleCancelPropose = () => {
    abortRef.current?.abort()
  }

  const handleUseTemplate = (template: TemplateInfo) => {
    setError(null)
    setSpec(structuredClone(template.spec))
    setProposalMessage(`已从模板「${template.name}」载入规格，可直接调整或创建。`)
    setProposalWarnings([])
    setPhase("proposed")
  }

  const handleCreate = async () => {
    if (!spec) return
    setError(null)
    setPhase("creating")
    try {
      const dataset = await api.createDataset(spec, prompt.trim())
      toast.success(`数据集「${dataset.name}」创建成功`, {
        description: `共 ${dataset.record_count} 条 CI、${dataset.relation_count} 条关系。`,
      })
      navigate(`/datasets/${dataset.id}`)
    } catch (err) {
      setPhase("proposed")
      setError(err instanceof ApiError ? err.detail : "生成失败，请稍后重试。")
    }
  }

  const proposing = phase === "proposing"
  const creating = phase === "creating"
  const busy = proposing || creating

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">创建数据集</h1>
        <p className="text-sm text-muted-foreground">
          用一段自然语言描述想要的测试环境，AI 会给出可编辑的生成规格；确认后再创建数据集。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>描述你想要的测试数据</CardTitle>
          <CardDescription>
            例如：“1 个数据中心、4 个机柜、20 台物理服务器、80 台虚拟机，服务器安装在机柜中，虚拟机运行在服务器上”
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value.slice(0, PROMPT_LIMIT))}
              rows={4}
              disabled={busy}
              placeholder="输入需求描述（最多 4000 字符）"
              aria-label="需求描述"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {prompt.length} / {PROMPT_LIMIT}
            </p>
          </div>
          <div className="flex gap-2">
            {proposing ? (
              <>
                <Button disabled>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  正在生成建议…
                </Button>
                <Button variant="outline" onClick={handleCancelPropose}>
                  <X className="size-4" aria-hidden />
                  取消
                </Button>
              </>
            ) : (
              <Button onClick={handlePropose} disabled={busy || !prompt.trim()}>
                <Sparkles className="size-4" aria-hidden />
                让 AI 生成建议规格
              </Button>
            )}
          </div>
          {!prompt.trim() && phase === "idle" && (
            <p className="text-xs text-muted-foreground">输入描述后按钮才会可用。</p>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" aria-hidden />
          <AlertTitle>出错了</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {spec && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              确认生成规格
              <Badge variant="secondary">共 {totalCiCount(spec)} 条 CI</Badge>
            </CardTitle>
            <CardDescription>{proposalMessage}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {proposalWarnings.length > 0 && (
              <Alert>
                <TriangleAlert className="size-4" aria-hidden />
                <AlertTitle>AI 建议包含以下提醒</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4">
                    {proposalWarnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <SpecEditor spec={spec} onChange={setSpec} disabled={creating} />
            <div className="flex gap-2 border-t pt-4">
              <Button onClick={handleCreate} disabled={creating || totalCiCount(spec) === 0}>
                {creating ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    正在生成数据集…
                  </>
                ) : (
                  "生成数据集"
                )}
              </Button>
              <Button variant="outline" onClick={handlePropose} disabled={busy || !prompt.trim()}>
                <RefreshCw className="size-4" aria-hidden />
                重新建议
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3" aria-label="内置模板">
        <h2 className="text-lg font-semibold">内置模板</h2>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无可用模板，或尚未通过认证。</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="size-4 text-muted-foreground" aria-hidden />
                    {template.name}
                  </CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => handleUseTemplate(template)}>
                    使用此模板
                  </Button>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {totalCiCount(template.spec)} 条 CI
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
