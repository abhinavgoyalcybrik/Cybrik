'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ChevronLeft,
    ChevronRight,
    Users,
    GraduationCap,
    Mic,
    Headphones,
    BookOpen,
    RotateCcw,
    Globe,
    Plane,
    Briefcase,
    School,
    MessageCircle,
    UserCheck,
    Target,
    Calendar,
    Sparkles
} from 'lucide-react';

interface OnboardingData {
    targetScore: number | null;
    examDate: string | null;
    testType: 'general' | 'academic' | null;
    attemptType: string | null;
    purpose: string | null;
    referralSource: string | null;
}

const TOTAL_STEPS = 6;

export default function OnboardingPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [data, setData] = useState<OnboardingData>({
        targetScore: null,
        examDate: null,
        testType: null,
        attemptType: null,
        purpose: null,
        referralSource: null,
    });
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    // Redirect if not authenticated
    useEffect(() => {
        const savedUser = localStorage.getItem('ielts_user');
        if (!savedUser) {
            router.push('/login');
        }
    }, [router]);

    // Check if onboarding already completed
    useEffect(() => {
        const completed = localStorage.getItem('ielts_onboarding_completed');
        if (completed === 'true') {
            router.push('/dashboard');
        }
    }, [router]);

    const handleNext = async () => {
        if (currentStep < TOTAL_STEPS) {
            setCurrentStep(currentStep + 1);
        } else {
            // Save data to backend
            try {
                const response = await fetch('/api/ielts/auth/onboarding/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(data),
                });

                if (response.ok) {
                    localStorage.setItem('ielts_onboarding_data', JSON.stringify(data));
                    localStorage.setItem('ielts_onboarding_completed', 'true');
                    router.push('/dashboard');
                } else {
                    // Still proceed but warn
                    localStorage.setItem('ielts_onboarding_data', JSON.stringify(data));
                    localStorage.setItem('ielts_onboarding_completed', 'true');
                    router.push('/dashboard');
                }
            } catch (error) {
                // Fallback to localStorage only
                localStorage.setItem('ielts_onboarding_data', JSON.stringify(data));
                localStorage.setItem('ielts_onboarding_completed', 'true');
                router.push('/dashboard');
            }
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const progressPercentage = (currentStep / TOTAL_STEPS) * 100;

    // Calendar helpers
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();
        return { daysInMonth, startingDay };
    };

    const { daysInMonth, startingDay } = getDaysInMonth(selectedMonth);
    const today = new Date();

    const isPastDate = (day: number) => {
        const checkDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
        return checkDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    };

    const questions = [
        "Why are you preparing for IELTS?",
        "Which IELTS test are you going to take?",
        "Are you taking IELTS for the first time or retaking it?",
        "What's your target band score?",
        "When do you plan to take the IELTS exam?",
        "One last thing - how did you hear about us?"
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#16263F] via-[#0B1F3A] to-[#061020] flex flex-col">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-[#6FB63A]/15 blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-[#16263F]/50 blur-3xl"></div>
            </div>

            {/* Header with back button and progress */}
            <div className="p-4 flex items-center gap-4 relative z-10">
                <button
                    onClick={handleBack}
                    disabled={currentStep === 1}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-white transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
                <span className="text-white/60 text-sm font-medium">{currentStep}/{TOTAL_STEPS}</span>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12 relative z-10">
                {/* Mascot & Question */}
                <div className="flex items-start gap-4 mb-10 max-w-xl w-full">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center flex-shrink-0 border border-white/20">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <div className="bg-white/10 backdrop-blur-xl text-white px-6 py-4 rounded-2xl rounded-tl-sm border border-white/20 flex-1">
                        <p className="font-semibold text-lg">
                            {questions[currentStep - 1]}
                        </p>
                    </div>
                </div>

                {/* Step Content */}
                <div className="max-w-xl w-full">
                    {/* Step 1: Purpose */}
                    {currentStep === 1 && (
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { id: 'study_abroad', label: 'Study abroad', icon: Plane, color: 'text-blue-400' },
                                { id: 'immigration', label: 'Immigration', icon: Globe, color: 'text-blue-400' },
                                { id: 'work_abroad', label: 'Work abroad', icon: Briefcase, color: 'text-amber-400' },
                                { id: 'local_university', label: 'Study at local university', icon: School, color: 'text-orange-400' },
                                { id: 'other', label: 'Other reasons', icon: MessageCircle, color: 'text-emerald-400' },
                                { id: 'teacher', label: 'I am an IELTS teacher', icon: UserCheck, color: 'text-rose-400' },
                            ].map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => { setData({ ...data, purpose: option.id }); handleNext(); }}
                                    className={`p-5 rounded-xl border-2 text-left transition-all flex items-center gap-3 bg-white/10 backdrop-blur-xl hover:bg-white/20
                                        ${data.purpose === option.id
                                            ? 'border-white bg-white/20'
                                            : 'border-white/20 hover:border-white/40'
                                        }`}
                                >
                                    <option.icon className={`w-5 h-5 ${option.color}`} />
                                    <span className="font-medium text-white">{option.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step 2: Test Type */}
                    {currentStep === 2 && (
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => { setData({ ...data, testType: 'general' }); handleNext(); }}
                                className={`p-8 rounded-xl border-2 text-center transition-all bg-white/10 backdrop-blur-xl hover:bg-white/20
                                    ${data.testType === 'general'
                                        ? 'border-white bg-white/20'
                                        : 'border-white/20 hover:border-white/40'
                                    }`}
                            >
                                <Users className="w-10 h-10 text-white mx-auto mb-3" />
                                <span className="font-bold text-white text-lg">General</span>
                                <p className="text-white/60 text-sm mt-2">For migration & work</p>
                            </button>
                            <button
                                onClick={() => { setData({ ...data, testType: 'academic' }); handleNext(); }}
                                className={`p-8 rounded-xl border-2 text-center transition-all bg-white/10 backdrop-blur-xl hover:bg-white/20
                                    ${data.testType === 'academic'
                                        ? 'border-white bg-white/20'
                                        : 'border-white/20 hover:border-white/40'
                                    }`}
                            >
                                <GraduationCap className="w-10 h-10 text-white mx-auto mb-3" />
                                <span className="font-bold text-white text-lg">Academic</span>
                                <p className="text-white/60 text-sm mt-2">For university study</p>
                            </button>
                        </div>
                    )}

                    {/* Step 3: First Time or Retake */}
                    {currentStep === 3 && (
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { id: 'first', label: 'My first time', icon: Users },
                                { id: 'writing', label: 'Writing retake', icon: BookOpen },
                                { id: 'speaking', label: 'Speaking retake', icon: Mic },
                                { id: 'listening', label: 'Listening retake', icon: Headphones },
                                { id: 'reading', label: 'Reading retake', icon: BookOpen },
                                { id: 'full', label: 'Full test retake', icon: RotateCcw },
                            ].map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => { setData({ ...data, attemptType: option.id }); handleNext(); }}
                                    className={`p-5 rounded-xl border-2 text-left transition-all flex items-center gap-3 bg-white/10 backdrop-blur-xl hover:bg-white/20
                                        ${data.attemptType === option.id
                                            ? 'border-white bg-white/20'
                                            : 'border-white/20 hover:border-white/40'
                                        }`}
                                >
                                    <option.icon className="w-5 h-5 text-white" />
                                    <span className="font-medium text-white">{option.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step 4: Target Score */}
                    {currentStep === 4 && (
                        <div className="flex flex-wrap gap-4 justify-center">
                            {[5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map((score) => (
                                <button
                                    key={score}
                                    onClick={() => { setData({ ...data, targetScore: score }); handleNext(); }}
                                    className={`w-20 h-20 rounded-2xl border-2 font-bold text-2xl transition-all bg-white/10 backdrop-blur-xl hover:bg-white/20 font-score
                                        ${data.targetScore === score
                                            ? 'border-white bg-white text-[#1e3a5f]'
                                            : 'border-white/20 text-white hover:border-white/40'
                                        }`}
                                >
                                    {score}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step 5: Exam Date */}
                    {currentStep === 5 && (
                        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                            {/* Month Navigation */}
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
                                    className="p-2 hover:bg-white/10 rounded-lg text-white"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="font-semibold text-white">
                                    {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </span>
                                <button
                                    onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
                                    className="p-2 hover:bg-white/10 rounded-lg text-white"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Day Headers */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                                    <div key={day} className="text-center text-sm text-white/40 py-2">{day}</div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1">
                                {Array.from({ length: startingDay }).map((_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const dateStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const isPast = isPastDate(day);
                                    return (
                                        <button
                                            key={day}
                                            disabled={isPast}
                                            onClick={() => { setData({ ...data, examDate: dateStr }); handleNext(); }}
                                            className={`p-2 text-center rounded-lg transition-all
                                                ${isPast ? 'text-white/20 cursor-not-allowed' : 'text-white hover:bg-white/20'}
                                                ${data.examDate === dateStr ? 'bg-white text-[#1e3a5f] font-bold' : ''}
                                            `}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* I don't know yet */}
                            <button
                                onClick={() => { setData({ ...data, examDate: 'unknown' }); handleNext(); }}
                                className="mt-6 w-full py-3 border-2 border-white/20 rounded-xl text-white hover:border-white/40 hover:bg-white/10 transition-all font-medium"
                            >
                                I don't know yet
                            </button>
                        </div>
                    )}

                    {/* Step 6: Referral Source */}
                    {currentStep === 6 && (
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { id: 'instagram', label: 'Instagram', emoji: '📷' },
                                { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
                                { id: 'friends', label: 'Friends/Family', emoji: '👋' },
                                { id: 'google', label: 'Google Search', emoji: '🔍' },
                                { id: 'facebook', label: 'Facebook', emoji: '📘' },
                                { id: 'youtube', label: 'Youtube', emoji: '▶️' },
                                { id: 'other', label: 'Other', emoji: '💬' },
                            ].map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => { setData({ ...data, referralSource: option.id }); handleNext(); }}
                                    className={`p-5 rounded-xl border-2 text-left transition-all flex items-center gap-3 bg-white/10 backdrop-blur-xl hover:bg-white/20
                                        ${data.referralSource === option.id
                                            ? 'border-white bg-white/20'
                                            : 'border-white/20 hover:border-white/40'
                                        }`}
                                >
                                    <span className="text-2xl">{option.emoji}</span>
                                    <span className="font-medium text-white">{option.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

