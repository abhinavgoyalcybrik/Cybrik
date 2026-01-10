'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import apiFetch from '@/lib/api';
import { Card } from '@/components/ui/card';

interface AIAnalysis {
    applicant_info: {
        name: string;
        email: string;
        program_interest: string;
    };
    interest_level: 'high' | 'medium' | 'low';
    qualification_score: number;
    concerns: string[];
    documents_needed: string[];
    follow_up: {
        needed: boolean;
        timing: string;
        reason: string;
    };
    key_points: string[];
}

interface CallRecord {
    id: number;
    applicant: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
    } | null;
    ai_analyzed: boolean;
    ai_quality_score: number;
    ai_analysis_result: AIAnalysis;
    created_at: string;
    status: string;
}

export default function AIInsightsPage() {
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCalls();
    }, []);

    const fetchCalls = async () => {
        try {
            // Fetch calls that have been analyzed
            const response = await apiFetch('/api/calls/?ai_analyzed=true');
            setCalls(response.results || []);
        } catch (error) {
            console.error('Error fetching AI insights:', error);
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-500';
        if (score >= 50) return 'text-yellow-500';
        return 'text-red-500';
    };

    return (
        <div className="p-6 space-y-6 bg-[var(--cy-bg-page)] min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--cy-text-primary)]">AI Call Insights</h1>
                    <p className="text-[var(--cy-text-secondary)]">Real-time analysis of applicant conversations</p>
                </div>
                <button
                    onClick={fetchCalls}
                    className="px-4 py-2 bg-[var(--cy-navy)] text-white rounded-lg hover:bg-opacity-90 transition-colors"
                >
                    Refresh Data
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--cy-lime)]"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {calls.map((call) => (
                        <motion.div
                            key={call.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-xl shadow-sm border border-[var(--cy-border)] overflow-hidden hover:shadow-md transition-shadow"
                        >
                            <div className="p-5 border-b border-gray-100">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-[var(--cy-navy)]">
                                        {call.applicant ? `${call.applicant.first_name} ${call.applicant.last_name || ''}` : 'Unknown Applicant'}
                                    </h3>
                                    <span className={`font-bold text-lg ${getScoreColor(call.ai_quality_score)}`}>
                                        {call.ai_quality_score}/100
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500">
                                    {new Date(call.created_at).toLocaleDateString()} • {new Date(call.created_at).toLocaleTimeString()}
                                </p>
                            </div>

                            <div className="p-5 space-y-4">
                                {/* Interest Level */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-500">Interest:</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase
                    ${call.ai_analysis_result?.interest_level === 'high' ? 'bg-green-100 text-green-700' :
                                            call.ai_analysis_result?.interest_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'}`}>
                                        {call.ai_analysis_result?.interest_level || 'N/A'}
                                    </span>
                                </div>

                                {/* Key Insights */}
                                {call.ai_analysis_result?.concerns?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Concerns</p>
                                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                            {call.ai_analysis_result.concerns.slice(0, 2).map((concern, idx) => (
                                                <li key={idx} className="truncate">{concern}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Follow Up */}
                                {call.ai_analysis_result?.follow_up?.needed && (
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <p className="text-xs font-bold text-blue-600 uppercase mb-1">
                                            AI Recommendation
                                        </p>
                                        <p className="text-sm text-blue-800">
                                            {call.ai_analysis_result.follow_up.reason}
                                        </p>
                                        <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 font-medium">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Timing: {call.ai_analysis_result.follow_up.timing}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                                <button className="text-sm text-[var(--cy-navy)] font-medium hover:underline">
                                    View Full Transcript
                                </button>
                                <button className="px-3 py-1.5 bg-[var(--cy-lime)] text-[var(--cy-navy)] text-sm font-bold rounded-md hover:brightness-110 transition-all">
                                    Action
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
