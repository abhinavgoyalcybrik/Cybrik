'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useSpring, useInView, AnimatePresence } from 'framer-motion';

// Smooth spring config for animations
const smoothSpring = { type: 'spring' as const, stiffness: 100, damping: 30, mass: 1 };
const bouncySpring = { type: 'spring' as const, stiffness: 300, damping: 20 };

// Animated Dashboard Mockup Component - Enhanced with real charts
export function DashboardMockup({ activeFeature = 0 }: { activeFeature?: number }) {
    const features = [
        { name: 'leads', color: '#6FB63A', gradient: 'from-green-500 to-emerald-600' },
        { name: 'pipeline', color: '#3B82F6', gradient: 'from-blue-500 to-indigo-600' },
        { name: 'analytics', color: '#8B5CF6', gradient: 'from-purple-500 to-violet-600' },
        { name: 'ai', color: '#F59E0B', gradient: 'from-amber-500 to-orange-600' },
    ];

    const currentFeature = features[activeFeature] || features[0];

    return (
        <motion.div
            className="relative w-full max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 40, rotateX: 10 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ ...smoothSpring, duration: 0.8 }}
            style={{ perspective: 1000 }}
        >
            {/* Glow Effect Behind */}
            <motion.div
                className="absolute -inset-4 rounded-3xl blur-2xl opacity-30"
                animate={{
                    background: `linear-gradient(135deg, ${currentFeature.color}40, transparent)`,
                }}
                transition={{ duration: 0.5 }}
            />

            {/* Browser Frame */}
            <div className="relative bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] rounded-2xl shadow-2xl overflow-hidden border border-white/10">
                {/* Browser Header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-[#0a0a14] border-b border-white/5">
                    <div className="flex gap-1.5">
                        <motion.div className="w-3 h-3 rounded-full bg-red-500" whileHover={{ scale: 1.2 }} />
                        <motion.div className="w-3 h-3 rounded-full bg-yellow-500" whileHover={{ scale: 1.2 }} />
                        <motion.div className="w-3 h-3 rounded-full bg-green-500" whileHover={{ scale: 1.2 }} />
                    </div>
                    <div className="flex-1 mx-4">
                        <div className="bg-[#1a1a2e] rounded-lg px-4 py-2 text-xs text-gray-400 flex items-center gap-2 border border-white/5">
                            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-gray-500">https://</span>
                            <span className="text-white">crm.cybrikhq.com</span>
                            <span className="text-gray-500">/dashboard</span>
                        </div>
                    </div>
                </div>

                {/* Dashboard Content */}
                <div className="flex min-h-[400px]">
                    {/* Sidebar */}
                    <motion.div
                        className="w-16 bg-gradient-to-b from-[#0B1F3A] to-[#061224] p-3 space-y-3 hidden sm:flex flex-col"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...smoothSpring, delay: 0.2 }}
                    >
                        {/* Logo */}
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6FB63A] to-[#4a9a20] flex items-center justify-center mb-4">
                            <span className="text-white font-bold text-sm">C</span>
                        </div>

                        {/* Nav Items */}
                        {[
                            { icon: '📊', label: 'Dashboard' },
                            { icon: '👥', label: 'Leads' },
                            { icon: '📈', label: 'Pipeline' },
                            { icon: '🎙️', label: 'AI Calls' },
                            { icon: '⚙️', label: 'Settings' },
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-300 ${i === activeFeature
                                    ? 'bg-white/10 shadow-lg ring-2 ring-[#6FB63A]/50'
                                    : 'hover:bg-white/5'
                                    }`}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                animate={{
                                    scale: i === activeFeature ? 1.05 : 1,
                                }}
                                transition={bouncySpring}
                            >
                                {item.icon}
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Main Content */}
                    <div className="flex-1 p-4 sm:p-6 space-y-4 bg-gradient-to-br from-[#0f1629] via-[#131b30] to-[#1a1a2e]">
                        {/* Stats Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: 'Total Leads', value: '2,847', change: '+12%', trend: 'up' },
                                { label: 'Qualified', value: '1,234', change: '+8%', trend: 'up' },
                                { label: 'Conversion', value: '43%', change: '+5%', trend: 'up' },
                                { label: 'AI Calls', value: '892', change: '+24%', trend: 'up' },
                            ].map((stat, i) => (
                                <motion.div
                                    key={stat.label}
                                    className="relative overflow-hidden rounded-xl border transition-all duration-500"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        scale: activeFeature === i ? 1.02 : 1,
                                    }}
                                    transition={{ ...smoothSpring, delay: 0.3 + i * 0.08 }}
                                    style={{
                                        background: activeFeature === i
                                            ? `linear-gradient(135deg, ${features[i].color}15, ${features[i].color}05)`
                                            : 'rgba(255,255,255,0.02)',
                                        borderColor: activeFeature === i ? features[i].color : 'rgba(255,255,255,0.05)',
                                        boxShadow: activeFeature === i ? `0 8px 32px ${features[i].color}20` : 'none',
                                    }}
                                >
                                    <div className="p-3 relative z-10">
                                        <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-medium">{stat.label}</div>
                                        <motion.div
                                            className="text-xl sm:text-2xl font-bold text-white mt-1"
                                            animate={{ scale: activeFeature === i ? [1, 1.05, 1] : 1 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            {stat.value}
                                        </motion.div>
                                        <div className="flex items-center gap-1 mt-1">
                                            <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-xs text-green-400 font-medium">{stat.change}</span>
                                        </div>
                                    </div>

                                    {/* Sparkline */}
                                    <svg className="absolute bottom-0 left-0 right-0 h-8 opacity-20" viewBox="0 0 100 32" preserveAspectRatio="none">
                                        <motion.path
                                            d="M0 28 Q 10 20, 20 24 T 40 18 T 60 22 T 80 12 T 100 8"
                                            fill="none"
                                            stroke={features[i].color}
                                            strokeWidth="2"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 1.5, delay: 0.5 + i * 0.1 }}
                                        />
                                    </svg>
                                </motion.div>
                            ))}
                        </div>

                        {/* Chart Area */}
                        <motion.div
                            className="bg-white/[0.02] backdrop-blur rounded-xl p-4 border border-white/5"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ ...smoothSpring, delay: 0.5 }}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="text-sm font-semibold text-white">Conversion Funnel</div>
                                    <motion.div
                                        className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium"
                                        animate={{ scale: [1, 1.05, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    >
                                        Live
                                    </motion.div>
                                </div>
                                <div className="flex gap-1">
                                    {['7D', '30D', '90D'].map((period, i) => (
                                        <motion.div
                                            key={period}
                                            className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-all ${i === 1 ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                }`}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            {period}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Animated Funnel Bars */}
                            <div className="flex items-end gap-2 h-28 sm:h-36">
                                {[
                                    { height: 100, label: 'Leads', value: '2,847' },
                                    { height: 78, label: 'Qualified', value: '2,220' },
                                    { height: 55, label: 'Applied', value: '1,565' },
                                    { height: 38, label: 'Admitted', value: '1,082' },
                                    { height: 25, label: 'Enrolled', value: '712' },
                                ].map((bar, i) => (
                                    <motion.div
                                        key={i}
                                        className="flex-1 rounded-t-lg relative group cursor-pointer"
                                        style={{
                                            background: `linear-gradient(to top, ${features[i % 4].color}, ${features[i % 4].color}60)`,
                                        }}
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: `${bar.height}%`, opacity: 1 }}
                                        transition={{
                                            ...smoothSpring,
                                            delay: 0.7 + i * 0.1,
                                            duration: 0.8
                                        }}
                                        whileHover={{
                                            scale: 1.02,
                                            filter: 'brightness(1.2)',
                                            transition: { duration: 0.2 }
                                        }}
                                    >
                                        {/* Tooltip */}
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#0B1F3A] px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10">
                                            {bar.value}
                                        </div>

                                        {/* Shimmer Effect */}
                                        <motion.div
                                            className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent rounded-t-lg"
                                            initial={{ y: '100%' }}
                                            animate={{ y: '-100%' }}
                                            transition={{
                                                duration: 2,
                                                repeat: Infinity,
                                                repeatDelay: 3,
                                                delay: i * 0.2
                                            }}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                            <div className="flex justify-between mt-3">
                                {['Leads', 'Qualified', 'Applied', 'Admitted', 'Enrolled'].map((label) => (
                                    <div key={label} className="text-[9px] sm:text-xs text-gray-500 flex-1 text-center font-medium">{label}</div>
                                ))}
                            </div>
                        </motion.div>

                        {/* AI Activity Feed */}
                        <motion.div
                            className="bg-white/[0.02] backdrop-blur rounded-xl p-4 border border-white/5"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...smoothSpring, delay: 0.8 }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-semibold text-white">AI Agent Activity</div>
                                <motion.div
                                    className="flex items-center gap-1.5"
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span className="text-xs text-green-400">3 Active</span>
                                </motion.div>
                            </div>
                            <div className="space-y-2">
                                <AnimatePresence mode="popLayout">
                                    {[
                                        { text: 'Call completed with Sarah K.', time: '2m ago', icon: '📞', status: 'success' },
                                        { text: 'Lead qualified: High intent', time: '5m ago', icon: '✨', status: 'info' },
                                        { text: 'Follow-up scheduled', time: '12m ago', icon: '📅', status: 'pending' },
                                    ].map((activity, i) => (
                                        <motion.div
                                            key={activity.text}
                                            className="flex items-center gap-3 text-xs text-gray-300 py-2.5 px-3 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors cursor-pointer"
                                            initial={{ opacity: 0, x: -20, scale: 0.95 }}
                                            animate={{ opacity: 1, x: 0, scale: 1 }}
                                            transition={{ ...smoothSpring, delay: 1 + i * 0.1 }}
                                            whileHover={{ x: 4 }}
                                        >
                                            <span className="text-lg">{activity.icon}</span>
                                            <span className="flex-1 font-medium">{activity.text}</span>
                                            <span className="text-gray-500">{activity.time}</span>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// Scroll Progress Indicator - Enhanced
export function ScrollProgress() {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

    return (
        <motion.div
            className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6FB63A] via-[#8BC34A] to-[#6FB63A] origin-left z-[100]"
            style={{ scaleX }}
        />
    );
}

// Parallax Section Wrapper
export function ParallaxSection({
    children,
    offset = 50
}: {
    children: React.ReactNode;
    offset?: number;
}) {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ['start end', 'end start']
    });

    const y = useSpring(
        React.useMemo(() => {
            // Manual transform since useTransform may not exist
            return scrollYProgress;
        }, [scrollYProgress]),
        { stiffness: 100, damping: 30 }
    );

    return (
        <motion.div ref={ref} style={{ y }}>
            {children}
        </motion.div>
    );
}

// Fade-in Section - Enhanced with smoother animations
export function FadeInSection({
    children,
    direction = 'up',
    delay = 0
}: {
    children: React.ReactNode;
    direction?: 'up' | 'down' | 'left' | 'right';
    delay?: number;
}) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-80px' });

    const directionMap = {
        up: { y: 60, x: 0 },
        down: { y: -60, x: 0 },
        left: { y: 0, x: 60 },
        right: { y: 0, x: -60 },
    };

    return (
        <motion.div
            ref={ref}
            initial={{
                opacity: 0,
                y: directionMap[direction].y,
                x: directionMap[direction].x,
                filter: 'blur(10px)'
            }}
            animate={isInView ? {
                opacity: 1,
                y: 0,
                x: 0,
                filter: 'blur(0px)'
            } : {}}
            transition={{
                ...smoothSpring,
                delay,
                opacity: { duration: 0.4 },
                filter: { duration: 0.4 }
            }}
        >
            {children}
        </motion.div>
    );
}

// Dashboard Showcase with Sticky Scroll - Enhanced
export function DashboardShowcase() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeFeature, setActiveFeature] = React.useState(0);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ['start start', 'end end']
    });

    // Smooth scroll progress tracking
    const smoothProgress = useSpring(scrollYProgress, { stiffness: 50, damping: 20 });

    // Update active feature based on scroll progress
    React.useEffect(() => {
        const unsubscribe = smoothProgress.on('change', (latest) => {
            const newFeature = Math.min(3, Math.floor(latest * 4));
            setActiveFeature(newFeature);
        });
        return () => unsubscribe();
    }, [smoothProgress]);

    const showcaseFeatures = [
        {
            title: 'Lead Management',
            description: 'Track every lead from first contact to enrollment. See their journey, interactions, and status at a glance.',
            icon: '👥',
            color: '#6FB63A'
        },
        {
            title: 'Smart Pipeline',
            description: 'Visualize your sales funnel with real-time data. Identify bottlenecks and optimize your conversion rates.',
            icon: '📊',
            color: '#3B82F6'
        },
        {
            title: 'AI Analytics',
            description: 'Get deep insights powered by AI. Understand trends, predict outcomes, and make data-driven decisions.',
            icon: '🧠',
            color: '#8B5CF6'
        },
        {
            title: 'Voice AI Agent',
            description: 'Let AI handle student calls 24/7. Every conversation is transcribed, summarized, and logged automatically.',
            icon: '🎙️',
            color: '#F59E0B'
        },
    ];

    return (
        <div ref={containerRef} className="relative min-h-[300vh]">
            {/* Sticky Container */}
            <div className="sticky top-0 h-screen flex items-center overflow-hidden bg-gradient-to-b from-transparent to-[#F8FAFC]">
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
                    <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
                        {/* Left: Feature List */}
                        <div className="space-y-6 order-2 lg:order-1">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={smoothSpring}
                            >
                                <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full mb-4">
                                    <motion.span
                                        className="w-2 h-2 rounded-full bg-[#6FB63A]"
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                    Dashboard Preview
                                </span>
                                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0B1F3A] mb-4" style={{ letterSpacing: '-0.02em' }}>
                                    Everything You Need.
                                    <br />
                                    <span className="text-[#6FB63A]">One Powerful Dashboard.</span>
                                </h2>
                            </motion.div>

                            <div className="space-y-3">
                                {showcaseFeatures.map((feature, i) => {
                                    const isActive = activeFeature === i;

                                    return (
                                        <motion.div
                                            key={feature.title}
                                            className="p-4 rounded-xl border-2 cursor-pointer overflow-hidden relative"
                                            initial={{ opacity: 0, x: -30 }}
                                            whileInView={{ opacity: 1, x: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ ...smoothSpring, delay: i * 0.08 }}
                                            animate={{
                                                scale: isActive ? 1.02 : 1,
                                                backgroundColor: isActive ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.5)',
                                                borderColor: isActive ? feature.color : 'transparent',
                                                boxShadow: isActive ? `0 10px 40px ${feature.color}20` : 'none',
                                            }}
                                            whileHover={{
                                                backgroundColor: 'rgba(255,255,255,0.9)',
                                                x: 4,
                                            }}
                                        >
                                            {/* Active Indicator Bar */}
                                            <motion.div
                                                className="absolute left-0 top-0 bottom-0 w-1 rounded-full"
                                                style={{ backgroundColor: feature.color }}
                                                initial={{ scaleY: 0 }}
                                                animate={{ scaleY: isActive ? 1 : 0 }}
                                                transition={{ ...smoothSpring }}
                                            />

                                            <div className="flex items-start gap-4">
                                                <motion.div
                                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 transition-colors"
                                                    animate={{
                                                        backgroundColor: isActive ? `${feature.color}20` : '#f3f4f6',
                                                        scale: isActive ? 1.1 : 1,
                                                    }}
                                                    transition={bouncySpring}
                                                >
                                                    {feature.icon}
                                                </motion.div>
                                                <div>
                                                    <h3 className="font-semibold text-[#0B1F3A] mb-1">{feature.title}</h3>
                                                    <motion.p
                                                        className="text-sm text-[#5B6A7F] leading-relaxed"
                                                        animate={{ opacity: isActive ? 1 : 0.7 }}
                                                    >
                                                        {feature.description}
                                                    </motion.p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Scroll Indicator */}
                            <motion.div
                                className="flex items-center gap-2 text-sm text-gray-400 mt-6"
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                                Scroll to explore features
                            </motion.div>
                        </div>

                        {/* Right: Dashboard Preview */}
                        <div className="order-1 lg:order-2">
                            <DashboardMockup activeFeature={activeFeature} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Scroll Triggers (invisible, just for scroll tracking) */}
            <div className="absolute inset-0 pointer-events-none">
                {showcaseFeatures.map((_, i) => (
                    <div key={i} className="h-[75vh]" />
                ))}
            </div>
        </div>
    );
}

