"use client"

import * as React from "react"
import { FrameBase } from "@arwes/react"

import { arwesField1 } from "@/components/ui/arwes-frame-settings"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <FrameBase
          settings={arwesField1}
          className="arwes-field-frame pointer-events-none"
        />
        <input
          ref={ref}
          type={type}
          data-slot="input"
          className={cn(
            "arwes-input arwes-bevel file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground relative z-[2] flex h-9 w-full min-w-0 border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            "focus-visible:ring-2 focus-visible:ring-cyan-300/75",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
            className
          )}
          {...props}
        />
      </div>
    )
  }
)

Input.displayName = "Input"

export { Input }
