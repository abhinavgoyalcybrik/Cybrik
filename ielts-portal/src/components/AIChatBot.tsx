'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, History, Sparkles, ChevronRight, Minimize2 } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const SYSTEM_PROMPT = `You are an IELTS AI Assistant for Cybrik IELTS - an AI-powered IELTS preparation platform.

Your role is to help students ONLY with topics related to:
1. IELTS exam preparation (Writing, Speaking, Reading, Listening)
2. Band score criteria and assessment
3. Tips for improving IELTS scores
4. Questions about the Cybrik IELTS platform features
5. IELTS exam format, timing, and structure
6. Vocabulary and grammar relevant to IELTS

If asked about unrelated topics, politely redirect the conversation back to IELTS preparation.

Keep responses concise, helpful, and encouraging. Use examples where helpful.`;

const SUGGESTED_QUESTIONS = [
    "Give improvement tips",
    "Find my key mistakes",
    "Explain my score",
    "Help with ideas",
    "Rewrite for a higher band",
    "Paraphrase my introduction",
    "Suggest new vocabulary"
];

export default function AIChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const handleOpenChat = () => setIsOpen(true);
        window.addEventListener('open-ai-chat', handleOpenChat);
        return () => window.removeEventListener('open-ai-chat', handleOpenChat);
    }, []);

    const sendMessage = async (textOverride?: string) => {
        const textToSend = textOverride || input;
        if (!textToSend.trim() || isLoading) return;

        const userMessage = textToSend.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error('API key not configured');
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            {
                                role: 'user',
                                parts: [{ text: SYSTEM_PROMPT }]
                            },
                            {
                                role: 'model',
                                parts: [{ text: 'I understand. I am an IELTS AI Assistant for Cybrik IELTS. I will only help with IELTS-related topics. How can I help you today?' }]
                            },
                            ...messages.map(msg => ({
                                role: msg.role === 'user' ? 'user' : 'model',
                                parts: [{ text: msg.content }]
                            })),
                            {
                                role: 'user',
                                parts: [{ text: userMessage }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 1024,
                        }
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                console.error('API Error:', data);
                throw new Error(data.error?.message || 'API request failed');
            }

            const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponse) {
                throw new Error('Invalid response from AI');
            }

            setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
        } catch (error: any) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message || 'Please try again.'}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <>
            {/* Toggle Button (Visible when closed) - kept as backup/floating trigger if needed */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed z-50 bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center animate-bounce-slow"
                    aria-label="Open Personal AI Tutor"
                >
                    <Bot className="w-7 h-7" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
                </button>
            )}

            {/* Backdrop (Optional - for mobile or focus) */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Drawer */}
            <div
                className={`fixed top-0 right-0 z-50 h-[100dvh] w-full sm:w-[400px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-100 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Header */}
                <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-800">Personal AI Tutor</h2>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Online</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Chat History"
                        >
                            <History className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50">

                    {/* Welcome State */}
                    {messages.length === 0 && (
                        <div className="mt-8 text-center px-6">
                            <div className="w-20 h-20 bg-white rounded-full shadow-sm mx-auto mb-6 flex items-center justify-center relative">
                                <div className="absolute inset-0 bg-purple-100 rounded-full animate-ping opacity-20"></div>
                                <Bot className="w-10 h-10 text-purple-600" />
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg mb-2">How can I help you?</h3>
                            <p className="text-sm text-slate-500 leading-relaxed mb-8">
                                I've analyzed your test results. Ask me to explain your score, find mistakes, or help you practice!
                            </p>

                            <div className="space-y-2">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Suggested Questions</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {SUGGESTED_QUESTIONS.map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => sendMessage(q)}
                                            className="px-3 py-2 bg-white border border-slate-200 hover:border-purple-300 hover:text-purple-700 text-slate-600 text-xs font-medium rounded-lg transition-all shadow-sm hover:shadow-md active:scale-95"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Chat Messages */}
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                    ? 'bg-purple-600 text-white rounded-br-none'
                                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                                }`}>
                                {msg.role === 'assistant' && (
                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 opacity-70">
                                        <Bot className="w-3 h-3" />
                                        <span className="text-[10px] font-bold uppercase">AI Tutor</span>
                                    </div>
                                )}
                                <div className="markdown-prose whitespace-pre-wrap">
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                                <span className="text-xs font-medium text-slate-400">Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                    <div className="relative">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything about your results..."
                            rows={1}
                            className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all resize-none shadow-inner"
                            style={{ minHeight: '52px' }}
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || isLoading}
                            className="absolute right-2 top-2 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="mt-2 text-center">
                        <p className="text-[10px] text-slate-400">
                            AI can make mistakes. Double check important info.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