// Floating Elements for Parallax Background - Enhanced
export function FloatingElements() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Gradient Orbs with smoother animations */}
            <motion.div
                className="absolute top-20 right-[10%] w-72 h-72 rounded-full bg-gradient-to-br from-[#6FB63A]/20 to-[#6FB63A]/5 blur-3xl"
                animate={{
                    y: [0, -40, 0],
                    scale: [1, 1.15, 1],
                    rotate: [0, 5, 0],
                }}
                transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />
            <motion.div
                className="absolute bottom-40 left-[5%] w-96 h-96 rounded-full bg-gradient-to-br from-blue-500/15 to-cyan-500/5 blur-3xl"
                animate={{
                    y: [0, 50, 0],
                    scale: [1, 1.2, 1],
                    rotate: [0, -10, 0],
                }}
                transition={{
                    duration: 12,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />
            <motion.div
                className="absolute top-1/2 right-[20%] w-64 h-64 rounded-full bg-gradient-to-br from-purple-500/15 to-pink-500/5 blur-3xl"
                animate={{
                    x: [0, 40, 0],
                    y: [0, -30, 0],
                    rotate: [0, 15, 0],
                }}
                transition={{
                    duration: 14,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />

            {/* Floating particles */}
            {[...Array(5)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-[#6FB63A]/30"
                    style={{
                        left: `${20 + i * 15}%`,
                        top: `${30 + (i * 10) % 40}%`,
                    }}
                    animate={{
                        y: [0, -30, 0],
                        opacity: [0.3, 0.7, 0.3],
                    }}
                    transition={{
                        duration: 4 + i,
                        repeat: Infinity,
                        delay: i * 0.5,
                        ease: 'easeInOut',
                    }}
                />
            ))}
        </div>
    );
}

// Scroll-Triggered Counter Animation
export function AnimatedCounter({
    value,
    suffix = ''
}: {
    value: number;
    suffix?: string;
}) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true });
    const [displayValue, setDisplayValue] = React.useState(0);

    React.useEffect(() => {
        if (isInView) {
            let start = 0;
            const end = value;
            const duration = 2000;
            const increment = end / (duration / 16);

            const timer = setInterval(() => {
                start += increment;
                if (start >= end) {
                    setDisplayValue(end);
                    clearInterval(timer);
                } else {
                    setDisplayValue(Math.floor(start));
                }
            }, 16);


            return () => clearInterval(timer);
        }
    }, [isInView, value]);

    return (
        <span ref={ref}>
            {displayValue.toLocaleString()}{suffix}
        </span>
    );
}

