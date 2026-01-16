"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FunnelChartProps {
    data: any[];
    title: string;
}

const COLORS = ['#94a3b8', '#6366f1', '#8b5cf6', '#ec4899', '#10b981'];

export default function FunnelChart({ data, title }: FunnelChartProps) {
    const filteredData = data.filter(item => item.stage !== 'Applicants' && item.stage !== 'Active Leads');

    return (
        <div className="w-full h-full p-4 sm:p-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/20 flex flex-col overflow-hidden">
            <h3 className="text-sm sm:text-base lg:text-lg font-bold text-slate-800 mb-4">{title}</h3>
            <div className="flex-1 min-h-0 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="stage"
                            type="category"
                            width={100}
                            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                padding: '12px'
                            }}
                            itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={32}>
                            {filteredData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
