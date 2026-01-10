"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Card } from '@/components/ui/card';
import clsx from 'clsx';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridProps {
    layout: Layout[];
    onLayoutChange: (layout: Layout[]) => void;
    children: React.ReactNode;
    isEditable?: boolean;
}

function generateResponsiveLayouts(baseLayout: Layout[]) {
    const lg = baseLayout;

    const md = baseLayout.map((item) => {
        const newItem = { ...item, minW: Math.min(item.minW || 2, 10), w: Math.min(item.w, 10) };
        if (item.i.startsWith('stat_')) {
            const statIndex = baseLayout.filter(l => l.i.startsWith('stat_')).findIndex(l => l.i === item.i);
            return { ...newItem, x: (statIndex % 2) * 5, y: Math.floor(statIndex / 2) * 2, w: 5, h: 2 };
        }
        if (item.i === 'trend_chart') return { ...newItem, x: 0, y: 4, w: 10, h: 4 };
        if (item.i === 'funnel_chart') return { ...newItem, x: 0, y: 8, w: 5, h: 4 };
        if (item.i === 'llm_usage') return { ...newItem, x: 5, y: 8, w: 5, h: 3 };
        if (item.i === 'app_status') return { ...newItem, x: 0, y: 12, w: 5, h: 3 };
        if (item.i === 'cost_chart') return { ...newItem, x: 5, y: 12, w: 5, h: 3 };
        return newItem;
    });

    const sm = baseLayout.map((item) => {
        const newItem = { ...item, minW: Math.min(item.minW || 2, 6), w: Math.min(item.w, 6) };
        if (item.i.startsWith('stat_')) {
            const statIndex = baseLayout.filter(l => l.i.startsWith('stat_')).findIndex(l => l.i === item.i);
            return { ...newItem, x: 0, y: statIndex * 2, w: 6, h: 2 };
        }
        if (item.i === 'trend_chart') return { ...newItem, x: 0, y: 6, w: 6, h: 4 };
        if (item.i === 'funnel_chart') return { ...newItem, x: 0, y: 10, w: 6, h: 4 };
        if (item.i === 'llm_usage') return { ...newItem, x: 0, y: 14, w: 6, h: 3 };
        if (item.i === 'app_status') return { ...newItem, x: 0, y: 17, w: 6, h: 3 };
        if (item.i === 'cost_chart') return { ...newItem, x: 0, y: 20, w: 6, h: 3 };
        return { ...newItem, x: 0, w: 6 };
    });

    const xs = baseLayout.map((item) => {
        const newItem = { ...item, minW: Math.min(item.minW || 2, 4), w: Math.min(item.w, 4) };
        if (item.i.startsWith('stat_')) {
            const statIndex = baseLayout.filter(l => l.i.startsWith('stat_')).findIndex(l => l.i === item.i);
            return { ...newItem, x: 0, y: statIndex * 2, w: 4, h: 2 };
        }
        if (item.i === 'trend_chart') return { ...newItem, x: 0, y: 6, w: 4, h: 4 };
        if (item.i === 'funnel_chart') return { ...newItem, x: 0, y: 10, w: 4, h: 4 };
        if (item.i === 'llm_usage') return { ...newItem, x: 0, y: 14, w: 4, h: 3 };
        if (item.i === 'app_status') return { ...newItem, x: 0, y: 17, w: 4, h: 3 };
        if (item.i === 'cost_chart') return { ...newItem, x: 0, y: 20, w: 4, h: 3 };
        return { ...newItem, x: 0, w: 4 };
    });

    const xxs = baseLayout.map((item) => {
        const newItem = { ...item, minW: Math.min(item.minW || 2, 2), w: Math.min(item.w, 2) };
        if (item.i.startsWith('stat_')) {
            const statIndex = baseLayout.filter(l => l.i.startsWith('stat_')).findIndex(l => l.i === item.i);
            return { ...newItem, x: 0, y: statIndex * 2, w: 2, h: 2 };
        }
        if (item.i === 'trend_chart') return { ...newItem, x: 0, y: 6, w: 2, h: 3 };
        if (item.i === 'funnel_chart') return { ...newItem, x: 0, y: 9, w: 2, h: 3 };
        if (item.i === 'llm_usage') return { ...newItem, x: 0, y: 12, w: 2, h: 3 };
        if (item.i === 'app_status') return { ...newItem, x: 0, y: 15, w: 2, h: 3 };
        if (item.i === 'cost_chart') return { ...newItem, x: 0, y: 18, w: 2, h: 3 };
        return { ...newItem, x: 0, w: 2 };
    });

    return { lg, md, sm, xs, xxs };
}

export default function DashboardGrid({ layout, onLayoutChange, children, isEditable = false }: DashboardGridProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const responsiveLayouts = useMemo(() => generateResponsiveLayouts(layout), [layout]);

    if (!mounted) return null;

    return (
        <ResponsiveGridLayout
            className="layout"
            layouts={responsiveLayouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={100}
            isDraggable={isEditable}
            isResizable={isEditable}
            onLayoutChange={(currentLayout: Layout[]) => onLayoutChange(currentLayout)}
            draggableHandle=".drag-handle"
            margin={[16, 16]}
            containerPadding={[0, 0]}
            useCSSTransforms={true}
        >
            {children}
        </ResponsiveGridLayout>
    );
}
