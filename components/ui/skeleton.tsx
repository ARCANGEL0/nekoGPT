import { FrameBase } from "@/components/ui/neko-fx"

import { nekoField1 } from "@/components/ui/neko-frame-settings"
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("relative animate-pulse overflow-hidden rounded-md bg-accent", className)}
      {...props}
    >
      <FrameBase
        settings={nekoField1}
        className="fieldneko pointer-events-none"
      />
    </div>
  )
}

export { Skeleton }
