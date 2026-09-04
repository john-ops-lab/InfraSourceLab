import { useEffect, type ReactNode } from "react"
import { BrowserRouter, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom"
import { Database, Plus, Settings } from "lucide-react"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { getSessionUser, hasSession, onUnauthorized } from "@/lib/api"
import { cn } from "@/lib/utils"
import CreatePage from "@/pages/CreatePage"
import DatasetsPage from "@/pages/DatasetsPage"
import DatasetDetailPage from "@/pages/DatasetDetailPage"
import LoginPage from "@/pages/LoginPage"
import SettingsPage from "@/pages/SettingsPage"

function navClassName({ isActive }: { isActive: boolean }): string {
  return cn(
    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors",
    isActive
      ? "bg-accent text-accent-foreground font-medium"
      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
  )
}

function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  useEffect(() => {
    onUnauthorized(() => {
      toast.error("认证失败（401）", {
        id: "auth-401",
        description: "登录已过期或凭证无效，请重新登录或检查 API Key。",
      })
      navigate("/login")
    })
  }, [navigate])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <NavLink to="/create" className="flex items-center gap-2 font-semibold">
            <Database className="size-5 text-primary" aria-hidden />
            <span>InfraSourceLab</span>
            <span className="hidden rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground lg:inline">
              CMDB 测试数据生成
            </span>
          </NavLink>
          <nav className="flex items-center gap-1" aria-label="主导航">
            <NavLink to="/create" className={navClassName} aria-label="创建数据集">
              <Plus className="size-4" aria-hidden />
              <span className="hidden sm:inline">创建数据集</span>
            </NavLink>
            <NavLink to="/datasets" className={navClassName} aria-label="数据集列表">
              <Database className="size-4" aria-hidden />
              <span className="hidden sm:inline">数据集列表</span>
            </NavLink>
            <NavLink to="/settings" className={navClassName} aria-label="设置">
              <Settings className="size-4" aria-hidden />
              <span className="hidden sm:inline">设置</span>
            </NavLink>
            {hasSession() && (
              <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
                {getSessionUser()}
              </span>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/create" replace />} />
                <Route path="/create" element={<CreatePage />} />
                <Route path="/datasets" element={<DatasetsPage />} />
                <Route path="/datasets/:id" element={<DatasetDetailPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/create" replace />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  )
}
