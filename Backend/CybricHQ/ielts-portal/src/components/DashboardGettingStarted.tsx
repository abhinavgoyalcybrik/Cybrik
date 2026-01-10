'use client';

import React from 'react';
import { Play, TrendingUp, Target, ArrowRight, PenTool, Headphones } from 'lucide-react';
import Link from 'next/link';

export default function DashboardGettingStarted() {
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
            </div>

            <div className="space-y-4">
                {/* Daily Goal Card */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-1 shadow-sm group cursor-pointer transition-transform hover:scale-[1.01]">
                    <div className="bg-white rounded-xl p-5 h-full flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Headphones className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Daily Goal</div>
                                <h3 className="font-bold text-slate-900 text-lg">Complete 1 Listening Test</h3>
                                <p className="text-sm text-slate-500 mt-1">Estimated time: 30 mins</p>
                            </div>
                        </div>
                        <Link href="/tests/listening" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                            Start Now
                        </Link>
                    </div>
                </div>

                {/* Focus Area Card */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all group border-l-4 border-l-orange-500">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Focus Area</div>
                                <h3 className="font-bold text-slate-900 text-lg">Improve your Writing</h3>
                                <p className="text-sm text-slate-500 mt-1">Based on your recent performance</p>
                            </div>
                        </div>
                        <Link href="/tests/writing" className="flex items-center gap-2 text-slate-600 hover:text-orange-600 font-medium transition-colors">
                            <span className="text-sm">Practice</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                {/* Quick Action Card */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all group border-l-4 border-l-emerald-500">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                                <Play className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Quick Start</div>
                                <h3 className="font-bold text-slate-900 text-lg">Take a Reading Mock</h3>
                                <p className="text-sm text-slate-500 mt-1">Challenge yourself today</p>
                            </div>
                        </div>
                        <Link href="/tests/reading" className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 font-medium transition-colors">
                            <span className="text-sm">Begin</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
