"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const Tabs = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { defaultValue?: string; value?: string; onValueChange?: (value: string) => void }
>(({ className, defaultValue, value, onValueChange, children, ...props }, ref) => {
    const [selectedValue, setSelectedValue] = React.useState(value || defaultValue || "")

    React.useEffect(() => {
        if (value !== undefined) {
            setSelectedValue(value)
        }
    }, [value])

    const handleValueChange = (newValue: string) => {
        setSelectedValue(newValue)
        onValueChange?.(newValue)
    }

    return (
        <TabsContext.Provider value={{ value: selectedValue, onValueChange: handleValueChange }}>
            <div ref={ref} className={cn("", className)} {...props}>
                {children}
            </div>
        </TabsContext.Provider>
    )
})
Tabs.displayName = "Tabs"

const TabsContext = React.createContext<{
    value: string
    onValueChange: (value: string) => void
}>({
    value: "",
    onValueChange: () => { },
})

const TabsList = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500",
            className
        )}
        {...props}
    />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    const isSelected = context.value === value

    return (
        <button
            ref={ref}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => context.onValueChange(value)}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isSelected
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-900",
                className
            )}
            {...props}
        />
    )
})
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    const isSelected = context.value === value

    if (!isSelected) return null

    return (
        <div
            ref={ref}
            role="tabpanel"
            className={cn(
                "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2",
                className
            )}
            {...props}
        />
    )
})
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
