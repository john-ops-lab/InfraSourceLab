import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  BadgeCheck,
  Bot,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  PlugZap,
  RefreshCw,
  Save,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ApiError,
  api,
  extractDetail,
  hasSession,
  type AIConfigInfo,
  type AIPromptConfig,
} from "@/lib/api"

const PROMPT_CHAR_LIMIT = 8000

function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}

/**
 * AI 建议服务面板：模型接入配置、拉取模型列表、测试连接与提示词选择。
 * 只有管理员登录会话可以读写配置；API Key 会话只看到状态提示。
 */
export function AIServicePanel() {
  const [config, setConfig] = useState<AIConfigInfo | null>(null)
  const [statusConfigured, setStatusConfigured] = useState<boolean | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)

  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("")
  const [timeout, setTimeoutSeconds] = useState("30")
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  const [models, setModels] = useState<string[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [testing, setTesting] = useState(false)

  const [prompts, setPrompts] = useState<AIPromptConfig | null>(null)
  const [promptMode, setPromptMode] = useState<"default" | "custom">("default")
  const [customPrompt, setCustomPrompt] = useState("")
  const [savingPrompt, setSavingPrompt] = useState(false)

  useEffect(() => {
    let cancelled = false
    // 公开状态：非管理员会话也能看到已配置/未配置徽标
    api
      .status()
      .then((status) => {
        if (!cancelled) setStatusConfigured(status.ai_configured)
      })
      .catch(() => {})
    Promise.all([api.getAIConfig(), api.getAIPrompts()])
      .then(([info, promptInfo]) => {
        if (cancelled) return
        setConfig(info)
        setBaseUrl(info.base_url)
        setModel(info.model)
        setTimeoutSeconds(String(info.timeout_seconds))
        setPrompts(promptInfo)
        setPromptMode(promptInfo.active)
        setCustomPrompt(promptInfo.custom_prompt)
        setForbidden(false)
      })
      .catch((error) => {
        if (cancelled) return
        if (isAuthError(error)) {
          setForbidden(true)
        } else {
          toast.error("读取 AI 建议服务配置失败", {
            description: extractDetail(error, "无法连接服务端"),
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async () => {
    const timeoutValue = Number(timeout)
    if (!Number.isFinite(timeoutValue) || timeoutValue <= 0 || timeoutValue > 600) {
      toast.error("超时时间需为 0~600 之间的数字（秒）")
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateAIConfig({
        base_url: baseUrl,
        // 空字符串表示保持不变，避免误清空已配置的密钥
        api_key: apiKey.trim() ? apiKey.trim() : null,
        model,
        timeout_seconds: timeoutValue,
      })
      setConfig(updated)
      setApiKey("")
      toast.success("AI 配置已保存", { description: "立即生效，无需重启服务。" })
    } catch (error) {
      if (isAuthError(error)) {
        setForbidden(true)
      } else {
        toast.error("保存失败", { description: extractDetail(error, "请求失败") })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleFetchModels = async () => {
    setFetchingModels(true)
    try {
      const result = await api.listAIModels()
      setModels(result.models)
      if (result.models.length === 0) {
        toast.warning("服务端返回的模型列表为空", {
          description: "请检查接入地址是否指向 OpenAI 兼容服务。",
        })
      } else {
        toast.success(`已拉取 ${result.models.length} 个模型 ID`, {
          description: "可在下方列表中选择要使用的模型。",
        })
      }
    } catch (error) {
      if (isAuthError(error)) {
        setForbidden(true)
      } else {
        toast.error("拉取模型列表失败", {
          description: error instanceof ApiError ? error.detail : extractDetail(error, "请求失败"),
        })
      }
    } finally {
      setFetchingModels(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const result = await api.testAIConnection()
      if (result.ok) {
        toast.success("连接测试通过", { description: result.message })
      } else {
        toast.warning("连接测试未通过", { description: result.message })
      }
    } catch (error) {
      if (isAuthError(error)) {
        setForbidden(true)
      } else {
        toast.error("连接测试失败", { description: extractDetail(error, "请求失败") })
      }
    } finally {
      setTesting(false)
    }
  }

  const handleSavePrompt = async () => {
    setSavingPrompt(true)
    try {
      const updated = await api.updateAIPrompts({
        active: promptMode,
        custom_prompt: customPrompt,
      })
      setPrompts(updated)
      setPromptMode(updated.active)
      setCustomPrompt(updated.custom_prompt)
      toast.success("提示词配置已保存", {
        description:
          updated.active === "custom" && updated.custom_prompt
            ? "后续 AI 建议使用自定义提示词。"
            : "后续 AI 建议使用系统默认提示词。",
      })
    } catch (error) {
      if (isAuthError(error)) {
        setForbidden(true)
      } else {
        toast.error("保存提示词失败", { description: extractDetail(error, "请求失败") })
      }
    } finally {
      setSavingPrompt(false)
    }
  }

  const configured = config ? config.ai_configured : statusConfigured

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-5" aria-hidden />
          AI 建议服务
        </CardTitle>
        <CardDescription>
          自然语言建议通过 OpenAI 兼容的 /chat/completions 调用模型。配置保存到数据库，立即生效。
          {configured === true ? (
            <Badge className="ml-2">
              <BadgeCheck className="size-3.5" aria-hidden />
              已配置
            </Badge>
          ) : configured === false ? (
            <Badge variant="secondary" className="ml-2">
              <CircleAlert className="size-3.5" aria-hidden />
              未配置（只能使用内置模板）
            </Badge>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">正在读取配置…</p>
        ) : forbidden ? (
          <p className="text-sm text-muted-foreground">
            {hasSession() ? (
              "当前会话无权管理 AI 配置（会话可能已过期），请重新登录后再试。"
            ) : (
              <>
                修改 AI 配置与提示词需要管理员
                <Link to="/login" className="mx-1 text-primary underline-offset-4 hover:underline">
                  登录
                </Link>
                （API Key 不具备管理权限）。
              </>
            )}
          </p>
        ) : (
          <>
            <section className="space-y-4" aria-label="模型接入配置">
              <h3 className="text-sm font-semibold">模型接入配置</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-base-url">Base URL</Label>
                  <Input
                    id="ai-base-url"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder="https://api.openai.com/v1"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    兼容 OpenAI 的服务地址，例如 https://api.deepseek.com/v1。
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-api-key">API Key</Label>
                  <div className="relative">
                    <Input
                      id="ai-api-key"
                      type={visible ? "text" : "password"}
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={
                        config?.api_key_configured
                          ? `已配置（${config.api_key_hint}），留空保持不变`
                          : "填写模型服务的 API Key"
                      }
                      autoComplete="off"
                      className="pr-9"
                    />
                    <button
                      type="button"
                      className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setVisible((value) => !value)}
                      aria-label={visible ? "隐藏密钥" : "显示密钥"}
                    >
                      {visible ? (
                        <EyeOff className="size-4" aria-hidden />
                      ) : (
                        <Eye className="size-4" aria-hidden />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">密钥只存在服务端数据库中，界面不回显。</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-model">模型名称</Label>
                  <Input
                    id="ai-model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="gpt-4o-mini"
                    autoComplete="off"
                  />
                  {models.length > 0 && (
                    <div className="space-y-1">
                      <Label htmlFor="ai-model-list" className="text-xs text-muted-foreground">
                        从服务端拉取的模型中选择
                      </Label>
                      <select
                        id="ai-model-list"
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring"
                        value={models.includes(model) ? model : ""}
                        onChange={(event) => {
                          if (event.target.value) setModel(event.target.value)
                        }}
                        aria-label="选择拉取到的模型"
                      >
                        <option value="">（当前手动填写：{model || "未填写"}）</option>
                        {models.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-timeout">超时（秒）</Label>
                  <Input
                    id="ai-timeout"
                    type="number"
                    min={1}
                    max={600}
                    value={timeout}
                    onChange={(event) => setTimeoutSeconds(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-4" aria-hidden />
                  )}
                  {saving ? "保存中…" : "保存配置"}
                </Button>
                <Button variant="outline" onClick={handleFetchModels} disabled={fetchingModels}>
                  {fetchingModels ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden />
                  )}
                  拉取模型列表
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <PlugZap className="size-4" aria-hidden />
                  )}
                  测试连接
                </Button>
              </div>
            </section>

            <section className="space-y-3 border-t pt-4" aria-label="系统提示词">
              <h3 className="text-sm font-semibold">系统提示词</h3>
              <p className="text-xs text-muted-foreground">
                AI 生成建议规格时使用的系统提示词。默认使用系统内置模板，也可切换为自定义内容。
              </p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="prompt-mode"
                    checked={promptMode === "default"}
                    onChange={() => setPromptMode("default")}
                    className="size-4 accent-primary"
                  />
                  系统默认提示词
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="prompt-mode"
                    checked={promptMode === "custom"}
                    onChange={() => setPromptMode("custom")}
                    className="size-4 accent-primary"
                  />
                  自定义提示词
                </label>
              </div>
              {promptMode === "default" ? (
                <Textarea
                  value={prompts?.default_prompt ?? ""}
                  readOnly
                  rows={8}
                  aria-label="系统默认提示词（只读）"
                  className="bg-muted/40 font-mono text-xs"
                />
              ) : (
                <div className="space-y-1">
                  <Textarea
                    value={customPrompt}
                    onChange={(event) =>
                      setCustomPrompt(event.target.value.slice(0, PROMPT_CHAR_LIMIT))
                    }
                    rows={8}
                    aria-label="自定义提示词"
                    placeholder="输入自定义系统提示词（留空时仍回退到系统默认提示词）"
                    className="font-mono text-xs"
                  />
                  <p className="text-right text-xs text-muted-foreground">
                    {customPrompt.length} / {PROMPT_CHAR_LIMIT}
                  </p>
                </div>
              )}
              <Button variant="secondary" onClick={handleSavePrompt} disabled={savingPrompt}>
                {savingPrompt ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="size-4" aria-hidden />
                )}
                {savingPrompt ? "保存中…" : "保存提示词配置"}
              </Button>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  )
}
