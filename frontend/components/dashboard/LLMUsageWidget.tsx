"use client";

import React from 'react';
import { Activity, Phone, Clock, DollarSign } from 'lucide-react';

interface LLMUsageWidgetProps {
    data: {
        total_calls: number;
        total_minutes: number;
        estimated_cost_usd: number;
    };
}

export default function LLMUsageWidget({ data }: LLMUsageWidgetProps) {
    return (
        <div className="w-full h-full p-3 sm:p-4 lg:p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-lg text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl -ml-12 -mb-12" />

            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 lg:mb-6 relative z-10">
                <div className="p-1.5 sm:p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                    <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-300" />
                </div>
                <h3 className="text-sm sm:text-base lg:text-lg font-semibold tracking-wide">AI Calls Usage</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4 relative z-10 flex-1">
                <div className="flex flex-col gap-0.5 sm:gap-1 justify-center">
                    <div className="flex items-center gap-1 text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider font-medium">
                        <Phone className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Calls
                    </div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold">{data?.total_calls || 0}</div>
                </div>

                <div className="flex flex-col gap-0.5 sm:gap-1 justify-center">
                    <div className="flex items-center gap-1 text-emerald-400 text-[10px] sm:text-xs uppercase tracking-wider font-medium">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Mins
                    </div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-400">{data?.total_minutes || 0}</div>
                </div>
            </div>

            <div className="mt-3 sm:mt-4 lg:mt-6 pt-2 sm:pt-3 lg:pt-4 border-t border-white/10 text-[10px] sm:text-xs text-slate-400 relative z-10">
                Total usage duration.
            </div>
        </div>
    );
}
