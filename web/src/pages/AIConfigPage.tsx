import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { BadgeCheck, Bot, CircleAlert, Eye, EyeOff, Save } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, api, extractDetail, hasSession, type AIConfigInfo } from "@/lib/api"

export default function AIConfigPage() {
  const [config, setConfig] = useState<AIConfigInfo | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("")
  const [timeout, setTimeoutSeconds] = useState("30")
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api
      .getAIConfig()
      .then((info) => {
        setConfig(info)
        setForbidden(false)
        setBaseUrl(info.base_url)
        setModel(info.model)
        setTimeoutSeconds(String(info.timeout_seconds))
        setApiKey("")
      })
      .catch((error) => {
        setConfig(null)
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setForbidden(true)
        } else {
          toast.error("读取 AI 配置失败", {
            description: extractDetail(error, "无法连接服务端"),
          })
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setForbidden(true)
      } else {
        toast.error("保存失败", { description: extractDetail(error, "请求失败") })
      }
    } finally {
      setSaving(false)
    }
  }

  if (forbidden) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">AI 模型配置</h1>
          <p className="text-sm text-muted-foreground">该页面仅管理员登录会话可访问。</p>
        </div>
        <Card>
          <CardContent className="pt-6 text-sm">
            {hasSession() ? (
              <p>当前会话无权访问管理接口（会话可能已过期），请重新登录后再试。</p>
            ) : (
              <p>
                请先使用管理员账号
                <Link to="/login" className="mx-1 text-primary underline-offset-4 hover:underline">
                  登录
                </Link>
                （API Key 不具备管理权限）。
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI 模型配置</h1>
        <p className="text-sm text-muted-foreground">
          创建页的自然语言建议通过 OpenAI 兼容的 /chat/completions 调用模型。配置保存到数据库，立即生效。
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">正在读取配置…</p>
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5" aria-hidden />
              OpenAI 兼容服务
            </CardTitle>
            <CardDescription>
              {config?.ai_configured ? (
                <Badge>
                  <BadgeCheck className="size-3.5" aria-hidden />
                  已配置，可从提示词生成建议规格
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <CircleAlert className="size-3.5" aria-hidden />
                  未配置，创建页只能使用内置模板
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ai-model">模型名称</Label>
                <Input
                  id="ai-model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="gpt-4o-mini"
                  autoComplete="off"
                />
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
            <Button onClick={handleSave} disabled={saving}>
              <Save className="size-4" aria-hidden />
              {saving ? "保存中…" : "保存配置"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
