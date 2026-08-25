import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Database, Eye, EyeOff, LogIn } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, api, setSession, setApiKey } from "@/lib/api"
import { extractDetail } from "@/lib/api"

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [keyMode, setKeyMode] = useState(false)
  const [apiKey, setApiKeyInput] = useState("")

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return

    if (keyMode) {
      // 备用通道：直接使用 ISL_API_KEY
      const trimmed = apiKey.trim()
      if (!trimmed) {
        toast.error("API Key 不能为空")
        return
      }
      setApiKey(trimmed)
      toast.success("API Key 已保存", { description: "仅保存在当前浏览器会话中。" })
      navigate("/create")
      return
    }

    if (!username.trim() || !password) {
      toast.error("请输入用户名和密码")
      return
    }
    setSubmitting(true)
    try {
      const result = await api.login(username.trim(), password)
      setSession(result.token, result.username)
      toast.success(`登录成功：${result.username}`)
      navigate("/create")
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("用户名或密码错误")
      } else {
        toast.error("登录失败", {
          description:
            error instanceof ApiError ? error.detail : extractDetail(error, "无法连接服务端"),
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Database className="size-8 text-primary" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight">InfraSourceLab</h1>
          <p className="text-sm text-muted-foreground">CMDB 测试数据生成 · 管理员登录</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{keyMode ? "使用 API Key 登录" : "管理员登录"}</CardTitle>
            <CardDescription>
              {keyMode
                ? "备用通道：粘贴服务端环境变量 ISL_API_KEY。"
                : "默认账户 admin / admin123，登录后可在设置页修改密码。"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {keyMode ? (
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type={visible ? "text" : "password"}
                    value={apiKey}
                    onChange={(event) => setApiKeyInput(event.target.value)}
                    placeholder="粘贴服务端 ISL_API_KEY"
                    autoComplete="off"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="username">用户名</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="admin"
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">密码</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={visible ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        className="pr-9"
                      />
                      <button
                        type="button"
                        className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setVisible((value) => !value)}
                        aria-label={visible ? "隐藏" : "显示"}
                      >
                        {visible ? (
                          <EyeOff className="size-4" aria-hidden />
                        ) : (
                          <Eye className="size-4" aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                <LogIn className="size-4" aria-hidden />
                {keyMode ? "保存并进入" : "登录"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setKeyMode((value) => !value)}
              >
                {keyMode ? "返回管理员登录" : "改用 API Key（备用）"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
