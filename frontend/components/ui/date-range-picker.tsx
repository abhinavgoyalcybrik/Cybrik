"use client"

import * as React from "react"
import { format, subDays, startOfMonth, endOfMonth, startOfYear, subMonths } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps {
    className?: string
    date: DateRange | undefined
    setDate: (date: DateRange | undefined) => void
}

const presets = [
    { label: "Today", getValue: () => ({ from: new Date(), to: new Date() }) },
    { label: "Yesterday", getValue: () => ({ from: subDays(new Date(), 1), to: subDays(new Date(), 1) }) },
    { label: "Last 7 days", getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
    { label: "Last 30 days", getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
    { label: "This Month", getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
    { label: "Last Month", getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
]

export function DatePickerWithRange({
    className,
    date,
    setDate,
}: DatePickerWithRangeProps) {
    const [open, setOpen] = React.useState(false)

    const handlePresetClick = (preset: typeof presets[0]) => {
        setDate(preset.getValue())
    }

    const getDaysCount = () => {
        if (!date?.from || !date?.to) return 0
        return Math.ceil((date.to.getTime() - date.from.getTime()) / (1000 * 60 * 60 * 24)) + 1
    }

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-auto min-w-[180px] justify-between text-left font-medium",
                            "bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white",
                            "rounded-xl px-4 py-2.5 h-auto",
                            !date && "text-white/60"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 opacity-70" />
                            {date?.from ? (
                                date.to ? (
                                    <span className="text-sm">
                                        {format(date.from, "MMM d")} - {format(date.to, "MMM d, yyyy")}
                                    </span>
                                ) : (
                                    <span className="text-sm">{format(date.from, "MMM d, yyyy")}</span>
                                )
                            ) : (
                                <span className="text-sm">Select date range</span>
                            )}
                        </div>
                        <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-auto p-0 bg-white rounded-2xl shadow-2xl border border-gray-200"
                    align="end"
                    sideOffset={8}
                >
                    {/* Quick Select Row */}
                    <div className="flex items-center gap-2 p-3 border-b border-gray-100 bg-gray-50 rounded-t-2xl overflow-x-auto">
                        {presets.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={() => handlePresetClick(preset)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap",
                                    "bg-white border border-gray-200 text-gray-600",
                                    "hover:bg-[var(--cy-lime)]/20 hover:border-[var(--cy-lime)] hover:text-[var(--cy-navy)]",
                                    "active:scale-95"
                                )}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Calendar */}
                    <div className="p-3">
                        <Calendar
                            mode="range"
                            defaultMonth={date?.from || subMonths(new Date(), 1)}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                        />
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50 rounded-b-2xl">
                        <div className="text-sm text-[var(--cy-navy)] font-medium">
                            {date?.from && date?.to ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[var(--cy-lime)]"></span>
                                    {getDaysCount()} {getDaysCount() === 1 ? 'day' : 'days'} selected
                                </span>
                            ) : (
                                <span className="text-gray-400">No range selected</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDate(undefined)}
                                className="text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg h-8"
                            >
                                <X className="h-3 w-3 mr-1" />
                                Clear
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => setOpen(false)}
                                className="text-xs bg-[var(--cy-navy)] text-white hover:bg-[var(--cy-navy)]/90 rounded-lg px-4 h-8"
                            >
                                Apply
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
