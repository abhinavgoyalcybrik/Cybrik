"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    const defaultClassNames = getDefaultClassNames()
    const [dragStart, setDragStart] = React.useState<Date | null>(null)

    // Handle drag selection for range mode
    const onDayMouseDown = (day: Date, activeModifiers: any, e: React.MouseEvent) => {
        // @ts-ignore - DayPicker props are complex unions, force check
        if (props.mode === "range" && props.onSelect) {
            setDragStart(day)
            // Start selection with just the clicked day
            // @ts-ignore
            props.onSelect({ from: day, to: undefined }, day, activeModifiers, e)
        }
        // @ts-ignore
        props.onDayMouseDown?.(day, activeModifiers, e)
    }

    const onDayMouseEnter = (day: Date, activeModifiers: any, e: React.MouseEvent) => {
        // @ts-ignore
        if (dragStart && props.mode === "range" && props.onSelect) {
            // Update range dynamically as user drags
            const range = {
                from: dragStart < day ? dragStart : day,
                to: dragStart < day ? day : dragStart
            }
            // @ts-ignore
            props.onSelect(range, day, activeModifiers, e)
        }
        // @ts-ignore
        props.onDayMouseEnter?.(day, activeModifiers, e)
    }

    // Stop dragging on global mouse up
    React.useEffect(() => {
        const handleMouseUp = () => setDragStart(null)
        document.addEventListener("mouseup", handleMouseUp)
        return () => document.removeEventListener("mouseup", handleMouseUp)
    }, [])

    return (
        // @ts-ignore
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-2", className)}
            // @ts-ignore
            onDayMouseDown={onDayMouseDown}
            // @ts-ignore
            onDayMouseEnter={onDayMouseEnter}
            classNames={{
                root: cn(defaultClassNames.root, ""),
                months: cn(defaultClassNames.months, "flex gap-4"),
                month: cn(defaultClassNames.month, "space-y-3"),
                month_caption: cn(defaultClassNames.month_caption, "flex justify-center relative items-center h-8 mb-1"),
                caption_label: cn(defaultClassNames.caption_label, "text-sm font-bold text-[var(--cy-navy)]"),
                nav: cn(defaultClassNames.nav, "flex items-center justify-between absolute inset-x-0 px-1"),
                button_previous: cn(
                    "h-7 w-7 bg-white rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-[var(--cy-navy)] transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                ),
                button_next: cn(
                    "h-7 w-7 bg-white rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-[var(--cy-navy)] transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                ),
                month_grid: cn(defaultClassNames.month_grid, "w-full border-collapse"),
                weekdays: cn(defaultClassNames.weekdays, "flex"),
                weekday: cn(
                    defaultClassNames.weekday,
                    "text-gray-400 w-9 font-semibold text-[10px] uppercase"
                ),
                week: cn(defaultClassNames.week, "flex w-full"),
                day: cn(
                    defaultClassNames.day,
                    "h-8 w-9 text-center text-sm p-0 relative flex items-center justify-center"
                ),
                day_button: cn(
                    defaultClassNames.day_button,
                    "h-8 w-full p-0 font-medium transition-all cursor-pointer text-gray-700",
                    "hover:bg-[var(--cy-lime)]/30 hover:text-[var(--cy-navy)]",
                    "focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)] focus:rounded-full"
                ),
                range_start: cn(
                    defaultClassNames.range_start,
                    "!bg-[var(--cy-navy)] !rounded-l-full !rounded-r-none [&>button]:!text-white [&>button]:!bg-transparent [&>button]:font-bold"
                ),
                range_end: cn(
                    defaultClassNames.range_end,
                    "!bg-[var(--cy-navy)] !rounded-r-full !rounded-l-none [&>button]:!text-white [&>button]:!bg-transparent [&>button]:font-bold"
                ),
                selected: cn(
                    defaultClassNames.selected,
                    "!bg-[var(--cy-navy)] !text-white font-bold [&>button]:!bg-transparent"
                ),
                today: cn(
                    defaultClassNames.today,
                    "[&>button]:ring-2 [&>button]:ring-[var(--cy-lime)] [&>button]:ring-inset [&>button]:rounded-full [&>button]:!bg-transparent"
                ),
                outside: cn(
                    defaultClassNames.outside,
                    "text-gray-300 opacity-40 [&>button]:!bg-transparent"
                ),
                disabled: cn(
                    defaultClassNames.disabled,
                    "text-gray-300 opacity-50 cursor-not-allowed"
                ),
                range_middle: cn(
                    defaultClassNames.range_middle,
                    "!bg-[var(--cy-navy)] !rounded-none [&>button]:!text-white [&>button]:!bg-transparent [&>button]:font-medium"
                ),
                hidden: cn(defaultClassNames.hidden, "invisible"),
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation }) =>
                    orientation === "left"
                        ? <ChevronLeft className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
            }}
            // @ts-ignore
            {...props}
        />
    )
}
Calendar.displayName = "Calendar"

export { Calendar }
