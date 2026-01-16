"use client";

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ApplicationsChartProps {
    data: any[];
    title: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function ApplicationsChart({ data, title }: ApplicationsChartProps) {
    // If no data or all zero counts, show empty state
    const hasData = data && data.length > 0 && data.some(item => item.count > 0);

    return (
        <div className="w-full h-full p-4 sm:p-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/20 flex flex-col overflow-hidden">
            <h3 className="text-sm sm:text-base lg:text-lg font-bold text-slate-800 mb-4">{title}</h3>
            <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center relative">
                {!hasData ? (
                    <div className="text-center text-slate-400 flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                            <span className="text-2xl">📋</span>
                        </div>
                        <p className="text-sm font-medium">No application data yet</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius="55%"
                                outerRadius="75%"
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="count"
                                nameKey="status"
                                cornerRadius={6}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    borderRadius: '12px',
                                    border: 'none',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    padding: '12px',
                                    fontSize: '12px'
                                }}
                                formatter={(value: any) => [`${value} Applications`, 'Count']}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                iconSize={8}
                                wrapperStyle={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
