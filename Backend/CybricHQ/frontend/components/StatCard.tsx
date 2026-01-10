// frontend/components/StatCard.tsx
"use client";
import React from "react";

export default function StatCard({ title, value, subtitle }: { title: string; value: number | string; subtitle?: string; }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      </div>
      {subtitle && <p className="text-xs text-gray-400 mt-2">{subtitle}</p>}
    </div>
  );
}
