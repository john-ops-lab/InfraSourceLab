import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface CollapsibleCardProps {
  /** 标题（可含图标），始终可见 */
  title: ReactNode
  /** 摘要描述，始终可见（状态徽标等可放这里） */
  description?: ReactNode
  /** 折叠的功能区内容，展开后渲染 */
  children: ReactNode
  defaultOpen?: boolean
  contentClassName?: string
}

/**
 * 设置页可折叠功能卡：头部（标题 + 摘要 + chevron）始终可见、整行点击切换，
 * 功能区默认收起，页面只呈现功能清单。
 */
export function CollapsibleCard({
  title,
  description,
  children,
  defaultOpen = false,
  contentClassName,
}: CollapsibleCardProps) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card className="gap-0 py-0">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group/trigger w-full cursor-pointer text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <CardHeader className="py-4 transition-colors group-hover/trigger:bg-muted/40">
              <CardTitle className="flex items-center gap-2">{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
              <CardAction>
                <ChevronDown
                  className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/trigger:rotate-180"
                  aria-hidden
                />
              </CardAction>
            </CardHeader>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className={cn("border-t py-4", contentClassName)}>
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
