"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitives.Root
        className={cn(
            "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--cy-lime)] data-[state=unchecked]:bg-slate-800 shadow-inner",
            className
        )}
        {...props}
        ref={ref}
    >
        <SwitchPrimitives.Thumb
            className={cn(
                "pointer-events-none flex items-center justify-center h-6 w-6 rounded-full bg-white shadow-md ring-0 transition-transform duration-300 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
            )}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-400 data-[state=checked]:text-[var(--cy-lime)] transition-colors duration-300"
            >
                <path d="M12 2v10" />
                <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
            </svg>
        </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
