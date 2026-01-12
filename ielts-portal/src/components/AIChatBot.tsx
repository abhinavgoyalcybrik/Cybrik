'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot } from 'lucide-react';

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

You must REFUSE to answer questions about:
- Topics unrelated to IELTS or English learning
- General knowledge, news, or current events
- Personal opinions on non-IELTS matters
- Anything not directly related to IELTS preparation

If asked about unrelated topics, politely redirect the conversation back to IELTS preparation.

Keep responses concise, helpful, and encouraging. Use examples where helpful.`;

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

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
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
                                parts: [{ text: 'I understand. I am an IELTS AI Assistant for Cybrik IELTS. I will only help with IELTS-related topics and politely decline other requests. How can I help you with your IELTS preparation today?' }]
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

            // Better error handling
            if (!response.ok) {
                console.error('API Error:', data);
                throw new Error(data.error?.message || 'API request failed');
            }

            const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponse) {
                console.error('Unexpected response structure:', data);
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
            {/* Chat Bubble */}
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#6FB63A] text-white rounded-full shadow-lg hover:bg-[#5FA030] transition-all duration-300 flex items-center justify-center ${isOpen ? 'scale-0' : 'scale-100'}`}
                aria-label="Open AI Chat"
            >
                <MessageCircle className="w-6 h-6" />
            </button>

            {/* Chat Modal */}
            <div className={`fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] h-[500px] max-h-[calc(100vh-100px)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                {/* Header */}
                <div className="bg-[#0B1F3A] text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#6FB63A] rounded-full flex items-center justify-center">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm">IELTS AI Assistant</h3>
                            <p className="text-xs text-gray-300">Ask me about IELTS prep!</p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-gray-300 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-500 text-sm py-8">
                            <Bot className="w-12 h-12 mx-auto mb-3 text-[#6FB63A]" />
                            <p className="font-medium">Hi! I'm your IELTS AI Assistant.</p>
                            <p className="text-xs mt-1">Ask me anything about IELTS preparation!</p>
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-[#6FB63A] text-white rounded-br-md' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-2xl rounded-bl-md">
                                <Loader2 className="w-5 h-5 animate-spin text-[#6FB63A]" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-gray-200 bg-white">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about IELTS..."
                            className="flex-1 px-4 py-2.5 bg-gray-100 border-none rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#6FB63A]"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isLoading}
                            className="w-10 h-10 bg-[#6FB63A] text-white rounded-full flex items-center justify-center hover:bg-[#5FA030] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
