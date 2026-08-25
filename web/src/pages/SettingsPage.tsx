import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  BadgeCheck,
  Bot,
  CircleAlert,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Trash2,
  UserRound,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ApiError,
  api,
  clearApiKey,
  clearSession,
  extractDetail,
  getApiKey,
  getSessionUser,
  hasApiKey,
  hasSession,
  setApiKey,
} from "@/lib/api"

function PasswordCard() {
  const navigate = useNavigate()
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!oldPassword || !newPassword) {
      toast.error("请填写当前密码和新密码")
      return
    }
    if (newPassword.length < 6) {
      toast.error("新密码至少 6 位")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致")
      return
    }
    setSaving(true)
    try {
      await api.changePassword(oldPassword, newPassword)
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success("密码已修改", { description: "当前登录会话保持有效。" })
    } catch (error) {
      toast.error("修改失败", {
        description: error instanceof ApiError ? error.detail : extractDetail(error, "请求失败"),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    try {
      await api.logout()
    } catch {
      // 令牌已失效时也直接清理本地会话
    }
    clearSession()
    toast.success("已退出登录")
    navigate("/login")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-5" aria-hidden />
          账户与密码
        </CardTitle>
        <CardDescription>
          当前登录：{getSessionUser() || "admin"}。不强制修改默认密码，可自行修改。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label htmlFor="old-password">当前密码</Label>
            <Input
              id="old-password"
              type={visible ? "text" : "password"}
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">新密码（至少 6 位）</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={visible ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                className="pr-9"
              />
              <button
                type="button"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setVisible((value) => !value)}
                aria-label={visible ? "隐藏" : "显示"}
              >
                {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">确认新密码</Label>
            <Input
              id="confirm-password"
              type={visible ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : "修改密码"}
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="size-4" aria-hidden />
            退出登录
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const loggedIn = hasSession()
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
        <p className="text-sm text-muted-foreground">管理账户、访问凭证与服务状态。</p>
      </div>

      {loggedIn ? (
        <PasswordCard />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-5" aria-hidden />
              未登录
            </CardTitle>
            <CardDescription>
              使用管理员账号登录后，可修改密码并配置 AI 模型；也可以继续使用下方的 API Key 备用通道。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/login">前往登录</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" aria-hidden />
            API Key（备用通道）
          </CardTitle>
          <CardDescription>
            所有 /api/v1 接口都需要 Bearer Token：优先使用管理员登录会话，环境变量
            ISL_API_KEY 作为备用。密钥只保存在浏览器 sessionStorage 中。
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
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-5" aria-hidden />
            AI 建议服务
          </CardTitle>
          <CardDescription>
            创建页的自然语言建议依赖服务端 AI 配置，管理员可在
            <Link to="/settings/ai" className="mx-1 text-primary underline-offset-4 hover:underline">
              AI 模型配置
            </Link>
            页修改。
          </CardDescription>
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
