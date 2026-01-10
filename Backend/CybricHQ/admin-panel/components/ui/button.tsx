import * as React from "react"
import { cn } from "@/lib/utils"

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'destructive', size?: 'default' | 'sm' | 'icon' }>(
    ({ className, variant = 'default', size = 'default', ...props }, ref) => {
        const variants = {
            default: "bg-brand-green text-white hover:bg-brand-green-600 shadow-sm",
            outline: "border border-slate-300 bg-white hover:bg-slate-100 text-slate-700",
            ghost: "hover:bg-slate-100 text-slate-700",
            destructive: "bg-red-600 text-white hover:bg-red-700",
        }
        const sizes = {
            default: "h-9 px-4 py-2",
            sm: "h-7 px-3 text-xs",
            icon: "h-9 w-9 p-0",
        }
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
