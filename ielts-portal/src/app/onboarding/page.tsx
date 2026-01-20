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
        const savedUserStr = localStorage.getItem('ielts_user');

        let userCompleted = false;
        if (savedUserStr) {
            try {
                const savedUser = JSON.parse(savedUserStr);
                userCompleted = savedUser.onboarding_completed === true;
            } catch (e) {
                // ignore
            }
        }

        // Only redirect if explicitly true in user object (source of truth)
        if (userCompleted) {
            router.push('/dashboard');
        }
    }, [router]);

    const handleNext = async () => {
        if (currentStep < TOTAL_STEPS) {
            setCurrentStep(currentStep + 1);
        } else {
            // Save data to backend and update user object
            try {
                const response = await fetch('/api/ielts/auth/onboarding/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(data),
                });

                // Update user object in localStorage with onboarding_completed flag
                const savedUserStr = localStorage.getItem('ielts_user');
                if (savedUserStr) {
                    try {
                        const savedUser = JSON.parse(savedUserStr);
                        savedUser.onboarding_completed = true;
                        localStorage.setItem('ielts_user', JSON.stringify(savedUser));
                    } catch (e) {
                        // ignore parse errors
                    }
                }

                localStorage.setItem('ielts_onboarding_data', JSON.stringify(data));
                localStorage.setItem('ielts_onboarding_completed', 'true');
                router.push('/dashboard');
            } catch (error) {
                // Fallback - still update localStorage and redirect
                const savedUserStr = localStorage.getItem('ielts_user');
                if (savedUserStr) {
                    try {
                        const savedUser = JSON.parse(savedUserStr);
                        savedUser.onboarding_completed = true;
                        localStorage.setItem('ielts_user', JSON.stringify(savedUser));
                    } catch (e) {
                        // ignore parse errors
                    }
                }
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
        <div className="min-h-screen bg-[var(--cy-bg-page)] flex flex-col">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-[var(--cy-lime)]/10 blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-[var(--cy-navy)]/5 blur-3xl"></div>
            </div>

            {/* Header with back button and progress */}
            <div className="p-4 flex items-center gap-4 relative z-10">
                <button
                    onClick={handleBack}
                    disabled={currentStep === 1}
                    className="p-2 hover:bg-[var(--cy-bg-alt)] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="w-6 h-6 text-[var(--cy-text-primary)]" />
                </button>
                <div className="flex-1 h-2 bg-[var(--cy-border)] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[var(--cy-lime)] transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
                <span className="text-[var(--cy-text-muted)] text-sm font-medium">{currentStep}/{TOTAL_STEPS}</span>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12 relative z-10">
                {/* Mascot & Question */}
                <div className="flex items-start gap-4 mb-10 max-w-xl w-full">
                    <div className="w-16 h-16 bg-[var(--cy-lime-light)] rounded-full flex items-center justify-center flex-shrink-0 border border-[var(--cy-lime)]/20">
                        <Sparkles className="w-8 h-8 text-[var(--cy-lime)]" />
                    </div>
                    <div className="bg-[var(--cy-bg-surface)] shadow-md text-[var(--cy-text-primary)] px-6 py-4 rounded-2xl rounded-tl-sm border border-[var(--cy-border)] flex-1">
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
                                { id: 'study_abroad', label: 'Study abroad', icon: Plane, color: 'text-blue-500' },
                                { id: 'immigration', label: 'Immigration', icon: Globe, color: 'text-blue-500' },
                                { id: 'work_abroad', label: 'Work abroad', icon: Briefcase, color: 'text-amber-500' },
                                { id: 'local_university', label: 'Study at local university', icon: School, color: 'text-orange-500' },
                                { id: 'other', label: 'Other reasons', icon: MessageCircle, color: 'text-emerald-500' },
                                { id: 'teacher', label: 'I am an IELTS teacher', icon: UserCheck, color: 'text-rose-500' },
                            ].map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => { setData({ ...data, purpose: option.id }); handleNext(); }}
                                    className={`p-5 rounded-xl border-2 text-left transition-all flex items-center gap-3 bg-[var(--cy-bg-surface)] hover:bg-[var(--cy-bg-surface-hover)] shadow-sm hover:shadow-md
                                        ${data.purpose === option.id
                                            ? 'border-[var(--cy-lime)] bg-[var(--cy-lime-light)]'
                                            : 'border-[var(--cy-border)] hover:border-[var(--cy-lime)]'
                                        }`}
                                >
                                    <option.icon className={`w-5 h-5 ${option.color}`} />
                                    <span className="font-medium text-[var(--cy-text-primary)]">{option.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step 2: Test Type */}
                    {currentStep === 2 && (
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => { setData({ ...data, testType: 'general' }); handleNext(); }}
                                className={`p-8 rounded-xl border-2 text-center transition-all bg-[var(--cy-bg-surface)] hover:bg-[var(--cy-bg-surface-hover)] shadow-sm hover:shadow-md
                                    ${data.testType === 'general'
                                        ? 'border-[var(--cy-lime)] bg-[var(--cy-lime-light)]'
                                        : 'border-[var(--cy-border)] hover:border-[var(--cy-lime)]'
                                    }`}
                            >
                                <Users className="w-10 h-10 text-[var(--cy-navy)] mx-auto mb-3" />
                                <span className="font-bold text-[var(--cy-text-primary)] text-lg">General</span>
                                <p className="text-[var(--cy-text-secondary)] text-sm mt-2">For migration & work</p>
                            </button>
                            <button
                                onClick={() => { setData({ ...data, testType: 'academic' }); handleNext(); }}
                                className={`p-8 rounded-xl border-2 text-center transition-all bg-[var(--cy-bg-surface)] hover:bg-[var(--cy-bg-surface-hover)] shadow-sm hover:shadow-md
                                    ${data.testType === 'academic'
                                        ? 'border-[var(--cy-lime)] bg-[var(--cy-lime-light)]'
                                        : 'border-[var(--cy-border)] hover:border-[var(--cy-lime)]'
                                    }`}
                            >
                                <GraduationCap className="w-10 h-10 text-[var(--cy-navy)] mx-auto mb-3" />
                                <span className="font-bold text-[var(--cy-text-primary)] text-lg">Academic</span>
                                <p className="text-[var(--cy-text-secondary)] text-sm mt-2">For university study</p>
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
                                    className={`p-5 rounded-xl border-2 text-left transition-all flex items-center gap-3 bg-[var(--cy-bg-surface)] hover:bg-[var(--cy-bg-surface-hover)] shadow-sm hover:shadow-md
                                        ${data.attemptType === option.id
                                            ? 'border-[var(--cy-lime)] bg-[var(--cy-lime-light)]'
                                            : 'border-[var(--cy-border)] hover:border-[var(--cy-lime)]'
                                        }`}
                                >
                                    <option.icon className="w-5 h-5 text-[var(--cy-navy)]" />
                                    <span className="font-medium text-[var(--cy-text-primary)]">{option.label}</span>
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
                                    className={`w-20 h-20 rounded-2xl border-2 font-bold text-2xl transition-all bg-[var(--cy-bg-surface)] hover:bg-[var(--cy-bg-surface-hover)] shadow-sm hover:shadow-md font-score
                                        ${data.targetScore === score
                                            ? 'border-[var(--cy-lime)] bg-[var(--cy-lime)] text-white'
                                            : 'border-[var(--cy-border)] text-[var(--cy-text-primary)] hover:border-[var(--cy-lime)]'
                                        }`}
                                >
                                    {score}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step 5: Exam Date */}
                    {currentStep === 5 && (
                        <div className="bg-[var(--cy-bg-surface)] rounded-2xl p-6 border border-[var(--cy-border)] shadow-md">
                            {/* Month Navigation */}
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
                                    className="p-2 hover:bg-[var(--cy-bg-alt)] rounded-lg text-[var(--cy-text-primary)]"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="font-semibold text-[var(--cy-text-primary)]">
                                    {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </span>
                                <button
                                    onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
                                    className="p-2 hover:bg-[var(--cy-bg-alt)] rounded-lg text-[var(--cy-text-primary)]"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Day Headers */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                                    <div key={day} className="text-center text-sm text-[var(--cy-text-muted)] py-2">{day}</div>
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
                                                ${isPast ? 'text-[var(--cy-text-muted)]/40 cursor-not-allowed' : 'text-[var(--cy-text-primary)] hover:bg-[var(--cy-bg-alt)]'}
                                                ${data.examDate === dateStr ? 'bg-[var(--cy-lime)] text-white font-bold' : ''}
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
                                className="mt-6 w-full py-3 border-2 border-[var(--cy-border)] rounded-xl text-[var(--cy-text-primary)] hover:border-[var(--cy-lime)] hover:bg-[var(--cy-bg-surface-hover)] transition-all font-medium"
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
                                    className={`p-5 rounded-xl border-2 text-left transition-all flex items-center gap-3 bg-[var(--cy-bg-surface)] hover:bg-[var(--cy-bg-surface-hover)] shadow-sm hover:shadow-md
                                        ${data.referralSource === option.id
                                            ? 'border-[var(--cy-lime)] bg-[var(--cy-lime-light)]'
                                            : 'border-[var(--cy-border)] hover:border-[var(--cy-lime)]'
                                        }`}
                                >
                                    <span className="text-2xl">{option.emoji}</span>
                                    <span className="font-medium text-[var(--cy-text-primary)]">{option.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

