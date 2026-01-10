"use client";

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ApplicationsChartProps {
    data: any[];
    title: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function ApplicationsChart({ data, title }: ApplicationsChartProps) {
    return (
        <div className="w-full h-full p-3 sm:p-4 lg:p-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/20 flex flex-col overflow-hidden">
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-slate-800 mb-2 sm:mb-4">{title}</h3>
            <div className="flex-1 min-h-0 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="45%"
                            innerRadius="40%"
                            outerRadius="60%"
                            fill="#8884d8"
                            paddingAngle={4}
                            dataKey="count"
                            nameKey="status"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
