import { FrameBase } from "@arwes/react"

import { arwesField1 } from "@/components/ui/arwes-frame-settings"
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("relative animate-pulse overflow-hidden rounded-md bg-accent", className)}
      {...props}
    >
      <FrameBase
        settings={arwesField1}
        className="arwes-field-frame pointer-events-none"
      />
    </div>
  )
}

export { Skeleton }
