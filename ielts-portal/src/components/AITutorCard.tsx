import React from 'react';
import { MessageCircle } from 'lucide-react';

interface AITutorCardProps {
    type: 'writing' | 'speaking' | 'reading' | 'listening';
    overallBand?: number;
}

export default function AITutorCard({ type, overallBand }: AITutorCardProps) {
    const handleOpenChat = () => {
        window.dispatchEvent(new CustomEvent('open-ai-chat'));
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <button
                onClick={handleOpenChat}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group transform hover:-translate-y-0.5"
            >
                <div className="relative">
                    <MessageCircle className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 border-2 border-indigo-600 rounded-full animate-pulse"></span>
                </div>
                Ask AI Tutor
            </button>
            <p className="text-xs text-center text-slate-400 mt-2">
                Get instant feedback on your {type}
            </p>
        </div>
    );
}
