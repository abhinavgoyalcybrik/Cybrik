'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    Upload,
    Download,
    Eye,
    Copy,
    RotateCcw,
    FileJson,
    AlertCircle,
    CheckCircle2,
    AlertTriangle,
} from 'lucide-react';

interface PassageItem {
    item_id: string;
    number: number;
    prompt: string;
    group_id: string;
    group_type: string;
    answer_type: string;
    answer_value: string;
    start_index: number | null;
    stop_index: number | null;
}

interface Passage {
    passage_id: string;
    title: string;
    text: string;
    groups: any[];
}

interface TestData {
    passages: Passage[];
}

export default function IndexCheckerPage() {
    const { isAdmin, isLoading: authLoading } = useAuth();
    const router = useRouter();

    // State
    const [raw, setRaw] = useState<TestData | null>(null);
    const [passageIndex, setPassageIndex] = useState(0);
    const [groupFilter, setGroupFilter] = useState('');
    const [edits, setEdits] = useState<Map<string, { start_index: number; stop_index: number }>>(new Map());
    const [activeItemId, setActiveItemId] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

    const passage = raw?.passages?.[passageIndex] || null;
    const passageText = passage?.text || '';

    // Collect items from current passage
    const allItems = useMemo(() => {
        if (!passage?.groups) return [];
        const out: PassageItem[] = [];
        for (const g of passage.groups) {
            const gId = g.group_id || '';
            const gType = g.type || '';
            const items = g.items || [];
            for (const it of items) {
                const ans = it.answer || {};
                out.push({
                    item_id: it.item_id,
                    number: it.number,
                    prompt: it.prompt || '',
                    group_id: gId,
                    group_type: gType,
                    answer_type: ans.type || '',
                    answer_value: ans.value ?? '',
                    start_index: typeof ans.start_index === 'number' ? ans.start_index : null,
                    stop_index: typeof ans.stop_index === 'number' ? ans.stop_index : null,
                });
            }
        }
        return out.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    }, [passage]);

    // Unique groups for filter
    const groups = useMemo(() => {
        return Array.from(new Set(allItems.map(x => x.group_id))).filter(Boolean);
    }, [allItems]);

    // Filtered items
    const visibleItems = useMemo(() => {
        if (!groupFilter) return allItems;
        return allItems.filter(x => x.group_id === groupFilter);
    }, [allItems, groupFilter]);

    // Get edited or original values
    const getEditedOrOriginal = useCallback((item: PassageItem) => {
        const e = edits.get(item.item_id);
        return {
            start: e?.start_index ?? item.start_index,
            stop: e?.stop_index ?? item.stop_index,
        };
    }, [edits]);

    // Index status helper
    const indexStatus = (start: number | null, stop: number | null, textLen: number) => {
        if (start === null || stop === null) return { cls: 'warning', label: 'missing' };
        if (start < 0 || stop < 0) return { cls: 'error', label: 'negative' };
        if (stop <= start) return { cls: 'error', label: 'stop<=start' };
        if (start >= textLen) return { cls: 'error', label: 'start>=len' };
        if (stop > textLen) return { cls: 'warning', label: 'stop>len' };
        return { cls: 'success', label: 'ok' };
    };

    // Handle file upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            setRaw(data);
            setPassageIndex(0);
            setGroupFilter('');
            setEdits(new Map());
            setActiveItemId(null);
        } catch (err) {
            alert('Invalid JSON file');
        }
    };

    // Update edit
    const updateEdit = (itemId: string, startVal: string, stopVal: string) => {
        const s = startVal === '' ? null : Number(startVal);
        const t = stopVal === '' ? null : Number(stopVal);

        if (typeof s === 'number' && Number.isFinite(s) && typeof t === 'number' && Number.isFinite(t)) {
            setEdits(prev => new Map(prev).set(itemId, { start_index: s, stop_index: t }));
        } else {
            setEdits(prev => {
                const copy = new Map(prev);
                copy.delete(itemId);
                return copy;
            });
        }
    };

    // Reset edit
    const resetEdit = (item: PassageItem) => {
        setEdits(prev => {
            const copy = new Map(prev);
            copy.delete(item.item_id);
            return copy;
        });
    };

    // Export patched JSON
    const exportEdits = () => {
        if (!raw || !passage) return;
        const patched = JSON.parse(JSON.stringify(raw));
        const p = patched.passages[passageIndex];

        for (const [itemId, val] of edits.entries()) {
            for (const g of p.groups || []) {
                for (const it of g.items || []) {
                    if (it.item_id === itemId) {
                        it.answer = it.answer || {};
                        it.answer.start_index = val.start_index;
                        it.answer.stop_index = val.stop_index;
                    }
                }
            }
        }

        const blob = new Blob([JSON.stringify(patched, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `patched_${passage.passage_id || 'passage'}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    // Render passage with highlights
    const renderPassage = () => {
        if (!passageText) return <p className="text-slate-400 italic">No passage loaded</p>;

        const segs: { start: number; stop: number; item_id: string }[] = [];
        for (const it of visibleItems) {
            const { start, stop } = getEditedOrOriginal(it);
            if (typeof start !== 'number' || typeof stop !== 'number') continue;
            if (start < 0 || stop <= start || start >= passageText.length) continue;
            segs.push({ start, stop: Math.min(stop, passageText.length), item_id: it.item_id });
        }
        segs.sort((a, b) => a.start - b.start || a.stop - b.stop);

        const boundaries = new Set([0, passageText.length]);
        for (const s of segs) {
            boundaries.add(s.start);
            boundaries.add(s.stop);
        }
        const points = Array.from(boundaries).sort((a, b) => a - b);

        const parts: React.ReactNode[] = [];
        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i], b = points[i + 1];
            const chunk = passageText.slice(a, b);
            const covering = segs.filter(s => s.start <= a && s.stop >= b);

            if (covering.length === 0) {
                parts.push(<span key={i}>{chunk}</span>);
            } else {
                const primary = covering[0].item_id;
                const isActive = primary === activeItemId;
                parts.push(
                    <mark
                        key={i}
                        className={`px-0.5 rounded cursor-pointer ${isActive
                            ? 'bg-amber-200 ring-2 ring-amber-400'
                            : 'bg-green-100 hover:bg-green-200'
                            }`}
                        onClick={() => setActiveItemId(primary)}
                        title={covering.map(x => x.item_id).join(', ')}
                    >
                        {chunk}
                    </mark>
                );
            }
        }

        return <>{parts}</>;
    };

    // Copy substring
    const copySubstring = (item: PassageItem) => {
        const { start, stop } = getEditedOrOriginal(item);
        if (typeof start !== 'number' || typeof stop !== 'number') return;
        const sub = passageText.slice(
            Math.max(0, start),
            Math.min(passageText.length, stop)
        );
        navigator.clipboard?.writeText(sub);
    };

    if (authLoading || !isAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title="Index Checker"
            subtitle="Verify startIndex/stopIndex for reading test questions"
            actions={
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm transition-colors cursor-pointer">
                        <Upload className="w-5 h-5" />
                        Upload JSON
                        <input
                            type="file"
                            accept=".json,application/json"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                    </label>
                    {raw && (
                        <button
                            onClick={exportEdits}
                            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium shadow-sm transition-colors"
                        >
                            <Download className="w-5 h-5" />
                            Export Edits
                        </button>
                    )}
                </div>
            }
        >
            {!raw ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                    <div className="inline-flex p-4 rounded-full bg-blue-50 mb-4">
                        <FileJson className="w-10 h-10 text-blue-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Upload a Test JSON</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-6">
                        Click "Upload JSON" to load a reading test and verify the start/stop indexes for each question.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Panel - Controls & Questions */}
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Passage</label>
                                    <select
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={passageIndex}
                                        onChange={(e) => {
                                            setPassageIndex(Number(e.target.value));
                                            setGroupFilter('');
                                            setEdits(new Map());
                                            setActiveItemId(null);
                                        }}
                                    >
                                        {raw.passages.map((p, i) => (
                                            <option key={i} value={i}>
                                                {p.passage_id}: {p.title || 'Untitled'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Group Filter</label>
                                    <select
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={groupFilter}
                                        onChange={(e) => setGroupFilter(e.target.value)}
                                    >
                                        <option value="">All groups</option>
                                        {groups.map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
                                <span>Questions: <strong className="text-slate-900">{allItems.length}</strong></span>
                                <span>Visible: <strong className="text-slate-900">{visibleItems.length}</strong></span>
                                <span>Passage length: <strong className="text-slate-900">{passageText.length}</strong></span>
                            </div>
                        </div>

                        {/* Questions List */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm max-h-[60vh] overflow-y-auto">
                            <div className="p-3 border-b border-slate-200 bg-slate-50 sticky top-0">
                                <h3 className="font-semibold text-slate-900">Questions</h3>
                            </div>
                            <div className="p-3 space-y-3">
                                {visibleItems.map((item) => {
                                    const { start, stop } = getEditedOrOriginal(item);
                                    const status = indexStatus(start, stop, passageText.length);
                                    const isActive = item.item_id === activeItemId;
                                    const preview = (typeof start === 'number' && typeof stop === 'number')
                                        ? passageText.slice(Math.max(0, start), Math.min(passageText.length, stop))
                                        : '';

                                    return (
                                        <div
                                            key={item.item_id}
                                            className={`p-3 rounded-xl border transition-all ${isActive
                                                ? 'border-amber-400 bg-amber-50'
                                                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="font-bold text-slate-900">Q{item.number}</span>
                                                        <span className="text-slate-400">({item.group_type} / {item.answer_type})</span>
                                                        {status.cls === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                                        {status.cls === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                                                        {status.cls === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                                        <span className={`text-xs font-medium ${status.cls === 'success' ? 'text-green-600' :
                                                            status.cls === 'warning' ? 'text-amber-600' : 'text-red-600'
                                                            }`}>
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1 truncate">{item.prompt || '(no prompt)'}</p>
                                                </div>
                                                <span className="text-xs px-2 py-1 bg-slate-200 text-slate-600 rounded-full">{item.group_id}</span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mt-3">
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">start_index</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg font-mono"
                                                        value={start ?? ''}
                                                        onChange={(e) => updateEdit(item.item_id, e.target.value, String(stop ?? ''))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">stop_index</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg font-mono"
                                                        value={stop ?? ''}
                                                        onChange={(e) => updateEdit(item.item_id, String(start ?? ''), e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 mt-3">
                                                <button
                                                    onClick={() => setActiveItemId(item.item_id)}
                                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                                                >
                                                    <Eye className="w-3 h-3" /> Highlight
                                                </button>
                                                <button
                                                    onClick={() => copySubstring(item)}
                                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                                                >
                                                    <Copy className="w-3 h-3" /> Copy
                                                </button>
                                                <button
                                                    onClick={() => resetEdit(item)}
                                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                                                >
                                                    <RotateCcw className="w-3 h-3" /> Reset
                                                </button>
                                            </div>

                                            {preview && (
                                                <div className="mt-2 p-2 bg-white rounded-lg border border-slate-200 text-xs font-mono text-slate-600 max-h-20 overflow-auto whitespace-pre-wrap">
                                                    {preview}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Passage */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                            <h3 className="font-semibold text-slate-900">{passage?.title || 'No passage'}</h3>
                            <p className="text-sm text-slate-500 mt-1">{passage?.passage_id}</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                {renderPassage()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
