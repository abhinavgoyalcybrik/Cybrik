"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CallMinutesChartProps {
    data: any[];
    title: string;
}

export default function CostChart({ data, title }: CallMinutesChartProps) {
    return (
        <div className="w-full h-full p-3 sm:p-4 lg:p-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/20 flex flex-col overflow-hidden">
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-slate-800 mb-2 sm:mb-4">{title}</h3>
            <div className="flex-1 min-h-0 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}m`} width={35} />
                        <Tooltip
                            cursor={{ fill: '#f1f5f9' }}
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                            formatter={(value) => [`${value ?? 0} mins`, 'Duration']}
                        />
                        <Bar dataKey="minutes" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