//Vibrant Dashboard Mockup - Matching user's exact design with rich dummy data
function VibrantDashboardMockup({ featureIndex, color }: { featureIndex: number; color: string }) {
    // Feature-specific dummy data
    const featureData = [
        // Dashboard Overview
        {
            stats: [
                { label: 'Total Leads', value: '2,847', change: '+24%', changePositive: true },
                { label: 'Active Deals', value: '156', change: '+18%', changePositive: true },
                { label: 'Conversion', value: '43%', change: '+5%', changePositive: true },
                { label: 'Revenue', value: '$245K', change: '+32%', changePositive: true },
            ],
            chartData: [65, 78, 85, 72, 90, 88, 95],
            recentActivity: [
                { name: 'Sarah Johnson', action: 'Closed deal', time: '2m ago', status: 'success' },
                { name: 'Mike Chen', action: 'Meeting scheduled', time: '5m ago', status: 'info' },
                { name: 'Emma Wilson', action: 'Lead qualified', time: '12m ago', status: 'success' },
                { name: 'David Park', action: 'Follow-up sent', time: '18m ago', status: 'pending' },
            ]
        },
        // Lead Management
        {
            stats: [
                { label: 'New Leads', value: '342', change: '+45', changePositive: true },
                { label: 'Qualified', value: '89', change: '+12', changePositive: true },
                { label: 'In Progress', value: '156', change: '+8', changePositive: true },
                { label: 'Converted', value: '67', change: '+15', changePositive: true },
            ],
            chartData: [45, 62, 58, 75, 82, 78, 92],
            recentActivity: [
                { name: 'Priya Sharma', action: 'New lead from Meta', time: 'Just now', status: 'new' },
                { name: 'James Williams', action: 'Qualified today', time: '3m ago', status: 'success' },
                { name: 'Lisa Anderson', action: 'Callback scheduled', time: '7m ago', status: 'info' },
                { name: 'Robert Taylor', action: 'Documents sent', time: '15m ago', status: 'pending' },
            ]
        },
        // AI Conversations
        {
            stats: [
                { label: 'Total Calls', value: '1,248', change: '+156', changePositive: true },
                { label: 'Active Now', value: '23', change: '+5', changePositive: true },
                { label: 'Success Rate', value: '92%', change: '+3%', changePositive: true },
                { label: 'Avg Duration', value: '4m 32s', change: '-12s', changePositive: true },
            ],
            chartData: [88, 92, 85, 95, 90, 94, 96],
            recentActivity: [
                { name: 'AI Call #1247', action: 'Booking confirmed', time: 'Live', status: 'live' },
                { name: 'AI Call #1246', action: 'Info collected', time: '1m ago', status: 'success' },
                { name: 'AI Call #1245', action: 'Follow-up scheduled', time: '4m ago', status: 'success' },
                { name: 'AI Call #1244', action: 'Voicemail left', time: '8m ago', status: 'pending' },
            ]
        },
        // Smart Messaging
        {
            stats: [
                { label: 'Messages', value: '3,456', change: '+234', changePositive: true },
                { label: 'WhatsApp', value: '1,892', change: '+145', changePositive: true },
                { label: 'SMS', value: '1,564', change: '+89', changePositive: true },
                { label: 'Auto-Reply', value: '78%', change: '+12%', changePositive: true },
            ],
            chartData: [72, 89, 95, 88, 92, 96, 93],
            recentActivity: [
                { name: 'Amit Patel', action: 'WhatsApp replied', time: 'Just now', status: 'new' },
                { name: 'Maria Garcia', action: 'SMS conversation', time: '2m ago', status: 'live' },
                { name: 'John Smith', action: 'Auto-response sent', time: '5m ago', status: 'success' },
                { name: 'Nina Kapoor', action: 'Message delivered', time: '9m ago', status: 'info' },
            ]
        },
        // Campaign Scaling
        {
            stats: [
                { label: 'Ad Spend', value: '$12.4K', change: '+$2.1K', changePositive: false },
                { label: 'Impressions', value: '456K', change: '+89K', changePositive: true },
                { label: 'Clicks', value: '12.3K', change: '+2.4K', changePositive: true },
                { label: 'ROAS', value: '4.2x', change: '+0.8x', changePositive: true },
            ],
            chartData: [55, 68, 72, 85, 78, 92, 88],
            recentActivity: [
                { name: 'Meta Campaign', action: 'Performing well', time: 'Active', status: 'success' },
                { name: 'Google Ads', action: 'Budget increased', time: '1h ago', status: 'info' },
                { name: 'Instagram Ads', action: 'New creative live', time: '3h ago', status: 'new' },
                { name: 'LinkedIn Ads', action: 'Lead gen active', time: '5h ago', status: 'live' },
            ]
        },
    ];

    const currentData = featureData[featureIndex];
    const statusColors = {
        success: color,
        new: '#10B981',
        live: '#F59E0B',
        info: '#3B82F6',
        pending: '#9CA3AF'
    };

    return (
        <div className="flex h-full bg-white">
            {/* Navy Blue Header - Matching your dashboard */}
            <div className="absolute top-0 left-0 right-0 h-14 md:h-16 bg-gradient-to-r from-[#0B1F3A] to-[#183A5E] border-b border-gray-200 flex items-center px-4 md:px-6 z-10">
                <div className="flex items-center gap-3 flex-1">
                    <motion.div
                        className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-[#6FB63A] to-[#5a9b2e] flex items-center justify-center shadow-lg"
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                    >
                        <span className="text-white font-bold text-sm md:text-base">C</span>
                    </motion.div>
                    <div className="hidden md:block">
                        <div className="text-white text-sm font-semibold">CybrikHQ</div>
                        <div className="text-white/60 text-xs">
                            {['Dashboard', 'Leads', 'AI Calls', 'Messages', 'Campaigns'][featureIndex]}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                    <motion.div
                        className="relative w-2 h-2 rounded-full bg-green-400"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                    <span className="hidden md:inline text-white/80 text-xs">Live</span>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-gradient-to-br from-gray-50 to-white pt-16 md:pt-20 p-4 md:p-6 overflow-hidden">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                    {currentData.stats.map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            className="bg-white rounded-xl p-3 md:p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1, duration: 0.4 }}
                        >
                            <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                                {stat.label}
                            </div>
                            <div className="flex items-end justify-between">
                                <motion.div
                                    className="text-xl md:text-2xl font-bold text-[#0B1F3A]"
                                    key={stat.value}
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200 }}
                                >
                                    {stat.value}
                                </motion.div>
                                <motion.span
                                    className={`text-[10px] md:text-xs font-medium px-1.5 py-0.5 rounded ${stat.changePositive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                                        }`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 + i * 0.1 }}
                                >
                                    {stat.change}
                                </motion.span>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Chart Section - Different chart types per feature */}
                <div className="bg-white rounded-xl p-4 md:p-5 border border-gray-200 shadow-sm mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm md:text-base font-semibold text-[#0B1F3A]">
                                {['Performance Metrics', 'Lead Funnel', 'Call Analytics', 'Message Activity', 'Campaign ROI'][featureIndex]}
                            </h3>
                            <p className="text-xs text-gray-500">Last 7 days</p>
                        </div>
                        <motion.div
                            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
                            style={{ backgroundColor: `${color}10`, color }}
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                            <span className="font-medium">Live</span>
                        </motion.div>
                    </div>

                    {/* Different chart types based on feature */}
                    {featureIndex === 0 && (
                        /* Line Chart for Dashboard Overview */
                        <div className="h-32 md:h-40 relative">
                            <svg className="w-full h-full" viewBox="0 0 280 160">
                                {/* Grid lines */}
                                {[0, 1, 2, 3, 4].map((i) => (
                                    <line key={i} x1="0" y1={i * 40} x2="280" y2={i * 40} stroke="#f0f0f0" strokeWidth="1" />
                                ))}
                                {/* Area fill */}
                                <motion.path
                                    d={`M0 ${160 - currentData.chartData[0] * 1.6} ${currentData.chartData.map((v, i) => `L${i * 40 + 40} ${160 - v * 1.6}`).join(' ')} L280 160 L0 160 Z`}
                                    fill={`${color}15`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5, duration: 0.8 }}
                                />
                                {/* Line */}
                                <motion.path
                                    d={`M0 ${160 - currentData.chartData[0] * 1.6} ${currentData.chartData.map((v, i) => `L${i * 40 + 40} ${160 - v * 1.6}`).join(' ')}`}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ delay: 0.6, duration: 1.2, ease: "easeOut" }}
                                />
                                {/* Dots */}
                                {currentData.chartData.map((v, i) => (
                                    <motion.circle
                                        key={i}
                                        cx={i * 40 + 40}
                                        cy={160 - v * 1.6}
                                        r="4"
                                        fill="white"
                                        stroke={color}
                                        strokeWidth="2"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.8 + i * 0.08 }}
                                    />
                                ))}
                            </svg>
                            <div className="flex justify-between mt-2 px-2">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                                    <span key={day} className="text-[8px] md:text-[9px] text-gray-400">{day}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {featureIndex === 1 && (
                        /* Funnel Chart for Leads */
                        <div className="flex items-center justify-center h-32 md:h-40 gap-2">
                            <div className="flex flex-col gap-1 flex-1">
                                {[
                                    { label: 'Visitors', value: 100, count: '2.8K' },
                                    { label: 'Leads', value: 75, count: '342' },
                                    { label: 'Qualified', value: 50, count: '89' },
                                    { label: 'Converted', value: 30, count: '67' }
                                ].map((stage, i) => (
                                    <motion.div
                                        key={stage.label}
                                        className="relative rounded-r-lg overflow-hidden flex items-center"
                                        style={{
                                            backgroundColor: `${color}${20 + i * 15}`,
                                            height: '22%'
                                        }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${stage.value}%` }}
                                        transition={{ delay: 0.5 + i * 0.15, duration: 0.6 }}
                                    >
                                        <span className="text-[9px] md:text-[10px] font-medium text-gray-700 ml-2">{stage.label}</span>
                                        <span className="text-[9px] md:text-[10px] font-bold ml-auto mr-2" style={{ color }}>{stage.count}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}

                    {featureIndex === 2 && (
                        /* Donut Chart for AI Calls */
                        <div className="flex items-center justify-center h-32 md:h-40 gap-6">
                            <div className="relative w-32 h-32">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                    {/* Background circle */}
                                    <circle cx="50" cy="50" r="40" fill="none" stroke="#f0f0f0" strokeWidth="12" />
                                    {/* Animated segments */}
                                    {[
                                        { value: 92, color: color, label: 'Success' },
                                        { value: 5, color: '#F59E0B', label: 'Pending' },
                                        { value: 3, color: '#EF4444', label: 'Missed' }
                                    ].map((segment, i) => {
                                        const prevTotal = [0, 92, 97][i];
                                        const circumference = 2 * Math.PI * 40;
                                        const offset = (prevTotal / 100) * circumference;
                                        const length = (segment.value / 100) * circumference;

                                        return (
                                            <motion.circle
                                                key={i}
                                                cx="50"
                                                cy="50"
                                                r="40"
                                                fill="none"
                                                stroke={segment.color}
                                                strokeWidth="12"
                                                strokeDasharray={`${length} ${circumference}`}
                                                strokeDashoffset={-offset}
                                                strokeLinecap="round"
                                                initial={{ strokeDasharray: `0 ${circumference}` }}
                                                animate={{ strokeDasharray: `${length} ${circumference}` }}
                                                transition={{ delay: 0.5 + i * 0.2, duration: 0.8 }}
                                            />
                                        );
                                    })}
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <motion.div
                                        className="text-xl md:text-2xl font-bold"
                                        style={{ color }}
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 1.2 }}
                                    >
                                        92%
                                    </motion.div>
                                    <div className="text-[9px] text-gray-500">Success</div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                {[
                                    { label: 'Success', value: '92%', color: color },
                                    { label: 'Pending', value: '5%', color: '#F59E0B' },
                                    { label: 'Missed', value: '3%', color: '#EF4444' }
                                ].map((item, i) => (
                                    <motion.div
                                        key={item.label}
                                        className="flex items-center gap-2"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.8 + i * 0.1 }}
                                    >
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-[10px] text-gray-600">{item.label}</span>
                                        <span className="text-[10px] font-semibold ml-auto" style={{ color: item.color }}>{item.value}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}

                    {featureIndex === 3 && (
                        /* Stacked Area for Messages */
                        <div className="h-32 md:h-40 relative">
                            <svg className="w-full h-full" viewBox="0 0 280 160">
                                {/* WhatsApp area */}
                                <motion.path
                                    d={`M0 160 L0 ${160 - currentData.chartData[0] * 0.8} ${currentData.chartData.map((v, i) => `L${i * 40 + 40} ${160 - v * 0.8}`).join(' ')} L280 160 Z`}
                                    fill={`${color}40`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5, duration: 0.6 }}
                                />
                                {/* SMS area */}
                                <motion.path
                                    d={`M0 160 L0 ${160 - currentData.chartData[0] * 0.5} ${currentData.chartData.map((v, i) => `L${i * 40 + 40} ${160 - v * 0.5}`).join(' ')} L280 160 Z`}
                                    fill={`#3B82F640`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.7, duration: 0.6 }}
                                />
                            </svg>
                            <div className="flex justify-between mt-2 px-2">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                                    <span key={day} className="text-[8px] md:text-[9px] text-gray-400">{day}</span>
                                ))}
                            </div>
                            <div className="flex gap-4 mt-2 justify-center">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                                    <span className="text-[9px] text-gray-600">WhatsApp</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-sm bg-blue-500" />
                                    <span className="text-[9px] text-gray-600">SMS</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {featureIndex === 4 && (
                        /* Bar Chart for Ad Performance */
                        <div className="flex items-end gap-1.5 md:gap-2 h-32 md:h-40">
                            {currentData.chartData.map((value, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    <motion.div
                                        className="w-full rounded-t-lg relative overflow-hidden"
                                        style={{ backgroundColor: `${color}20` }}
                                        initial={{ height: 0 }}
                                        animate={{ height: `${value}%` }}
                                        transition={{ delay: 0.5 + i * 0.08, duration: 0.6, ease: "easeOut" }}
                                    >
                                        <motion.div
                                            className="absolute inset-0 rounded-t-lg"
                                            style={{ backgroundColor: color }}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: i === featureIndex % 7 ? 1 : 0.4 }}
                                            transition={{ duration: 0.3 }}
                                        />
                                        {i === featureIndex % 7 && (
                                            <motion.div
                                                className="absolute inset-0 bg-white/20"
                                                animate={{ opacity: [0, 0.5, 0] }}
                                                transition={{ duration: 1.5, repeat: Infinity }}
                                            />
                                        )}
                                    </motion.div>
                                    <span className="text-[8px] md:text-[9px] text-gray-400">
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                    <h3 className="text-xs md:text-sm font-semibold text-[#0B1F3A] mb-3">Recent Activity</h3>
                    <div className="space-y-2">
                        {currentData.recentActivity.map((activity, i) => (
                            <motion.div
                                key={i}
                                className="flex items-center gap-2 md:gap-3 p-2 md:p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 1.2 + i * 0.1 }}
                            >
                                <motion.div
                                    className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                                    style={{ backgroundColor: statusColors[activity.status as keyof typeof statusColors] }}
                                    animate={activity.status === 'live' ? { scale: [1, 1.1, 1] } : {}}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    {activity.name.charAt(0)}
                                </motion.div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs md:text-sm font-medium text-gray-900 truncate">
                                        {activity.name}
                                    </div>
                                    <div className="text-[10px] md:text-xs text-gray-500 truncate">
                                        {activity.action}
                                    </div>
                                </div>
                                <div className="text-[9px] md:text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                                    {activity.time}
                                </div>
                                {activity.status === 'live' && (
                                    <motion.div
                                        className="w-2 h-2 rounded-full bg-green-400"
                                        animate={{ opacity: [1, 0.3, 1] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    />
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Apple-Style Fullscreen Cinematic Scroll Section
export function AppleStyleShowcase() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ['start start', 'end end']
    });

    const smoothProgress = useSpring(scrollYProgress, { stiffness: 50, damping: 30 });
    const isInView = useInView(containerRef, { margin: "-20% 0px -20% 0px" });

    const [animationState, setAnimationState] = React.useState({
        scale: 0.88,
        opacity: 0,
        y: 40,
        rotateX: 5,
        blur: 8,
        textOpacity: 0,
        featureIndex: 0,
    });

    // Audio narration state
    const [selectedLanguage, setSelectedLanguage] = React.useState<'en' | 'hi' | 'pa'>('en');
    const [isMuted, setIsMuted] = React.useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const prevFeatureIndex = useRef<number>(-1);

    React.useEffect(() => {
        const unsubscribe = smoothProgress.on('change', (latest) => {
            let scale = 0.88, opacity = 0, y = 40, rotateX = 5, blur = 8, textOpacity = 0, featureIndex = 0;

            if (latest < 0.1) {
                const phase = latest / 0.1;
                const eased = 1 - Math.pow(1 - phase, 3);
                scale = 0.88 + (eased * 0.12);
                opacity = eased;
                y = 40 - (eased * 40);
                rotateX = 5 - (eased * 5);
                blur = 8 - (eased * 8);
            } else if (latest < 0.18) {
                scale = 1; opacity = 1; y = 0; rotateX = 0; blur = 0;
                textOpacity = (latest - 0.1) / 0.08;
                featureIndex = 0;
            } else if (latest < 0.35) {
                scale = 1; opacity = 1; y = 0; rotateX = 0; blur = 0; textOpacity = 1;
                featureIndex = 0;
            } else if (latest < 0.5) {
                scale = 1; opacity = 1; y = 0; rotateX = 0; blur = 0; textOpacity = 1;
                featureIndex = 1;
            } else if (latest < 0.65) {
                scale = 1; opacity = 1; y = 0; rotateX = 0; blur = 0; textOpacity = 1;
                featureIndex = 2;
            } else if (latest < 0.8) {
                scale = 1; opacity = 1; y = 0; rotateX = 0; blur = 0; textOpacity = 1;
                featureIndex = 3;
            } else if (latest < 0.92) {
                scale = 1; opacity = 1; y = 0; rotateX = 0; blur = 0; textOpacity = 1;
                featureIndex = 4;
            } else {
                const phase = (latest - 0.92) / 0.08;
                const eased = phase * phase;
                scale = 1 - (eased * 0.08);
                opacity = 1 - (eased * 0.25);
                y = eased * -25;
                blur = eased * 4;
                textOpacity = 1 - eased;
                featureIndex = 4;
            }

            setAnimationState({ scale, opacity, y, rotateX, blur, textOpacity, featureIndex });
        });
        return () => unsubscribe();
    }, [smoothProgress]);

    // Play audio when feature changes
    React.useEffect(() => {
        if (prevFeatureIndex.current !== animationState.featureIndex && animationState.textOpacity > 0.5 && !isMuted && isInView) {
            prevFeatureIndex.current = animationState.featureIndex;

            // Stop current audio if playing
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }

            // Play new audio for this feature
            const audioPath = `/audio/showcase/${selectedLanguage}/feature-${animationState.featureIndex}.mp3`;
            audioRef.current = new Audio(audioPath);
            audioRef.current.volume = 0.7;
            audioRef.current.play().catch((err) => {
                // Auto-play might be blocked, user needs to interact first
                console.log('Audio autoplay prevented:', err);
            });
        }
    }, [animationState.featureIndex, animationState.textOpacity, selectedLanguage, isMuted, isInView]);

    // Cleanup audio when scrolling away
    React.useEffect(() => {
        if (!isInView && audioRef.current) {
            audioRef.current.pause();
        }
    }, [isInView]);

    const features = [
        { title: 'Complete Dashboard', subtitle: 'Monitor everything in real-time', icon: '📊', color: '#6FB63A' },
        { title: 'Lead Pipeline', subtitle: 'Track leads from first contact to close', icon: '👥', color: '#3B82F6' },
        { title: 'AI Voice Agent', subtitle: '24/7 calls with live analytics', icon: '🎙️', color: '#8B5CF6' },
        { title: 'Smart Messaging', subtitle: 'WhatsApp & SMS at scale', icon: '💬', color: '#10B981' },
        { title: 'Ad Performance', subtitle: 'Optimize every campaign dollar', icon: '📈', color: '#F59E0B' },
    ];

    const currentFeature = features[animationState.featureIndex];

    const languages = [
        { code: 'en' as const, label: 'English', flag: '🇬🇧' },
        { code: 'hi' as const, label: 'हिंदी', flag: '🇮🇳' },
    ];

    return (
        <div
            ref={containerRef}
            className="relative"
            style={{ height: '450vh', background: 'linear-gradient(180deg, #F0F4F8 0%, #ffffff 10%, #ffffff 90%, #F0F4F8 100%)' }}
        >
            <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
                {/* Subtle animated gradient */}
                <motion.div
                    className="absolute inset-0 pointer-events-none"
                    animate={{ background: `radial-gradient(ellipse 50% 35% at 50% 45%, ${currentFeature.color}08 0%, transparent 45%)` }}
                    transition={{ duration: 0.6 }}
                />

                {/* Fixed Language & Audio Controls - Bottom Right */}
                <motion.div
                    className="fixed bottom-8 right-8 z-50 flex flex-col gap-3"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: animationState.opacity > 0.5 ? 1 : 0, scale: animationState.opacity > 0.5 ? 1 : 0.9 }}
                    transition={{ duration: 0.4 }}
                >
                    {/* Language Selector */}
                    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-2 shadow-2xl border-2 border-gray-200/50">
                        <div className="flex flex-col gap-2">
                            {languages.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => setSelectedLanguage(lang.code)}
                                    className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 min-w-[140px] ${selectedLanguage === lang.code
                                        ? 'bg-gradient-to-r from-[#6FB63A] to-[#5a9b2e] text-white shadow-lg scale-105'
                                        : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                >
                                    <span className="text-xl">{lang.flag}</span>
                                    <span>{lang.label}</span>
                                    {selectedLanguage === lang.code && (
                                        <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mute/Unmute Button */}
                    <button
                        onClick={() => {
                            setIsMuted(!isMuted);
                            if (audioRef.current) {
                                audioRef.current.pause();
                            }
                        }}
                        className="p-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-gray-200/50 hover:bg-white transition-all group"
                        title={isMuted ? 'Unmute narration' : 'Mute narration'}
                    >
                        {isMuted ? (
                            <svg className="w-6 h-6 text-gray-600 group-hover:text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6 text-[#6FB63A] group-hover:text-[#5a9b2e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                        )}
                    </button>
                </motion.div>

                {/* Feature Text */}
                <motion.div
                    className="absolute top-[5%] left-1/2 -translate-x-1/2 text-center z-20 w-full max-w-3xl px-6"
                    style={{ opacity: animationState.textOpacity }}
                >
                    <motion.div
                        key={animationState.featureIndex}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-2"
                    >
                        <motion.span
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-medium tracking-widest uppercase rounded-full border backdrop-blur-sm"
                            style={{ color: currentFeature.color, backgroundColor: `${currentFeature.color}10`, borderColor: `${currentFeature.color}20` }}
                        >
                            <span className="text-sm">{currentFeature.icon}</span>
                            {animationState.featureIndex + 1} / {features.length}
                        </motion.span>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#0B1F3A]" style={{ letterSpacing: '-0.02em' }}>
                            {currentFeature.title}
                        </h2>
                        <p className="text-sm sm:text-base md:text-lg text-[#5B6A7F] max-w-md mx-auto">
                            {currentFeature.subtitle}
                        </p>
                    </motion.div>
                </motion.div>

                {/* Dashboard Mockup */}
                <motion.div
                    className="relative z-10 w-[90vw] max-w-5xl mx-auto mt-20"
                    style={{
                        transform: `scale(${animationState.scale}) translateY(${animationState.y}px) perspective(1400px) rotateX(${animationState.rotateX}deg)`,
                        opacity: animationState.opacity,
                        filter: `blur(${animationState.blur}px)`,
                    }}
                >
                    {/* Shadow */}
                    <motion.div
                        className="absolute -bottom-6 left-[10%] right-[10%] h-16 rounded-[50%] blur-xl"
                        animate={{ backgroundColor: `${currentFeature.color}20` }}
                        transition={{ duration: 0.5 }}
                    />

                    {/* Browser Frame */}
                    <div className="relative bg-white rounded-xl md:rounded-2xl shadow-[0_20px_60px_-15px_rgba(11,31,58,0.25)] overflow-hidden border border-gray-200/50">
                        {/* Browser Header */}
                        <div className="flex items-center gap-2 px-3 md:px-4 py-2.5 bg-gradient-to-b from-[#f8f9fb] to-[#f1f3f5] border-b border-gray-200/70">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#ff5f57] shadow-sm" />
                                <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#ffbd2e] shadow-sm" />
                                <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#28c840] shadow-sm" />
                            </div>
                            <div className="flex-1 mx-4 md:mx-6">
                                <div className="bg-white rounded-md px-3 md:px-4 py-1 md:py-1.5 text-[10px] md:text-xs text-gray-500 flex items-center justify-center gap-1.5 border border-gray-200 max-w-xs mx-auto">
                                    <svg className="w-2.5 h-2.5 md:w-3 md:h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-gray-600 font-medium">crm.cybrikhq.com</span>
                                </div>
                            </div>
                        </div>

                        {/* Vibrant Dashboard Content */}
                        <div className="h-[350px] md:h-[450px] overflow-hidden relative">
                            <VibrantDashboardMockup
                                featureIndex={animationState.featureIndex}
                                color={currentFeature.color}
                            />
                        </div>
                    </div>
                </motion.div>

                {/* Scroll Indicator */}
                <motion.div
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5"
                    animate={{ opacity: animationState.scale < 0.95 ? [0.35, 0.65, 0.35] : 0.2 }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                >
                    <span className="text-[10px] uppercase tracking-widest text-[#5B6A7F]/50">Scroll to explore</span>
                    <motion.svg className="w-4 h-4 text-[#5B6A7F]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" animate={{ y: [0, 3, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </motion.svg>
                </motion.div>

                {/* Progress Dots */}
                <div className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
                    {features.map((feature, i) => (
                        <motion.div
                            key={i}
                            className="w-2 h-2 rounded-full border-[1.5px] cursor-pointer"
                            animate={{
                                backgroundColor: i === animationState.featureIndex ? feature.color : 'transparent',
                                borderColor: i === animationState.featureIndex ? feature.color : '#CBD5E1',
                                scale: i === animationState.featureIndex ? 1.25 : 1,
                            }}
                            transition={{ duration: 0.25 }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
