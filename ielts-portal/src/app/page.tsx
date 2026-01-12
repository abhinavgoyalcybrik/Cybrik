'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Upload,
    Sparkles,
    TrendingUp,
    Mic,
    PenTool,
    CheckCircle,
    Star,
    Award,
    Users,
    BookOpen,
    MessageCircle,
    ArrowRight,
    Play,
    Zap,
    Trophy,
    Target,
    Headphones
} from 'lucide-react';

export default function LandingPage() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const features = [
        {
            icon: PenTool,
            title: 'Writing Evaluation',
            description: 'Get instant AI feedback on Task 1 & Task 2 essays with accurate band score predictions.',
        },
        {
            icon: Mic,
            title: 'Speaking Practice',
            description: 'Record your responses and get detailed AI feedback on pronunciation and fluency.',
        },
        {
            icon: Headphones,
            title: 'Listening Tests',
            description: 'Practice with real IELTS-style listening tests and improve your comprehension.',
        },
        {
            icon: BookOpen,
            title: 'Reading Practice',
            description: 'Timed reading exercises with authentic passages and question types.',
        },
        {
            icon: MessageCircle,
            title: 'AI Tutor',
            description: 'Chat with our AI tutor to understand feedback and get personalized study tips.',
        },
        {
            icon: Zap,
            title: 'Instant Results',
            description: 'No waiting - get your evaluation results and feedback in seconds.',
        },
    ];

    const howItWorks = [
        {
            step: '01',
            icon: Upload,
            title: 'Upload or Record',
            description: 'Submit your IELTS writing task or record your speaking response.',
        },
        {
            step: '02',
            icon: Sparkles,
            title: 'AI Analysis',
            description: 'Our AI analyzes your response using official IELTS rubrics and criteria.',
        },
        {
            step: '03',
            icon: TrendingUp,
            title: 'Get Feedback',
            description: 'Receive detailed feedback and personalized tips to improve your score.',
        },
    ];

    const stats = [
        { value: '50K+', label: 'Active Learners' },
        { value: '4.8', label: 'Average Rating' },
        { value: '92%', label: 'Score Improvement' },
        { value: '1M+', label: 'Evaluations Done' },
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#E6ECF4]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
                    <div className="flex items-center justify-between h-16 sm:h-20">
                        <div className="flex items-center gap-2">
                            <img src="/logo.png" alt="Cybrik IELTS" className="h-10 w-auto" />
                        </div>
                        <nav className="hidden md:flex items-center gap-8">
                            <a href="#how-it-works" className="text-sm font-medium text-[#5B6A7F] hover:text-[#0B1F3A] transition-colors">
                                How It Works
                            </a>
                            <a href="#features" className="text-sm font-medium text-[#5B6A7F] hover:text-[#0B1F3A] transition-colors">
                                Features
                            </a>
                            <a href="#pricing" className="text-sm font-medium text-[#5B6A7F] hover:text-[#0B1F3A] transition-colors">
                                Pricing
                            </a>
                        </nav>
                        <div className="flex items-center gap-3">
                            <Link href="/login">
                                <button className="hidden sm:block px-4 py-2 text-sm font-medium text-[#0B1F3A] hover:text-[#6FB63A] transition-colors">
                                    Sign In
                                </button>
                            </Link>
                            <Link href="/register">
                                <button className="px-4 sm:px-6 py-2 sm:py-2.5 text-sm font-semibold bg-[#6FB63A] text-white rounded-lg hover:bg-[#5FA030] transition-colors shadow-md">
                                    Get Started Free
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative pt-28 sm:pt-32 lg:pt-40 pb-16 sm:pb-20 lg:pb-28 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white via-[#F8FAFC] to-[#E8F5DC]/30" />

                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-[0.03]">
                    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="heroGrid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                                <circle cx="30" cy="30" r="1.5" fill="#6FB63A" />
                                <path d="M30 0 L30 28 M60 30 L32 30" stroke="#6FB63A" strokeWidth="0.5" fill="none" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#heroGrid)" />
                    </svg>
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
                    <div className={`text-center max-w-4xl mx-auto transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                        {/* Badge */}
                        <div className="mb-4 sm:mb-6">
                            <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#6FB63A] animate-pulse" />
                                AI-Powered IELTS Preparation
                            </span>
                        </div>

                        {/* Main Heading */}
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#0B1F3A] mb-4 sm:mb-6" style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                            Know Your IELTS Score
                            <br />
                            <span className="text-[#6FB63A]">Before Test Day</span>
                        </h1>

                        {/* Subheading */}
                        <p className="text-base sm:text-lg lg:text-xl text-[#5B6A7F] mb-6 sm:mb-8 max-w-2xl mx-auto">
                            Get instant AI feedback on all IELTS modules.
                            Real band score estimates and personalized tips to boost your score.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-8 sm:mb-12">
                            <Link href="/register">
                                <button className="group w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-sm font-semibold bg-[#6FB63A] text-white rounded-lg shadow-lg shadow-[#6FB63A]/25 hover:shadow-[#6FB63A]/35 hover:bg-[#5FA030] transition-all">
                                    <span className="flex items-center justify-center gap-2">
                                        Try It Free
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                    </span>
                                </button>
                            </Link>
                            <a href="#how-it-works">
                                <button className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-sm font-semibold text-[#0B1F3A] border-2 border-[#E6ECF4] rounded-lg hover:border-[#6FB63A] transition-colors">
                                    <span className="flex items-center justify-center gap-2">
                                        <Play className="w-4 h-4" />
                                        See How It Works
                                    </span>
                                </button>
                            </a>
                        </div>

                        {/* Trust Badges */}
                        <div className="flex flex-wrap justify-center gap-6 sm:gap-8 text-sm text-[#8494A7]">
                            <span className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-[#6FB63A]" />
                                No credit card required
                            </span>
                            <span className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-[#6FB63A]" />
                                4 free evaluations
                            </span>
                            <span className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-[#6FB63A]" />
                                Instant results
                            </span>
                        </div>
                    </div>

                    {/* Demo Card */}
                    <div className={`mt-12 sm:mt-16 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
                        <div className="relative max-w-3xl mx-auto">
                            <div className="absolute -inset-4 bg-gradient-to-r from-[#6FB63A]/10 to-[#0B1F3A]/10 blur-3xl rounded-3xl" />
                            <div className="relative bg-white border border-[#E6ECF4] rounded-2xl p-6 sm:p-8 shadow-xl">
                                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#E6ECF4]">
                                    <div className="w-3 h-3 rounded-full bg-red-400" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                    <div className="w-3 h-3 rounded-full bg-green-400" />
                                    <span className="ml-2 text-sm text-[#8494A7]">IELTS Writing Evaluation</span>
                                </div>
                                <div className="flex flex-col sm:flex-row items-start gap-6">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#6FB63A] to-[#4CAF50] flex items-center justify-center text-white text-2xl font-bold animate-float shadow-lg">
                                        7.5
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-[#0B1F3A] mb-4">Your Band Score Breakdown</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { name: 'Task Achievement', score: 7 },
                                                { name: 'Coherence & Cohesion', score: 8 },
                                                { name: 'Lexical Resource', score: 7 },
                                                { name: 'Grammar', score: 8 },
                                            ].map((item) => (
                                                <div key={item.name} className="flex justify-between items-center bg-[#F8FAFC] px-4 py-2 rounded-lg">
                                                    <span className="text-[#5B6A7F] text-sm">{item.name}</span>
                                                    <span className="font-bold text-[#6FB63A]">{item.score}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-12 sm:py-16 bg-[#0B1F3A]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
                        {stats.map((stat) => (
                            <div key={stat.label} className="text-center p-4 sm:p-6">
                                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#6FB63A] mb-1 sm:mb-2">
                                    {stat.value}
                                </div>
                                <div className="text-xs sm:text-sm text-[#B0BDCC] uppercase tracking-wider">
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="py-16 sm:py-20 lg:py-28 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
                    <div className="text-center mb-12 sm:mb-16">
                        <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full mb-4 sm:mb-6">
                            How It Works
                        </span>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#0B1F3A] mb-4" style={{ letterSpacing: '-0.02em' }}>
                            Get Your Band Score
                            <br />
                            <span className="text-[#6FB63A]">In 3 Simple Steps</span>
                        </h2>
                        <p className="text-base sm:text-lg text-[#5B6A7F] max-w-2xl mx-auto">
                            Upload your work, let AI analyze it, and get instant professional feedback.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
                        {howItWorks.map((item, i) => (
                            <div key={item.step} className="relative">
                                {/* Removed connecting lines */}
                                <div className="text-5xl sm:text-6xl font-bold text-[#E8F5DC] mb-4">{item.step}</div>
                                <div className="w-12 h-12 mb-4 bg-[#E8F5DC] text-[#6FB63A] rounded-lg flex items-center justify-center">
                                    <item.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg sm:text-xl font-semibold text-[#0B1F3A] mb-2">{item.title}</h3>
                                <p className="text-sm sm:text-base text-[#5B6A7F]">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="py-16 sm:py-20 lg:py-28 bg-[#F8FAFC]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
                    <div className="text-center mb-12 sm:mb-16">
                        <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full mb-4 sm:mb-6">
                            Platform Features
                        </span>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#0B1F3A] mb-4" style={{ letterSpacing: '-0.02em' }}>
                            Everything You Need
                            <br />
                            <span className="text-[#6FB63A]">For IELTS Success</span>
                        </h2>
                        <p className="text-base sm:text-lg text-[#5B6A7F] max-w-2xl mx-auto">
                            Comprehensive tools powered by AI to help you achieve your target band score.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {features.map((feature) => (
                            <div
                                key={feature.title}
                                className="group p-6 sm:p-8 bg-white border border-[#E6ECF4] rounded-xl hover:border-[#6FB63A]/50 hover:shadow-xl transition-all duration-300"
                            >
                                <div className="w-12 h-12 flex items-center justify-center mb-4 sm:mb-6 bg-[#E8F5DC] text-[#6FB63A] rounded-lg group-hover:bg-[#6FB63A] group-hover:text-white transition-colors">
                                    <feature.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg sm:text-xl font-semibold text-[#0B1F3A] mb-2 sm:mb-3">
                                    {feature.title}
                                </h3>
                                <p className="text-sm sm:text-base text-[#5B6A7F] leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="py-16 sm:py-20 lg:py-28 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
                    <div className="text-center mb-12 sm:mb-16">
                        <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase text-[#6FB63A] bg-[#E8F5DC] rounded-full mb-4 sm:mb-6">
                            Pricing
                        </span>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#0B1F3A] mb-4" style={{ letterSpacing: '-0.02em' }}>
                            Simple, Affordable Pricing
                        </h2>
                        <p className="text-base sm:text-lg text-[#5B6A7F] max-w-2xl mx-auto">
                            Start free, upgrade when you need more evaluations.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
                        {/* Free Plan */}
                        <div className="p-6 sm:p-8 bg-white border border-[#E6ECF4] rounded-xl">
                            <div className="text-sm font-semibold text-[#6FB63A] uppercase tracking-wider mb-2">Free</div>
                            <div className="flex items-baseline gap-1 mb-4">
                                <span className="text-4xl font-bold text-[#0B1F3A]">₹0</span>
                                <span className="text-[#8494A7]">/forever</span>
                            </div>
                            <p className="text-sm text-[#5B6A7F] mb-6">Perfect for trying out our AI evaluation.</p>
                            <ul className="space-y-3 mb-8">
                                {['4 free evaluations', 'All module scoring', 'AI Tutor access (limited)', 'Unlimited practice questions', 'Community support'].map((item) => (
                                    <li key={item} className="flex items-center gap-2 text-sm text-[#3D4B5C]">
                                        <CheckCircle className="w-4 h-4 text-[#6FB63A] flex-shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/register">
                                <button className="w-full py-3 text-sm font-semibold text-[#0B1F3A] border-2 border-[#E6ECF4] rounded-lg hover:border-[#6FB63A] transition-colors">
                                    Get Started
                                </button>
                            </Link>
                        </div>

                        {/* Premium Plan */}
                        <div className="p-6 sm:p-8 bg-[#0B1F3A] border-2 border-[#6FB63A] rounded-xl relative">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-semibold bg-[#6FB63A] text-white rounded-full">
                                Most Popular
                            </div>
                            <div className="text-sm font-semibold text-[#6FB63A] uppercase tracking-wider mb-2">Premium</div>
                            <div className="flex items-baseline gap-1 mb-4">
                                <span className="text-4xl font-bold text-white">₹499</span>
                                <span className="text-[#8494A7]">/month</span>
                            </div>
                            <p className="text-sm text-[#B0BDCC] mb-6">For serious IELTS preparation.</p>
                            <ul className="space-y-3 mb-8">
                                {['Unlimited evaluations', 'All free features', 'Priority AI analysis', 'Full AI Tutor access', 'Detailed progress reports', 'Email support'].map((item) => (
                                    <li key={item} className="flex items-center gap-2 text-sm text-white">
                                        <CheckCircle className="w-4 h-4 text-[#6FB63A] flex-shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/register">
                                <button className="w-full py-3 text-sm font-semibold bg-[#6FB63A] text-white rounded-lg hover:bg-[#5FA030] transition-colors shadow-lg">
                                    Start Premium
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 sm:py-20 lg:py-28 bg-[#0B1F3A]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-[#6FB63A]/20 rounded-full">
                        <Award className="w-8 h-8 text-[#6FB63A]" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6" style={{ letterSpacing: '-0.02em' }}>
                        Start Improving Your
                        <br />
                        <span className="text-[#6FB63A]">IELTS Score Today</span>
                    </h2>
                    <p className="text-sm sm:text-base lg:text-lg text-[#B0BDCC] mb-8 sm:mb-10 max-w-2xl mx-auto">
                        Join thousands of learners who have achieved their target band scores with our AI-powered platform.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link href="/register">
                            <button className="w-full sm:w-auto px-8 py-4 text-sm font-semibold bg-[#6FB63A] text-white rounded-lg shadow-lg hover:bg-[#5FA030] transition-colors">
                                Get Started Free
                            </button>
                        </Link>
                        <Link href="/login">
                            <button className="w-full sm:w-auto px-8 py-4 text-sm font-semibold text-white border-2 border-[#16263F] rounded-lg hover:border-[#6FB63A] transition-colors">
                                Sign In
                            </button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 sm:py-12 bg-[#0F1929] border-t border-[#16263F]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8 pb-8 border-b border-[#16263F]">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <img src="/logo.png" alt="Cybrik IELTS" className="h-8 w-auto brightness-0 invert" />
                            </div>
                            <p className="text-sm text-[#8494A7]">
                                AI-powered IELTS preparation to help you achieve your target band score.
                            </p>
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Product</h4>
                            <ul className="space-y-2">
                                <li><a href="#features" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">Features</a></li>
                                <li><a href="#pricing" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">Pricing</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Company</h4>
                            <ul className="space-y-2">
                                <li><a href="https://cybriksolutions.com" target="_blank" rel="noopener noreferrer" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">About Us</a></li>
                                <li><a href="#" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">Contact</a></li>
                                <li><a href="#" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">Blog</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Legal</h4>
                            <ul className="space-y-2">
                                <li><a href="#" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">Privacy Policy</a></li>
                                <li><a href="#" className="text-sm text-[#8494A7] hover:text-[#6FB63A] transition-colors">Terms of Service</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-xs sm:text-sm text-[#5B6A7F]">
                            © {new Date().getFullYear()} Cybrik Solutions. All rights reserved.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
