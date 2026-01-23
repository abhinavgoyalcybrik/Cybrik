'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Play, TrendingUp, Target, ArrowRight, PenTool, Headphones, BookOpen, Mic, Check, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface SectionStats {
    averageScore: number;
    testsCompleted: number;
}

interface TestCounts {
    speaking: number;
    writing: number;
    listening: number;
    reading: number;
}

interface DashboardGettingStartedProps {
    sectionStats?: { [key: string]: SectionStats };
    completedCounts?: { [key: string]: number };
}

interface RecommendedTask {
    id: string;
    type: 'daily_goal' | 'focus_area' | 'quick_start';
    label: string;
    title: string;
    description: string;
    module: 'reading' | 'writing' | 'listening' | 'speaking';
    href: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
}

const MODULE_CONFIG = {
    listening: {
        icon: <Headphones className="w-6 h-6" />,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-l-indigo-500',
        href: '/tests/listening',
    },
    reading: {
        icon: <BookOpen className="w-6 h-6" />,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-l-emerald-500',
        href: '/tests/reading',
    },
    writing: {
        icon: <PenTool className="w-6 h-6" />,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-l-orange-500',
        href: '/tests/writing',
    },
    speaking: {
        icon: <Mic className="w-6 h-6" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-l-blue-500',
        href: '/tests/speaking',
    },
};

const STORAGE_KEY = 'ielts_completed_recommendations';

interface CompletedTasks {
    date: string;
    taskIds: string[];
    lastCompletedCounts: Record<string, number>;
}

function getStoredTasks(): CompletedTasks {
    if (typeof window === 'undefined') return { date: '', taskIds: [], lastCompletedCounts: {} };
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) { /* ignore */ }
    return { date: '', taskIds: [], lastCompletedCounts: {} };
}

function saveStoredTasks(tasks: CompletedTasks) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
}

