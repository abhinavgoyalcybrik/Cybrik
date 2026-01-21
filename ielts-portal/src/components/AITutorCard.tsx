import React from 'react';
import { MessageCircle, Bot, Sparkles } from 'lucide-react';

interface AITutorCardProps {
    type: 'writing' | 'speaking' | 'reading' | 'listening';
    overallBand?: number;
}

export default function AITutorCard({ type, overallBand }: AITutorCardProps) {
    const handleOpenChat = () => {
        window.dispatchEvent(new CustomEvent('open-ai-chat'));
    };

    const getContextMessage = () => {
        switch (type) {
            case 'writing':
                return "I can help you rewrite your essay to reach a Band 9.0!";
            case 'speaking':
                return "Let's practice your pronunciation and fluency together.";
            case 'reading':
            case 'listening':
                return "I can explain any answer and give you tips for next time.";
            default:
                return "I'm here to help you improve your IELTS score.";
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Header / Avatar Area */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 text-center border-b border-slate-50">
                <div className="w-20 h-20 bg-white rounded-full mx-auto shadow-sm flex items-center justify-center mb-3 relative">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full opacity-10 animate-pulse"></div>
                    <Bot className="w-10 h-10 text-indigo-600" />
                    <div className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 border-2 border-white rounded-full" title="Online"></div>
                </div>
                <h3 className="font-bold text-slate-900 text-lg">AI Personal Tutor</h3>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Always Online</p>
            </div>

            {/* Content Area */}
            <div className="p-6">
                <div className="bg-slate-50 rounded-xl p-4 mb-6 relative">
                    <div className="absolute -top-2 left-6 w-4 h-4 bg-slate-50 transform rotate-45 border-t border-l border-slate-100"></div> {/* Speech Bubble Triangle (fake) - refined below */}

                    <p className="text-sm text-slate-600 leading-relaxed italic">
                        "{getContextMessage()}"
                    </p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleOpenChat}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm shadow-indigo-200 transition-all flex items-center justify-center gap-2 group"
                    >
                        <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        Chat Now
                    </button>
                    <p className="text-xs text-center text-slate-400">
                        Ask about your <span className="font-medium text-slate-600">{type} test</span> results
                    </p>
                </div>
            </div>
        </div>
    );
}
