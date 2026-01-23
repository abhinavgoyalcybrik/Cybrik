'use client';

import React, { useState, useMemo, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Upload, Download, Search, X, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

// --- Types ---
interface Answer {
    type?: string;
    value?: any;
    start_index?: number; // 0-based, inclusive
    stop_index?: number;  // 0-based, exclusive
}

interface Item {
    item_id: string;
    number?: number;
    prompt?: string;
    answer?: Answer;
}

interface Group {
    group_id?: string;
    type?: string;
    items?: Item[];
}

interface Passage {
    passage_id?: string;
    title?: string;
    text: string;
    groups?: Group[];
}

interface TestData {
    passages?: Passage[];
    [key: string]: any;
}

interface EditMap {
    [itemId: string]: { start_index: number; stop_index: number };
}

// --- Helper: Flatten Items ---
const collectItems = (p: Passage | null) => {
    if (!p?.groups) return [];
    const out: any[] = [];
    p.groups.forEach(g => {
        (g.items || []).forEach(it => {
            out.push({
                ...it,
                group_id: g.group_id,
                group_type: g.type,
            });
        });
    });
    return out.sort((a, b) => (a.number || 0) - (b.number || 0));
};

export default function IndexCheckerPage() {
    // --- State ---
    const [raw, setRaw] = useState<TestData | null>(null);
    const [passageIdx, setPassageIdx] = useState<number>(0);
    const [activeItemId, setActiveItemId] = useState<string | null>(null);
    const [edits, setEdits] = useState<EditMap>({});
    const [groupFilter, setGroupFilter] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Derived State ---
    const passage = raw?.passages?.[passageIdx] || null;
    const items = useMemo(() => collectItems(passage), [passage]);

    // Get visible items based on filter
    const visibleItems = useMemo(() => {
        if (!groupFilter) return items;
        return items.filter(it => it.group_id === groupFilter);
    }, [items, groupFilter]);

    // Get current groups for filter dropdown
    const groups = useMemo(() => {
        return Array.from(new Set(items.map(it => it.group_id))).filter(Boolean) as string[];
    }, [items]);

    // --- Actions ---

    // Handle File Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const json = JSON.parse(text);
            setRaw(json);
            setPassageIdx(0);
            setEdits({});
            setActiveItemId(null);
        } catch (err) {
            alert('Invalid JSON file');
            console.error(err);
        }
    };

    // Handle Edit Change
    const handleEdit = (itemId: string, field: 'start' | 'stop', value: string) => {
        const num = parseInt(value, 10);
        if (isNaN(num)) return; // Or handle empty to clear?

        setEdits(prev => {
            const current = prev[itemId] || {
                start_index: items.find(i => i.item_id === itemId)?.answer?.start_index || 0,
                stop_index: items.find(i => i.item_id === itemId)?.answer?.stop_index || 0
            };

            const next = { ...current };
            if (field === 'start') next.start_index = num;
            else next.stop_index = num;

            // If matches original, remove from edits (optional optimization)
            return { ...prev, [itemId]: next };
        });
    };

    const clearEdit = (itemId: string) => {
        setEdits(prev => {
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
    };

    // Export Edits
    const exportEdits = () => {
        if (!raw || !passage) return;

        // Deep copy
        const patched = JSON.parse(JSON.stringify(raw));
        const p = patched.passages[passageIdx];

        // Apply edits
        p.groups?.forEach((g: Group) => {
            g.items?.forEach((it: Item) => {
                if (edits[it.item_id]) {
                    it.answer = {
                        ...it.answer,
                        ...edits[it.item_id]
                    };
                }
            });
        });

        const blob = new Blob([JSON.stringify(patched, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `patched_${passage.passage_id || 'passage'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- Render Helpers ---

    // Helper to get effective start/stop for an item
    const getRange = (item: any) => {
        const edit = edits[item.item_id];
        const start = edit?.start_index ?? item.answer?.start_index;
        const stop = edit?.stop_index ?? item.answer?.stop_index;
        return { start, stop };
    };

    // Render Passage Text with Highlights
    const renderPassageText = () => {
        if (!passage) return null;
        const text = passage.text || '';
        if (!text) return <div className="text-zinc-500 italic">No text content</div>;

        // 1. Build segments
        // We need to split the text at every start/stop point of VISIBLE items
        const boundaries = new Set<number>([0, text.length]);
        const ranges: { start: number; stop: number; itemId: string }[] = [];

        visibleItems.forEach(it => {
            const { start, stop } = getRange(it);
            if (typeof start === 'number' && typeof stop === 'number' && start >= 0 && stop > start) {
                // Clamp to text length
                const s = Math.max(0, Math.min(start, text.length));
                const e = Math.max(0, Math.min(stop, text.length));
                if (s < e) {
                    ranges.push({ start: s, stop: e, itemId: it.item_id });
                    boundaries.add(s);
                    boundaries.add(e);
                }
            }
        });

        const points = Array.from(boundaries).sort((a, b) => a - b);
        const segments = [];

        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i];
            const b = points[i + 1];
            const chunk = text.slice(a, b);

            // Find all items covering this chunk
            const covering = ranges.filter(r => r.start <= a && r.stop >= b);

            if (covering.length > 0) {
                // Determine active status
                const isActive = covering.some(c => c.itemId === activeItemId);
                // Highlight color logic
                let bgClass = isActive
                    ? 'bg-yellow-400/40 outline outline-2 outline-yellow-400'
                    : 'bg-green-400/30 hover:bg-green-400/50';

                // If multiple items cover this, maybe show darker?
                if (covering.length > 1 && !isActive) {
                    bgClass = 'bg-blue-400/30 hover:bg-blue-400/50';
                }

                segments.push(
                    <mark
                        key={i}
                        className={`cursor-pointer transition-colors rounded-sm ${bgClass} text-inherit`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveItemId(covering[0].itemId); // Select first one
                        }}
                        title={`Items: ${covering.map(c => c.itemId).join(', ')}`}
                    >
                        {chunk}
                    </mark>
                );
            } else {
                segments.push(<span key={i}>{chunk}</span>);
            }
        }

        return (
            <div className="font-sans text-sm leading-relaxed whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-200">
                {segments}
            </div>
        );
    };

    return (
        <AdminLayout
            title="Index Checker"
            subtitle="Verify and fix start/stop indexes for reading tests"
        >
            <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 h-[calc(100vh-140px)]">

                {/* --- Left Panel: Controls --- */}
                <div className="flex flex-col gap-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    {/* Header Controls */}
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-4">

                        {/* File Upload */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium"
                            >
                                <Upload className="w-4 h-4" />
                                {raw ? 'Load Different JSON' : 'Upload JSON File'}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json,application/json"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            {raw && (
                                <button
                                    onClick={exportEdits}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-sm font-medium"
                                    title="Export Edits"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Filters */}
                        {raw && (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Passage</label>
                                    <select
                                        value={passageIdx}
                                        onChange={(e) => {
                                            setPassageIdx(Number(e.target.value));
                                            setEdits({}); // Clear edits on passage switch for safety
                                            setActiveItemId(null);
                                        }}
                                        className="w-full text-sm bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 rounded-lg p-2"
                                    >
                                        {raw.passages?.map((p, i) => (
                                            <option key={i} value={i}>
                                                {p.passage_id || `Passage ${i + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Group Filter</label>
                                    <select
                                        value={groupFilter}
                                        onChange={(e) => setGroupFilter(e.target.value)}
                                        className="w-full text-sm bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 rounded-lg p-2"
                                    >
                                        <option value="">All Groups</option>
                                        {groups.map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Question List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {!raw ? (
                            <div className="text-center py-12 text-zinc-500 text-sm">
                                Upload a JSON file to get started
                            </div>
                        ) : visibleItems.length === 0 ? (
                            <div className="text-center py-12 text-zinc-500 text-sm">
                                No questions found in this view
                            </div>
                        ) : (
                            visibleItems.map(item => {
                                const { start, stop } = getRange(item);
                                const isActive = activeItemId === item.item_id;
                                const hasRange = typeof start === 'number' && typeof stop === 'number';
                                const validRange = hasRange && start! >= 0 && stop! > start!;
                                const textLen = passage?.text.length || 0;
                                const outOfBounds = hasRange && (start! >= textLen || stop! > textLen);

                                return (
                                    <div
                                        key={item.item_id}
                                        id={`q-${item.item_id}`}
                                        className={`p-3 rounded-lg border text-sm transition-all cursor-pointer ${isActive
                                                ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-300 dark:border-blue-700 ring-1 ring-blue-300 dark:ring-blue-700'
                                                : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                            }`}
                                        onClick={() => setActiveItemId(item.item_id)}
                                    >
                                        {/* Header */}
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-zinc-700 dark:text-zinc-200">Q{item.number}</span>
                                                <span className="text-xs text-zinc-400 font-mono">{item.item_id}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {outOfBounds ? (
                                                    <span className="text-[10px] uppercase font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">Bounds Error</span>
                                                ) : !validRange ? (
                                                    <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Missing</span>
                                                ) : (
                                                    <span className="text-[10px] uppercase font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">OK</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Prompt */}
                                        <p className="text-zinc-600 dark:text-zinc-400 text-xs mb-3 line-clamp-2" title={item.prompt}>
                                            {item.prompt || '(No prompt)'}
                                        </p>

                                        {/* Inputs */}
                                        {isActive && (
                                            <div className="grid grid-cols-2 gap-2 bg-white dark:bg-black/20 p-2 rounded border border-zinc-200 dark:border-zinc-700 mb-2" onClick={e => e.stopPropagation()}>
                                                <div>
                                                    <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">Start</label>
                                                    <input
                                                        type="number"
                                                        value={isFinite(start as number) ? start : ''}
                                                        onChange={(e) => handleEdit(item.item_id, 'start', e.target.value)}
                                                        className="w-full text-xs p-1 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">Stop</label>
                                                    <input
                                                        type="number"
                                                        value={isFinite(stop as number) ? stop : ''}
                                                        onChange={(e) => handleEdit(item.item_id, 'stop', e.target.value)}
                                                        className="w-full text-xs p-1 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Preview of active text */}
                                        {validRange && !outOfBounds && isActive && passage && (
                                            <div className="bg-zinc-100 dark:bg-zinc-900 rounded p-2 text-xs font-mono text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-all border border-zinc-200 dark:border-zinc-800">
                                                {passage.text.slice(start!, stop!)}
                                            </div>
                                        )}

                                        {/* Action: Clear */}
                                        {edits[item.item_id] && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); clearEdit(item.item_id); }}
                                                className="mt-2 text-xs text-blue-500 hover:underline flex items-center gap-1"
                                            >
                                                <X className="w-3 h-3" /> Reset to Original
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* --- Right Panel: Passage --- */}
                <div className="flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
                        <div>
                            <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {passage ? (passage.title || 'Untitled Passage') : 'Passage Viewer'}
                            </h2>
                            <p className="text-xs text-zinc-500">
                                {passage ? `Length: ${passage.text.length} chars` : 'Select a JSON file to view contents'}
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-6 bg-white dark:bg-zinc-950">
                        {renderPassageText()}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
