"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FunnelChartProps {
    data: any[];
    title: string;
}

const COLORS = ['#94a3b8', '#6366f1', '#8b5cf6', '#ec4899', '#10b981'];

export default function FunnelChart({ data, title }: FunnelChartProps) {
    return (
        <div className="w-full h-full p-3 sm:p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800 mb-2 sm:mb-4">{title}</h3>
            <div className="flex-1 min-h-0 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="stage" type="category" width={70} tick={{ fontSize: 10, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                        <Tooltip
                            cursor={{ fill: '#f3f4f6' }}
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
