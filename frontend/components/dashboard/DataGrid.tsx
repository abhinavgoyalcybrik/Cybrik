import React, { useState, useMemo } from 'react';
import { Search, Filter, X } from 'lucide-react';

interface Column<T> {
    header: string;
    accessorKey?: keyof T;
    cell?: (item: T) => React.ReactNode;
    className?: string;
    enableFiltering?: boolean; // Default true
}

interface DataGridProps<T> {
    data: T[];
    columns: Column<T>[];
    title?: string;
    subtitle?: React.ReactNode;
    action?: React.ReactNode;
    enableFiltering?: boolean;
}

export default function DataGrid<T extends { id?: string | number }>({
    data,
    columns,
    title,
    subtitle,
    action,
    enableFiltering = true
}: DataGridProps<T>) {
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [showFilters, setShowFilters] = useState(false);

    const filteredData = useMemo(() => {
        if (Object.keys(filters).length === 0) return data;

        return data.filter(item => {
            return Object.entries(filters).every(([key, value]) => {
                if (!value) return true;

                // Find the column definition to check for custom logic if needed
                // For now, simple string matching on the accessor value
                const itemValue = item[key as keyof T];

                if (itemValue === null || itemValue === undefined) return false;

                return String(itemValue).toLowerCase().includes(value.toLowerCase());
            });
        });
    }, [data, filters]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => {
            const next = { ...prev, [key]: value };
            if (!value) delete next[key];
            return next;
        });
    };

    const clearFilters = () => {
        setFilters({});
    };

    return (
        <div className="card overflow-hidden">
            {(title || action || enableFiltering) && (
                <div className="px-6 py-4 border-b border-[var(--cy-border)] flex items-center justify-between bg-[var(--cy-bg-surface)]">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            {title && <h3 className="h3 text-[var(--cy-navy)]">{title}</h3>}
                            {subtitle && <div className="text-sm text-[var(--cy-text-muted)] mt-1">{subtitle}</div>}
                        </div>
                        {enableFiltering && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-outline'} gap-2`}
                                >
                                    <Filter size={14} />
                                    {showFilters ? 'Hide Filters' : 'Filter'}
                                </button>
                                {Object.keys(filters).length > 0 && (
                                    <button
                                        onClick={clearFilters}
                                        className="btn btn-sm btn-ghost text-red-500 hover:bg-red-50 gap-1"
                                    >
                                        <X size={14} /> Clear
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-[var(--cy-bg-page)] border-b border-[var(--cy-border)]">
                            {columns.map((col, i) => (
                                <th
                                    key={i}
                                    className={`px-6 py-3 text-left text-xs font-semibold text-[var(--cy-text-muted)] uppercase tracking-wider ${col.className || ''}`}
                                >
                                    <div className="flex flex-col gap-2">
                                        <span>{col.header}</span>
                                        {showFilters && enableFiltering && col.enableFiltering !== false && col.accessorKey && (
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder={`Search ${col.header}...`}
                                                    className="input py-1 px-2 text-xs w-full font-normal normal-case"
                                                    value={filters[col.accessorKey as string] || ''}
                                                    onChange={(e) => handleFilterChange(col.accessorKey as string, e.target.value)}
                                                />
                                                <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--cy-text-muted)] pointer-events-none" />
                                            </div>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--cy-border)] bg-[var(--cy-bg-surface)]">
                        {filteredData.length > 0 ? (
                            filteredData.map((item, rowIndex) => (
                                <tr key={item.id || rowIndex} className="hover:bg-[var(--cy-bg-surface-hover)] transition-colors group">
                                    {columns.map((col, colIndex) => (
                                        <td key={colIndex} className={`px-6 py-4 text-sm text-[var(--cy-text-secondary)] ${col.className || ''}`}>
                                            {col.cell ? col.cell(item) : (item[col.accessorKey as keyof T] as React.ReactNode)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-8 text-center text-[var(--cy-text-muted)]">
                                    {data.length === 0 ? "No data available" : "No results matching filters"}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Simple Footer/Pagination Placeholder */}
            <div className="px-6 py-3 border-t border-[var(--cy-border)] bg-[var(--cy-bg-page)] flex items-center justify-between text-xs text-[var(--cy-text-muted)]">
                <span>Showing {filteredData.length} of {data.length} results</span>
                <div className="flex gap-2">
                    <button className="hover:text-[var(--cy-navy)] disabled:opacity-50" disabled>Previous</button>
                    <button className="hover:text-[var(--cy-navy)] disabled:opacity-50" disabled>Next</button>
                </div>
            </div>
        </div>
    );
}
