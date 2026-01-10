import React from 'react';

export function BarChart({ data, height = 200 }: { data: { label: string; value: number }[]; height?: number }) {
    const maxValue = Math.max(...data.map(d => d.value), 1);

    return (
        <div className="flex items-end justify-between gap-2" style={{ height }}>
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full bg-[var(--cy-bg-page)] rounded-t-md relative overflow-hidden h-full flex items-end">
                        <div
                            className="w-full bg-[var(--cy-navy)] opacity-80 group-hover:opacity-100 transition-all duration-500 rounded-t-md"
                            style={{ height: `${(d.value / maxValue) * 100}%` }}
                        />
                    </div>
                    <span className="text-xs text-[var(--cy-text-muted)] font-medium truncate w-full text-center">
                        {d.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

export function DonutChart({ data, size = 160 }: { data: { label: string; value: number; color?: string }[]; size?: number }) {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    let currentAngle = 0;

    // Default colors if not provided
    const colors = ['#0B1F3A', '#6FB63A', '#10B981', '#F59E0B', '#EF4444'];

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox="0 0 100 100" className="transform -rotate-90">
                {data.map((d, i) => {
                    const percentage = d.value / total;
                    const dashArray = percentage * 314; // 2 * PI * R (R=50) -> but we use r=40 so 2*PI*40 ≈ 251
                    // Using r=40, circumference = 2 * PI * 40 ≈ 251.3
                    const circumference = 251.3;
                    const strokeDasharray = `${percentage * circumference} ${circumference}`;
                    const strokeDashoffset = -currentAngle * circumference;

                    currentAngle += percentage;

                    return (
                        <circle
                            key={i}
                            cx="50"
                            cy="50"
                            r="40"
                            fill="transparent"
                            stroke={d.color || colors[i % colors.length]}
                            strokeWidth="12"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset} // This needs to be calculated cumulatively
                            className="transition-all duration-1000 ease-out"
                            style={{ transformOrigin: 'center' }}
                        />
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-[var(--cy-navy)]">{total}</span>
                <span className="text-xs text-[var(--cy-text-muted)] uppercase">Total</span>
            </div>
        </div>
    );
}

export function HorizontalBarChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
    const maxValue = Math.max(...data.map(d => d.value), 1);

    return (
        <div className="space-y-4">
            {data.map((d, i) => (
                <div key={i} className="group">
                    <div className="flex justify-between text-sm font-medium mb-1">
                        <span className="text-[var(--cy-text-primary)]">{d.label}</span>
                        <span className="text-[var(--cy-text-secondary)]">{d.value}</span>
                    </div>
                    <div className="w-full bg-[var(--cy-bg-page)] rounded-full h-2 overflow-hidden">
                        <div
                            className="h-2 rounded-full transition-all duration-1000 ease-out"
                            style={{
                                width: `${(d.value / maxValue) * 100}%`,
                                backgroundColor: d.color || 'var(--cy-navy)'
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
