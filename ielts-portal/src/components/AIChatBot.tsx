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


    // Dragging logic
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef<{ x: number, y: number } | null>(null);
    const dragStartTime = useRef<number>(0);

    // Initialize position on mount (optional, or just rely on CSS default until first drag)

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - (dragStartPos.current?.x || 0),
                    y: e.clientY - (dragStartPos.current?.y || 0)
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only allow primary button drag
        if (e.button !== 0) return;

        // e.preventDefault(); // Don't prevent default immediately, might block input focus if used elsewhere, but for button it's fine. 
        // Actually, preventing default might stop text selection which is good.
        // e.preventDefault();

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

        // Calculate offset from top-left of the element
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        // If this is the very first drag, and position is null, we need to respect the current CSS position
        // rect.left and rect.top ARE the current position.

        // We want subsequent mouse moves to set the Top/Left style.
        // newX = currentMouseX - offsetX
        // newY = currentMouseY - offsetY

        // But wait, our state `position` corresponds to the `top/left` styles we apply.
        // So offset needed is just the difference.

        dragStartPos.current = { x: offsetX, y: offsetY };
        dragStartTime.current = Date.now();

        // If we haven't set a manual position yet, capture the current computed position
        if (!position) {
            setPosition({ x: rect.left, y: rect.top });
        }

        setIsDragging(true);
    };

    const handleClick = (e: React.MouseEvent) => {
        // Prevent click if we dragged
        const dragDuration = Date.now() - dragStartTime.current;
        // Simple heuristic: if held down for > 200ms, assume drag/hold, but better to check distance.
        // Since we don't track start x/y for click, let's just rely on isDragging logic?
        // Actually, typical 'click' fires after mouseup.
        // We can just check drag duration implies intentional drag?
        // Or better: did we move?
        // Let's assume if the mouse didn't move much, it's a click.
        // Ideally we track moved distance.
        // For now, let's just allow click if drag was short or didn't move much (handled by the fact that if it moved, position updated)
        // A simple way:
        if (isDragging) {
            // e.stopPropagation(); // maybe?
        }
    };

    // Helper to determine if we should toggle on click
    const handleToggle = () => {
        // If a drag just happened (or is happening), don't toggle.
        // But handleMouseUp fires before click.
        // Let's track if we actually MOVED.
        // We can use a ref 'hasMoved' set in mouseMove.
    };

    // We need 'hasMoved' ref.
    const hasMoved = useRef(false);

    // Updated Effect
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                hasMoved.current = true;
                setPosition({
                    x: e.clientX - (dragStartPos.current?.x || 0),
                    y: e.clientY - (dragStartPos.current?.y || 0)
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const onMouseDown = (e: React.MouseEvent) => {
        hasMoved.current = false;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragStartPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        if (!position) {
            setPosition({ x: rect.left, y: rect.top });
        }
        setIsDragging(true);
    };

    const onButtonClick = () => {
        if (!hasMoved.current) {
            setIsOpen(true);
        }
    };

    // For the modal window (also draggable? maybe by header?)
    const onHeaderMouseDown = (e: React.MouseEvent) => {
        hasMoved.current = false;
        const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
        dragStartPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        if (!position) {
            setPosition({ x: rect.left, y: rect.top });
        }
        setIsDragging(true);
    };

    // Dynamic style
    const style = position ? { left: position.x, top: position.y, bottom: 'auto', right: 'auto' } : {};

    return (
        <>
            {/* Chat Bubble */}
            <button
                onMouseDown={onMouseDown}
                onClick={onButtonClick}
                style={style}
                className={`fixed z-50 w-14 h-14 bg-[#6FB63A] text-white rounded-full shadow-lg hover:bg-[#5FA030] transition-transform duration-300 flex items-center justify-center ${!position ? 'bottom-6 right-6' : ''} ${isOpen ? 'scale-0' : 'scale-100'} cursor-move`}
                aria-label="Open AI Chat"
            >
                <MessageCircle className="w-6 h-6" />
            </button>

            {/* Chat Modal */}
            <div
                style={style}
                className={`fixed z-50 w-[380px] max-w-[calc(100vw-48px)] h-[500px] max-h-[calc(100vh-100px)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-transform duration-300 ${!position ? 'bottom-6 right-6' : ''} ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
            >
                {/* Header - Draggable */}
                <div
                    onMouseDown={onHeaderMouseDown}
                    className="bg-[#0B1F3A] text-white p-4 flex items-center justify-between cursor-move"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#6FB63A] rounded-full flex items-center justify-center">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm">IELTS AI Assistant</h3>
                            <p className="text-xs text-gray-300">Ask me about IELTS prep!</p>
                        </div>
                    </div>
                    {/* Close button shouldn't trigger drag - handled by bubbling? stopPropagation on close click */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="text-gray-300 hover:text-white transition-colors"
                    >
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
