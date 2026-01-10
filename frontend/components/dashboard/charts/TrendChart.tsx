"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TrendChartProps {
    data: any[];
    title: string;
}

export default function TrendChart({ data, title }: TrendChartProps) {
    return (
        <div className="w-full h-full p-3 sm:p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800 mb-2 sm:mb-4">{title}</h3>
            <div className="flex-1 min-h-0 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} width={30} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ color: '#1f2937' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} name="Count" />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
