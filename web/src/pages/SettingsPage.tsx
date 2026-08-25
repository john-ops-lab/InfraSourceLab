import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BadgeCheck, CircleAlert, ExternalLink, Eye, EyeOff, KeyRound, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { clearApiKey, getApiKey, hasApiKey, setApiKey } from "@/lib/api"

export default function SettingsPage() {
  const [keyInput, setKeyInput] = useState("")
  const [visible, setVisible] = useState(false)
  const [saved, setSaved] = useState(hasApiKey())
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)

  const refreshStatus = () => {
    setAiConfigured(null)
    api
      .status()
      .then((status) => setAiConfigured(status.ai_configured))
      .catch(() => setAiConfigured(null))
  }

  useEffect(() => {
    refreshStatus()
  }, [])

  const handleSave = () => {
    const trimmed = keyInput.trim()
    if (!trimmed) {
      toast.error("API Key 不能为空")
      return
    }
    setApiKey(trimmed)
    setKeyInput("")
    setSaved(true)
    refreshStatus()
    toast.success("API Key 已保存", { description: "仅保存在当前浏览器会话中。" })
  }

  const handleClear = () => {
    clearApiKey()
    setSaved(false)
    toast.success("已清除本会话的 API Key")
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="text-sm text-muted-foreground">管理访问凭证与服务状态。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" aria-hidden />
            API Key
          </CardTitle>
          <CardDescription>
            所有 /api/v1 接口都需要 Bearer Token。密钥只保存在浏览器 sessionStorage
            中，关闭标签页后失效，不会写入 URL 或日志。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            {saved ? (
              <Badge>
                <BadgeCheck className="size-3.5" aria-hidden />
                当前会话已配置 API Key
              </Badge>
            ) : (
              <Badge variant="secondary">
                <CircleAlert className="size-3.5" aria-hidden />
                当前会话未配置 API Key
              </Badge>
            )}
          </div>
          <div className="flex max-w-lg gap-2">
            <div className="relative flex-1">
              <Input
                type={visible ? "text" : "password"}
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                placeholder="粘贴服务端 ISL_API_KEY"
                aria-label="API Key"
                autoComplete="off"
                className="pr-9"
              />
              <button
                type="button"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setVisible((value) => !value)}
                aria-label={visible ? "隐藏密钥" : "显示密钥"}
              >
                {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
            <Button onClick={handleSave} disabled={!keyInput.trim()}>
              保存
            </Button>
          </div>
          {saved && (
            <Button variant="outline" size="sm" onClick={handleClear}>
              <Trash2 className="size-4" aria-hidden />
              清除本会话密钥
            </Button>
          )}
          {getApiKey() && (
            <p className="text-xs text-muted-foreground">
              当前密钥前 4 位：{getApiKey().slice(0, 4)}••••
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI 建议服务</CardTitle>
          <CardDescription>创建页的自然语言建议依赖服务端 AI 配置。</CardDescription>
        </CardHeader>
        <CardContent>
          {aiConfigured === null ? (
            <p className="text-sm text-muted-foreground">无法获取状态，请检查服务是否运行。</p>
          ) : aiConfigured ? (
            <Badge>
              <BadgeCheck className="size-3.5" aria-hidden />
              已配置（可从提示词生成建议规格）
            </Badge>
          ) : (
            <Badge variant="secondary">
              <CircleAlert className="size-3.5" aria-hidden />
              未配置（可改用内置模板创建数据集）
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>接口文档</CardTitle>
          <CardDescription>FastAPI 自动生成的交互式文档。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="/docs" target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden />
              打开 /docs
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
