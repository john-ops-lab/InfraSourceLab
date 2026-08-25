import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CodeCopyProps {
  label: string
  code: string
}

export function CodeCopy({ label, code }: CodeCopyProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // 剪贴板不可用时不阻塞使用
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{label}</div>
      <div className="relative">
        <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 pr-12 text-xs leading-relaxed">
          <code>{code}</code>
        </pre>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-1.5 right-1.5 h-7 px-2"
          onClick={copy}
          aria-label={`复制：${label}`}
        >
          {copied ? (
            <Check className="size-4 text-green-600" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          <span className="sr-only">{copied ? "已复制" : "复制"}</span>
        </Button>
      </div>
    </div>
  )
}
