import React from 'react';
import { motion } from 'framer-motion';

interface KPIGridProps {
  kpis: {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    trend?: string;
    trendUp?: boolean;
    subtitle?: string;
  }[];
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function KPIGrid({ kpis }: KPIGridProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
    >
      {kpis.map((kpi, index) => (
        <motion.div
          key={index}
          variants={item}
          className="card p-6 relative overflow-hidden group hover:border-[var(--cy-lime)] transition-colors"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-[var(--cy-bg-page)] rounded-xl text-[var(--cy-navy)] group-hover:bg-[var(--cy-lime)] group-hover:text-white transition-colors">
              {kpi.icon || (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              )}
            </div>
            {kpi.trend && (
              <span className={`badge ${kpi.trendUp ? 'badge-success' : 'badge-error'}`}>
                {kpi.trendUp ? '↑' : '↓'} {kpi.trend}
              </span>
            )}
          </div>

          <div>
            <div className="text-[var(--cy-text-muted)] text-sm font-medium uppercase tracking-wider mb-1">
              {kpi.title}
            </div>
            <div className="text-3xl font-bold text-[var(--cy-navy)] tracking-tight">
              {kpi.value}
            </div>
            {kpi.subtitle && (
              <div className="text-xs text-[var(--cy-text-secondary)] mt-2">
                {kpi.subtitle}
              </div>
            )}
          </div>

          {/* Decorative Sparkline Background */}
          <div className="absolute bottom-0 right-0 opacity-5 pointer-events-none">
            <svg width="120" height="60" viewBox="0 0 120 60" fill="none">
              <path d="M0 60L20 40L40 50L60 20L80 30L100 10L120 40V60H0Z" fill="currentColor" className="text-[var(--cy-navy)]" />
            </svg>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