export default function DashboardGettingStarted({ sectionStats = {}, completedCounts = {} }: DashboardGettingStartedProps) {
    const [tasks, setTasks] = useState<RecommendedTask[]>([]);
    const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Generate recommendations based on user stats
    const generateRecommendations = useCallback((excludeIds: string[] = []): RecommendedTask[] => {
        const modules = ['listening', 'reading', 'writing', 'speaking'] as const;
        const recommendations: RecommendedTask[] = [];

        // Calculate metrics for each module
        const moduleMetrics = modules.map(module => ({
            module,
            completed: completedCounts[module] || 0,
            avgScore: sectionStats[module]?.averageScore || 0,
        }));

        // Sort by lowest score (weakest area first)
        const byWeakness = [...moduleMetrics].sort((a, b) => a.avgScore - b.avgScore);

        // Sort by least completed (needs more practice)
        const byCompletion = [...moduleMetrics].sort((a, b) => a.completed - b.completed);

        // Daily Goal: Module with fewest completions (rotate daily)
        const dailyModule = byCompletion[0].module;
        const dailyConfig = MODULE_CONFIG[dailyModule];
        const dailyId = `daily_${dailyModule}_${getTodayDate()}`;

        if (!excludeIds.includes(dailyId)) {
            recommendations.push({
                id: dailyId,
                type: 'daily_goal',
                label: 'DAILY GOAL',
                title: `Complete 1 ${dailyModule.charAt(0).toUpperCase() + dailyModule.slice(1)} Test`,
                description: 'Estimated time: 30 mins',
                module: dailyModule,
                href: dailyConfig.href,
                icon: dailyConfig.icon,
                color: dailyConfig.color,
                bgColor: dailyConfig.bgColor,
                borderColor: dailyConfig.borderColor,
            });
        } else {
            // Generate alternative daily goal
            const altModule = byCompletion[1]?.module || modules[Math.floor(Math.random() * modules.length)];
            const altConfig = MODULE_CONFIG[altModule];
            recommendations.push({
                id: `daily_${altModule}_alt_${Date.now()}`,
                type: 'daily_goal',
                label: 'DAILY GOAL',
                title: `Complete 1 ${altModule.charAt(0).toUpperCase() + altModule.slice(1)} Test`,
                description: 'Keep your streak going!',
                module: altModule,
                href: altConfig.href,
                icon: altConfig.icon,
                color: altConfig.color,
                bgColor: altConfig.bgColor,
                borderColor: altConfig.borderColor,
            });
        }

        // Focus Area: Weakest module (lowest average score)
        const weakestModule = byWeakness[0].module;
        const weakConfig = MODULE_CONFIG[weakestModule];
        const focusId = `focus_${weakestModule}_${getTodayDate()}`;

        if (!excludeIds.includes(focusId)) {
            recommendations.push({
                id: focusId,
                type: 'focus_area',
                label: 'FOCUS AREA',
                title: `Improve your ${weakestModule.charAt(0).toUpperCase() + weakestModule.slice(1)}`,
                description: byWeakness[0].avgScore > 0
                    ? `Current avg: ${byWeakness[0].avgScore.toFixed(1)} - Let's improve!`
                    : 'Based on your recent performance',
                module: weakestModule,
                href: weakConfig.href,
                icon: <TrendingUp className="w-6 h-6" />,
                color: weakConfig.color,
                bgColor: weakConfig.bgColor,
                borderColor: weakConfig.borderColor,
            });
        } else {
            // Generate alternative focus
            const altWeak = byWeakness[1]?.module || modules[Math.floor(Math.random() * modules.length)];
            const altWeakConfig = MODULE_CONFIG[altWeak];
            recommendations.push({
                id: `focus_${altWeak}_alt_${Date.now()}`,
                type: 'focus_area',
                label: 'FOCUS AREA',
                title: `Practice ${altWeak.charAt(0).toUpperCase() + altWeak.slice(1)} Skills`,
                description: 'Strengthen your abilities',
                module: altWeak,
                href: altWeakConfig.href,
                icon: <TrendingUp className="w-6 h-6" />,
                color: altWeakConfig.color,
                bgColor: altWeakConfig.bgColor,
                borderColor: altWeakConfig.borderColor,
            });
        }

        // Quick Start: Random module for variety
        const quickModules = modules.filter(m => m !== dailyModule && m !== weakestModule);
        const quickModule = quickModules[Math.floor(Math.random() * quickModules.length)] || 'reading';
        const quickConfig = MODULE_CONFIG[quickModule];
        const quickId = `quick_${quickModule}_${getTodayDate()}`;

        if (!excludeIds.includes(quickId)) {
            recommendations.push({
                id: quickId,
                type: 'quick_start',
                label: 'QUICK START',
                title: `Take a ${quickModule.charAt(0).toUpperCase() + quickModule.slice(1)} Mock`,
                description: 'Challenge yourself today',
                module: quickModule,
                href: quickConfig.href,
                icon: <Play className="w-6 h-6" />,
                color: quickConfig.color,
                bgColor: quickConfig.bgColor,
                borderColor: quickConfig.borderColor,
            });
        } else {
            const altQuick = modules[Math.floor(Math.random() * modules.length)];
            const altQuickConfig = MODULE_CONFIG[altQuick];
            recommendations.push({
                id: `quick_${altQuick}_alt_${Date.now()}`,
                type: 'quick_start',
                label: 'QUICK START',
                title: `Try a ${altQuick.charAt(0).toUpperCase() + altQuick.slice(1)} Test`,
                description: 'Quick practice session',
                module: altQuick,
                href: altQuickConfig.href,
                icon: <Play className="w-6 h-6" />,
                color: altQuickConfig.color,
                bgColor: altQuickConfig.bgColor,
                borderColor: altQuickConfig.borderColor,
            });
        }

        return recommendations;
    }, [completedCounts, sectionStats]);

    // Check if any test was completed and mark corresponding task as done
    useEffect(() => {
        const stored = getStoredTasks();
        const today = getTodayDate();

        // Reset if new day
        if (stored.date !== today) {
            stored.date = today;
            stored.taskIds = [];
            stored.lastCompletedCounts = { ...completedCounts };
            saveStoredTasks(stored);
        }

        // Check if completedCounts increased (user completed a test)
        const lastCounts = stored.lastCompletedCounts || {};
        const newlyCompleted: string[] = [];

        Object.keys(completedCounts).forEach(module => {
            const current = completedCounts[module] || 0;
            const last = lastCounts[module] || 0;
            if (current > last) {
                // Mark tasks for this module as completed
                tasks.forEach(task => {
                    if (task.module === module && !stored.taskIds.includes(task.id)) {
                        newlyCompleted.push(task.id);
                    }
                });
            }
        });

        if (newlyCompleted.length > 0) {
            const updatedIds = [...stored.taskIds, ...newlyCompleted];
            setCompletedTaskIds(updatedIds);
            saveStoredTasks({
                date: today,
                taskIds: updatedIds,
                lastCompletedCounts: { ...completedCounts },
            });
        } else {
            setCompletedTaskIds(stored.taskIds);
        }

        // Update last counts
        if (JSON.stringify(stored.lastCompletedCounts) !== JSON.stringify(completedCounts)) {
            stored.lastCompletedCounts = { ...completedCounts };
            saveStoredTasks(stored);
        }
    }, [completedCounts, tasks]);

    // Generate initial recommendations
    useEffect(() => {
        const stored = getStoredTasks();
        const recommendations = generateRecommendations(stored.taskIds);
        setTasks(recommendations);
        setCompletedTaskIds(stored.taskIds);
    }, [generateRecommendations]);

    // Handle refresh/regenerate
    const handleRefresh = () => {
        setIsRefreshing(true);
        const stored = getStoredTasks();
        const newTasks = generateRecommendations(stored.taskIds);
        setTasks(newTasks);
        setTimeout(() => setIsRefreshing(false), 500);
    };

    // Mark a task as complete manually (for testing or user action)
    const markTaskComplete = (taskId: string) => {
        const stored = getStoredTasks();
        if (!stored.taskIds.includes(taskId)) {
            stored.taskIds.push(taskId);
            stored.date = getTodayDate();
            saveStoredTasks(stored);
            setCompletedTaskIds([...stored.taskIds]);

            // Generate new task to replace completed one
            setTimeout(() => {
                const newTasks = generateRecommendations(stored.taskIds);
                setTasks(newTasks);
            }, 300);
        }
    };

    const dailyGoal = tasks.find(t => t.type === 'daily_goal');
    const focusArea = tasks.find(t => t.type === 'focus_area');
    const quickStart = tasks.find(t => t.type === 'quick_start');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                        <Target className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Recommended Actions</h2>
                        <p className="text-sm text-slate-500">Curated specifically for your progress</p>
                    </div>
                </div>
                <button
                    onClick={handleRefresh}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Refresh recommendations"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="space-y-4">
                {/* Daily Goal Card */}
                {dailyGoal && (
                    <div className={`bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-1 shadow-sm group transition-all ${completedTaskIds.includes(dailyGoal.id) ? 'opacity-75' : 'hover:scale-[1.01]'}`}>
                        <div className="bg-white rounded-xl p-5 h-full flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 ${dailyGoal.bgColor} ${dailyGoal.color} rounded-xl relative`}>
                                    {dailyGoal.icon}
                                    {completedTaskIds.includes(dailyGoal.id) && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
                                        {dailyGoal.label}
                                        {completedTaskIds.includes(dailyGoal.id) && (
                                            <span className="ml-2 text-green-600">✓ Completed</span>
                                        )}
                                    </div>
                                    <h3 className={`font-bold text-lg ${completedTaskIds.includes(dailyGoal.id) ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                        {dailyGoal.title}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">{dailyGoal.description}</p>
                                </div>
                            </div>
                            {completedTaskIds.includes(dailyGoal.id) ? (
                                <button
                                    onClick={() => {
                                        const stored = getStoredTasks();
                                        stored.taskIds = stored.taskIds.filter(id => id !== dailyGoal.id);
                                        saveStoredTasks(stored);
                                        handleRefresh();
                                    }}
                                    className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors"
                                >
                                    New Task
                                </button>
                            ) : (
                                <Link href={dailyGoal.href} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                                    Start Now
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {/* Focus Area Card */}
                {focusArea && (
                    <div className={`bg-white rounded-2xl p-5 border border-slate-100 shadow-sm transition-all group border-l-4 ${focusArea.borderColor} ${completedTaskIds.includes(focusArea.id) ? 'opacity-75' : 'hover:shadow-md'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 ${focusArea.bgColor} ${focusArea.color} rounded-xl relative`}>
                                    {focusArea.icon}
                                    {completedTaskIds.includes(focusArea.id) && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${focusArea.color}`}>
                                        {focusArea.label}
                                        {completedTaskIds.includes(focusArea.id) && (
                                            <span className="ml-2 text-green-600">✓ Done</span>
                                        )}
                                    </div>
                                    <h3 className={`font-bold text-lg ${completedTaskIds.includes(focusArea.id) ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                        {focusArea.title}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">{focusArea.description}</p>
                                </div>
                            </div>
                            {completedTaskIds.includes(focusArea.id) ? (
                                <button
                                    onClick={() => {
                                        const stored = getStoredTasks();
                                        stored.taskIds = stored.taskIds.filter(id => id !== focusArea.id);
                                        saveStoredTasks(stored);
                                        handleRefresh();
                                    }}
                                    className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium transition-colors"
                                >
                                    <span className="text-sm">New Task</span>
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            ) : (
                                <Link href={focusArea.href} className={`flex items-center gap-2 text-slate-600 hover:${focusArea.color} font-medium transition-colors`}>
                                    <span className="text-sm">Practice</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {/* Quick Action Card */}
                {quickStart && (
                    <div className={`bg-white rounded-2xl p-5 border border-slate-100 shadow-sm transition-all group border-l-4 ${quickStart.borderColor} ${completedTaskIds.includes(quickStart.id) ? 'opacity-75' : 'hover:shadow-md'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 ${quickStart.bgColor} ${quickStart.color} rounded-xl relative`}>
                                    {quickStart.icon}
                                    {completedTaskIds.includes(quickStart.id) && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${quickStart.color}`}>
                                        {quickStart.label}
                                        {completedTaskIds.includes(quickStart.id) && (
                                            <span className="ml-2 text-green-600">✓ Done</span>
                                        )}
                                    </div>
                                    <h3 className={`font-bold text-lg ${completedTaskIds.includes(quickStart.id) ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                        {quickStart.title}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">{quickStart.description}</p>
                                </div>
                            </div>
                            {completedTaskIds.includes(quickStart.id) ? (
                                <button
                                    onClick={() => {
                                        const stored = getStoredTasks();
                                        stored.taskIds = stored.taskIds.filter(id => id !== quickStart.id);
                                        saveStoredTasks(stored);
                                        handleRefresh();
                                    }}
                                    className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium transition-colors"
                                >
                                    <span className="text-sm">New Task</span>
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            ) : (
                                <Link href={quickStart.href} className={`flex items-center gap-2 text-slate-600 hover:${quickStart.color} font-medium transition-colors`}>
                                    <span className="text-sm">Begin</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
